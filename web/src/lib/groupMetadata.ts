// Logic untuk "decrypt-atau-pakai-cache" metadata grup.
//
// Di-extract dari `store/conversation.ts` (loadConversations) agar perilaku
// persisten-decryptedMetadata dapat diuji unit secara stabil tanpa mengimpor
// rantai store yang berat. Ini juga regression guard untuk bug "Unknown Group"
// + pesan grup menghilang setelah reload.
//
// Aturan (jangan dirubah): metadata hanya didekripsi bila belum ada cache;
// hasil dekripsi WAJIB dipersist (melalui dep `save`) agar reload berikutnya
// memakai cache — sender-key ratchet sudah maju melewati N=0, jadi dekripsi
// ulang dari N=0 akan gagal.

import type { Conversation } from '@store/conversation';

export interface GroupMeta {
  title?: string;
  description?: string;
  avatarUrl?: string;
  participants?: string[];
}

export interface ResolveGroupMetadataDeps {
  decrypt: (encryptedMetadata: string, conversationId: string) => Promise<GroupMeta | null>;
  save: (conv: Conversation) => Promise<unknown>;
  cacheParticipants: (conversationId: string, userIds: string[]) => void;
}

export interface GroupMetaCandidate {
  id: string;
  isGroup: boolean;
  encryptedMetadata?: string | null;
  decryptedMetadata?: GroupMeta | undefined;
}

/**
 * Mengembalikan decryptedMetadata yang valid (cache atau hasil dekripsi baru),
 * atau undefined bila tidak ada. Bila berhasil mendekripsi, hasilnya dipersist
 * dan participant di-cache.
 */
export async function resolveGroupMetadata(
  c: GroupMetaCandidate,
  deps: ResolveGroupMetadataDeps
): Promise<GroupMeta | undefined> {
  // 1. Cache sudah ada → pakai apa adanya (jangan dekripsi ulang — ratchet maju).
  if (c.decryptedMetadata) return c.decryptedMetadata;

  // 2. Bukan grup atau tidak ada metadata terenkripsi → tanpa metadata.
  if (!c.isGroup || !c.encryptedMetadata) return undefined;

  try {
    const decrypted = await deps.decrypt(c.encryptedMetadata, c.id);
    if (decrypted) {
      if (Array.isArray(decrypted.participants) && decrypted.participants.length > 0) {
        deps.cacheParticipants(c.id, decrypted.participants);
      }
      // BUGFIX: persist agar reload berikutnya memakai cache.
      await deps.save({ ...c, decryptedMetadata: decrypted } as Conversation);
      return decrypted;
    }
    return undefined;
  } catch (e) {
    console.warn('Failed to decrypt metadata for group', e);
    return undefined;
  }
}