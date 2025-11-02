
import { getSodium } from '@lib/sodiumInitializer';
import { api } from '@lib/api';
import { retrievePrivateKey, decryptSessionKeyForUser } from '@utils/keyManagement';
import { useModalStore } from '@store/modal';

// --- Key Cache ---
const sessionKeyCache = new Map<string, Uint8Array>();
const MAX_CACHE_SIZE = 100;
let userPublicKey: Uint8Array | null = null;
let userPrivateKey: Uint8Array | null = null;

export function clearKeyCache(): void {
  sessionKeyCache.clear();
  userPrivateKey = null;
}

function cleanupCacheIfNeeded(): void {
  if (sessionKeyCache.size > MAX_CACHE_SIZE) {
    const firstKey = sessionKeyCache.keys().next().value;
    sessionKeyCache.delete(firstKey);
  }
}

// --- Password & Private Key Management ---

// This function is a placeholder for a secure password retrieval mechanism (e.g., a session-scoped cache or a modal).
async function getPassword(): Promise<string> {
  return new Promise((resolve, reject) => {
    useModalStore.getState().showPasswordPrompt(
      (password) => {
        if (password) {
          resolve(password);
        } else {
          reject(new Error("Password not provided."));
        }
      }
    );
  });
}

async function getMyKeyPair(): Promise<{ publicKey: Uint8Array, privateKey: Uint8Array }> {
  if (userPrivateKey && userPublicKey) {
    return { publicKey: userPublicKey, privateKey: userPrivateKey };
  }

  const password = await getPassword();
  const encryptedKey = localStorage.getItem('encryptedPrivateKey');
  const publicKeyB64 = localStorage.getItem('publicKey');

  if (!encryptedKey || !publicKeyB64) {
    throw new Error("Encryption keys not found in storage.");
  }

  const privateKey = await retrievePrivateKey(encryptedKey, password);
  if (!privateKey) {
    throw new Error("Incorrect password. Failed to decrypt private key.");
  }

  const sodium = await getSodium();
  const publicKey = sodium.from_base64(publicKeyB64, sodium.base64_variants.ORIGINAL);

  userPrivateKey = privateKey;
  userPublicKey = publicKey;
  
  return { publicKey, privateKey };
}

// --- Session Key Retrieval ---

async function getSessionKey(conversationId: string): Promise<Uint8Array> {
  if (sessionKeyCache.has(conversationId)) {
    return sessionKeyCache.get(conversationId)!;
  }

  cleanupCacheIfNeeded();

  try {
    // 1. Fetch the encrypted session key from the server
    const { encryptedKey } = await api<{ encryptedKey: string }>(`/api/session-keys/${conversationId}`);

    // 2. Get the user's key pair (this may prompt for a password)
    const { publicKey, privateKey } = await getMyKeyPair();

    // 3. Decrypt the session key
    const sodium = await getSodium();
    const sessionKey = await decryptSessionKeyForUser(encryptedKey, publicKey, privateKey, sodium);
    
    // 4. Cache and return the decrypted key
    sessionKeyCache.set(conversationId, sessionKey);
    return sessionKey;

  } catch (error) {
    console.error(`Failed to get or decrypt session key for conversation ${conversationId}:`, error);
    throw new Error("Could not establish secure session.");
  }
}

// --- Message Encryption/Decryption ---

export async function encryptMessage(text: string, conversationId: string): Promise<string> {
  if (!text) return '';
  
  const sodium = await getSodium();
  const key = await getSessionKey(conversationId);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const encrypted = sodium.crypto_secretbox_easy(text, nonce, key);

  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);

  return sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
}

export async function decryptMessage(cipher: string, conversationId: string): Promise<string> {
  if (!cipher || typeof cipher !== 'string' || cipher.trim() === '') {
    return '';
  }

  const sodium = await getSodium();
  
  // Heuristic to check if the content is actually encrypted (Base64)
  // This avoids trying to decrypt plain text messages from before E2EE was enabled.
  const isLikelyEncrypted = (cipher.length > 32 && (cipher.endsWith('=') || cipher.endsWith('==') || /^[A-Za-z0-9+/]+$/.test(cipher.slice(0, -2))));
  if (!isLikelyEncrypted) {
    return cipher; // Return as plain text
  }

  try {
    const combined = sodium.from_base64(cipher, sodium.base64_variants.ORIGINAL);
    
    if (combined.length <= sodium.crypto_secretbox_NONCEBYTES) {
      return '[Invalid Encrypted Data]';
    }

    const key = await getSessionKey(conversationId);
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = combined.slice(sodium.crypto_secretbox_NONCEBYTES);

    const decrypted = sodium.crypto_secretbox_open_easy(encrypted, nonce, key);
    return sodium.to_string(decrypted);

  } catch (error) {
    console.error(`Decryption failed for conversation ${conversationId}:`, error);
    return '[Failed to decrypt message]';
  }
}
