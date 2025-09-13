import CryptoJS from 'crypto-js'

const SECRET_KEY = import.meta.env.VITE_CHAT_SECRET || 'default-secret'

// Enkripsi teks
export function encryptMessage(text: string): string {
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString()
}

// Dekripsi teks
export function decryptMessage(cipher: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY)
    return bytes.toString(CryptoJS.enc.Utf8) || '[Failed to decrypt]'
  } catch {
    return '[Invalid encrypted message]'
  }
}