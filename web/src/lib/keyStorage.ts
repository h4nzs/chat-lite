// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For licensing details, see LICENSE file.

/**
 * Key Storage Layer
 * 
 * Handles all encrypted storage operations for cryptographic keys and ratchet states.
 * All data is encrypted with the master seed before being stored in IndexedDB.
 * 
 * @module keyStorage
 */

import { get, set, del } from 'idb-keyval';
import { clearAllKeys as clearSessionKeys } from './keychainDb';
import { sha256 } from 'hash-wasm';
import { useAuthStore } from '@store/auth';
import type { SerializedRatchetState } from '@lib/crypto-worker-proxy';
import {
  storeRatchetSession,
  getRatchetSession,
  deleteRatchetSession,
  storeMessageKey,
  getMessageKey,
  deleteMessageKey,
  storeSkippedKey,
  getSkippedKey,
  deleteSkippedKey,
  addSessionKey,
  getSessionKey,
  getLatestSessionKey,
  storeGroupKey,
  getGroupKey,
  deleteGroupKey,
  receiveGroupKey,
  storeOneTimePreKey,
  getOneTimePreKey,
  deleteOneTimePreKey,
  getLastOtpkId
} from '@lib/keychainDb';

// Helper to lazy-load crypto worker proxy
async function getWorkerProxy() {
  return import('@lib/crypto-worker-proxy');
}

// ============================================================================
// General Key Storage (Existing Functions)
// ============================================================================

const STORAGE_KEYS = {
  ENCRYPTED_KEYS: 'nyx_encrypted_keys',
  DEVICE_AUTO_UNLOCK_KEY: 'nyx_device_auto_unlock_key',
  DEVICE_AUTO_UNLOCK_READY: 'nyx_device_auto_unlock_ready',
  PANIC_HASH: 'nyx_panic_hash',
};

export const setPanicPassword = async (password: string): Promise<void> => {
  if (!password) {
    localStorage.removeItem(STORAGE_KEYS.PANIC_HASH);
    return;
  }
  const hash = await sha256(password);
  localStorage.setItem(STORAGE_KEYS.PANIC_HASH, hash);
};

export const checkPanicPassword = async (password: string): Promise<boolean> => {
  const storedHash = localStorage.getItem(STORAGE_KEYS.PANIC_HASH);
  if (!storedHash) return false;
  const hash = await sha256(password);
  return hash === storedHash;
};

/**
 * Stores Encrypted Private Keys to IndexedDB
 */
export const saveEncryptedKeys = async (keysData: string): Promise<void> => {
  try {
    await set(STORAGE_KEYS.ENCRYPTED_KEYS, keysData);
  } catch (error) {
    console.error('Failed to save keys to IndexedDB:', error);
    throw new Error('Storage failure');
  }
};

/**
 * Retrieves Encrypted Private Keys from IndexedDB
 */
export const getEncryptedKeys = async (): Promise<string | undefined> => {
  try {
    return await get<string>(STORAGE_KEYS.ENCRYPTED_KEYS);
  } catch (error) {
    console.error('Failed to retrieve keys from IndexedDB:', error);
    return undefined;
  }
};

export const saveDeviceAutoUnlockKey = async (key: string): Promise<void> => {
  try {
    await set(STORAGE_KEYS.DEVICE_AUTO_UNLOCK_KEY, key);
  } catch (error) {
    console.error('Failed to save device auto unlock key to IndexedDB:', error);
    throw new Error('Storage failure');
  }
};

export const getDeviceAutoUnlockKey = async (): Promise<string | undefined> => {
  try {
    return await get<string>(STORAGE_KEYS.DEVICE_AUTO_UNLOCK_KEY);
  } catch (error) {
    console.error('Failed to retrieve device auto unlock key from IndexedDB:', error);
    return undefined;
  }
};

/**
 * Sets device auto-unlock ready status to IndexedDB
 */
export const setDeviceAutoUnlockReady = async (isReady: boolean): Promise<void> => {
  try {
    await set(STORAGE_KEYS.DEVICE_AUTO_UNLOCK_READY, isReady);
  } catch (error) {
    console.error('Failed to set device auto unlock ready status to IndexedDB:', error);
  }
};

/**
 * Retrieves device auto-unlock ready status from IndexedDB
 */
export const getDeviceAutoUnlockReady = async (): Promise<boolean> => {
  try {
    const isReady = await get<boolean>(STORAGE_KEYS.DEVICE_AUTO_UNLOCK_READY);
    return !!isReady;
  } catch (error) {
    console.error('Failed to get device auto unlock ready status from IndexedDB:', error);
    return false;
  }
};

/**
 * Clears Keys (Normal Logout)
 * Only removes local decryption keys, but preserves history database (keychain-db)
 * so users don't lose chats when logging back in.
 */
export const clearKeys = async (): Promise<void> => {
  try {
    await del(STORAGE_KEYS.ENCRYPTED_KEYS);
    await del(STORAGE_KEYS.DEVICE_AUTO_UNLOCK_KEY);
    await del(STORAGE_KEYS.DEVICE_AUTO_UNLOCK_READY);
  } catch (error) {
    console.error('Failed to clear keys:', error);
  }
};

/**
 * NUCLEAR WIPE (Emergency Eject)
 * Deletes ALL data traces from this browser.
 * - Deletes Session Keys & History (IndexedDB)
 * - Deletes Master Keys (IDB-Keyval)
 * - Deletes LocalStorage & SessionStorage
 */
export const nuclearWipe = async (): Promise<void> => {
  try {
    console.warn("INITIATING NUCLEAR WIPE...");

    // 1. Delete Master Keys
    await clearKeys();

    // 2. Delete History & Session Keys (The Vault)
    await clearSessionKeys();

    // 3. Delete Bio Vault (WebAuthn PRF Storage)
    localStorage.removeItem('nyx_bio_vault');

    // 4. Delete remaining LocalStorage (User Profile, Settings, etc)
    localStorage.clear();
    sessionStorage.clear();

    console.warn("NUCLEAR WIPE COMPLETE.");
  } catch (error) {
    console.error('Nuclear wipe failed partially:', error);
  }
};

/**
 * Check if user has stored keys (for login redirect logic)
 */
export const hasStoredKeys = async (): Promise<boolean> => {
  const keys = await getEncryptedKeys();
  return !!keys;
};

// ============================================================================
// Crypto Storage Helpers (Extracted from utils/crypto.ts)
// ============================================================================

/**
 * Retrieves the master seed or throws an error if unavailable
 */
async function getMasterSeedOrThrow(): Promise<Uint8Array> {
  const masterSeed = await useAuthStore.getState().getMasterSeed();
  if (!masterSeed) {
    throw new Error("Master key locked or unavailable. Please unlock your session.");
  }
  return masterSeed;
}

/**
 * Securely stores an encrypted RatchetState for a conversation
 */
export async function storeRatchetStateSecurely(
  conversationId: string,
  state: SerializedRatchetState
): Promise<void> {
  const masterSeed = await getMasterSeedOrThrow();
  const { worker_encrypt_session_key } = await getWorkerProxy();
  const stateBytes = new TextEncoder().encode(JSON.stringify(state));
  const encryptedState = await worker_encrypt_session_key(stateBytes, masterSeed);
  await storeRatchetSession(conversationId, encryptedState);
}

/**
 * Securely retrieves a RatchetState for a conversation
 */
export async function retrieveRatchetStateSecurely(
  conversationId: string
): Promise<SerializedRatchetState | null> {
  const encryptedState = await getRatchetSession(conversationId);
  if (!encryptedState) return null;

  try {
    const masterSeed = await getMasterSeedOrThrow();
    const { worker_decrypt_session_key } = await getWorkerProxy();
    const stateBytes = await worker_decrypt_session_key(encryptedState, masterSeed);
    return JSON.parse(new TextDecoder().decode(stateBytes));
  } catch (error) {
    console.error(`Failed to decrypt ratchet state for ${conversationId}:`, error);
    return null;
  }
}

/**
 * Securely stores an encrypted skipped message key
 */
export async function storeSkippedMessageKeySecurely(
  headerKey: string,
  mkString: string
): Promise<void> {
  const masterSeed = await getMasterSeedOrThrow();
  const { worker_encrypt_session_key } = await getWorkerProxy();
  const mkBytes = new TextEncoder().encode(mkString);
  const encryptedMk = await worker_encrypt_session_key(mkBytes, masterSeed);
  await storeSkippedKey(headerKey, encryptedMk);
}

/**
 * Securely retrieves a skipped message key
 */
export async function retrieveSkippedMessageKeySecurely(
  headerKey: string
): Promise<string | null> {
  const encryptedMk = await getSkippedKey(headerKey);
  if (!encryptedMk) return null;

  try {
    const masterSeed = await getMasterSeedOrThrow();
    const { worker_decrypt_session_key } = await getWorkerProxy();
    const mkBytes = await worker_decrypt_session_key(encryptedMk, masterSeed);
    return new TextDecoder().decode(mkBytes);
  } catch (error) {
    console.error(`Failed to decrypt skipped key ${headerKey}:`, error);
    return null;
  }
}

/**
 * Securely stores an encrypted message key
 */
export async function storeMessageKeySecurely(
  messageId: string,
  mk: Uint8Array
): Promise<void> {
  const masterSeed = await getMasterSeedOrThrow();
  const { worker_encrypt_session_key } = await getWorkerProxy();
  const encryptedMk = await worker_encrypt_session_key(mk, masterSeed);
  await storeMessageKey(messageId, encryptedMk);
}

/**
 * Securely retrieves a message key
 */
export async function retrieveMessageKeySecurely(
  messageId: string
): Promise<Uint8Array | null> {
  const encryptedMk = await getMessageKey(messageId);
  if (!encryptedMk) return null;

  try {
    const masterSeed = await getMasterSeedOrThrow();
    const { worker_decrypt_session_key } = await getWorkerProxy();
    return await worker_decrypt_session_key(encryptedMk, masterSeed);
  } catch (error) {
    console.error(`Failed to decrypt message key for ${messageId}:`, error);
    return null;
  }
}

/**
 * Deletes a message key
 */
export async function deleteMessageKeySecurely(messageId: string): Promise<void> {
  await deleteMessageKey(messageId);
}

/**
 * Securely stores an encrypted session key
 */
export async function storeSessionKeySecurely(
  conversationId: string,
  sessionId: string,
  key: Uint8Array
): Promise<void> {
  const masterSeed = await getMasterSeedOrThrow();
  const { worker_encrypt_session_key } = await getWorkerProxy();
  const encryptedKey = await worker_encrypt_session_key(key, masterSeed);
  await addSessionKey(conversationId, sessionId, encryptedKey);
}

/**
 * Securely retrieves a session key
 */
export async function retrieveSessionKeySecurely(
  conversationId: string,
  sessionId: string
): Promise<Uint8Array | null> {
  const encryptedKey = await getSessionKey(conversationId, sessionId);
  if (!encryptedKey) return null;

  try {
    const masterSeed = await getMasterSeedOrThrow();
    const { worker_decrypt_session_key } = await getWorkerProxy();
    return await worker_decrypt_session_key(encryptedKey, masterSeed);
  } catch (error) {
    console.error(`Failed to decrypt session key for ${sessionId}:`, error);
    return null;
  }
}

/**
 * Securely stores an encrypted group key
 */
export async function storeGroupKeySecurely(
  conversationId: string,
  key: Uint8Array
): Promise<void> {
  const masterSeed = await getMasterSeedOrThrow();
  const { worker_encrypt_session_key } = await getWorkerProxy();
  const encryptedKey = await worker_encrypt_session_key(key, masterSeed);
  await storeGroupKey(conversationId, encryptedKey);
}

/**
 * Securely retrieves a group key
 */
export async function retrieveGroupKeySecurely(
  conversationId: string
): Promise<Uint8Array | null> {
  const encryptedKey = await getGroupKey(conversationId);
  if (!encryptedKey) return null;

  try {
    const masterSeed = await getMasterSeedOrThrow();
    const { worker_decrypt_session_key } = await getWorkerProxy();
    return await worker_decrypt_session_key(encryptedKey, masterSeed);
  } catch (error) {
    console.error(`Failed to decrypt group key for ${conversationId}:`, error);
    return null;
  }
}

/**
 * Securely retrieves the latest session key for a conversation
 */
export async function retrieveLatestSessionKeySecurely(
  conversationId: string
): Promise<{ sessionId: string; key: Uint8Array } | null> {
  const latest = await getLatestSessionKey(conversationId);
  if (!latest) return null;

  try {
    const masterSeed = await getMasterSeedOrThrow();
    const { worker_decrypt_session_key } = await getWorkerProxy();
    const key = await worker_decrypt_session_key(latest.key, masterSeed);
    return { sessionId: latest.sessionId, key };
  } catch (error) {
    console.error(`Failed to decrypt latest session key for ${conversationId}:`, error);
    return null;
  }
}

/**
 * Checks and refills One-Time Pre-Keys when below threshold
 */
export async function checkAndRefillOneTimePreKeys(): Promise<void> {
  try {
    const { authFetch } = await import('@lib/api');
    const { count } = await authFetch<{ count: number }>('/api/keys/count-otpk');
    const OTPK_THRESHOLD = 50;
    const OTPK_BATCH_SIZE = 100;

    if (count >= OTPK_THRESHOLD) return;

    const masterSeed = await getMasterSeedOrThrow();
    const startId = (await getLastOtpkId()) + 1;

    const { worker_generate_otpk_batch } = await getWorkerProxy();

    const batch = await worker_generate_otpk_batch(OTPK_BATCH_SIZE, startId, masterSeed);

    // Store private keys locally
    for (const key of batch) {
      await storeOneTimePreKey(key.keyId, key.encryptedPrivateKey);
    }

    // Upload public keys
    const publicKeys = batch.map((k: { keyId: number; publicKey: string }) => ({ keyId: k.keyId, publicKey: k.publicKey }));
    await authFetch('/api/keys/upload-otpk', {
      method: 'POST',
      body: JSON.stringify({ keys: publicKeys })
    });
  } catch (error) {
    console.error("[KeyStorage] Failed to refill One-Time Pre-Keys:", error);
  }
}

/**
 * Resets One-Time Pre-Keys
 */
export async function resetOneTimePreKeys(): Promise<void> {
  try {
    const { authFetch } = await import('@lib/api');
    await authFetch('/api/keys/otpk', { method: 'DELETE' });
    await checkAndRefillOneTimePreKeys();
  } catch (error) {
    console.error("[KeyStorage] Failed to reset OTPKs:", error);
  }
}

// Re-export keychainDb deletion functions for convenience
export {
  deleteRatchetSession,
  deleteSessionKeys,
  deleteConversationKeychain,
  deleteSkippedKey
} from '@lib/keychainDb';
