/**
 * Shared type guard functions for validating parsed JSON payloads.
 * Use these instead of inline `as` assertions on JSON.parse results.
 */

import type { SystemMessagePayload } from '@nyx/shared';

// ─── Reaction Payload ────────────────────────────────────────────
export interface ReactionPayload {
  type: 'reaction';
  targetMessageId: string;
  emoji: string;
}

export function isReactionPayload(data: unknown): data is ReactionPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === 'reaction' &&
    typeof d.targetMessageId === 'string' &&
    typeof d.emoji === 'string'
  );
}

// ─── Edit Payload ────────────────────────────────────────────────
export interface EditPayload {
  type: 'edit';
  targetMessageId: string;
  text: string;
}

export function isEditPayload(data: unknown): data is EditPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === 'edit' &&
    typeof d.targetMessageId === 'string' &&
    typeof d.text === 'string'
  );
}

// ─── Silent / System Payload Types ───────────────────────────────
export type SilentType =
  | 'silent'
  | 'CALL_INIT'
  | 'GHOST_SYNC'
  | 'STORY_KEY'
  | 'UNSEND'
  | 'reaction_remove'
  | 'SYSTEM_KEY_REQUEST';

export interface SilentPayload {
  type: SilentType;
  text?: string;
  key?: string;
  storyId?: string;
  targetMessageId?: string;
  emoji?: string;
  url?: string;
}

const SILENT_TYPES: ReadonlySet<string> = new Set<SilentType>([
  'silent', 'CALL_INIT', 'GHOST_SYNC', 'STORY_KEY',
  'UNSEND', 'reaction_remove', 'SYSTEM_KEY_REQUEST',
]);

export function isSilentPayload(data: unknown): data is SilentPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.type !== 'string' || !SILENT_TYPES.has(d.type)) return false;
  return true;
}

// ─── File Metadata ────────────────────────────────────────────────
export interface FileMetadata {
  type: 'file';
  url?: string;
  key?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  isBlindAttachment?: boolean;
}

export function isFileMetadata(data: unknown): data is FileMetadata {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.type !== 'file') return false;
  return true;
}

// ─── Story Reply ─────────────────────────────────────────────────
export interface StoryReplyPayload {
  type: 'story_reply';
  text?: string;
  storyAuthorId?: string;
  isReply?: boolean;
  storyText?: string;
  hasMedia?: boolean;
}

export function isStoryReplyPayload(data: unknown): data is StoryReplyPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.type !== 'story_reply') return false;
  return true;
}

// ─── X3DH Header ─────────────────────────────────────────────────
export interface X3dhHeader {
  ciphertext?: string;
  x3dh?: {
    initiatorSigningKey: string;
    initiatorCiphertexts: string;
    otpkId: number;
  };
}

export function isX3dhHeader(data: unknown): data is X3dhHeader {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.x3dh !== undefined) {
    if (!d.x3dh || typeof d.x3dh !== 'object') return false;
    const x = d.x3dh as Record<string, unknown>;
    if (typeof x.initiatorSigningKey !== 'string') return false;
    if (typeof x.initiatorCiphertexts !== 'string') return false;
    if (typeof x.otpkId !== 'number') return false;
  }
  return true;
}

// ─── System Message Payload ──────────────────────────────────────
export function isSystemMessagePayload(data: unknown): data is SystemMessagePayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.type === 'string';
}

// ─── Generic Object with participants ────────────────────────────
export function hasParticipantsArray(data: unknown): data is { participants: string[] } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.participants) && d.participants.every(p => typeof p === 'string');
}

// ─── Ciphertext Wrapper ──────────────────────────────────────────
export interface CiphertextWrapper {
  ciphertext?: string;
}

export function isCiphertextWrapper(data: unknown): data is CiphertextWrapper {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.ciphertext === undefined || typeof d.ciphertext === 'string';
}

// ─── Conversation Metadata (decrypted) ────────────────────────────
export interface DecryptedGroupMetadata {
  title?: string;
  description?: string;
  avatarUrl?: string;
  participants?: string[];
  authSecret?: string;
}

export function isDecryptedGroupMetadata(data: unknown): data is DecryptedGroupMetadata {
  if (!data || typeof data !== 'object') return false;
  return true; // Minimal guard — all fields are optional
}

// ─── Story Key Payload ────────────────────────────────────────────
export interface StoryKeyPayload {
  type: 'STORY_KEY';
  storyId?: string;
  key?: string;
}

export function isStoryKeyPayload(data: unknown): data is StoryKeyPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.type === 'STORY_KEY';
}

// ─── GHOST_SYNC Payload ────────────────────────────────────────────
export interface GhostSyncPayload {
  type: 'GHOST_SYNC';
}

export function isGhostSyncPayload(data: unknown): data is GhostSyncPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.type === 'GHOST_SYNC';
}

// ─── Upgraded Account Payload ──────────────────────────────────────
export interface ProtocolResetPayload {
  type: 'PROTOCOL_RESET';
  conversationId?: string;
  senderId?: string;
}

export function isProtocolResetPayload(data: unknown): data is ProtocolResetPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.type === 'PROTOCOL_RESET';
}

// ─── Plain Object (for Record<string, unknown> patterns) ───────────
/** Checks if value is a non-null object (not array). Use for JSON.parse results. */
export function isPlainObject(data: unknown): data is Record<string, unknown> {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}

// ─── Link Preview ─────────────────────────────────────────────────
export interface LinkPreviewPayload {
  url?: string;
  title?: string;
  description?: string;
  image?: string;
}

export function isLinkPreviewPayload(data: unknown): data is LinkPreviewPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.url === 'string' || typeof d.title === 'string';
}
