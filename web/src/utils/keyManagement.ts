import { getSodium } from '@lib/sodiumInitializer';

// Function to generate a new key pair for the user
export async function generateKeyPair(): Promise<{ publicKey: Uint8Array, privateKey: Uint8Array }> {
  const sodium = await getSodium();
  return sodium.crypto_kx_keypair();
}

// Function to export public key in a string format
export function exportPublicKey(publicKey: Uint8Array): string {
  return sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL);
}

// Function to export private key in a string format
export function exportPrivateKey(privateKey: Uint8Array): string {
  return sodium.to_base64(privateKey, sodium.base64_variants.ORIGINAL);
}

// Function to import public key from string
export function importPublicKey(publicKeyStr: string): Uint8Array {
  return sodium.from_base64(publicKeyStr, sodium.base64_variants.ORIGINAL);
}

// Function to import private key from string
export function importPrivateKey(privateKeyStr: string): Uint8Array {
  return sodium.from_base64(privateKeyStr, sodium.base64_variants.ORIGINAL);
}

// Function to store private key securely in browser storage
export async function storePrivateKey(privateKey: Uint8Array, password: string): Promise<string> {
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required and must be a non-empty string');
  }
  
  if (!privateKey || !(privateKey instanceof Uint8Array)) {
    throw new Error('Private key is required and must be a Uint8Array');
  }
  
  const sodium = await getSodium();
  
  try {
    // Derive a key from the password
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const key = sodium.crypto_pwhash(
      sodium.crypto_secretbox_KEYBYTES,
      password,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_DEFAULT
    );
    
    // Encrypt the private key
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const encryptedPrivateKey = sodium.crypto_secretbox_easy(privateKey, nonce, key);
    
    // Combine salt, nonce, and encrypted key
    const result = new Uint8Array(salt.length + nonce.length + encryptedPrivateKey.length);
    result.set(salt, 0);
    result.set(nonce, salt.length);
    result.set(encryptedPrivateKey, salt.length + nonce.length);
    
    return sodium.to_base64(result, sodium.base64_variants.ORIGINAL);
  } catch (error) {
    console.error('Error in storePrivateKey:', error);
    throw error;
  }
}

// Function to retrieve and decrypt private key from storage
export async function retrievePrivateKey(encryptedDataStr: string, password: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  
  const encryptedData = sodium.from_base64(encryptedDataStr, sodium.base64_variants.ORIGINAL);
  
  // Extract salt, nonce, and encrypted key
  const salt = encryptedData.slice(0, sodium.crypto_pwhash_SALTBYTES);
  const nonce = encryptedData.slice(sodium.crypto_pwhash_SALTBYTES, sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES);
  const encryptedPrivateKey = encryptedData.slice(sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES);
  
  // Derive the same key from the password
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  
  // Decrypt the private key
  const privateKey = sodium.crypto_secretbox_open_easy(encryptedPrivateKey, nonce, key);
  
  return privateKey;
}

// Function to create a session key for a conversation
export async function createSessionKey(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}

// Function to encrypt a session key with a user's public key (using direct public key encryption)
export async function encryptSessionKeyForUser(sessionKey: Uint8Array, recipientPublicKey: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  
  // Use direct public key encryption (sealing) - recipient can decrypt with their private key
  const encryptedSessionKey = sodium.crypto_box_seal(sessionKey, recipientPublicKey);
  
  return sodium.to_base64(encryptedSessionKey, sodium.base64_variants.ORIGINAL);
}

// Function to decrypt a session key using user's private key
export async function decryptSessionKeyForUser(encryptedSessionKeyStr: string, myPrivateKey: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  
  const encryptedSessionKey = sodium.from_base64(encryptedSessionKeyStr, sodium.base64_variants.ORIGINAL);
  
  // Decrypt using private key - no need for sender's public key with seal/unseal
  const sessionKey = sodium.crypto_box_seal_open(encryptedSessionKey, myPrivateKey);
  
  return sessionKey;
}