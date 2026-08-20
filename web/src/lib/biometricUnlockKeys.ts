// Magic-unlock biometric: menurunkan kunci dari recovery phrase ke MEMORI saja.
//
// Di-extract dari `pages/Login.tsx` (handleBiometricLogin) agar kontrak penting
// ini bisa diuji unit:
//   - JANGAN menimpa `nyx_encrypted_keys` di IndexedDB (bug lama: password jadi
//     "incorrect" setelah unlock biometric).
//   - JANGAN menyimpan auto-unlock key session (bundle IDB tetap milik password).
// Hanya decrypt → set ke RAM (setDecryptedKeys) → selesai.

import type { RetrievedKeys } from './crypto-worker-proxy';

export interface UnlockFromRecoveryPhraseDeps {
  restoreFromPhrase: (phrase: string, password: string) => Promise<{ encryptedPrivateKeys: string }>;
  retrievePrivateKeys: (encrypted: string, password: string) => Promise<{ success: boolean; keys?: RetrievedKeys }>;
  setDecryptedKeys: (keys: RetrievedKeys) => void | Promise<void>;
  randomPassword?: () => string;
}

export async function unlockFromRecoveryPhrase(
  recoveryPhrase: string,
  deps: UnlockFromRecoveryPhraseDeps
): Promise<boolean> {
  const sessionPassword = deps.randomPassword
    ? deps.randomPassword()
    : await (async () => {
        const sodium = await import('@lib/sodiumInitializer').then((m) => m.getSodium());
        return sodium.to_hex(sodium.randombytes_buf(16));
      })();

  const { encryptedPrivateKeys } = await deps.restoreFromPhrase(recoveryPhrase, sessionPassword);
  const dec = await deps.retrievePrivateKeys(encryptedPrivateKeys, sessionPassword);

  if (!dec.success || !dec.keys) return false;

  await deps.setDecryptedKeys(dec.keys);
  return true;
}