import { getSodium } from '@lib/sodiumInitializer';
import { api } from '@lib/api';
import { retrievePrivateKey, decryptSessionKeyForUser } from '@utils/keyManagement';
import { useModalStore } from '@store/modal';
import {
  addSessionKey,
  getSessionKey as getKeyFromDb,
  getLatestSessionKey,
  clearAllKeys as clearKeychainDb,
} from '@lib/keychainDb';

// --- User Private Key Cache (in-memory for one session) ---
let userPublicKey: Uint8Array | null = null;
let userPrivateKey: Uint8Array | null = null;

// --- Ratchet Tracker (in-memory for one session) ---
// This ensures we only ratchet once per conversation per app session.
const ratchetedConversations = new Set<string>();

export function clearKeyCache(): void {
  userPublicKey = null;
  userPrivateKey = null;
  ratchetedConversations.clear();
  // clearKeychainDb(); // Clear the IndexedDB keychain on logout - REMOVED
}

// --- Password & Private Key Management ---
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

async function getMyKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
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

// --- Session Ratcheting and Key Retrieval ---

/**
 * Ensures a session is established and up-to-date for a conversation.
 * If it's a new app session for this convo, it ratchets a new key.
 */
export async function ensureAndRatchetSession(conversationId: string): Promise<void> {
  if (ratchetedConversations.has(conversationId)) {
    return; // Already ratcheted in this app session
  }

  try {
    console.log(`Ratcheting session for conversation ${conversationId}...`);
    const { sessionId, encryptedKey } = await api<{ sessionId: string; encryptedKey: string }>(
      `/api/session-keys/${conversationId}/ratchet`,
      { method: 'POST' }
    );

    if (!sessionId || !encryptedKey) {
      throw new Error('Invalid response from ratchet endpoint.');
    }

    const { publicKey, privateKey } = await getMyKeyPair();
    const sodium = await getSodium();
    const newSessionKey = await decryptSessionKeyForUser(encryptedKey, publicKey, privateKey, sodium);

    await addSessionKey(conversationId, sessionId, newSessionKey);
    ratchetedConversations.add(conversationId);
    console.log(`Successfully ratcheted and stored new session key ${sessionId} for ${conversationId}`);
  } catch (error) {
    console.error(`Failed to ratchet session for ${conversationId}:`, error);
    throw new Error('Could not establish a secure session.');
  }
}

// --- Message Encryption/Decryption ---

export async function encryptMessage(
  text: string,
  conversationId: string
): Promise<{ ciphertext: string; sessionId: string }> {
  if (!text) {
    throw new Error('Cannot encrypt empty text.');
  }

  const latestKey = await getLatestSessionKey(conversationId);
  if (!latestKey) {
    // This should ideally not happen if ensureAndRatchetSession is called first.
    throw new Error('No session key available for encryption. Please re-open the conversation.');
  }

  const { sessionId, key } = latestKey;
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const encrypted = sodium.crypto_secretbox_easy(text, nonce, key);

  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);

  const ciphertext = sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
  return { ciphertext, sessionId };
}

export async function decryptMessage(
  cipher: string,
  conversationId: string,
  sessionId: string | null | undefined
): Promise<string> {
  if (!cipher || typeof cipher !== 'string' || cipher.trim() === '') {
    return '';
  }
  
  if (!sessionId) {
    // This is likely an old message from before the ratcheting system was implemented.
    return '[Message from an old session, cannot be decrypted]';
  }

  const sodium = await getSodium();
  const key = await getKeyFromDb(conversationId, sessionId);

  if (!key) {
    // We don't have the key for this session. This can happen if the user
    // cleared their storage or is on a new device.
    return '[Decryption key not found for this message]';
  }

  try {
    const combined = sodium.from_base64(cipher, sodium.base64_variants.ORIGINAL);
    if (combined.length <= sodium.crypto_secretbox_NONCEBYTES) {
      return '[Invalid Encrypted Data]';
    }

    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = combined.slice(sodium.crypto_secretbox_NONCEBYTES);

    const decrypted = sodium.crypto_secretbox_open_easy(encrypted, nonce, key);
    return sodium.to_string(decrypted);
  } catch (error) {
    console.error(`Decryption failed for convo ${conversationId}, session ${sessionId}:`, error);
    return '[Failed to decrypt message]';
  }
}