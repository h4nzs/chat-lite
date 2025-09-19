import sodium from 'libsodium-wrappers'

// In-memory storage for per-conversation keys (in production, this should be in a secure store)
const conversationKeys = new Map<string, Uint8Array>()

// Generate a random key for libsodium
async function generateKey(): Promise<Uint8Array> {
  await sodium.ready
  return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES)
}

// Get or create a key for a conversation
async function getConversationKey(conversationId: string): Promise<Uint8Array> {
  if (!conversationKeys.has(conversationId)) {
    const key = await generateKey()
    conversationKeys.set(conversationId, key)
  }
  return conversationKeys.get(conversationId)!
}

// Encrypt message with libsodium
export async function encryptMessage(text: string, conversationId: string = 'default'): Promise<string> {
  await sodium.ready
  const key = await getConversationKey(conversationId)
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
export async function decryptMessage(cipher: string, conversationId: string = 'default'): Promise<string> {
  try {
    // Check if cipher is valid
    if (!cipher || typeof cipher !== 'string') {
      throw new Error('Invalid cipher text')
    }
    
    await sodium.ready
    const key = await getConversationKey(conversationId)
    const combined = sodium.from_base64(cipher, sodium.base64_variants.ORIGINAL)
    
    // Check if combined data is valid
    if (combined.length <= sodium.crypto_secretbox_NONCEBYTES) {
      throw new Error('Incomplete input data')
    }
    
    // Extract nonce and encrypted data
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES)
    const encrypted = combined.slice(sodium.crypto_secretbox_NONCEBYTES)
    
    // Decrypt
    const decrypted = sodium.crypto_secretbox_open_easy(encrypted, nonce, key)
    return sodium.to_string(decrypted)
  } catch (error) {
    console.error('Decryption failed:', error)
    // Return a more specific error message
    if (error instanceof Error) {
      if (error.message.includes('incorrect key')) {
        return '[Failed to decrypt: Invalid key]'
      } else if (error.message.includes('incomplete input')) {
        return '[Failed to decrypt: Incomplete data]'
      }
    }
    return '[Failed to decrypt: Message may be corrupted]'
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