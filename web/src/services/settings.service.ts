// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { api } from '@lib/api';
import { exportDatabaseToJson, importDatabaseFromJson, saveProfileKey } from '@lib/keychainDb';
import { executeLocalWipe } from '@lib/nukeProtocol';
import { setPanicPassword } from '@lib/keyStorage';
import { generateProfileKey, encryptProfile, minePoW, getRecoveryPhrase } from '@lib/crypto-worker-proxy';
import { setupBiometricUnlock } from '@lib/biometricUnlock';
import { getDeviceAutoUnlockKey, getEncryptedKeys } from '@lib/keyStorage';
import { useModalStore } from '@store/modal';
import { useMessageStore } from '@store/message';
import { useProfileStore } from '@store/profile';
import toast from 'react-hot-toast';

/**
 * Update user profile with new encrypted profile data
 */
export const updateUserProfile = async (
  userId: string,
  name: string,
  description: string,
  avatarUrl: string | null | undefined,
  currentEncryptedProfile?: string
) => {
  const profileKeyB64 = await getProfileKey(userId);
  let key = profileKeyB64;
  if (!key) {
    key = await generateProfileKey();
    await saveProfileKey(userId, key);
  }

  const profileJson = JSON.stringify({ name, description, avatarUrl });
  const encryptedProfile = await encryptProfile(profileJson, key);

  await api('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify({ encryptedProfile })
  });

  // Force update the local cache
  useProfileStore.getState().decryptAndCache(userId, encryptedProfile);

  return encryptedProfile;
};

/**
 * Get or generate profile key for user
 */
const getProfileKey = async (userId: string): Promise<string | null> => {
  const { getProfileKey: getKey } = await import('@lib/keychainDb');
  return (await getKey(userId)) || null;
};

/**
 * Setup biometric unlock with WebAuthn
 */
export const setupBiometricAuth = async (userId: string, setUser: (user: any) => void) => {
  try {
    // 1. Get Recovery Phrase to lock
    let phraseToLock = '';

    const autoUnlockKey = await getDeviceAutoUnlockKey();
    const encryptedKeysStr = await getEncryptedKeys();

    if (autoUnlockKey && encryptedKeysStr) {
      try {
        phraseToLock = await getRecoveryPhrase(encryptedKeysStr, autoUnlockKey);
      } catch {
        // Ignore errors, will prompt for password
      }
    }

    // If failed automatically, prompt user for password
    if (!phraseToLock) {
      await new Promise<void>((resolve, reject) => {
        useModalStore.getState().showPasswordPrompt(async (password) => {
          if (!password) {
            reject(new Error('Password required to enable biometric unlock.'));
            return;
          }
          try {
            const encKeys = await getEncryptedKeys();
            if (!encKeys) throw new Error('No keys found.');
            phraseToLock = await getRecoveryPhrase(encKeys, password);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    toast.loading('Initializing biometric scanner...', { id: 'passkey' });
    
    // Force creation of NEW credential to ensure PRF support
    const options = await api<Record<string, unknown>>('/api/auth/webauthn/register/options?force=true');

    toast.loading('Scan fingerprint now to LOCK your vault...', { id: 'passkey' });

    // 2. Setup Biometric with PRF
    const attResp = await setupBiometricUnlockInternal(options, phraseToLock);

    // 3. Verify Server
    const verificationResp = await api<{ verified: boolean }>('/api/auth/webauthn/register/verify', {
      method: 'POST',
      body: JSON.stringify(attResp),
    });

    if (verificationResp.verified) {
      toast.success('Biometric active! You can now login without password.', { id: 'passkey' });
      setUser({ isVerified: true });
      return true;
    } else {
      throw new Error('Verification failed');
    }
  } catch (error: unknown) {
    if ((error as Error).name === 'NotAllowedError') {
      toast.error('Scan cancelled.', { id: 'passkey' });
    } else {
      toast.error(`Error: ${(error as Error).message}`, { id: 'passkey' });
    }
    throw error;
  }
};

// Internal setup function (renamed from setupBiometricUnlock)
const setupBiometricUnlockInternal = async (options: Record<string, unknown>, phraseToLock: string) => {
  return setupBiometricUnlock(options, phraseToLock);
};

/**
 * Execute Proof of Work mining for VIP upgrade
 */
export const executePoWMining = async () => {
  const toastId = toast.loading('Connecting to mining pool...');

  try {
    // 1. Get Challenge
    const { salt, difficulty } = await api<{ salt: string; difficulty: number }>('/api/auth/pow/challenge');

    toast.loading('Mining cryptographic puzzle... (CPU Intensive)', { id: toastId });

    // 2. Mine in Worker
    const { nonce } = await minePoW(salt, difficulty);

    toast.loading('Verifying proof...', { id: toastId });

    // 3. Verify
    const result = await api<{ success: boolean }>('/api/auth/pow/verify', {
      method: 'POST',
      body: JSON.stringify({ nonce })
    });

    if (result.success) {
      toast.success('Proof Accepted! Account upgraded to VIP.', { id: toastId });
      return true;
    }
    return false;
  } catch (error: unknown) {
    console.error(error);
    toast.error(`Mining failed: ${(error as Error).message}`, { id: toastId });
    throw error;
  }
};

/**
 * Delete user account permanently
 */
export const deleteUserAccount = async (userId: string, password: string) => {
  try {
    // 1. Collect file keys from messages (Best Effort from Memory)
    const messagesMap = useMessageStore.getState().messages;
    const fileKeys: string[] = [];

    Object.values(messagesMap).flat().forEach((msg: unknown) => {
      const m = msg as { senderId: string; fileKey?: string };
      if (m.senderId === userId && m.fileKey) {
        fileKeys.push(m.fileKey);
      }
    });

    // 2. Nuke Server
    await api('/api/users/me', {
      method: 'DELETE',
      body: JSON.stringify({
        password,
        fileKeys
      })
    });

    // 3. Nuke Local
    await executeLocalWipe();

    toast.success('Account obliterated.');
    window.location.replace('/');
  } catch (error: unknown) {
    const errorMsg = (error as { details?: string; message: string }).details
      ? JSON.parse((error as { details: string }).details).error
      : (error as Error).message;
    toast.error(`Deletion failed: ${errorMsg}`);
    throw error;
  }
};

/**
 * Export vault database to JSON file
 */
export const exportVault = async () => {
  try {
    const json = await exportDatabaseToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nyx_vault_backup_${new Date().toISOString().slice(0, 10)}.nyxvault`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Vault exported successfully! Keep this file safe.');
  } catch (error) {
    console.error('Export failed:', error);
    toast.error('Failed to export vault.');
    throw error;
  }
};

/**
 * Import vault database from JSON file
 */
export const importVault = async (file: File) => {
  const reader = new FileReader();
  
  return new Promise<void>((resolve, reject) => {
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        await importDatabaseFromJson(json);
        toast.success('Vault imported successfully! Reloading...');
        setTimeout(() => window.location.reload(), 1000);
        resolve();
      } catch (error) {
        console.error('Import failed:', error);
        toast.error('Invalid vault file or corrupted data.');
        reject(error);
      }
    };
    reader.readAsText(file);
  });
};

export { setPanicPassword };
