// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For licensing details, see LICENSE file.

/**
 * Session Key Service
 * 
 * Orchestrates session management, key distribution, and negotiation logic.
 * This service coordinates between crypto primitives and storage layers.
 * 
 * @module sessionKeyService
 */

import { authFetch } from '@lib/api';
import { useAuthStore } from '@store/auth';
import { useConversationStore, type Participant } from '@store/conversation';
import { useMessageStore } from '@store/message';
import {
  emitSessionKeyFulfillment,
  emitSessionKeyRequest,
  emitGroupKeyDistribution,
  emitGroupKeyRequest,
  emitGroupKeyFulfillment
} from '@lib/socket';
import { getGroupSenderState, saveGroupSenderState, deleteGroupSenderState, deleteGroupStates, saveGroupReceiverState } from '@lib/keychainDb';
import { getSodium } from '@lib/sodiumInitializer';

// Helper to lazy-load crypto worker proxy
async function getWorkerProxy() {
  return import('@lib/crypto-worker-proxy');
}

// Storage functions from keyStorage layer
import {
  storeSessionKeySecurely,
  retrieveSessionKeySecurely,
  storeGroupKeySecurely,
  retrieveGroupKeySecurely,
  retrieveLatestSessionKeySecurely,
  storeRatchetStateSecurely,
  retrieveRatchetStateSecurely,
  storeMessageKeySecurely,
  retrieveMessageKeySecurely,
  deleteMessageKeySecurely,
  checkAndRefillOneTimePreKeys,
  resetOneTimePreKeys,
  deleteRatchetSession,
  deleteSessionKeys,
  deleteConversationKeychain
} from '@lib/keyStorage';

// Crypto primitives from utils/crypto
import {
  decryptSessionKeyForUser,
  getMyEncryptionKeyPair,
  type PreKeyBundle
} from '@utils/crypto';

// ============================================================================
// Types
// ============================================================================

export interface GroupFulfillRequestPayload {
  conversationId: string;
  requesterId: string;
  requesterPublicKey: string;
}

export interface FulfillRequestPayload {
  conversationId: string;
  sessionId: string;
  requesterId: string;
  requesterPublicKey: string;
}

export interface ReceiveKeyPayload {
  conversationId: string;
  sessionId?: string;
  encryptedKey: string;
  type?: 'GROUP_KEY' | 'SESSION_KEY';
  senderId?: string;
  initiatorEphemeralKey?: string;
  initiatorIdentityKey?: string;
}

// ============================================================================
// Module State
// ============================================================================

const pendingGroupKeyRequests = new Map<string, { timerId: number }>();
const MAX_KEY_REQUEST_RETRIES = 2; // Total 3 attempts
const KEY_REQUEST_TIMEOUT_MS = 15000; // 15 seconds

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pendingGroupSessionPromises = new Map<string, Promise<any[] | null>>();
const groupSessionLocks = new Set<string>();

const periodicGroupKeyRotationTimers = new Map<string, NodeJS.Timeout>();

// ============================================================================
// Group Session Management
// ============================================================================

/**
 * Ensures a group session exists, creating one if necessary
 * Uses Sender Key Protocol for group encryption
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureGroupSession(
  conversationId: string,
  participants: Participant[],
  forceRotate: boolean = false
): Promise<any[] | null> {
  const pending = pendingGroupSessionPromises.get(conversationId);
  if (pending) return pending;

  if (groupSessionLocks.has(conversationId)) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!groupSessionLocks.has(conversationId)) {
          clearInterval(interval);
          ensureGroupSession(conversationId, participants, forceRotate).then(resolve);
        }
      }, 10);
    });
  }

  groupSessionLocks.add(conversationId);

  const promise = (async () => {
    try {
      // PHASE 2: Sender Key Protocol
      if (forceRotate) {
        await deleteGroupSenderState(conversationId);
        console.log(`[SessionKeyService] Forced rotation for group ${conversationId}`);
      }

      const existingSenderState = await getGroupSenderState(conversationId);
      if (existingSenderState) return null; // We already have a sender key for this group

      const sodium = await getSodium();
      const { groupInitSenderKey, worker_crypto_box_seal } = await getWorkerProxy();

      // 1. Generate NEW Sender Key (Chain Key)
      const { senderKeyB64 } = await groupInitSenderKey();

      const myId = useAuthStore.getState().user?.id;
      const otherParticipants = participants.filter(p => p.id !== myId);
      const missingKeys: string[] = [];

      // 2. Encrypt Sender Key for EACH participant (Fan-out)
      const distributionKeys = await Promise.all(
        otherParticipants.map(async (p) => {
          if (!p.publicKey) {
            missingKeys.push(p.id);
            return null;
          }
          const theirPublicKey = sodium.from_base64(p.publicKey, sodium.base64_variants.URLSAFE_NO_PADDING);
          const encryptedKey = await worker_crypto_box_seal(
            sodium.from_base64(senderKeyB64, sodium.base64_variants.URLSAFE_NO_PADDING),
            theirPublicKey
          );

          return {
            userId: p.id,
            key: sodium.to_base64(encryptedKey, sodium.base64_variants.URLSAFE_NO_PADDING),
            type: 'GROUP_KEY' as const
          };
        })
      );

      // 3. Save Initial Sender State ONLY after successful encryption fan-out
      await saveGroupSenderState({
        conversationId,
        CK: senderKeyB64,
        N: 0
      });

      return distributionKeys.filter(Boolean);
    } finally {
      groupSessionLocks.delete(conversationId);
    }
  })();

  pendingGroupSessionPromises.set(conversationId, promise);
  try {
    return await promise;
  } finally {
    pendingGroupSessionPromises.delete(conversationId);
  }
}

/**
 * Handles distribution of a group key from another participant
 */
export async function handleGroupKeyDistribution(
  conversationId: string,
  encryptedKey: string,
  senderId: string
): Promise<void> {
  const { publicKey, privateKey } = await getMyEncryptionKeyPair();

  // 1. Decrypt the Sender Key (Chain Key)
  const senderKeyBytes = await decryptSessionKeyForUser(encryptedKey, publicKey, privateKey);
  const sodium = await getSodium();
  const senderKeyB64 = sodium.to_base64(senderKeyBytes, sodium.base64_variants.URLSAFE_NO_PADDING);

  // 2. Save as Receiver State
  await saveGroupReceiverState({
    id: `${conversationId}_${senderId}`,
    conversationId,
    senderId,
    CK: senderKeyB64,
    N: 0
  });
}

/**
 * Rotates a group key, optionally notifying the server
 */
export async function rotateGroupKey(
  conversationId: string,
  reason: 'membership_change' | 'periodic_rotation' = 'membership_change'
): Promise<void> {
  // Clear OLD states
  await deleteGroupStates(conversationId);

  try {
    await authFetch(`/api/conversations/${conversationId}/key-rotation`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  } catch (error) {
    console.error(`[SessionKeyService] Failed to notify server about key rotation for ${conversationId}:`, error);
  }

  if (reason === 'membership_change') {
    const conversation = useConversationStore.getState().conversations.find(c => c.id === conversationId);
    if (conversation) {
      const distributionKeys = await ensureGroupSession(conversationId, conversation.participants);
      if (distributionKeys) {
        emitGroupKeyDistribution(conversationId, distributionKeys);
      }
    }
  }
}

/**
 * Schedules periodic group key rotation
 */
export async function schedulePeriodicGroupKeyRotation(conversationId: string): Promise<void> {
  stopPeriodicGroupKeyRotation(conversationId);

  const rotationInterval = 24 * 60 * 60 * 1000; // 24 hours
  const timerId = setInterval(async () => {
    await rotateGroupKey(conversationId, 'periodic_rotation');
  }, rotationInterval);

  periodicGroupKeyRotationTimers.set(conversationId, timerId);
}

/**
 * Stops periodic group key rotation
 */
export function stopPeriodicGroupKeyRotation(conversationId: string): void {
  const timerId = periodicGroupKeyRotationTimers.get(conversationId);
  if (timerId) {
    clearInterval(timerId);
    periodicGroupKeyRotationTimers.delete(conversationId);
  }
}

/**
 * Forces rotation of the group sender key
 */
export async function forceRotateGroupSenderKey(conversationId: string): Promise<void> {
  try {
    await deleteGroupSenderState(conversationId);
    console.log(`[SessionKeyService] Group Sender Key for ${conversationId} wiped. Forced rotation on next message.`);
  } catch (error) {
    console.error('Failed to rotate group key:', error);
  }
}

// ============================================================================
// Key Request Handling
// ============================================================================

/**
 * Requests a group key with timeout and retry logic
 * @internal - Exported for crypto.ts usage only
 */
export async function requestGroupKeyWithTimeout(
  conversationId: string,
  attempt = 0
): Promise<void> {
  if (pendingGroupKeyRequests.has(conversationId)) return;

  emitGroupKeyRequest(conversationId);

  const timerId = window.setTimeout(async () => {
    pendingGroupKeyRequests.delete(conversationId);
    if (attempt < MAX_KEY_REQUEST_RETRIES) {
      requestGroupKeyWithTimeout(conversationId, attempt + 1);
    } else {
      useMessageStore.getState().failPendingMessages(conversationId, '[Key request timed out]');
    }
  }, KEY_REQUEST_TIMEOUT_MS);

  pendingGroupKeyRequests.set(conversationId, { timerId });
}

/**
 * Fulfills a group key request from another participant
 */
export async function fulfillGroupKeyRequest(
  payload: GroupFulfillRequestPayload
): Promise<void> {
  const { conversationId, requesterId, requesterPublicKey: requesterPublicKeyB64 } = payload;
  const conversation = useConversationStore.getState().conversations.find(
    c => c.id === conversationId
  );
  
  if (!conversation || !conversation.participants.some(p => p.id === requesterId)) return;

  // [FIX] Send the CURRENT Sender Key (Ratchet Chain Key)
  const senderState = await getGroupSenderState(conversationId);
  if (!senderState) return;

  const sodium = await getSodium();
  const { worker_crypto_box_seal } = await getWorkerProxy();

  const requesterPublicKey = sodium.from_base64(
    requesterPublicKeyB64,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );
  const senderKeyBytes = sodium.from_base64(
    senderState.CK,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );
  const encryptedKeyForRequester = await worker_crypto_box_seal(
    senderKeyBytes,
    requesterPublicKey
  );

  emitGroupKeyFulfillment({
    requesterId,
    conversationId,
    encryptedKey: sodium.to_base64(
      encryptedKeyForRequester,
      sodium.base64_variants.URLSAFE_NO_PADDING
    ),
  });
}

/**
 * Fulfills a session key request from another participant
 */
export async function fulfillKeyRequest(
  payload: FulfillRequestPayload
): Promise<void> {
  const { conversationId, sessionId, requesterId, requesterPublicKey: requesterPublicKeyB64 } = payload;
  const key = await retrieveSessionKeySecurely(conversationId, sessionId);
  if (!key) return;

  const sodium = await getSodium();
  const { worker_crypto_box_seal } = await getWorkerProxy();

  const requesterPublicKey = sodium.from_base64(
    requesterPublicKeyB64,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );
  const encryptedKeyForRequester = await worker_crypto_box_seal(key, requesterPublicKey);

  emitSessionKeyFulfillment({
    requesterId,
    conversationId,
    sessionId,
    encryptedKey: sodium.to_base64(
      encryptedKeyForRequester,
      sodium.base64_variants.URLSAFE_NO_PADDING
    ),
  });
}

// ============================================================================
// Session Key Derivation (X3DH)
// ============================================================================

/**
 * Derives a session key as the recipient in an X3DH exchange
 */
export async function deriveSessionKeyAsRecipient(
  myIdentityKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array },
  mySignedPreKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array },
  initiatorIdentityKeyStr: string,
  initiatorEphemeralKeyStr: string,
  otpkId?: number
): Promise<Uint8Array> {
  const sodium = await getSodium();
  const { worker_x3dh_recipient, worker_decrypt_session_key } = await getWorkerProxy();

  const theirIdentityKey = sodium.from_base64(
    initiatorIdentityKeyStr,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );
  const theirEphemeralKey = sodium.from_base64(
    initiatorEphemeralKeyStr,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );

  let myOneTimePreKey: { privateKey: Uint8Array } | undefined;

  if (otpkId !== undefined) {
    // Get master seed for OTPK decryption
    const masterSeed = await useAuthStore.getState().getMasterSeed();
    if (!masterSeed) {
      throw new Error("Master seed unavailable for OTPK decryption");
    }

    // 1. Try Retrieve Encrypted OTPK Private Key from Local Storage
    const encryptedOtpk = await import('@lib/keychainDb').then(m => m.getOneTimePreKey(otpkId));

    if (encryptedOtpk) {
      try {
        const otpkPrivateKey = await worker_decrypt_session_key(encryptedOtpk, masterSeed);
        myOneTimePreKey = { privateKey: otpkPrivateKey };
      } catch (error) {
        console.error("Failed to decrypt stored OTPK:", error);
      }
    }

    // 2. RECOVERY: If not found (e.g. after logout/restore), Regenerate Deterministically
    if (!myOneTimePreKey) {
      try {
        const { worker_x3dh_recipient_regenerate } = await getWorkerProxy();
        const sessionKey = await worker_x3dh_recipient_regenerate({
          keyId: otpkId,
          masterSeed,
          myIdentityKey: myIdentityKeyPair,
          mySignedPreKey: mySignedPreKeyPair,
          theirIdentityKey: sodium.from_base64(
            initiatorIdentityKeyStr,
            sodium.base64_variants.URLSAFE_NO_PADDING
          ),
          theirEphemeralKey: sodium.from_base64(
            initiatorEphemeralKeyStr,
            sodium.base64_variants.URLSAFE_NO_PADDING
          )
        });
        return sessionKey;
      } catch (error) {
        console.error(`[X3DH] Failed to regenerate OTPK ${otpkId}:`, error);
      }
    }
  }

  try {
    const sessionKey = await worker_x3dh_recipient({
      myIdentityKey: myIdentityKeyPair,
      mySignedPreKey: mySignedPreKeyPair,
      theirIdentityKey,
      theirEphemeralKey,
      myOneTimePreKey
    });

    // 3. Perfect Forward Secrecy: Delete the OTPK after use
    if (otpkId !== undefined) {
      await import('@lib/keychainDb').then(m => m.deleteOneTimePreKey(otpkId));
    }

    return sessionKey;
  } finally {
    // Cleanup if needed (worker handles most)
  }
}

/**
 * Stores a received session key (handles both GROUP_KEY and SESSION_KEY types)
 */
export async function storeReceivedSessionKey(
  payload: ReceiveKeyPayload
): Promise<void> {
  if (!payload || typeof payload !== 'object') return;
  
  const {
    conversationId,
    sessionId,
    encryptedKey,
    type,
    senderId,
    initiatorEphemeralKey,
    initiatorIdentityKey
  } = payload;

  if (encryptedKey === 'dummy' || (sessionId && sessionId.startsWith('dummy'))) {
    console.warn("🛡️ [SessionKeyService] BLOCKED DUMMY KEY FROM SERVER!", { conversationId, sessionId });
    return;
  }

  if (type === 'GROUP_KEY') {
    if (!senderId) {
      console.error("Received GROUP_KEY but missing senderId. Cannot store key.");
      return;
    }
    const pendingRequest = pendingGroupKeyRequests.get(conversationId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timerId);
      pendingGroupKeyRequests.delete(conversationId);
    }

    // Use the NEW handler for Sender Key
    await handleGroupKeyDistribution(conversationId, encryptedKey, senderId);

    // Trigger reprocessing of pending messages
    useMessageStore.getState().reDecryptPendingMessages(conversationId);

  } else if (sessionId) {
    let newSessionKey: Uint8Array | undefined;

    if (encryptedKey.startsWith('{') && encryptedKey.includes('"x3dh":true')) {
      try {
        const metadata = JSON.parse(encryptedKey);
        if (metadata.x3dh && initiatorEphemeralKey && initiatorIdentityKey) {
          const { getEncryptionKeyPair, getSignedPreKeyPair } = useAuthStore.getState();
          const myIdentityKeyPair = await getEncryptionKeyPair();
          const mySignedPreKeyPair = await getSignedPreKeyPair();

          newSessionKey = await deriveSessionKeyAsRecipient(
            myIdentityKeyPair,
            mySignedPreKeyPair,
            initiatorIdentityKey,
            initiatorEphemeralKey,
            metadata.otpkId
          );
        } else {
          throw new Error("Invalid X3DH payload");
        }
      } catch (error) {
        console.error("X3DH derivation failed, falling back to legacy decrypt:", error);
        if (encryptedKey.length > 20 && !encryptedKey.trim().startsWith('{')) {
          const { publicKey, privateKey } = await getMyEncryptionKeyPair();
          newSessionKey = await decryptSessionKeyForUser(encryptedKey, publicKey, privateKey);
        } else {
          console.warn("[SessionKeyService] Skipping decryption for invalid/placeholder or JSON key.");
          return;
        }
      }
    } else {
      if (!encryptedKey || encryptedKey.length < 20 || encryptedKey.trim().startsWith('{')) {
        console.warn("[SessionKeyService] Received empty, short, or JSON session key where base64 was expected. Ignoring.");
        return;
      }

      const { publicKey, privateKey } = await getMyEncryptionKeyPair();
      newSessionKey = await decryptSessionKeyForUser(encryptedKey, publicKey, privateKey);
    }

    if (newSessionKey) {
      await storeSessionKeySecurely(conversationId, sessionId, newSessionKey);

      useMessageStore.getState().reDecryptPendingMessages(conversationId);
    }
  }
}

// ============================================================================
// Session Ratcheting
// ============================================================================

/**
 * Ensures and ratchets a session, fetching new keys from server if needed
 */
export async function ensureAndRatchetSession(conversationId: string): Promise<void> {
  try {
    const { sessionId, encryptedKey } = await authFetch<{ sessionId: string; encryptedKey: string }>(
      `/api/session-keys/${conversationId}/ratchet`,
      { method: 'POST' }
    );
    const { publicKey, privateKey } = await getMyEncryptionKeyPair();
    const newSessionKey = await decryptSessionKeyForUser(encryptedKey, publicKey, privateKey);

    await storeSessionKeySecurely(conversationId, sessionId, newSessionKey);
  } catch (error) {
    console.error(`Failed to ratchet session for ${conversationId}:`, error);
    throw new Error('Could not establish a secure session.');
  }
}

// ============================================================================
// One-Time Pre-Key Management
// ============================================================================

export { checkAndRefillOneTimePreKeys, resetOneTimePreKeys };

// ============================================================================
// Re-exports for convenience
// ============================================================================

export {
  // Storage functions
  storeSessionKeySecurely,
  retrieveSessionKeySecurely,
  storeGroupKeySecurely,
  retrieveGroupKeySecurely,
  retrieveLatestSessionKeySecurely,
  storeRatchetStateSecurely,
  retrieveRatchetStateSecurely,
  storeMessageKeySecurely,
  retrieveMessageKeySecurely,
  deleteMessageKeySecurely,
  // Cleanup functions
  deleteRatchetSession,
  deleteSessionKeys,
  deleteConversationKeychain
} from '@lib/keyStorage';
