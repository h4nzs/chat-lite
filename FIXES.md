# TASK: Fix libsodium TypeError in storePrivateKey (length cannot be null or undefined)

Context:
- Frontend throws: "Error in storePrivateKey: TypeError: length cannot be null or undefined".
- Root cause: invalid or missing Uint8Array values (privateKey, salt, nonce, or derived key).
- We must validate inputs, ensure correct Uint8Array conversions, and wrap sodium calls safely.

Goal:
1. Add validation for privateKey and password.
2. Convert combined key to Uint8Array before pwhash.
3. Generate salt and nonce safely.
4. Combine result (salt + nonce + ciphertext) properly.
5. Log and rethrow any errors.

Steps:
- Open web/src/utils/keyManagement.ts.
- Replace function storePrivateKey() with:

  ```ts
  export async function storePrivateKey(privateKey: Uint8Array, password: string): Promise<string> {
    const sodium = await getSodium();

    if (!privateKey || !(privateKey instanceof Uint8Array)) {
      console.error("storePrivateKey: invalid privateKey type", privateKey);
      throw new TypeError("Private key must be a Uint8Array");
    }
    if (!password || typeof password !== "string") {
      throw new TypeError("Password must be a non-empty string");
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

      return sodium.to_base64(result, sodium.base64_variants.ORIGINAL);
    } catch (err) {
      console.error("Error in storePrivateKey:", err);
      throw err;
    }
  }
````

Verification:

* Restart frontend dev server.
* Login again → no more "length cannot be null or undefined".
* Console logs "Private key successfully encrypted and encoded".

Output:

* Show updated function storePrivateKey only.
* Keep rest of file unchanged.

```