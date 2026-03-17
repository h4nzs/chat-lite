// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For licensing details, see LICENSE file.

/**
 * Cryptographic Primitives
 * 
 * Pure cryptographic functions for encryption, decryption, and key derivation.
 * This module contains NO storage or session management logic.
 * 
 * @module crypto
 */

import { getSodium } from '@lib/sodiumInitializer';
import { useAuthStore } from '@store/auth';
import { useConversationStore } from '@store/conversation';
import { getGroupSenderState, saveGroupSenderState, getGroupReceiverState, saveGroupReceiverState, storeGroupSkippedKey, takeGroupSkippedKey } from '@lib/keychainDb';

// Helper to lazy-load crypto worker proxy
async function getWorkerProxy() {
  return import('@lib/crypto-worker-proxy');
}

// Storage functions are now imported from keyStorage
import {
  storeRatchetStateSecurely,
  retrieveRatchetStateSecurely,
  storeMessageKeySecurely,
  retrieveMessageKeySecurely,
  storeSkippedMessageKeySecurely,
  retrieveSkippedMessageKeySecurely,
  retrieveSessionKeySecurely,
  deleteSkippedKey
} from '@lib/keyStorage';

// Session management is now in sessionKey.service
import { requestGroupKeyWithTimeout } from '@services/sessionKey.service';
import { emitSessionKeyRequest } from '@lib/socket';

// ============================================================================
// Types
// ============================================================================

export type DecryptResult =
  | { status: 'success'; value: string }
  | { status: 'pending'; reason: string }
  | { status: 'error'; error: Error };

export type PreKeyBundle = {
  identityKey: string;
  signingKey: string;
  signedPreKey: {
    key: string;
    signature: string;
  };
  oneTimePreKey?: {
    keyId: number;
    key: string;
  };
};

export interface DrHeader {
  dh: string;
  pn: number;
  n: number;
  epk?: string;
}

// ============================================================================
// Module State
// ============================================================================

// Unified Ratchet Mutex - Ensures that only one operation (Encrypt OR Decrypt)
// can modify the ratchet state of a conversation at any given time.
const ratchetLocks = new Map<string, Promise<void>>();

async function acquireRatchetLock(conversationId: string): Promise<() => void> {
  const previousLock = ratchetLocks.get(conversationId) || Promise.resolve();
  let release: () => void;
  const currentLock = new Promise<void>(resolve => { release = resolve; });
  ratchetLocks.set(conversationId, currentLock);

  // Wait for the previous lock to release
  await previousLock;

  return () => {
    release();
    if (ratchetLocks.get(conversationId) === currentLock) {
      ratchetLocks.delete(conversationId);
    }
  };
}

// ============================================================================
// E2EE WebRTC Signaling Helpers
// ============================================================================

export async function generateCallKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  const sodium = await getSodium();
  return sodium.to_base64(new Uint8Array(exported), sodium.base64_variants.URLSAFE_NO_PADDING);
}

export async function encryptCallSignal(
  payload: object,
  base64Key: string
): Promise<string> {
  const sodium = await getSodium();
  const keyBytes = sodium.from_base64(base64Key, sodium.base64_variants.URLSAFE_NO_PADDING);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedPayload
  );

  const encryptedBytes = new Uint8Array(encryptedBuf);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv, 0);
  combined.set(encryptedBytes, iv.length);

  return sodium.to_base64(combined, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export async function decryptCallSignal(
  encryptedStr: string,
  base64Key: string
): Promise<Record<string, unknown>> {
  const sodium = await getSodium();
  const keyBytes = sodium.from_base64(base64Key, sodium.base64_variants.URLSAFE_NO_PADDING);
  const combined = sodium.from_base64(encryptedStr, sodium.base64_variants.URLSAFE_NO_PADDING);

  const iv = combined.slice(0, 12);
  const encryptedBytes = combined.slice(12);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encryptedBytes
  );

  const jsonStr = new TextDecoder().decode(decryptedBuf);
  return JSON.parse(jsonStr);
}

// ============================================================================
// User Key Management
// ============================================================================

export async function getMyEncryptionKeyPair(): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  return useAuthStore.getState().getEncryptionKeyPair();
}

export async function decryptSessionKeyForUser(
  encryptedSessionKeyStr: string,
  publicKey: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  const sodium = await getSodium();
  const { worker_crypto_box_seal_open } = await getWorkerProxy();

  if (!privateKey || privateKey.length !== sodium.crypto_box_SECRETKEYBYTES) {
    throw new TypeError("Invalid privateKey length for session key decryption.");
  }
  if (!publicKey || publicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new TypeError("Invalid publicKey length for session key decryption.");
  }

  const encryptedSessionKey = sodium.from_base64(
    encryptedSessionKeyStr,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );
  const sessionKey = await worker_crypto_box_seal_open(
    encryptedSessionKey,
    publicKey,
    privateKey
  );

  if (!sessionKey) {
    throw new Error(
      "Failed to decrypt session key, likely due to incorrect key pair or corrupted data."
    );
  }

  return sessionKey;
}

// ============================================================================
// Message Encryption
// ============================================================================

const XCHACHA20_NONCE_BYTES = 24;

export async function encryptMessage(
  text: string,
  conversationId: string,
  isGroup: boolean = false,
  existingSession?: { sessionId: string; key: Uint8Array },
  messageId?: string
): Promise<{
  ciphertext: string;
  sessionId?: string;
  drHeader?: DrHeader;
  mk?: Uint8Array;
}> {
  const release = await acquireRatchetLock(conversationId);
  try {
    return await doEncryptMessage(
      text,
      conversationId,
      isGroup,
      existingSession,
      messageId
    );
  } finally {
    release();
  }
}

async function doEncryptMessage(
  text: string,
  conversationId: string,
  isGroup: boolean = false,
  existingSession?: { sessionId: string; key: Uint8Array },
  messageId?: string
): Promise<{
  ciphertext: string;
  sessionId?: string;
  drHeader?: DrHeader;
  mk?: Uint8Array;
}> {
  const sodium = await getSodium();
  const {
    worker_crypto_secretbox_xchacha20poly1305_easy,
    worker_dr_ratchet_encrypt,
    groupRatchetEncrypt
  } = await getWorkerProxy();

  if (isGroup) {
    // SENDER KEY PROTOCOL
    const senderState = await getGroupSenderState(conversationId);
    if (!senderState)
      throw new Error(`No sender key available for conversation ${conversationId}.`);

    const signingPrivateKey = await useAuthStore.getState().getSigningPrivateKey();

    // Encrypt & Ratchet
    const result = await groupRatchetEncrypt(
      { CK: senderState.CK, N: senderState.N },
      text,
      signingPrivateKey
    );

    // Store message key before updating state
    if (messageId && result.mk) {
      await storeMessageKeySecurely(messageId, result.mk);
    }

    // Update State
    await saveGroupSenderState({
      conversationId,
      CK: result.state.CK,
      N: result.state.N
    });

    // Construct Payload
    const payload = JSON.stringify({
      header: result.header,
      ciphertext: sodium.to_base64(result.ciphertext, sodium.base64_variants.URLSAFE_NO_PADDING),
      signature: result.signature
    });

    return { ciphertext: payload, mk: result.mk };
  } else {
    // DOUBLE RATCHET
    const state = await retrieveRatchetStateSecurely(conversationId);
    if (!state) throw new Error('Ratchet state not initialized for encryption.');

    const result = await worker_dr_ratchet_encrypt({
      serializedState: state,
      plaintext: text
    });

    const mkUint8 = new Uint8Array(result.mk);

    if (messageId) {
      await storeMessageKeySecurely(messageId, mkUint8);
    }

    await storeRatchetStateSecurely(conversationId, result.state);

    return {
      ciphertext: sodium.to_base64(result.ciphertext, sodium.base64_variants.URLSAFE_NO_PADDING),
      drHeader: result.header as DrHeader,
      mk: mkUint8
    };
  }
}

// ============================================================================
// Message Decryption
// ============================================================================

export async function decryptMessage(
  cipher: string,
  conversationId: string,
  isGroup: boolean,
  sessionId: string | null | undefined,
  messageId?: string
): Promise<DecryptResult> {
  const release = await acquireRatchetLock(conversationId);
  try {
    return await doDecryptMessage(cipher, conversationId, isGroup, sessionId, messageId);
  } finally {
    release();
  }
}

async function doDecryptMessage(
  cipher: string,
  conversationId: string,
  isGroup: boolean,
  sessionId: string | null | undefined,
  messageId?: string
): Promise<DecryptResult> {
  if (!cipher) return { status: 'success', value: '' };

  const sodium = await getSodium();
  const {
    worker_crypto_secretbox_xchacha20poly1305_open_easy,
    groupRatchetDecrypt,
    groupDecryptSkipped
  } = await getWorkerProxy();

  // GLOBAL SHORTCUT: Check Local Message Key Cache First
  if (messageId) {
    const mk = await retrieveMessageKeySecurely(messageId);
    if (mk) {
      let actualCipher = cipher;

      const unwrapCipher = (str: string): string => {
        if (str && typeof str === 'string' && str.trim().startsWith('{')) {
          try {
            const p = JSON.parse(str);
            if (p.dr && p.ciphertext) return unwrapCipher(p.ciphertext);
            if (p.ciphertext) return unwrapCipher(p.ciphertext);
          } catch {}
        }
        return str;
      };

      actualCipher = unwrapCipher(cipher);

      try {
        const combined = sodium.from_base64(
          actualCipher,
          sodium.base64_variants.URLSAFE_NO_PADDING
        );
        const nonce = combined.slice(0, XCHACHA20_NONCE_BYTES);
        const encrypted = combined.slice(XCHACHA20_NONCE_BYTES);
        const decrypted = await worker_crypto_secretbox_xchacha20poly1305_open_easy(
          encrypted,
          nonce,
          mk
        );
        return { status: 'success', value: sodium.to_string(decrypted) };
      } catch (error) {
        // Fail silently and try fallback
      }
    }
  }

  if (isGroup) {
    const senderId = sessionId;

    if (!senderId)
      return {
        status: 'error',
        error: new Error('Missing senderId for group decryption')
      };

    const receiverState = await getGroupReceiverState(conversationId, senderId);
    if (!receiverState) {
      requestGroupKeyWithTimeout(conversationId);
      return { status: 'pending', reason: 'waiting_for_key' };
    }

    try {
      const payload = JSON.parse(cipher);
      const { header, ciphertext, signature } = payload;

      // Resolve Sender Signing Key
      const conversation = useConversationStore.getState().conversations.find(
        c => c.id === conversationId
      );
      const sender = conversation?.participants.find(p => p.id === senderId);
      const keyToUse = sender?.signingKey;

      if (!keyToUse) {
        return { status: 'error', error: new Error('Missing sender signing key') };
      }

      const senderSigningKey = sodium.from_base64(
        keyToUse,
        sodium.base64_variants.URLSAFE_NO_PADDING
      );
      const ciphertextBytes = sodium.from_base64(
        ciphertext,
        sodium.base64_variants.URLSAFE_NO_PADDING
      );

      // 1. CHECK SKIPPED KEYS FIRST (ATOMIC)
      const skippedMkB64 = await takeGroupSkippedKey(
        conversationId,
        senderId,
        header.n
      );

      if (skippedMkB64) {
        // SECURITY FIX: Decrypt via Worker (Verifies Signature)
        const result = await groupDecryptSkipped(
          skippedMkB64,
          header.n,
          ciphertextBytes,
          signature,
          senderSigningKey
        );

        if (messageId) {
          const mkBytes = sodium.from_base64(
            skippedMkB64,
            sodium.base64_variants.URLSAFE_NO_PADDING
          );
          await storeMessageKeySecurely(messageId, mkBytes);
        }
        return { status: 'success', value: sodium.to_string(result.plaintext) };
      }

      const result = await groupRatchetDecrypt(
        { CK: receiverState.CK, N: receiverState.N },
        header,
        ciphertextBytes,
        signature,
        senderSigningKey
      );

      // 2. Store gaps separately
      for (const sk of result.skippedKeys) {
        await storeGroupSkippedKey(conversationId, senderId, sk.n, sk.mk);
      }

      await saveGroupReceiverState({
        ...receiverState,
        id: receiverState.id,
        conversationId,
        senderId,
        CK: result.state.CK,
        N: result.state.N
      });

      // Save Message Key for Fast Reloads
      if (messageId && result.mk) {
        await storeMessageKeySecurely(messageId, result.mk);
      }

      return { status: 'success', value: sodium.to_string(result.plaintext) };
    } catch (error: unknown) {
      console.error(`Group Decryption failed for convo ${conversationId}:`, error);
      return {
        status: 'error',
        error:
          error instanceof Error
            ? error
            : new Error('Failed to decrypt group message')
      };
    }
  } else {
    // DOUBLE RATCHET & LEGACY FALLBACK
    try {
      let payload;
      try {
        payload = JSON.parse(cipher);
      } catch {
        if (!sessionId)
          return {
            status: 'error',
            error: new Error('Cannot decrypt legacy message: Missing session ID.')
          };
        const key = await retrieveSessionKeySecurely(conversationId, sessionId);
        if (!key) {
          emitSessionKeyRequest(conversationId, sessionId);
          return { status: 'pending', reason: '[Requesting key to decrypt...]' };
        }
        const combined = sodium.from_base64(cipher, sodium.base64_variants.URLSAFE_NO_PADDING);
        const nonce = combined.slice(0, XCHACHA20_NONCE_BYTES);
        const encrypted = combined.slice(XCHACHA20_NONCE_BYTES);
        const decrypted = await worker_crypto_secretbox_xchacha20poly1305_open_easy(
          encrypted,
          nonce,
          key
        );
        return { status: 'success', value: sodium.to_string(decrypted) };
      }

      if (!payload.dr || !payload.ciphertext) {
        if (!sessionId)
          return {
            status: 'error',
            error: new Error('Cannot decrypt legacy message: Missing session ID.')
          };
        const key = await retrieveSessionKeySecurely(conversationId, sessionId);
        if (!key) {
          emitSessionKeyRequest(conversationId, sessionId);
          return { status: 'pending', reason: '[Requesting key to decrypt...]' };
        }
        const combined = sodium.from_base64(cipher, sodium.base64_variants.URLSAFE_NO_PADDING);
        const nonce = combined.slice(0, XCHACHA20_NONCE_BYTES);
        const encrypted = combined.slice(XCHACHA20_NONCE_BYTES);
        const decrypted = await worker_crypto_secretbox_xchacha20poly1305_open_easy(
          encrypted,
          nonce,
          key
        );
        return { status: 'success', value: sodium.to_string(decrypted) };
      }

      const drHeader = payload.dr;
      const actualCipher = payload.ciphertext;
      // Prefer epk if present, otherwise fallback to dh
      const dhKey = drHeader.epk || drHeader.dh;
      const headerKey = `${conversationId}_${dhKey}_${drHeader.n}`;

      const skippedMkStr = await retrieveSkippedMessageKeySecurely(headerKey);
      if (skippedMkStr) {
        const mk = sodium.from_base64(skippedMkStr, sodium.base64_variants.URLSAFE_NO_PADDING);
        const combined = sodium.from_base64(
          actualCipher,
          sodium.base64_variants.URLSAFE_NO_PADDING
        );
        const nonce = combined.slice(0, XCHACHA20_NONCE_BYTES);
        const encrypted = combined.slice(XCHACHA20_NONCE_BYTES);
        const decrypted = await worker_crypto_secretbox_xchacha20poly1305_open_easy(
          encrypted,
          nonce,
          mk
        );

        await deleteSkippedKey(headerKey);
        return { status: 'success', value: sodium.to_string(decrypted) };
      }

      const state = await retrieveRatchetStateSecurely(conversationId);
      if (!state) {
        return { status: 'pending', reason: 'waiting_for_ratchet_state' };
      }

      const { worker_dr_ratchet_decrypt } = await getWorkerProxy();
      const combined = sodium.from_base64(
        actualCipher,
        sodium.base64_variants.URLSAFE_NO_PADDING
      );

      const result = await worker_dr_ratchet_decrypt({
        serializedState: state,
        header: drHeader,
        ciphertext: combined
      });

      // Store intermediate keys (gaps) FIRST
      for (const sk of result.skippedKeys) {
        const skDhKey = sk.epk || sk.dh;
        const hKey = `${conversationId}_${skDhKey}_${sk.n}`;
        await storeSkippedMessageKeySecurely(hKey, sk.mk);
      }

      // Store current message key
      if (messageId) {
        await storeMessageKeySecurely(messageId, result.mk);
      }

      // Finally, update the ratchet state to advance the chain
      await storeRatchetStateSecurely(conversationId, result.state);

      return { status: 'success', value: sodium.to_string(result.plaintext) };
    } catch (error: unknown) {
      console.error(`DR Decryption failed for convo ${conversationId}:`, error);
      return {
        status: 'error',
        error:
          error instanceof Error
            ? error
            : new Error('Failed to decrypt message')
      };
    }
  }
}

// ============================================================================
// Pre-Key Handshake (Full X3DH with OTPK)
// ============================================================================

export async function establishSessionFromPreKeyBundle(
  myIdentityKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array },
  preKeyBundle: PreKeyBundle
): Promise<{
  sessionKey: Uint8Array;
  ephemeralPublicKey: string;
  otpkId?: number;
}> {
  const sodium = await getSodium();
  const { worker_x3dh_initiator } = await getWorkerProxy();

  const theirIdentityKey = sodium.from_base64(
    preKeyBundle.identityKey,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );
  const theirSignedPreKey = sodium.from_base64(
    preKeyBundle.signedPreKey.key,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );
  const theirSigningKey = sodium.from_base64(
    preKeyBundle.signingKey,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );
  const signature = sodium.from_base64(
    preKeyBundle.signedPreKey.signature,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );

  let theirOneTimePreKey: Uint8Array | undefined;
  if (preKeyBundle.oneTimePreKey) {
    theirOneTimePreKey = sodium.from_base64(
      preKeyBundle.oneTimePreKey.key,
      sodium.base64_variants.URLSAFE_NO_PADDING
    );
  }

  const result = await worker_x3dh_initiator({
    myIdentityKey: myIdentityKeyPair,
    theirIdentityKey,
    theirSignedPreKey,
    theirSigningKey,
    signature,
    theirOneTimePreKey
  });

  return {
    ...result,
    otpkId: preKeyBundle.oneTimePreKey?.keyId
  };
}

// ============================================================================
// File Encryption/Decryption
// ============================================================================

export async function encryptFile(blob: Blob): Promise<{
  encryptedBlob: Blob;
  key: string;
}> {
  const fileData = await blob.arrayBuffer();
  const sodium = await getSodium();
  const { worker_file_encrypt } = await getWorkerProxy();

  const { encryptedData, iv, key } = await worker_file_encrypt(fileData);

  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });

  const keyB64 = sodium.to_base64(key, sodium.base64_variants.URLSAFE_NO_PADDING);

  return { encryptedBlob, key: keyB64 };
}

export async function decryptFile(
  encryptedBlob: Blob,
  keyB64: string,
  originalType: string
): Promise<Blob> {
  const sodium = await getSodium();
  const { worker_file_decrypt } = await getWorkerProxy();

  const keyBytes = sodium.from_base64(keyB64, sodium.base64_variants.URLSAFE_NO_PADDING);
  const combinedData = await encryptedBlob.arrayBuffer();
  if (combinedData.byteLength < 12) throw new Error("Encrypted file is too short.");

  const decryptedData = await worker_file_decrypt(combinedData, keyBytes);

  return new Blob([decryptedData], { type: originalType });
}

// ============================================================================
// Safety Number Generation
// ============================================================================

export async function generateSafetyNumber(
  myPublicKey: Uint8Array,
  theirPublicKey: Uint8Array
): Promise<string> {
  const { generateSafetyNumber: workerGenerateSafetyNumber } =
    await getWorkerProxy();
  return workerGenerateSafetyNumber(myPublicKey, theirPublicKey);
}

// ============================================================================
// Re-exports for backward compatibility
// ============================================================================

// These are re-exported from keyStorage for files that still import them from crypto.ts
export {
  storeRatchetStateSecurely,
  retrieveRatchetStateSecurely,
  storeMessageKeySecurely,
  retrieveMessageKeySecurely,
  deleteMessageKeySecurely,
  storeSessionKeySecurely,
  retrieveSessionKeySecurely,
  storeGroupKeySecurely,
  retrieveGroupKeySecurely,
  retrieveLatestSessionKeySecurely,
  checkAndRefillOneTimePreKeys,
  resetOneTimePreKeys,
  deleteRatchetSession,
  deleteSessionKeys,
  deleteConversationKeychain
} from '@lib/keyStorage';

// These are re-exported from sessionKey.service for files that still import them from crypto.ts
export {
  ensureGroupSession,
  rotateGroupKey,
  forceRotateGroupSenderKey,
  deriveSessionKeyAsRecipient,
  fulfillGroupKeyRequest,
  fulfillKeyRequest,
  storeReceivedSessionKey,
  ensureAndRatchetSession,
  schedulePeriodicGroupKeyRotation,
  stopPeriodicGroupKeyRotation
} from '@services/sessionKey.service';
