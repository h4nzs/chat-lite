import { getSodium } from "@lib/sodiumInitializer";
import { api } from "@lib/api";

const B64_VARIANT = 'URLSAFE_NO_PADDING';

/**
 * Generates a new signed pre-key and a batch of one-time pre-keys.
 * @param identitySigningKey The user's long-term private signing key.
 */
export async function generatePreKeys(identitySigningKey: Uint8Array): Promise<{
  signedPreKey: { key: string, signature: string },
  oneTimePreKeys: { key: string }[]
}> {
  const sodium = await getSodium();

  // 1. Generate a long-term signed pre-key
  const signedPreKeyPair = sodium.crypto_box_keypair();
  const signature = sodium.crypto_sign_detached(signedPreKeyPair.publicKey, identitySigningKey);

  const signedPreKey = {
    key: sodium.to_base64(signedPreKeyPair.publicKey, sodium.base64_variants[B64_VARIANT]),
    signature: sodium.to_base64(signature, sodium.base64_variants[B64_VARIANT]),
  };

  // 2. Generate a batch of one-time pre-keys
  const oneTimePreKeys = [];
  for (let i = 0; i < 100; i++) {
    const oneTimeKeyPair = sodium.crypto_box_keypair();
    oneTimePreKeys.push({
      key: sodium.to_base64(oneTimeKeyPair.publicKey, sodium.base64_variants[B64_VARIANT]),
    });
  }

  return { signedPreKey, oneTimePreKeys };
}

/**
 * Uploads the generated pre-keys to the server.
 */
export async function uploadPreKeys(
  signedPreKey: { key: string, signature: string },
  oneTimePreKeys: { key: string }[]
): Promise<void> {
  await api("/api/keys/prekeys", {
    method: "POST",
    body: JSON.stringify({ signedPreKey, oneTimePreKeys }),
  });
}

/**
 * Fetches a user's pre-key bundle from the server.
 * This bundle is needed to initiate a secure conversation.
 */
export async function fetchPreKeyBundle(userId: string): Promise<any> {
  try {
    const bundle = await api(`/api/keys/prekey-bundle/${userId}`);
    return bundle;
  } catch (error) {
    console.error(`Failed to fetch pre-key bundle for user ${userId}:`, error);
    throw error;
  }
}