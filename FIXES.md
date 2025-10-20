TASK: Fix libsodium TypeError in storePrivateKey (length cannot be null or undefined)

Context:
- Error occurs in storePrivateKey during login (setupUserEncryptionKeys).
- Root cause: privateKey not a valid Uint8Array or sodium not ready before use.
- Need to validate inputs, ensure sodium initialized, and generate keypair properly.

Goal:
1. Add strong type validation in storePrivateKey().
2. Ensure setupUserEncryptionKeys() waits for sodium to initialize before generating keys.
3. Prevent libsodium "length cannot be null" error.

Steps:
- In web/src/utils/keyManagement.ts, update storePrivateKey:

  ```ts
  export async function storePrivateKey(privateKey: Uint8Array | null, password: string): Promise<string> {
    const sodium = await getSodium();

    if (!privateKey || !(privateKey instanceof Uint8Array)) {
      console.error("storePrivateKey: invalid privateKey", privateKey);
      throw new TypeError("Invalid private key — must be Uint8Array");
    }

    if (!password || typeof password !== "string") {
      throw new TypeError("Invalid password — must be string");
    }

    try {
      const appSecret = import.meta.env.VITE_APP_SECRET || "default-secret";
      const combinedKey = `${appSecret}-${password}`;
      const combinedBytes = sodium.from_string(combinedKey);

      const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
      const key = sodium.crypto_pwhash(
        sodium.crypto_secretbox_KEYBYTES,
        combinedBytes,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_DEFAULT
      );

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
````

* In setupUserEncryptionKeys(), before calling storePrivateKey:

  ```ts
  const sodium = await getSodium();
  const { publicKey, privateKey } = sodium.crypto_box_keypair();
  await storePrivateKey(privateKey, password);
  ```

Verification:

* Restart frontend.
* Login again → no "length cannot be null or undefined" errors.
* Console shows "✅ storePrivateKey: encrypted and encoded successfully".
* Message encryption logs remain valid.

```