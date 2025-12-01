import { getSodium } from '@lib/sodiumInitializer';

const B64_VARIANT = 'URLSAFE_NO_PADDING';

export async function generateKeyPairs(): Promise<{
  encryption: { publicKey: Uint8Array, privateKey: Uint8Array },
  signing: { publicKey: Uint8Array, privateKey: Uint8Array }
}> {
  const sodium = await getSodium();
  return {
    encryption: sodium.crypto_box_keypair(),
    signing: sodium.crypto_sign_keypair(),
  };
}

export async function exportPublicKey(publicKey: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(publicKey, sodium.base64_variants[B64_VARIANT]);
}

export async function storePrivateKeys(keys: {
  encryption: Uint8Array,
  signing: Uint8Array,
  signedPreKey: Uint8Array,
  masterSeed?: Uint8Array
}, password: string): Promise<string> {
  const sodium = await getSodium();
  const privateKeysJson = JSON.stringify({
    encryption: sodium.to_base64(keys.encryption, sodium.base64_variants[B64_VARIANT]),
    signing: sodium.to_base64(keys.signing, sodium.base64_variants[B64_VARIANT]),
    signedPreKey: sodium.to_base64(keys.signedPreKey, sodium.base64_variants[B64_VARIANT]),
    masterSeed: keys.masterSeed ? sodium.to_base64(keys.masterSeed, sodium.base64_variants[B64_VARIANT]) : undefined,
  });

  const salt = sodium.randombytes_buf(32);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

  const appSecret = import.meta.env.VITE_APP_SECRET;
  if (!appSecret) {
    throw new Error("VITE_APP_SECRET is required for key encryption.");
  }
  const combinedPass = `${appSecret}-${password}`;
  const keyInput = new Uint8Array(salt.length + sodium.from_string(combinedPass).length);
  keyInput.set(salt);
  keyInput.set(sodium.from_string(combinedPass), salt.length);
  const key = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, keyInput);

  const ciphertext = sodium.crypto_secretbox_easy(privateKeysJson, nonce, key);
  const result = new Uint8Array(salt.length + nonce.length + ciphertext.length);
  result.set(salt, 0);
  result.set(nonce, salt.length);
  result.set(ciphertext, salt.length + nonce.length);

  return sodium.to_base64(result, sodium.base64_variants[B64_VARIANT]);
}

export async function retrievePrivateKeys(encryptedDataStr: string, password: string): Promise<{
  encryption: Uint8Array,
  signing: Uint8Array,
  signedPreKey: Uint8Array,
  masterSeed?: Uint8Array
} | null> {
  try {
    const sodium = await getSodium();
    const encryptedData = sodium.from_base64(encryptedDataStr, sodium.base64_variants[B64_VARIANT]);

    const salt = encryptedData.slice(0, 32);
    const nonce = encryptedData.slice(32, 32 + sodium.crypto_secretbox_NONCEBYTES);
    const encryptedJson = encryptedData.slice(32 + sodium.crypto_secretbox_NONCEBYTES);

    const appSecret = import.meta.env.VITE_APP_SECRET;
    if (!appSecret) {
      throw new Error("VITE_APP_SECRET is required for key decryption.");
    }
    const combinedPass = `${appSecret}-${password}`;
    const keyInput = new Uint8Array(salt.length + sodium.from_string(combinedPass).length);
    keyInput.set(salt);
    keyInput.set(sodium.from_string(combinedPass), salt.length);
    const key = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, keyInput);

    const decryptedJson = sodium.to_string(sodium.crypto_secretbox_open_easy(encryptedJson, nonce, key));
    const keys = JSON.parse(decryptedJson);
    
    if (!keys.signedPreKey) {
      throw new Error("Legacy key bundle found. Account reset might be needed.");
    }

    return {
      encryption: sodium.from_base64(keys.encryption, sodium.base64_variants[B64_VARIANT]),
      signing: sodium.from_base64(keys.signing, sodium.base64_variants[B64_VARIANT]),
      signedPreKey: sodium.from_base64(keys.signedPreKey, sodium.base64_variants[B64_VARIANT]),
      masterSeed: keys.masterSeed ? sodium.from_base64(keys.masterSeed, sodium.base64_variants[B64_VARIANT]) : undefined,
    };
  } catch (error) {
    console.error("Failed to retrieve private keys:", error);
    return null;
  }
}

export async function generateSafetyNumber(myPublicKey: Uint8Array, theirPublicKey: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  
  let combined;
  if (sodium.compare(myPublicKey, theirPublicKey) < 0) {
    combined = new Uint8Array(myPublicKey.length + theirPublicKey.length);
    combined.set(myPublicKey, 0);
    combined.set(theirPublicKey, myPublicKey.length);
  } else {
    combined = new Uint8Array(myPublicKey.length + theirPublicKey.length);
    combined.set(theirPublicKey, 0);
    combined.set(myPublicKey, theirPublicKey.length);
  }

  const hash = sodium.crypto_generichash(64, combined);

  const fingerprint = sodium.to_hex(hash.slice(0, 30));
  const chunks = fingerprint.match(/.{1,10}/g) || [];
  const digitGroups = chunks.map(chunk => parseInt(chunk, 16).toString().padStart(5, '0').slice(-5));
  
  return digitGroups.join(' ');
}