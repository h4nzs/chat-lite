// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import type { Message } from '@store/conversation';
import { useAuthStore } from '@store/auth';
import { useConversationStore } from '@store/conversation';
import { useProfileStore } from '@store/profile';
import { getSodium } from '@lib/sodiumInitializer';
import { saveProfileKey } from '@lib/keychainDb';
import { shadowVault, saveStoryKey } from '@lib/shadowVaultDb';
import {
  decryptMessage,
  getMyEncryptionKeyPair
} from '@utils/crypto';
import {
  storeRatchetStateSecurely,
  retrieveMessageKeySecurely,
  deleteMessageKeySecurely
} from '@lib/keyStorage';
import {
  ensureGroupSession,
  deriveSessionKeyAsRecipient
} from '@services/sessionKey.service';

/**
 * Helper: Enrich messages with sender profile
 */
export function enrichMessagesWithSenderProfile(conversationId: string, messages: Message[]): Message[] {
  const conv = useConversationStore.getState().conversations.find(c => c.id === conversationId);
  if (!conv) return messages;

  const participantsMap = new Map(conv.participants.map(p => {
    const participant = p as unknown as { userId?: string; id: string };
    return [participant.userId || p.id, p];
  }));
  const cachedProfiles = useProfileStore.getState().profiles;

  return messages.map(m => {
    const pInfo = participantsMap.get(m.senderId);
    const profileKey = Object.keys(cachedProfiles).find(k => k.startsWith(m.senderId));
    const globalProfile = profileKey ? cachedProfiles[profileKey] : null;

    const resolvedName = globalProfile?.name || pInfo?.name;
    const resolvedUsername = globalProfile?.username || pInfo?.username;
    const resolvedAvatar = globalProfile?.avatarUrl || pInfo?.avatarUrl;
    const senderProfile = pInfo as unknown as { encryptedProfile?: string } | undefined;
    const encryptedProfile = senderProfile?.encryptedProfile || (m.sender as unknown as { encryptedProfile?: string })?.encryptedProfile;

    if (resolvedName && resolvedName !== 'Unknown' && resolvedName !== 'Encrypted User') {
      return {
        ...m,
        sender: {
          id: m.senderId,
          name: resolvedName,
          username: resolvedUsername,
          avatarUrl: resolvedAvatar,
          encryptedProfile
        }
      };
    }

    if (encryptedProfile && !(m.sender as unknown as { encryptedProfile?: string })?.encryptedProfile) {
      return {
        ...m,
        sender: {
          ...(m.sender || { id: m.senderId }),
          encryptedProfile
        }
      };
    }

    return m;
  });
}

/**
 * Parse reaction payload from message content
 */
export function parseReaction(content: string | null | undefined): { targetMessageId: string; emoji: string } | null {
  if (!content) return null;
  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.includes('"type":"reaction"')) return null;

    const payload = JSON.parse(trimmed);
    if (payload.type === 'reaction' && payload.targetMessageId && payload.emoji) {
      return payload;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Parse edit payload from message content
 */
export function parseEdit(content: string | null | undefined): { targetMessageId: string; text: string } | null {
  if (!content) return null;
  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.includes('"type":"edit"')) return null;
    const payload = JSON.parse(trimmed);
    if (payload.type === 'edit' && payload.targetMessageId && payload.text) {
      return payload;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Parse silent payload from message content
 */
export function parseSilent(content: string | null | undefined): { text?: string; type?: string; key?: string } | null {
  if (!content) return null;
  try {
    let trimmed = content.trim();
    if (trimmed.startsWith('STORY_KEY:')) {
      trimmed = trimmed.replace('STORY_KEY:', '');
    }
    if (!trimmed.startsWith('{')) return null;
    const payload = JSON.parse(trimmed);
    // DO NOT treat story_reply as silent. Let processMessagesAndReactions keep it.
    if (payload.type === 'story_reply') {
      return null;
    }
    if (payload.type === 'silent') {
      return payload;
    }
    if (payload.type === 'CALL_INIT' && typeof payload.key === 'string') {
      return payload;
    }
    if (payload.type === 'GHOST_SYNC') {
      return payload;
    }
    if (payload.type === 'STORY_KEY') {
      return payload;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Separate messages and reactions from decrypted items
 */
export function processMessagesAndReactions(
  decryptedItems: Message[],
  existingMessages: Message[] = []
): Message[] {
  const chatMessages: Message[] = [];
  const reactions: {
    id: string;
    messageId: string;
    emoji: string;
    userId: string;
    createdAt: string;
    user?: Message['sender'];
    isMessage: boolean;
  }[] = [];
  const edits: { targetMessageId: string; text: string; timestamp: number }[] = [];

  for (const msg of decryptedItems) {
    const reactionPayload = parseReaction(msg.content);
    const editPayload = parseEdit(msg.content);
    const silentPayload = parseSilent(msg.content);

    if (reactionPayload) {
      reactions.push({
        id: msg.id,
        messageId: reactionPayload.targetMessageId,
        emoji: reactionPayload.emoji,
        userId: msg.senderId,
        createdAt: msg.createdAt,
        user: msg.sender,
        isMessage: true
      });
    } else if (editPayload) {
      edits.push({
        targetMessageId: editPayload.targetMessageId,
        text: editPayload.text,
        timestamp: new Date(msg.createdAt).getTime()
      });
    } else {
      // Check if message was marked as silent during decryption
      if (msg.isSilent || silentPayload) {
        const silentType = silentPayload?.type || (msg as any).type;
        if (silentType === 'STORY_KEY' || silentType === 'GHOST_SYNC' || silentType === 'CALL_INIT') {
          // Ignore signaling messages completely
          continue;
        }
        // For other silent messages, keep if they have visible content
        if (!msg.content && msg.isSilent) {
          continue;
        }
      }
      chatMessages.push(msg);
    }
  }

  const messageMap = new Map([...existingMessages, ...chatMessages].map(m => [m.id, m]));

  for (const reaction of reactions) {
    const target = messageMap.get(reaction.messageId);
    if (target) {
      const existingReactions = target.reactions || [];
      if (!existingReactions.some(r => r.id === reaction.id)) {
        target.reactions = [...existingReactions, reaction];
      }
    }
  }

  // APPLY EDITS (Sort by timestamp so latest edit wins)
  edits.sort((a, b) => a.timestamp - b.timestamp);
  for (const edit of edits) {
    const target = messageMap.get(edit.targetMessageId);
    if (target) {
      target.content = edit.text;
      target.isEdited = true;
    }
  }

  return Array.from(messageMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * Check if content is likely encrypted
 */
function isLikelyEncrypted(str: string): boolean {
  const trimmed = str.trim();
  // 1. Check for JSON payload containing encryption markers
  if (trimmed.startsWith('{') && (trimmed.includes('"header"') || trimmed.includes('"ciphertext"') || trimmed.includes('"dr"'))) {
    return true;
  }
  // 2. Check for legacy/base64 encoded ciphertexts
  const base64Regex = /^[A-Za-z0-9+/_-]+={0,2}$/;
  if (base64Regex.test(trimmed) && trimmed.length > 20) {
    return true;
  }
  return false;
}

/**
 * Centralized Message Decryption Logic (Single Source of Truth)
 * Handles decryption of plain text AND file keys.
 */
export async function decryptMessageObject(
  message: Message,
  seenIds = new Set<string>(),
  depth = 0,
  options: { skipRetries?: boolean } = {}
): Promise<Message> {
  // 1. Clone message and add recursion guard
  const decryptedMsg = { ...message };
  const currentUser = useAuthStore.getState().user;

  if (seenIds.has(decryptedMsg.id) || depth > 10) {
    decryptedMsg.repliedTo = undefined; // Break recursive chain
    return decryptedMsg;
  }
  seenIds.add(decryptedMsg.id);

  const conversation = useConversationStore.getState().conversations.find(c => c.id === decryptedMsg.conversationId);
  const isGroup = conversation?.isGroup || false;

  try {
    // [FIX #1] SELF-MESSAGE DECRYPTION (Own Messages)
    if (currentUser && decryptedMsg.senderId === currentUser.id) {
      const { decryptSelfMessage } = await import('@services/messageCrypto');
      const selfDecrypted = await decryptSelfMessage(decryptedMsg, seenIds, depth, options);
      if (selfDecrypted && (selfDecrypted as Message).repliedTo) {
        (selfDecrypted as Message).repliedTo = await decryptMessageObject(
          (selfDecrypted as Message).repliedTo as Message,
          seenIds,
          depth + 1,
          options
        );
      }
      return selfDecrypted as Message;
    }

    // 2. Determine Payload to Decrypt
    let contentToDecrypt = decryptedMsg.ciphertext;

    if (!contentToDecrypt) {
      contentToDecrypt = decryptedMsg.fileKey || decryptedMsg.content;
    }

    if (!contentToDecrypt || contentToDecrypt === 'waiting_for_key' || contentToDecrypt === '[Requesting key to decrypt...]') {
      return decryptedMsg;
    }

    // [FIX] PARSE PLAIN JSON PAYLOADS (File, Reply, Story Reply, etc.)
    // These are already decrypted but need to be parsed into proper Message structure
    if (contentToDecrypt.trim().startsWith('{') && !isLikelyEncrypted(contentToDecrypt)) {
      try {
        const payload = JSON.parse(contentToDecrypt);
        
        // File Attachment
        if (payload.type === 'file') {
          decryptedMsg.fileUrl = payload.url;
          decryptedMsg.fileKey = payload.key;
          decryptedMsg.fileName = payload.name;
          decryptedMsg.fileSize = payload.size;
          decryptedMsg.fileType = payload.mimeType;
          decryptedMsg.content = null;
          decryptedMsg.isBlindAttachment = true;
          return decryptedMsg;
        }
        
        // Text Reply
        if (payload.type === 'reply') {
          decryptedMsg.content = payload.text;
          decryptedMsg.repliedToId = payload.targetMessageId;
          // Note: Full repliedTo object requires fetching the target message
          return decryptedMsg;
        }
        
        // Story Reply
        if (payload.type === 'story_reply') {
          decryptedMsg.content = payload.text;
          decryptedMsg.repliedTo = {
            id: 'story_mock',
            senderId: payload.storyAuthorId,
            sender: { id: payload.storyAuthorId },
            content: payload.storyText || (payload.hasMedia ? '📷 Story' : 'Story')
          } as Message;
          return decryptedMsg;
        }
        
        // Reaction (should be intercepted by processMessagesAndReactions)
        if (payload.type === 'reaction') {
          // Keep as content, will be parsed by processMessagesAndReactions
          return decryptedMsg;
        }
        
        // Edit (should be intercepted by processMessagesAndReactions)
        if (payload.type === 'edit') {
          // Keep as content, will be parsed by processMessagesAndReactions
          return decryptedMsg;
        }
        
        // Silent messages (GHOST_SYNC, STORY_KEY, CALL_INIT, etc.)
        if (payload.type === 'silent' || payload.type === 'GHOST_SYNC' || 
            payload.type === 'STORY_KEY' || payload.type === 'CALL_INIT') {
          decryptedMsg.isSilent = true;
          decryptedMsg.content = null; // Don't display
          return decryptedMsg;
        }
      } catch {
        // If JSON parsing fails, continue with normal flow
      }
    }

    // [FIX] PREVENT RE-DECRYPTION LOOP
    if (!isLikelyEncrypted(contentToDecrypt)) {
      return decryptedMsg;
    }

    // -------------------------------------------------------------------------
    // FLOW BARU: X3DH HEADER DETECTION (RECEIVING - 1on1 Only)
    // -------------------------------------------------------------------------
    if (!isGroup && contentToDecrypt.startsWith('{') && contentToDecrypt.includes('"x3dh":')) {
      try {
        const payload = JSON.parse(contentToDecrypt);
        const mk = await retrieveMessageKeySecurely(message.id);

        if (mk) {
          contentToDecrypt = payload.ciphertext;
        } else if (payload.x3dh && payload.ciphertext) {
          const { ik, ek, otpkId } = payload.x3dh;
          const ciphertext = payload.ciphertext;

          const myIdentityKeyPair = await getMyEncryptionKeyPair();
          const { getSignedPreKeyPair } = useAuthStore.getState();
          const mySignedPreKeyPair = await getSignedPreKeyPair();

          const sessionKey = await deriveSessionKeyAsRecipient(
            myIdentityKeyPair,
            mySignedPreKeyPair,
            ik,
            ek,
            otpkId
          );

          let theirRatchetPublicKey: Uint8Array | undefined;

          try {
            const innerPayload = JSON.parse(ciphertext);
            if (innerPayload.dr) {
              const epk = innerPayload.dr.dh || innerPayload.dr.epk;
              if (epk) {
                const sodium = await getSodium();
                theirRatchetPublicKey = sodium.from_base64(epk, sodium.base64_variants.URLSAFE_NO_PADDING);
              }
            }
          } catch {
            // Ignore parse errors
          }

          if (!theirRatchetPublicKey) {
            throw new Error('Cannot initialize Bob: Missing sender\'s ratchet key in first message.');
          }

          const { worker_dr_init_bob } = await import('@lib/crypto-worker-proxy');
          const newState = await worker_dr_init_bob({
            sk: sessionKey,
            mySignedPreKey: mySignedPreKeyPair,
            theirRatchetPublicKey: theirRatchetPublicKey
          });

          await storeRatchetStateSecurely(message.conversationId, newState);
          contentToDecrypt = ciphertext;
        }
      } catch (e) {
        console.error('[X3DH] Failed to parse/derive from header:', e);
      }
    }

    // 3. Save original ciphertext
    decryptedMsg.ciphertext = contentToDecrypt;

    // 4. Execute Decryption with Retry Loop
    let result;
    let attempts = 0;
    const MAX_ATTEMPTS = options.skipRetries ? 1 : 3;

    // [PHASE 3 FIX] Correct Session ID / Sender ID mapping
    const sessionOrSenderId = isGroup ? decryptedMsg.senderId : decryptedMsg.sessionId;

    while (attempts < MAX_ATTEMPTS) {
      result = await decryptMessage(
        contentToDecrypt!,
        decryptedMsg.conversationId,
        isGroup,
        sessionOrSenderId,
        decryptedMsg.id
      );

      if (result.status === 'success' || result.status === 'error') {
        break;
      }

      if (result.status === 'pending') {
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
    }

    // 5. Process Result
    if (result?.status === 'success') {
      let plainText = result.value;

      // --- EKSTRAKSI PROFILE KEY ---
      if (plainText && plainText.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(plainText);
          if (parsed.profileKey) {
            await saveProfileKey(decryptedMsg.senderId, parsed.profileKey);
            useProfileStore.getState().decryptAndCache(decryptedMsg.senderId, decryptedMsg.sender?.encryptedProfile || null);

            delete parsed.profileKey;

            if (parsed.text !== undefined && Object.keys(parsed).length === 1) {
              plainText = parsed.text;
            } else {
              plainText = JSON.stringify(parsed);
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      decryptedMsg.content = plainText;

      // BLIND ATTACHMENT PARSING
      if (plainText.startsWith('{') && plainText.includes('"type":"file"')) {
        try {
          const metadata = JSON.parse(plainText);
          if (metadata.type === 'file') {
            decryptedMsg.fileUrl = metadata.url;
            decryptedMsg.fileKey = metadata.key;
            decryptedMsg.fileName = metadata.name;
            decryptedMsg.fileSize = metadata.size;
            decryptedMsg.fileType = metadata.mimeType;
            decryptedMsg.content = null;
            decryptedMsg.isBlindAttachment = true;
          }
        } catch {
          // Ignore parse errors
        }
      }

      // STORY REPLY PARSING
      if (plainText.startsWith('{') && plainText.includes('"type":"story_reply"')) {
        try {
          const metadata = JSON.parse(plainText);
          if (metadata.type === 'story_reply') {
            decryptedMsg.content = metadata.text;
            decryptedMsg.repliedTo = {
              id: 'story_mock',
              senderId: metadata.storyAuthorId,
              sender: { id: metadata.storyAuthorId },
              content: metadata.storyText || (metadata.hasMedia ? '📷 Story' : 'Story')
            } as Message;
          }
        } catch {
          // Ignore parse errors
        }
      }
    } else if (result?.status === 'pending') {
      decryptedMsg.content = result.reason || 'waiting_for_key';
    } else {
      console.warn(`[Decrypt] Failed for msg ${decryptedMsg.id}:`, result?.error);
      const errMsg = result?.error?.message || '';
      if (errMsg.includes('waiting for key') || errMsg.includes('Missing sender')) {
        decryptedMsg.content = 'waiting_for_key';
      } else {
        decryptedMsg.content = '[Decryption Failed: Key out of sync]';
        decryptedMsg.error = true;
      }
      decryptedMsg.type = 'SYSTEM';
    }

    // 6. Decrypt Replied Message
    if (decryptedMsg.repliedTo) {
      decryptedMsg.repliedTo = await decryptMessageObject(decryptedMsg.repliedTo, seenIds, depth + 1, options);
    }

    return decryptedMsg;
  } catch (e: unknown) {
    console.error('Critical error in decryptMessageObject:', e);
    return { ...message, content: '🔒 Decryption Error', type: 'SYSTEM' };
  }
}
