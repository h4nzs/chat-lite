import sodium from 'libsodium-wrappers';
import { api } from '@lib/api';
import { decryptLegacyMessage } from './crypto'; // Import the old function for backward compatibility
import { 
  retrievePrivateKey, 
  importPublicKey,
  encryptSessionKeyWithPublicKey,
  decryptSessionKeyWithPrivateKey
} from './keyManagement';

// Cache for session keys to avoid repeated decryption
const sessionKeyCache = new Map<string, Uint8Array>();

// Encrypt message using session key approach
export async function encryptMessage(text: string, conversationId: string): Promise<{ 
  content: string, 
  sessionId: string, 
  encryptedSessionKey: string 
}> {
  await sodium.ready;
  
  // Fetch participants' public keys for this conversation
  const participants = await api(`/api/conversations/${conversationId}/participants/keys`);
  const myPublicKey = localStorage.getItem('publicKey');
  const myPrivateKeyStr = localStorage.getItem('encryptedPrivateKey');
  
  if (!myPublicKey || !myPrivateKeyStr) {
    throw new Error('User keys not available. Please set up your encryption keys.');
  }
  
  // Create a new session key
  const sessionKey = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
  const sessionId = sodium.to_base64(sodium.randombytes_buf(16), sodium.base64_variants.ORIGINAL);
  
  // Get user's private key
  const password = prompt("Enter your encryption password:"); // In a real app, this would come from secure storage
  if (!password) throw new Error('Password required for decryption');
  
  const myPrivateKey = await retrievePrivateKey(myPrivateKeyStr, password);
  
  // Encrypt the message content with the session key
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const encryptedMessage = sodium.crypto_secretbox_easy(text, nonce, sessionKey);
  
  // Combine nonce and encrypted message
  const combined = new Uint8Array(nonce.length + encryptedMessage.length);
  combined.set(nonce, 0);
  combined.set(encryptedMessage, nonce.length);
  
  const encryptedContent = sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
  
  // Encrypt the session key with the user's public key using crypto_box_seal
  const userPublicKey = importPublicKey(myPublicKey);
  const encryptedSessionKey = sodium.crypto_box_seal(sessionKey, userPublicKey);
  const encryptedSessionKeyStr = sodium.to_base64(encryptedSessionKey, sodium.base64_variants.ORIGINAL);
  
  // Cache the session key for immediate use
  sessionKeyCache.set(sessionId, sessionKey);
  
  return {
    content: encryptedContent,
    sessionId,
    encryptedSessionKey: encryptedSessionKeyStr
  };
}

// Decrypt message using session key approach
export async function decryptMessage(encryptedData: { 
  content: string, 
  sessionId?: string, 
  encryptedSessionKey?: string
}): Promise<string> {
  try {
    await sodium.ready;
    
    // Check if this is an old message (not using session keys)
    if (!encryptedData.sessionId || !encryptedData.encryptedSessionKey) {
      // This might be an old message encrypted with the old method
      // For now, return as is but in real implementation we'd use decryptLegacyMessage
      console.warn("This appears to be an old message format");
      return encryptedData.content; // This should eventually call the legacy decrypt function
    }
    
    // Check if session key is already in cache
    let sessionKey: Uint8Array | undefined;
    if (encryptedData.sessionId) {
      sessionKey = sessionKeyCache.get(encryptedData.sessionId);
    }
    
    // If not in cache, decrypt the session key
    if (!sessionKey && encryptedData.encryptedSessionKey) {
      const myPrivateKeyStr = localStorage.getItem('encryptedPrivateKey');
      if (!myPrivateKeyStr) {
        throw new Error('User private key not available for session key decryption');
      }
      
      const password = prompt("Enter your encryption password:"); // In a real app, this would come from secure storage
      if (!password) throw new Error('Password required for decryption');
      
      const myPrivateKey = await retrievePrivateKey(myPrivateKeyStr, password);
      
      // Decrypt the session key
      const encryptedSessionKey = sodium.from_base64(encryptedData.encryptedSessionKey, sodium.base64_variants.ORIGINAL);
      const myPublicKey = sodium.crypto_scalarmult_base(myPrivateKey);
      sessionKey = sodium.crypto_box_seal_open(encryptedSessionKey, myPublicKey, myPrivateKey);
      
      // Cache for future use in this session
      if (encryptedData.sessionId) {
        sessionKeyCache.set(encryptedData.sessionId, sessionKey);
      }
    }
    
    if (!sessionKey) {
      throw new Error('Unable to obtain session key for decryption');
    }
    
    // Parse the encrypted content
    const combined = sodium.from_base64(encryptedData.content, sodium.base64_variants.ORIGINAL);
    
    // Extract nonce and encrypted message
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const encryptedMessage = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
    
    // Decrypt the message content
    const decryptedBytes = sodium.crypto_secretbox_open_easy(encryptedMessage, nonce, sessionKey);
    
    return sodium.to_string(decryptedBytes);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return a more specific error message
    if (error instanceof Error) {
      if (error.message.includes('incorrect key')) {
        return '[Failed to decrypt: Invalid key]';
      } else if (error.message.includes('incomplete input')) {
        return '[Failed to decrypt: Incomplete data]';
      }
    }
    return '[Failed to decrypt: Message may be corrupted]';
  }
}

// Function to clear session key cache (useful for logout)
export function clearSessionKeyCache(): void {
  sessionKeyCache.clear();
}

// For backward compatibility with existing messages encrypted with crypto-js
const LEGACY_SECRET_KEY = (import.meta.env.VITE_CHAT_SECRET as string) || "";

export function decryptLegacyMessageWithSession(cipher: string): string {
  try {
    // If no secret key is provided, we can't decrypt legacy messages
    if (!LEGACY_SECRET_KEY) {
      return "[Decryption key not available]";
    }
    // This would use the original crypto-js decryption method
    return decryptLegacyMessage(cipher);
  } catch {
    return "[Invalid encrypted message]";
  }
}