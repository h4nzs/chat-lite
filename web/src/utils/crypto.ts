import { getSodium, initializeSodium } from '@lib/sodiumInitializer'
import { useAuthStore } from '@store/auth'

// Cache for derived keys to avoid recomputation
const keyCache = new Map<string, Uint8Array>()

// Function to clear key cache (useful for logout)
export function clearKeyCache(): void {
  keyCache.clear()
}

// Generate a deterministic key for a conversation based on conversation ID only
async function generateConversationKey(conversationId: string): Promise<Uint8Array> {
  const sodium = await getSodium()
  
  // Check cache first
  const cacheKey = `${conversationId}`
  if (keyCache.has(cacheKey)) {
    console.log("Using cached key for conversation:", conversationId); // Debug log
    return keyCache.get(cacheKey)!
  }
  
  // Create a deterministic key based on conversation ID only
  // This ensures both sender and receiver use the same key
  const keyMaterial = `${conversationId}`
  
  // Use crypto_generichash to derive a key from the key material
  const derivedKey = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    keyMaterial,
    'chat-lite-key-derivation-salt'
  )
  
  console.log("Generated new key for conversation:", { conversationId, keyMaterial, derivedKey }); // Debug log
  
  // Cache the key
  keyCache.set(cacheKey, derivedKey)
  
  return derivedKey
}

// Encrypt message with libsodium
export async function encryptMessage(text: string, conversationId: string): Promise<string> {
  console.log("=== ENCRYPT MESSAGE ===");
  console.log("Input text:", text);
  console.log("Conversation ID:", conversationId);
  const sodium = await getSodium()
  const key = await generateConversationKey(conversationId)
  console.log("Generated key (base64):", sodium.to_base64(key, sodium.base64_variants.ORIGINAL));
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  console.log("Generated nonce (base64):", sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL));
  const encrypted = sodium.crypto_secretbox_easy(text, nonce, key)
  console.log("Encrypted data (base64):", sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL));
  
  // Combine nonce and encrypted data for storage
  const combined = new Uint8Array(nonce.length + encrypted.length)
  combined.set(nonce)
  combined.set(encrypted, nonce.length)
  console.log("Combined data (base64):", sodium.to_base64(combined, sodium.base64_variants.ORIGINAL));
  
  // Return as base64 string
  const result = sodium.to_base64(combined, sodium.base64_variants.ORIGINAL)
  console.log("Final encrypted result:", result);
  console.log("=== END ENCRYPT MESSAGE ===");
  return result
}

// Decrypt message with libsodium
export async function decryptMessage(cipher: string, conversationId: string): Promise<string> {
  console.log("=== DECRYPT MESSAGE ===");
  console.log("Input cipher:", cipher);
  console.log("Conversation ID:", conversationId);
  try {
    // Check if cipher is valid and not empty
    if (!cipher || typeof cipher !== 'string' || cipher.trim() === '') {
      console.log("Empty or invalid cipher, returning as-is");
      console.log("=== END DECRYPT MESSAGE (empty/invalid) ===");
      return cipher || '';
    }
    
    // Check if cipher looks like base64 (basic check: length multiple of 4 and valid base64 characters)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cipher) || cipher.length % 4 !== 0) {
      // If it's not valid base64, return as plain text
      console.log("Cipher is not valid base64, returning as plain text:", cipher);
      console.log("=== END DECRYPT MESSAGE (plain text) ===");
      return cipher;
    }
    
    const sodium = await getSodium();
    
    // Try to decode as base64
    let combined: Uint8Array;
    try {
      combined = sodium.from_base64(cipher, sodium.base64_variants.ORIGINAL);
    } catch (decodeError) {
      console.log("Cannot decode as base64, returning as plain text:", cipher);
      console.log("=== END DECRYPT MESSAGE (plain text) ===");
      return cipher;
    }
    
    // Check if combined data is valid for decryption
    if (combined.length <= sodium.crypto_secretbox_NONCEBYTES) {
      console.log("Invalid cipher length, returning as plain text:", cipher);
      console.log("=== END DECRYPT MESSAGE (plain text) ===");
      return cipher;
    }
    
    // Generate the conversation key
    const key = await generateConversationKey(conversationId);
    
    // Extract nonce and encrypted data
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
    
    // Decrypt
    const decrypted = sodium.crypto_secretbox_open_easy(encrypted, nonce, key);
    const result = sodium.to_string(decrypted);
    
    console.log("Decrypted result:", result);
    console.log("=== END DECRYPT MESSAGE (success) ===");
    return result;
  } catch (error) {
    console.error('Decryption failed:', error);
    console.log("=== END DECRYPT MESSAGE (failed) ===");
    
    // Return a more specific error message, but also check if cipher itself is valid to return
    if (error instanceof Error) {
      if (error.message.includes('incorrect key') || error.message.includes('bad message authentication tag')) {
        return '[Failed to decrypt: Invalid key]';
      } else if (error.message.includes('incomplete input')) {
        return '[Failed to decrypt: Incomplete data]';
      }
    }
    
    // If the error is because the content is not encrypted, return it as is
    // This handles cases where the content is plain text that doesn't need decryption
    return cipher || '[Failed to decrypt: Message may be corrupted]';
  }
}

// For backward compatibility with existing messages encrypted with crypto-js
import CryptoJS from "crypto-js"

const LEGACY_SECRET_KEY = (import.meta.env.VITE_CHAT_SECRET as string) || ""

export function decryptLegacyMessage(cipher: string): string {
  try {
    // If no secret key is provided, we can't decrypt legacy messages
    if (!LEGACY_SECRET_KEY) {
      return "[Decryption key not available]"
    }
    const bytes = CryptoJS.AES.decrypt(cipher, LEGACY_SECRET_KEY)
    return bytes.toString(CryptoJS.enc.Utf8) || "[Failed to decrypt]"
  } catch {
    return "[Invalid encrypted message]"
  }
}