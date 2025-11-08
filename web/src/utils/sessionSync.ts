
import { authFetch } from "@lib/api";
import { getMyKeyPair } from "@utils/crypto";
import { decryptSessionKeyForUser } from "@utils/keyManagement";
import { addSessionKey } from "@lib/keychainDb";
import { getSodium } from "@lib/sodiumInitializer";
import toast from "react-hot-toast";

type SyncResponse = Record<string, { sessionId: string; encryptedKey: string }[]>;

export async function syncSessionKeys() {
  await toast.promise(
    (async () => {
      try {
        console.log("Starting session key synchronization...");

        // 1. Fetch all encrypted session keys from the server
        const allEncryptedKeys = await authFetch<SyncResponse>("/api/session-keys/sync");
        if (!allEncryptedKeys || Object.keys(allEncryptedKeys).length === 0) {
          console.log("No session keys to sync.");
          return; // Nothing to do
        }

        // 2. Get user's master key pair (this will prompt for password if not cached)
        const { publicKey, privateKey } = await getMyKeyPair();
        const sodium = await getSodium();

        let syncedKeyCount = 0;

        // 3. Decrypt and store each key
        for (const conversationId in allEncryptedKeys) {
          const keysForConvo = allEncryptedKeys[conversationId];
          for (const keyInfo of keysForConvo) {
            try {
              const sessionKey = await decryptSessionKeyForUser(
                keyInfo.encryptedKey,
                publicKey,
                privateKey,
                sodium
              );
              await addSessionKey(conversationId, keyInfo.sessionId, sessionKey);
              syncedKeyCount++;
            } catch (decryptionError) {
              console.warn(`Failed to decrypt session key ${keyInfo.sessionId} for convo ${conversationId}. Skipping.`, decryptionError);
            }
          }
        }

        console.log(`Synchronization complete. Synced ${syncedKeyCount} session keys.`);
      } catch (error: any) {
        // Don't re-throw the error to avoid breaking the app load.
        // The toast will show the failure.
        console.error("Session key synchronization failed:", error);
        // We check for the specific password error to give a better message
        if (error.message.includes("Incorrect password")) {
          throw new Error("Incorrect password provided for key sync.");
        }
        throw new Error("Failed to sync message keys from server.");
      }
    })(),
    {
      loading: "Syncing message keys...",
      success: "Message keys synced successfully!",
      error: (err) => err.message || "Key synchronization failed.",
    }
  );
}
