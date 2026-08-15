// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { getSodiumLib } from '@utils/crypto';
import { worker_generate_random_key, workerXChaChaSeal, workerXChaChaOpen } from './crypto-worker-proxy';

/**
 * Generate a new random symmetric key for a Story (using libsodium)
 * Output: Base64 URL Safe string
 */
export async function generateStoryKey(): Promise<string> {
  const sodium = await getSodiumLib();
  // Generate 32 bytes key for XChaCha20-Poly1305
  const keyBytes = await worker_generate_random_key();
  return sodium.to_base64(keyBytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/**
 * Encrypt a Story payload using the provided key.
 * AEAD dijalankan di crypto worker (canonical XChaCha envelope).
 * Output: Base64 URL Safe string (nonce + ciphertext)
 */
export async function encryptStoryPayload(payload: unknown, base64Key: string): Promise<string> {
  return workerXChaChaSeal(base64Key, JSON.stringify(payload));
}

/**
 * Decrypt a Story payload using the provided key.
 * Output: Parsed JSON Object
 */
export async function decryptStoryPayload(encryptedDataB64: string, base64Key: string): Promise<unknown> {
  const plaintext = await workerXChaChaOpen(base64Key, encryptedDataB64);
  return JSON.parse(plaintext);
}