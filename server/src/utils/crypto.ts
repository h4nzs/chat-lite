import sodium from 'libsodium-wrappers'
import { env } from '../config.js'

// Cache for derived keys to avoid recomputation
const keyCache = new Map<string, Uint8Array>()

// Generate a deterministic key for a conversation based on conversation ID only
async function generateConversationKey(conversationId: string): Promise<Uint8Array> {
  await sodium.ready
  
  // Check cache first
  const cacheKey = `${conversationId}`
  if (keyCache.has(cacheKey)) {
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
  
  // Cache the key
  keyCache.set(cacheKey, derivedKey)
  
  return derivedKey
}

// Encrypt message with libsodium
export async function encryptMessage(text: string, conversationId: string): Promise<string> {
  await sodium.ready
  const key = await generateConversationKey(conversationId)
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const encrypted = sodium.crypto_secretbox_easy(text, nonce, key)
  
  // Combine nonce and encrypted data for storage
  const combined = new Uint8Array(nonce.length + encrypted.length)
  combined.set(nonce)
  combined.set(encrypted, nonce.length)
  
  // Return as base64 string
  return sodium.to_base64(combined, sodium.base64_variants.ORIGINAL)
}

// Decrypt message with libsodium
export async function decryptMessage(cipher: string, conversationId: string): Promise<string> {
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
      return cipher;
    }
    
    await sodium.ready;
    const key = await generateConversationKey(conversationId);
    const combined = sodium.from_base64(cipher, sodium.base64_variants.ORIGINAL);
    
    // Check if combined data is valid
    if (combined.length <= sodium.crypto_secretbox_NONCEBYTES) {
      throw new Error('Incomplete input data');
    }
    
    // Extract nonce and encrypted data
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const encrypted = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
    
    // Decrypt
    const decrypted = sodium.crypto_secretbox_open_easy(encrypted, nonce, key);
    return sodium.to_string(decrypted);
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

// For backward compatibility with existing messages encrypted with crypto-js
import CryptoJS from 'crypto-js'

const LEGACY_SECRET_KEY = env.chatSecret || ''

export function decryptLegacyMessage(cipher: string): string {
  try {
    // If no secret key is provided, we can't decrypt legacy messages
    if (!LEGACY_SECRET_KEY) {
      return '[Decryption key not available]'
    }
    const bytes = CryptoJS.AES.decrypt(cipher, LEGACY_SECRET_KEY)
    return bytes.toString(CryptoJS.enc.Utf8) || '[Failed to decrypt]'
  } catch {
    return '[Invalid encrypted message]'
  }
}