import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import CryptoJS from 'crypto-js';
import { api } from '@lib/api';

const KEY_PUBLIC = 'publicKey';
const KEY_PRIVATE_ENCRYPTED = 'encryptedPrivateKey';

// --- Key Generation and Storage ---

/**
 * Generates a new key pair, encrypts the private key with the user's password,
 * stores them in localStorage, and uploads the public key to the server.
 */
export async function generateAndStoreKeys(password: string): Promise<void> {
  if (!password) throw new Error('Password is required to generate keys.');

  const keyPair = nacl.box.keyPair();
  const publicKeyB64 = encodeBase64(keyPair.publicKey);

  // Encrypt the private key with the password
  const salt = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.PBKDF2(password, salt, { keySize: 256 / 32, iterations: 10000 });
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(keyPair.privateKey, nonce, decodeBase64(key.toString(CryptoJS.enc.Base64)));

  const fullMessage = new Uint8Array(salt.sigBytes + nonce.length + ciphertext.length);
  fullMessage.set(decodeBase64(salt.toString(CryptoJS.enc.Base64)), 0);
  fullMessage.set(nonce, salt.sigBytes);
  fullMessage.set(ciphertext, salt.sigBytes + nonce.length);
  const encryptedPrivateKeyB64 = encodeBase64(fullMessage);

  // Store keys locally
  localStorage.setItem(KEY_PUBLIC, publicKeyB64);
  localStorage.setItem(KEY_PRIVATE_ENCRYPTED, encryptedPrivateKeyB64);

  // Upload public key to server
  await api('/api/keys/public', {
    method: 'POST',
    body: JSON.stringify({ publicKey: publicKeyB64 }),
  });
}

/**
 * Retrieves and decrypts the user's private key from localStorage.
 */
async function getMyPrivateKey(password: string): Promise<Uint8Array> {
  const encryptedKeyB64 = localStorage.getItem(KEY_PRIVATE_ENCRYPTED);
  if (!encryptedKeyB64) throw new Error('Encrypted private key not found.');

  const fullMessage = decodeBase64(encryptedKeyB64);
  const saltBytes = fullMessage.slice(0, 16);
  const nonce = fullMessage.slice(16, 16 + nacl.secretbox.nonceLength);
  const ciphertext = fullMessage.slice(16 + nacl.secretbox.nonceLength);
  const salt = CryptoJS.enc.Base64.parse(encodeBase64(saltBytes));

  const key = CryptoJS.PBKDF2(password, salt, { keySize: 256 / 32, iterations: 10000 });

  const decrypted = nacl.secretbox.open(ciphertext, nonce, decodeBase64(key.toString(CryptoJS.enc.Base64)));
  if (!decrypted) throw new Error('Failed to decrypt private key. Incorrect password?');

  return decrypted;
}

// --- Message Encryption/Decryption ---

const publicKeyCache: Record<string, Uint8Array> = {};

async function getRecipientPublicKey(userId: string): Promise<Uint8Array> {
  if (publicKeyCache[userId]) return publicKeyCache[userId];
  const { publicKey } = await api<{ publicKey: string }>(`/api/keys/public/${userId}`);
  const publicKeyBytes = decodeBase64(publicKey);
  publicKeyCache[userId] = publicKeyBytes;
  return publicKeyBytes;
}

/**
 * Encrypts a message for a given recipient.
 */
export async function encrypt(text: string, recipientId: string, password: string): Promise<string> {
  const messageBytes = decodeUTF8(text);
  const recipientPublicKey = await getRecipientPublicKey(recipientId);
  const myPrivateKey = await getMyPrivateKey(password);

  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(messageBytes, nonce, recipientPublicKey, myPrivateKey);

  const fullMessage = new Uint8Array(nonce.length + encrypted.length);
  fullMessage.set(nonce, 0);
  fullMessage.set(encrypted, nonce.length);

  return encodeBase64(fullMessage);
}

/**
 * Decrypts a message from a given sender.
 */
export async function decrypt(encryptedB64: string, senderId: string, password: string): Promise<string> {
  const fullMessage = decodeBase64(encryptedB64);
  const nonce = fullMessage.slice(0, nacl.box.nonceLength);
  const ciphertext = fullMessage.slice(nacl.box.nonceLength);

  const senderPublicKey = await getRecipientPublicKey(senderId);
  const myPrivateKey = await getMyPrivateKey(password);

  const decryptedBytes = nacl.box.open(ciphertext, nonce, senderPublicKey, myPrivateKey);
  if (!decryptedBytes) throw new Error('Decryption failed.');

  return encodeUTF8(decryptedBytes);
}
