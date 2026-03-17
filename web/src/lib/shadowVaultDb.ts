import Dexie, { Table } from 'dexie';
import type { Message } from '@store/conversation';
import { getSodium } from '@lib/sodiumInitializer';
import { getMyEncryptionKeyPair } from '@utils/crypto';

export interface DecryptedMessageRecord {
  id: string;
  conversationId: string;
  content: string | null; // ENCRYPTED Base64 string at rest
  repliedToId?: string;
  repliedTo?: string; // Encrypted JSON string of the replied message
  createdAt: string | Date;
  senderId: string;
  senderName?: string; // Encrypted sender name
  senderUsername?: string; // Encrypted sender username
  senderAvatarUrl?: string; // Encrypted avatar URL
  isViewOnce?: boolean;
  isDeletedLocal?: boolean;
  // File metadata (for Blind Attachments)
  fileUrl?: string; // Encrypted file URL
  fileKey?: string; // Encrypted file key
  fileName?: string; // Encrypted file name
  fileSize?: number;
  fileType?: string;
  // Message metadata
  isEdited?: boolean;
  reactions?: string; // Encrypted JSON string of reactions array
}

// --- CRYPTO ENGINE FOR IRON VAULT ---
const getVaultKey = async () => {
  const sodium = await getSodium();
  const { privateKey } = await getMyEncryptionKeyPair();
  if (!privateKey) throw new Error("Vault locked: Identity key not found in memory.");
  // Derive a deterministic 32-byte symmetric key from the user's private key
  return sodium.crypto_generichash(32, privateKey);
};

export const encryptVaultText = async (text: string): Promise<string> => {
  const sodium = await getSodium();
  const key = await getVaultKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  
  const cipherText = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    text, null, null, nonce, key
  );
  
  const combined = new Uint8Array(nonce.length + cipherText.length);
  combined.set(nonce);
  combined.set(cipherText, nonce.length);
  return sodium.to_base64(combined);
};

export const decryptVaultText = async (encryptedBase64: string): Promise<string | null> => {
  try {
    const sodium = await getSodium();
    const key = await getVaultKey();
    const combined = sodium.from_base64(encryptedBase64);
    const nonceBytes = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
    
    const nonce = combined.slice(0, nonceBytes);
    const cipherText = combined.slice(nonceBytes);

    const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, cipherText, null, nonce, key
    );
    return sodium.to_string(decrypted);
  } catch (e) {
    return null; // Silent fail for corrupted/old data
  }
};
// ------------------------------------

export class NyxShadowVault extends Dexie {
  messages!: Table<DecryptedMessageRecord, string>;
  storyKeys!: Table<{ storyId: string; key: string }, string>;

  constructor() {
    super('nyx_shadow_vault');
    this.version(4).stores({
      messages: 'id, conversationId, createdAt',
      storyKeys: 'storyId'
    });
  }

  async upsertMessages(messages: Message[]) {
    // Filter messages: Allow if it has content OR it is a tombstone OR it is a blind attachment (file)
    const validMessages = messages.filter(m => (m.content && m.content !== 'waiting_for_key' && !m.content.startsWith('[')) || m.isDeletedLocal || m.isBlindAttachment || m.fileUrl);
    if (validMessages.length === 0) return;

    try {
      const records: DecryptedMessageRecord[] = [];
      for (const m of validMessages) {
        // [FIX] PERSISTENCE: Check if we already have a record with better profile data
        const existing = await this.messages.get(m.id);

        let encryptedContent: string | null = null;
        let encryptedRepliedTo: string | undefined = undefined;
        let encryptedSenderName: string | undefined = undefined;
        let encryptedSenderUsername: string | undefined = undefined;
        let encryptedSenderAvatarUrl: string | undefined = undefined;
        let encryptedFileUrl: string | undefined = undefined;
        let encryptedFileKey: string | undefined = undefined;
        let encryptedFileName: string | undefined = undefined;

        if (m.content && !m.isDeletedLocal) {
            encryptedContent = await encryptVaultText(m.content);
        }

        if (m.repliedTo) {
             const repliedToStr = JSON.stringify(m.repliedTo);
             encryptedRepliedTo = await encryptVaultText(repliedToStr);
        } else if (existing?.repliedTo) {
             encryptedRepliedTo = existing.repliedTo;
        }

        // Fix: Persist sender info if it was hydrated, otherwise fallback to existing
        const mSender = m.sender as Record<string, string | null | undefined>;
        const hasValidName = mSender?.name && mSender.name !== 'Unknown' && mSender.name !== 'Encrypted User';

        if (hasValidName) {
            encryptedSenderName = await encryptVaultText(mSender.name as string);
            if (mSender.username) {
                encryptedSenderUsername = await encryptVaultText(mSender.username as string);
            }
            if (mSender.avatarUrl) {
                encryptedSenderAvatarUrl = await encryptVaultText(mSender.avatarUrl as string);
            }
        } else if (existing?.senderName) {
            // Keep the real name we already have in the vault!
            encryptedSenderName = existing.senderName;
            encryptedSenderUsername = existing.senderUsername;
            encryptedSenderAvatarUrl = existing.senderAvatarUrl;
        } else if (mSender?.avatarUrl) {
            encryptedSenderAvatarUrl = await encryptVaultText(mSender.avatarUrl);
        }

        // Persist file metadata (Blind Attachments)
        if (m.fileUrl) {
            encryptedFileUrl = await encryptVaultText(m.fileUrl);
        } else if (existing?.fileUrl) {
            encryptedFileUrl = existing.fileUrl;
        }

        if (m.fileKey) {
            encryptedFileKey = await encryptVaultText(m.fileKey);
        } else if (existing?.fileKey) {
            encryptedFileKey = existing.fileKey;
        }

        if (m.fileName) {
            encryptedFileName = await encryptVaultText(m.fileName);
        } else if (existing?.fileName) {
            encryptedFileName = existing.fileName;
        }

        // Persist message metadata (isEdited, reactions)
        let encryptedReactions: string | undefined = undefined;
        if (m.reactions && m.reactions.length > 0) {
            const reactionsStr = JSON.stringify(m.reactions);
            encryptedReactions = await encryptVaultText(reactionsStr);
        } else if (existing?.reactions) {
            encryptedReactions = existing.reactions;
        }

        records.push({
          id: m.id,
          conversationId: m.conversationId,
          content: encryptedContent, // Iron Vault: Stored as cipher
          repliedToId: m.repliedToId || existing?.repliedToId,
          repliedTo: encryptedRepliedTo,
          createdAt: m.createdAt,
          senderId: m.senderId,
          senderName: encryptedSenderName,
          senderUsername: encryptedSenderUsername,
          senderAvatarUrl: encryptedSenderAvatarUrl,
          fileUrl: encryptedFileUrl,
          fileKey: encryptedFileKey,
          fileName: encryptedFileName,
          fileSize: m.fileSize,
          fileType: m.fileType,
          isViewOnce: m.isViewOnce,
          isDeletedLocal: m.isDeletedLocal,
          isEdited: m.isEdited || existing?.isEdited,
          reactions: encryptedReactions
        });
      }
      await this.messages.bulkPut(records);
    } catch (err) {
      console.error("Iron Vault Encryption Error:", err);
    }
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    try {
      const records = await this.messages.where('conversationId').equals(conversationId).toArray();
      const messages: Message[] = [];
      for (const r of records) {
        let plainText = null;
        let decryptedRepliedTo = undefined;
        let decryptedSenderName = undefined;
        let decryptedSenderUsername = undefined;
        let decryptedSenderAvatarUrl = undefined;
        let decryptedFileUrl = undefined;
        let decryptedFileKey = undefined;
        let decryptedFileName = undefined;

        if (r.content && !r.isDeletedLocal) {
          plainText = await decryptVaultText(r.content);
        }

        if (r.repliedTo) {
            const rawRepliedTo = await decryptVaultText(r.repliedTo);
            if (rawRepliedTo) {
                try {
                    decryptedRepliedTo = JSON.parse(rawRepliedTo);
                } catch {}
            }
        }

        if (r.senderName) {
            decryptedSenderName = await decryptVaultText(r.senderName) || undefined;
        }
        if (r.senderUsername) {
            decryptedSenderUsername = await decryptVaultText(r.senderUsername) || undefined;
        }
        if (r.senderAvatarUrl) {
            decryptedSenderAvatarUrl = await decryptVaultText(r.senderAvatarUrl) || undefined;
        }
        
        // Restore file metadata (Blind Attachments)
        if (r.fileUrl) {
            decryptedFileUrl = await decryptVaultText(r.fileUrl) || undefined;
        }
        if (r.fileKey) {
            decryptedFileKey = await decryptVaultText(r.fileKey) || undefined;
        }
        if (r.fileName) {
            decryptedFileName = await decryptVaultText(r.fileName) || undefined;
        }

        // [FIX] Parse JSON payloads from vault (File, Reply, Story Reply, Silent)
        let parsedContent: string | null = plainText;
        let parsedFileUrl = decryptedFileUrl;
        let parsedFileKey = decryptedFileKey;
        let parsedFileName = decryptedFileName;
        let parsedFileSize = r.fileSize;
        let parsedFileType = r.fileType;
        let isBlindAttachment = false;
        let repliedToObj = decryptedRepliedTo;
        let isSilent = false;

        // Check if this is a file message stored with metadata (content=null but fileUrl exists)
        // OR if it's stored as JSON payload in content
        if (decryptedFileUrl && decryptedFileKey) {
          // File message stored with metadata fields
          isBlindAttachment = true;
          parsedContent = null;
        } else if (plainText && plainText.trim().startsWith('{')) {
          // File message stored as JSON payload in content
          try {
            const payload = JSON.parse(plainText);

            // File Attachment
            if (payload.type === 'file') {
              parsedContent = null;
              parsedFileUrl = payload.url || decryptedFileUrl;
              parsedFileKey = payload.key || decryptedFileKey;
              parsedFileName = payload.name || decryptedFileName;
              parsedFileSize = payload.size || r.fileSize;
              parsedFileType = payload.mimeType || r.fileType;
              isBlindAttachment = true;
            }
            // Text Reply
            else if (payload.type === 'reply') {
              parsedContent = payload.text;
              // repliedToId would need to be stored separately if needed
            }
            // Story Reply
            else if (payload.type === 'story_reply') {
              parsedContent = payload.text;
              repliedToObj = {
                id: 'story_mock',
                senderId: payload.storyAuthorId,
                sender: { id: payload.storyAuthorId },
                content: payload.storyText || (payload.hasMedia ? '📷 Story' : 'Story')
              };
            }
            // Reaction - KEEP JSON content for processMessagesAndReactions to parse
            else if (payload.type === 'reaction') {
              // Keep the JSON string intact - will be parsed by processMessagesAndReactions
              parsedContent = plainText;
            }
            // Edit - KEEP JSON content for processMessagesAndReactions to parse
            else if (payload.type === 'edit') {
              // Keep the JSON string intact - will be parsed by processMessagesAndReactions
              parsedContent = plainText;
            }
            // Silent messages
            else if (payload.type === 'silent' || payload.type === 'GHOST_SYNC' ||
                     payload.type === 'STORY_KEY' || payload.type === 'CALL_INIT') {
              parsedContent = null;
              isSilent = true;
            }
          } catch {
            // Keep original plaintext if parse fails
          }
        }

        // Restore message metadata (isEdited, reactions)
        let decryptedReactions = undefined;
        if (r.reactions) {
            const rawReactions = await decryptVaultText(r.reactions);
            if (rawReactions) {
                try {
                    decryptedReactions = JSON.parse(rawReactions);
                } catch {}
            }
        }

        messages.push({
          id: r.id,
          conversationId: r.conversationId,
          content: parsedContent,
          repliedToId: r.repliedToId,
          repliedTo: repliedToObj,
          createdAt: r.createdAt as string,
          senderId: r.senderId,
          sender: {
              id: r.senderId,
              name: decryptedSenderName,
              username: decryptedSenderUsername,
              avatarUrl: decryptedSenderAvatarUrl
          } as unknown as { id: string; name?: string; username?: string; avatarUrl?: string | null },
          fileUrl: parsedFileUrl,
          fileKey: parsedFileKey,
          fileName: parsedFileName,
          fileSize: parsedFileSize,
          fileType: parsedFileType,
          isBlindAttachment,
          isViewOnce: r.isViewOnce,
          isDeletedLocal: r.isDeletedLocal,
          isSilent,
          isEdited: r.isEdited,
          reactions: decryptedReactions
        });
      }
      return messages;
    } catch (e) {
      console.error("Vault Query Error:", e);
      return [];
    }
  }

  async getMessage(id: string): Promise<Message | null> {
    try {
      const r = await this.messages.get(id);
      if (!r) return null;
      let plainText = null;
      let decryptedRepliedTo = undefined;
      let decryptedSenderName = undefined;
      let decryptedSenderUsername = undefined;
      let decryptedSenderAvatarUrl = undefined;

      if (r.content && !r.isDeletedLocal) {
        plainText = await decryptVaultText(r.content);
      }

      if (r.repliedTo) {
          const rawRepliedTo = await decryptVaultText(r.repliedTo);
          if (rawRepliedTo) {
              try {
                  decryptedRepliedTo = JSON.parse(rawRepliedTo);
              } catch {}
          }
      }

      if (r.senderName) {
          decryptedSenderName = await decryptVaultText(r.senderName) || undefined;
      }
      if (r.senderUsername) {
          decryptedSenderUsername = await decryptVaultText(r.senderUsername) || undefined;
      }
      if (r.senderAvatarUrl) {
          decryptedSenderAvatarUrl = await decryptVaultText(r.senderAvatarUrl) || undefined;
      }

      return {
        id: r.id,
        conversationId: r.conversationId,
        content: plainText,
        repliedToId: r.repliedToId,
        repliedTo: decryptedRepliedTo,
        createdAt: r.createdAt as string,
        senderId: r.senderId,
        sender: {
            id: r.senderId,
            name: decryptedSenderName,
            username: decryptedSenderUsername,
            avatarUrl: decryptedSenderAvatarUrl
        } as unknown as { id: string; name?: string; username?: string; avatarUrl?: string | null },
        isViewOnce: r.isViewOnce,
        isDeletedLocal: r.isDeletedLocal
      };
    } catch (e) {
      return null;
    }
  }

  async deleteMessage(id: string) {
    try {
      await this.messages.delete(id);
    } catch (e) {
      console.error("Failed to delete message from vault", e);
    }
  }

  async deleteConversationMessages(conversationId: string) {
    try {
      await this.messages.where('conversationId').equals(conversationId).delete();
    } catch (e) {
      console.error("Failed to delete conversation messages from vault", e);
    }
  }
}

export const shadowVault = new NyxShadowVault();

export async function saveStoryKey(storyId: string, base64Key: string): Promise<void> {
  await shadowVault.storyKeys.put({ storyId, key: base64Key });
}

export async function getStoryKey(storyId: string): Promise<string | null> {
  const record = await shadowVault.storyKeys.get(storyId);
  return record ? record.key : null;
}