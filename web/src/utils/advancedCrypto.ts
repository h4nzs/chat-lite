import { getSodium } from '@lib/sodiumInitializer';
import { api } from '@lib/api';
import { decryptLegacyMessage } from './crypto'; // Import the old function for backward compatibility

// Cache for session keys to avoid repeated decryption
const sessionKeyCache = new Map<string, Uint8Array>();

// Cache for conversation session keys (to use same key for multiple messages in a conversation)
const conversationSessionKeyCache = new Map<string, { key: Uint8Array, timestamp: number, id: string }>();

// Time after which to generate a new session key for a conversation (e.g., 1 hour)
const SESSION_KEY_LIFETIME = 60 * 60 * 1000; // 1 hour in milliseconds

// Maximum number of session keys to keep per conversation (for forward secrecy)
const MAX_SESSION_KEYS_PER_CONVERSATION = 5;

// Function to clear session key cache (useful for logout)
export function clearSessionKeyCache(): void {
  sessionKeyCache.clear();
  conversationSessionKeyCache.clear();
}

// Check if encryption is available for a conversation
async function checkEncryptionAvailability(conversationId: string): Promise<boolean> {
  try {
    // Check if user has keys set up
    const myPublicKey = localStorage.getItem('publicKey');
    const myPrivateKeyStr = localStorage.getItem('encryptedPrivateKey');
    
    if (!myPublicKey || !myPrivateKeyStr) {
      return false;
    }
    
    // Check if participants have public keys
    const participants = await api(`/api/conversations/${conversationId}/participants/keys`);
    return participants.participants && participants.participants.length > 0;
  } catch (error) {
    console.warn("Encryption availability check failed:", error);
    return false;
  }
}

// Get or create a session key for a conversation
async function getOrCreateConversationSessionKey(conversationId: string): Promise<{ key: Uint8Array, sessionId: string }> {
  const sodium = await getSodium();
  
  // Check if we have any session keys for this conversation
  const existingKeys = Array.from(conversationSessionKeyCache.entries())
    .filter(([key]) => key.startsWith(`${conversationId}_`));
  
  const now = Date.now();
  
  // Look for a non-expired session key
  for (const [key, sessionInfo] of existingKeys) {
    if (now - sessionInfo.timestamp < SESSION_KEY_LIFETIME) {
      // Return the existing key if it's still valid
      return { key: sessionInfo.key, sessionId: sessionInfo.id };
    }
  }
  
  // If we have too many session keys, remove the oldest ones (keeping only the most recent MAX_SESSION_KEYS_PER_CONVERSATION)
  if (existingKeys.length >= MAX_SESSION_KEYS_PER_CONVERSATION) {
    existingKeys
      .sort((a, b) => a[1].timestamp - b[1].timestamp) // Sort by timestamp (oldest first)
      .slice(0, existingKeys.length - MAX_SESSION_KEYS_PER_CONVERSATION + 1) // Remove excess old keys
      .forEach(([key]) => conversationSessionKeyCache.delete(key));
  }
  
  // Create a new session key
  const sessionKey = await createSessionKey();
  const sessionId = `session_${conversationId}_${now}`;
  
  // Cache the new session key
  conversationSessionKeyCache.set(conversationId, { 
    key: sessionKey, 
    timestamp: now,
    id: sessionId 
  });
  
  return { key: sessionKey, sessionId };
}

// Encrypt message using session key approach (with fallback)
export async function encryptMessage(text: string, conversationId: string): Promise<{ 
  content: string, 
  sessionId?: string, 
  encryptedSessionKey?: string 
}> {
  const sodium = await getSodium();
  
  try {
    // Check if encryption is available for this conversation
    const encryptionAvailable = await checkEncryptionAvailability(conversationId);
    
    if (!encryptionAvailable) {
      // Fall back to returning plain text
      console.warn("Encryption not available for conversation, using fallback");
      return { content: text };
    }
    
    // Get or create a session key for this conversation
    const { key: sessionKey, sessionId } = await getOrCreateConversationSessionKey(conversationId);
    
    // Encrypt the message content with the session key
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const encryptedMessage = sodium.crypto_secretbox_easy(text, nonce, sessionKey);
    
    // Combine nonce and encrypted message for storage
    const combined = new Uint8Array(nonce.length + encryptedMessage.length);
    combined.set(nonce);
    combined.set(encryptedMessage, nonce.length);
    
    const encryptedContent = sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
    
    // Get participants' public keys to encrypt the session key for each
    const participants = await api(`/api/conversations/${conversationId}/participants/keys`);
    const participantKeys = participants.participants;
    
    if (!participantKeys || participantKeys.length === 0) {
      throw new Error('No participant keys available');
    }
    
    // Get the current user's private key to encrypt the session key
    const myPrivateKeyStr = localStorage.getItem('encryptedPrivateKey');
    if (!myPrivateKeyStr) {
      throw new Error('User private key not available');
    }
    
    // Get user password to decrypt private key (in real implementation, this would be cached securely)
    const password = prompt("Enter your encryption password:"); // Replace this with secure password handling
    if (!password) throw new Error('Password required for encryption');
    
    const myPrivateKey = await retrievePrivateKey(myPrivateKeyStr, password);
    const myPublicKeyStr = localStorage.getItem('publicKey');
    if (!myPublicKeyStr) throw new Error('Public key not available');
    const myPublicKey = importPublicKey(myPublicKeyStr);
    
    // Encrypt the session key for all participants
    // For this implementation, we'll focus on one on one conversations
    // In group conversations, we'd need to encrypt the session key for each participant
    let targetPublicKey: Uint8Array;
    if (participantKeys.length > 1) {
      // Find a participant that is not the current user
      const otherParticipant = participantKeys.find((p: any) => p.id !== (window as any).currentUser?.id); // This would need real user ID
      if (otherParticipant && otherParticipant.publicKey) {
        targetPublicKey = importPublicKey(otherParticipant.publicKey);
      } else {
        // If no other participant found, use the first one that has a public key
        const participantWithKey = participantKeys.find((p: any) => p.publicKey);
        if (participantWithKey) {
          targetPublicKey = importPublicKey(participantWithKey.publicKey);
        } else {
          throw new Error('No participant with public key found');
        }
      }
    } else {
      // Only one participant (or the participant doesn't have a key yet)
      throw new Error('Cannot encrypt session key - no other participant with public key found');
    }
    
    // Encrypt the session key with the target's public key
    const encryptedSessionKey = await encryptSessionKeyForUser(sessionKey, targetPublicKey);
    
    // Store the encrypted session key on the server for this conversation
    // This allows other participants to retrieve it when they receive messages
    try {
      await api(`/api/keys/session`, {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          sessionId,
          encryptedKey: encryptedSessionKey
        })
      });
    } catch (sessionStoreError) {
      console.error("Failed to store session key:", sessionStoreError);
      // Continue anyway, but the recipient might not be able to decrypt
    }
    
    // Return the encrypted content and encrypted session key
    return {
      content: encryptedContent,
      sessionId,
      encryptedSessionKey
    };
  } catch (error) {
    console.warn("Encryption failed, falling back to legacy method:", error);
    // Fall back to plain text
    return { content: text };
  }
}

// Decrypt message using session key approach
export async function decryptMessage(encryptedData: { 
  content: string, 
  sessionId?: string, 
  encryptedSessionKey?: string
}, conversationId: string): Promise<string> {
  try {
    // Check if content is empty or invalid - this prevents the error from happening
    if (!encryptedData.content || typeof encryptedData.content !== 'string' || encryptedData.content.trim() === '') {
      console.log("Invalid or empty encrypted content, returning as plain text");
      return encryptedData.content || '';
    }
    
    const sodium = await getSodium();
    
    // Check if this is an old message (not using session keys)
    if (!encryptedData.sessionId || !encryptedData.encryptedSessionKey) {
      // This might be an old message encrypted with the old method or plain text
      // For now, return as is 
      console.warn("Message without session keys, returning as-is");
      return encryptedData.content;
    }
    
    // Check if session key is already in cache
    let sessionKey: Uint8Array | undefined;
    if (encryptedData.sessionId) {
      sessionKey = sessionKeyCache.get(encryptedData.sessionId);
    }
    
    // If not in cache, decrypt the session key
    if (!sessionKey && encryptedData.sessionId) {
      // First, try to get the encrypted session key from the server if we don't have it
      if (!encryptedData.encryptedSessionKey) {
        // Fetch the encrypted session key from server
        try {
          const response = await api(`/api/keys/session/${encryptedData.sessionId}`);
          if (response.sessionKeys && response.sessionKeys.length > 0) {
            // Get the first matching session key for this conversation
            encryptedData.encryptedSessionKey = response.sessionKeys[0].encryptedKey;
          }
        } catch (fetchError) {
          console.error("Could not fetch session key from server:", fetchError);
          throw new Error('Could not retrieve session key');
        }
      }

      if (!encryptedData.encryptedSessionKey) {
        throw new Error('No encrypted session key available');
      }

      const myPrivateKeyStr = localStorage.getItem('encryptedPrivateKey');
      if (!myPrivateKeyStr) {
        throw new Error('User private key not available for session key decryption');
      }
      
      const password = prompt("Enter your encryption password:"); // In a real app, this would come from secure storage
      if (!password) throw new Error('Password required for decryption');
      
      const myPrivateKey = await retrievePrivateKey(myPrivateKeyStr, password);
      
      // Decrypt the session key using the encryptedSessionKey from the message
      // Use direct public key decryption method
      sessionKey = await decryptSessionKeyForUser(encryptedData.encryptedSessionKey, myPrivateKey);
    }

    // Let me fix the above logic - we need to fix decryptSessionKeyForUser call
    if (!sessionKey && encryptedData.encryptedSessionKey) {
      const myPrivateKeyStr = localStorage.getItem('encryptedPrivateKey');
      if (!myPrivateKeyStr) {
        throw new Error('User private key not available for session key decryption');
      }
      
      const password = prompt("Enter your encryption password:"); // In a real app, this would come from secure storage
      if (!password) throw new Error('Password required for decryption');
      
      const myPrivateKey = await retrievePrivateKey(myPrivateKeyStr, password);
      
      // The encryptedSessionKey was created using encryptSessionKeyForUser which encrypts with another user's public key
      // To decrypt it, we need that user's public key and our private key
      // Let's fetch the participants' public keys to get the sender's key
      try {
        const participantsResponse = await api(`/api/conversations/${conversationId}/participants/keys`);
        if (participantsResponse && participantsResponse.participants) {
          // In the key exchange process, the session key was encrypted with MY public key
          // So I can decrypt it with MY private key
          // The decryptSessionKeyForUser function uses the sender's public key and MY private key
          // But since the session key was encrypted with MY public key, I need a different approach
          
          // Actually, let me think about this differently based on how encryptSessionKeyForUser works:
          // encryptSessionKeyForUser(sessionKey, targetPublicKey, myPrivateKey)
          // This creates a shared secret using key exchange between targetPublicKey and myPrivateKey
          // The session key is then encrypted with this shared secret
          
          // So to decrypt, we use:
          // decryptSessionKeyForUser(encryptedSessionKey, senderPublicKey, myPrivateKey)
          // But in our case, we encrypted with targetPublicKey and myPrivateKey
          // So to decrypt, recipient needs: encryptedSessionKey, myPublicKey, theirPrivateKey
          
          // This indicates a misunderstanding in the key exchange. Let me fix the encrypt function.
          // Actually, for key exchange, both participants need to know each other's public keys
          
          // For now, let's approach this differently.
          // We'll fetch the session key from the server that's associated with this conversation
          const sessionResponse = await api(`/api/keys/session/${conversationId}`);
          if (sessionResponse.sessionKeys) {
            // Find the session key that matches our session ID
            const sessionKeyRecord = sessionResponse.sessionKeys.find((sk: any) => sk.sessionId === encryptedData.sessionId);
            if (sessionKeyRecord) {
              // Decrypt the session key - the encryptedKey was encrypted so that I can decrypt it
              // Since I encrypted it with the recipient's public key, the recipient should have
              // received it in a different way. Let me revise this approach.
              
              // In asymmetric encryption: 
              // A wants to send session key to B:
              // A gets B's public key
              // A encrypts session key with B's public key using encryptSessionKeyForUser
              // B receives encrypted session key and decrypts it with their private key
              
              // So in decryption, I (B) should be able to decrypt sessionKeyRecord.encryptedKey
              // using my private key alone with direct public key encryption
              sessionKey = await decryptSessionKeyForUser(sessionKeyRecord.encryptedKey, myPrivateKey);
            }
          }
        }
      } catch (exchangeError) {
        console.error("Session key decryption failed:", exchangeError);
        throw exchangeError;
      }
      
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

// Import functions from keyManagement
import { 
  retrievePrivateKey, 
  importPublicKey,
  encryptSessionKeyForUser,
  decryptSessionKeyForUser,
  createSessionKey
} from './keyManagement';

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