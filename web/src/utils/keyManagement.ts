import { getSodium } from '@lib/sodiumInitializer';

// Function to generate a new key pair for the user
export async function generateKeyPair(): Promise<{ publicKey: Uint8Array, privateKey: Uint8Array }> {
  const sodium = await getSodium();
  return sodium.crypto_box_keypair();
}

// Function to export public key in a string format
export async function exportPublicKey(publicKey: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL);
}

// Function to export private key in a string format
export async function exportPrivateKey(privateKey: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(privateKey, sodium.base64_variants.ORIGINAL);
}

// Function to import public key from string
export async function importPublicKey(publicKeyStr: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(publicKeyStr, sodium.base64_variants.ORIGINAL);
}

// Function to import private key from string
export async function importPrivateKey(privateKeyStr: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(privateKeyStr, sodium.base64_variants.ORIGINAL);
}

export async function storePrivateKey(privateKey: Uint8Array | null, password: string): Promise<string> {
  const sodium = await getSodium();

  if (!privateKey || !(privateKey instanceof Uint8Array)) {
    console.error("storePrivateKey: invalid privateKey", privateKey);
    throw new TypeError("Invalid private key — must be Uint8Array");
  }

  if (!password || typeof password !== "string" || password.length === 0) {
    throw new TypeError("Invalid password — must be a non-empty string");
  }

  try {
    const appSecret = import.meta.env.VITE_APP_SECRET || "default-secret";
    const combinedKey = `${appSecret}-${password}`;
    const combinedBytes = sodium.from_string(combinedKey);

    const salt = sodium.randombytes_buf(32); // Using a 32-byte salt for generichash

    // Derive key using crypto_generichash as a workaround for pwhash issues
    const keyInput = new Uint8Array(salt.length + combinedBytes.length);
    keyInput.set(salt);
    keyInput.set(combinedBytes, salt.length);
    const key = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, keyInput);


    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = sodium.crypto_secretbox_easy(privateKey, nonce, key);

    const result = new Uint8Array(salt.length + nonce.length + ciphertext.length);
    result.set(salt, 0);
    result.set(nonce, salt.length);
    result.set(ciphertext, salt.length + nonce.length);

    const encoded = sodium.to_base64(result, sodium.base64_variants.ORIGINAL);
    console.log("✅ storePrivateKey: encrypted and encoded successfully");
    return encoded;
  } catch (err) {
    console.error("❌ Error in storePrivateKey:", err);
    throw err;
  }
}

// Function to retrieve and decrypt private key from storage
export async function retrievePrivateKey(encryptedDataStr: string, password: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  
  const encryptedData = sodium.from_base64(encryptedDataStr, sodium.base64_variants.ORIGINAL);
  
  // Extract salt, nonce, and encrypted key
  const salt = encryptedData.slice(0, 32);
  const nonce = encryptedData.slice(32, 32 + sodium.crypto_secretbox_NONCEBYTES);
  const encryptedPrivateKey = encryptedData.slice(32 + sodium.crypto_secretbox_NONCEBYTES);
  
  // Derive the same key from the password
  const appSecret = import.meta.env.VITE_APP_SECRET || "default-secret";
  const combinedKey = `${appSecret}-${password}`;
  const combinedBytes = sodium.from_string(combinedKey);
  
  // Derive key using crypto_generichash to match the storing logic
  const keyInput = new Uint8Array(salt.length + combinedBytes.length);
  keyInput.set(salt);
  keyInput.set(combinedBytes, salt.length);
  const key = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, keyInput);
  
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
export async function decryptSessionKeyForUser(encryptedSessionKeyStr: string, publicKey: Uint8Array, privateKey: Uint8Array, sodium: any): Promise<Uint8Array> {
  // Final, most robust check to ensure the private key is valid before use.
  if (!privateKey || privateKey.length !== sodium.crypto_box_SECRETKEYBYTES) {
    throw new TypeError("Invalid private key provided for session key decryption.");
  }
  if (!publicKey || publicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new TypeError("Invalid public key provided for session key decryption.");
  }

  const encryptedSessionKey = sodium.from_base64(encryptedSessionKeyStr, sodium.base64_variants.ORIGINAL);
  
  // Decrypt using the full keypair
  const sessionKey = sodium.crypto_box_seal_open(encryptedSessionKey, publicKey, privateKey);
  
  if (!sessionKey) {
    throw new Error("Failed to decrypt session key.");
  }

  return sessionKey;
}