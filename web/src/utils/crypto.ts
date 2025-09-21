import sodium from 'libsodium-wrappers'
import { useAuthStore } from '@store/auth'

// Cache for derived keys to avoid recomputation
const keyCache = new Map<string, Uint8Array>()

// Function to clear key cache (useful for logout)
export function clearKeyCache(): void {
  keyCache.clear()
}

// Generate a deterministic key for a conversation based on conversation ID only
async function generateConversationKey(conversationId: string): Promise<Uint8Array> {
  await sodium.ready
  
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
  await sodium.ready
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
    // Check if cipher is valid
    if (!cipher || typeof cipher !== 'string') {
      throw new Error('Invalid cipher text');
    }
    
    // Cek apakah cipher adalah pesan teks biasa (tidak dienkripsi)
    // Jika cipher tidak berupa base64 yang valid, asumsikan itu adalah teks biasa
    try {
      sodium.from_base64(cipher, sodium.base64_variants.ORIGINAL);
    } catch {
      // Jika tidak bisa di-decode sebagai base64, asumsikan itu adalah teks biasa
      console.log("Returning plain text:", cipher);
      console.log("=== END DECRYPT MESSAGE (plain text) ===");
      return cipher;
    }
    
    await sodium.ready;
    const key = await generateConversationKey(conversationId);
    console.log("Generated key (base64):", sodium.to_base64(key, sodium.base64_variants.ORIGINAL));
    const combined = sodium.from_base64(cipher, sodium.base64_variants.ORIGINAL);
    console.log("Decoded combined data (base64):", sodium.to_base64(combined, sodium.base64_variants.ORIGINAL));
    
    // Check if combined data is valid
    if (combined.length <= sodium.crypto_secretbox_NONCEBYTES) {
      throw new Error('Incomplete input data');
    }
    
    // Extract nonce and encrypted data
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
    console.log("Extracted nonce (base64):", sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL));
    console.log("Extracted encrypted data (base64):", sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL));
    
    // Decrypt
    const decrypted = sodium.crypto_secretbox_open_easy(encrypted, nonce, key);
    const result = sodium.to_string(decrypted);
    console.log("Decrypted result:", result);
    console.log("=== END DECRYPT MESSAGE (success) ===");
    return result;
  } catch (error) {
    console.error('Decryption failed:', error);
    console.log("=== END DECRYPT MESSAGE (failed) ===");
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