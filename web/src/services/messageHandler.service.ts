// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { api } from '@lib/api';
import { getSocket, emitSessionKeyRequest, emitGroupKeyDistribution } from '@lib/socket';
import { addToQueue, getQueueItems, removeFromQueue, updateQueueAttempt } from '@lib/offlineQueueDb';
import { useAuthStore } from '@store/auth';
import { useConversationStore } from '@store/conversation';
import { useConnectionStore } from '@store/connection';
import { useMessageStore } from '@store/message';
import { shadowVault } from '@lib/shadowVaultDb';
import type { Message } from '@store/conversation';
import { decryptMessageObject, processMessagesAndReactions, enrichMessagesWithSenderProfile, parseReaction, parseEdit, parseSilent } from './messageDecryption.service';

/**
 * Send message logic (extracted from store)
 * Returns the final message or payload to be saved
 */
export async function sendMessageLogic(
  conversationId: string,
  data: Partial<Message>,
  tempId?: number,
  isSilent?: boolean
): Promise<{ message?: Message; error?: string }> {
  const { prepareEncryptedPayload, generatePushPayloads } = await import('@services/messageCrypto');
  const { user } = useAuthStore.getState();
  const conversations = useConversationStore.getState().conversations;
  const conversation = conversations.find(c => c.id === conversationId);
  const isGroup = conversation?.isGroup || false;
  const actualTempId = tempId || Date.now() * 1000 + Math.floor(Math.random() * 1000);

  try {
    let contentToEncrypt = data.content || '';

    // Handle file metadata
    if (data.fileUrl && data.fileKey) {
      contentToEncrypt = JSON.stringify({
        type: 'file',
        url: data.fileUrl,
        key: data.fileKey,
        name: data.fileName,
        size: data.fileSize,
        mimeType: data.fileType
      });
    }

    // Handle reply metadata
    if (data.repliedTo) {
      contentToEncrypt = JSON.stringify({
        type: 'reply',
        text: contentToEncrypt,
        targetMessageId: data.repliedTo.id,
        targetSenderId: data.repliedTo.senderId
      });
    }

    // Handle story reply
    if (data.repliedTo && (data.repliedTo as any).isStory) {
      contentToEncrypt = JSON.stringify({
        type: 'story_reply',
        text: contentToEncrypt,
        storyAuthorId: data.repliedTo.senderId,
        storyId: (data.repliedTo as any).storyId,
        storyText: data.repliedTo.content,
        hasMedia: (data.repliedTo as any).hasMedia
      });
    }

    const { ciphertext, x3dhHeader, mkToStore } = await prepareEncryptedPayload({
      content: contentToEncrypt,
      conversationId,
      isGroup,
      actualTempId,
      participants: conversation?.participants || [],
      isReactionPayload: false
    });

    if (mkToStore) {
      const { storeMessageKeySecurely } = await import('@lib/keyStorage');
      await storeMessageKeySecurely(`temp_${actualTempId}`, mkToStore);
    }

    let finalCiphertext = ciphertext;
    if (x3dhHeader) {
      finalCiphertext = JSON.stringify({
        x3dh: x3dhHeader,
        ciphertext: ciphertext
      });
    }

    const pushPayloads = await generatePushPayloads(
      contentToEncrypt,
      conversationId,
      conversation?.participants || [],
      data as { content?: string; fileUrl?: string; fileName?: string }
    );

    const payload = {
      ...data,
      content: finalCiphertext,
      sessionId: undefined,
      fileKey: undefined,
      fileName: undefined,
      fileType: undefined,
      fileSize: undefined,
      pushPayloads: Object.keys(pushPayloads).length > 0 ? pushPayloads : undefined
    };

    const socket = getSocket();
    const isConnected = socket?.connected;

    if (!isConnected) {
      const queueMsg = {
        ...payload,
        id: `temp_${actualTempId}`,
        tempId: actualTempId,
        conversationId,
        senderId: user?.id,
        createdAt: new Date().toISOString()
      } as Message;
      await addToQueue(conversationId, queueMsg, actualTempId);
      return { error: 'offline' };
    }

    return new Promise((resolve) => {
      socket?.emit(
        'message:send',
        { ...payload, conversationId, tempId: actualTempId },
        async (res: { ok: boolean; msg?: Message; error?: string }) => {
          if (res.ok && res.msg) {
            const existingMsg = {
              id: `temp_${actualTempId}`,
              tempId: actualTempId,
              content: data.content,
              repliedTo: data.repliedTo
            };

            const updatedMsg = {
              ...res.msg,
              content: existingMsg.content,
              repliedTo: existingMsg.repliedTo,
              isBlindAttachment: data.isBlindAttachment,
              status: 'SENT' as const
            };

            if (mkToStore) {
              const { retrieveMessageKeySecurely, storeMessageKeySecurely, deleteMessageKeySecurely } = await import('@lib/keyStorage');
              const mk = await retrieveMessageKeySecurely(`temp_${actualTempId}`);
              if (mk) {
                await storeMessageKeySecurely(res.msg!.id, mk);
                await deleteMessageKeySecurely(`temp_${actualTempId}`);
              }
            }

            resolve({ message: updatedMsg });
          } else {
            resolve({ error: res.error || 'Failed to send' });
          }
        }
      );
    });
  } catch (error) {
    console.error('Send message error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to send' };
  }
}

/**
 * Fetch messages logic (extracted from store)
 * Returns the fetched and decrypted messages
 */
export async function fetchMessagesLogic(
  conversationId: string,
  beforeCursor?: string
): Promise<{ messages: Message[]; hasMore: boolean }> {
  try {
    const url = beforeCursor ? `/api/messages/${conversationId}?cursor=${beforeCursor}` : `/api/messages/${conversationId}`;
    const res = await api<{ items: Message[] }>(url);

    if (!res.items || res.items.length === 0) {
      return { messages: [], hasMore: false };
    }

    const decryptedItems: Message[] = [];
    for (const item of res.items) {
      const decrypted = await decryptMessageObject(item);
      decryptedItems.push(decrypted);
    }

    const enrichedMessages = enrichMessagesWithSenderProfile(conversationId, decryptedItems);
    const processedMessages = processMessagesAndReactions(enrichedMessages);

    // Save to shadow vault
    await shadowVault.upsertMessages(processedMessages);

    return {
      messages: processedMessages,
      hasMore: res.items.length >= 50
    };
  } catch (error) {
    console.error('Fetch messages error:', error);
    return { messages: [], hasMore: false };
  }
}

/**
 * Handle incoming message from socket (extracted from store)
 * Returns the processed message to be saved
 */
export async function handleIncomingMessage(message: Message): Promise<Message | null> {
  try {
    const decrypted = await decryptMessageObject(message);
    
    // INTERCEPT SPECIAL PAYLOADS - Don't render these as chat bubbles
    const reactionPayload = parseReaction(decrypted.content);
    const editPayload = parseEdit(decrypted.content);
    const silentPayload = parseSilent(decrypted.content);
    
    // If it's a reaction, add it to the target message and return null
    if (reactionPayload) {
      const { user } = useAuthStore.getState();
      const reaction = {
        id: decrypted.id,
        emoji: reactionPayload.emoji,
        userId: decrypted.senderId,
        isMessage: true
      };
      useMessageStore.getState().addLocalReaction(
        decrypted.conversationId,
        reactionPayload.targetMessageId,
        reaction
      );
      return null; // Don't render as new message
    }
    
    // If it's an edit, update the target message and return null
    if (editPayload) {
      useMessageStore.getState().updateMessage(
        decrypted.conversationId,
        editPayload.targetMessageId,
        { content: editPayload.text, isEdited: true }
      );
      return null; // Don't render as new message
    }
    
    // If it's a silent/system message (GHOST_SYNC, STORY_KEY, CALL_INIT), ignore it
    if (silentPayload) {
      if (silentPayload.type === 'GHOST_SYNC' || 
          silentPayload.type === 'STORY_KEY' || 
          (silentPayload.type === 'CALL_INIT' && !silentPayload.text)) {
        return null; // Completely invisible
      }
    }
    
    const enriched = enrichMessagesWithSenderProfile(message.conversationId, [decrypted]);
    const processed = processMessagesAndReactions(enriched);

    if (processed.length === 0) {
      return null;
    }

    const finalMessage = processed[0];

    // Save to shadow vault
    await shadowVault.upsertMessages([finalMessage]);

    return finalMessage;
  } catch (error) {
    console.error('Handle incoming message error:', error);
    return null;
  }
}

/**
 * Handle reaction logic (extracted from store)
 * Returns the mutation result
 */
export async function handleReactionLogic(
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<{ success: boolean; error?: string }> {
  const { user } = useAuthStore.getState();
  const actualTempId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  try {
    const { prepareEncryptedPayload } = await import('@services/messageCrypto');
    const conversation = useConversationStore.getState().conversations.find(c => c.id === conversationId);
    const isGroup = conversation?.isGroup || false;

    const contentToEncrypt = JSON.stringify({
      type: 'reaction',
      targetMessageId: messageId,
      emoji
    });

    const { ciphertext, mkToStore } = await prepareEncryptedPayload({
      content: contentToEncrypt,
      conversationId,
      isGroup,
      actualTempId,
      participants: conversation?.participants || [],
      isReactionPayload: true
    });

    if (mkToStore) {
      const { storeMessageKeySecurely } = await import('@lib/keyStorage');
      await storeMessageKeySecurely(`temp_${actualTempId}`, mkToStore);
    }

    const socket = getSocket();
    const isConnected = socket?.connected;

    if (!isConnected) {
      const queueMsg = {
        id: `temp_${actualTempId}`,
        tempId: actualTempId,
        conversationId,
        senderId: user?.id,
        content: ciphertext,
        createdAt: new Date().toISOString()
      } as Message;
      await addToQueue(conversationId, queueMsg, actualTempId);
      return { success: false, error: 'offline' };
    }

    return new Promise((resolve) => {
      socket?.emit(
        'message:send',
        {
          conversationId,
          content: ciphertext,
          tempId: actualTempId
        },
        (res: { ok: boolean; msg?: Message; error?: string }) => {
          if (res.ok) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res.error });
          }
        }
      );
    });
  } catch (error) {
    console.error('Handle reaction error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send reaction' };
  }
}

/**
 * Process offline queue (extracted from store)
 */
export async function processOfflineQueue(): Promise<void> {
  const queueItems = await getQueueItems();
  const connectionStatus = useConnectionStore.getState().status;

  if (connectionStatus !== 'connected' || queueItems.length === 0) {
    return;
  }

  const socket = getSocket();
  if (!socket) {
    return;
  }

  for (const item of queueItems) {
    try {
      const queueItem = item as unknown as { conversationId: string; tempId: number; message: Partial<Message> };
      // Skip if tempId is not a number
      if (typeof queueItem.tempId !== 'number') continue;
      
      await updateQueueAttempt(queueItem.tempId, 1);

      await new Promise<void>((resolve) => {
        socket.emit(
          'message:send',
          {
            conversationId: queueItem.message.conversationId,
            content: queueItem.message.content,
            tempId: queueItem.tempId
          },
          async (res: { ok: boolean; msg?: Message }) => {
            if (res.ok && res.msg) {
              await removeFromQueue(queueItem.tempId);
            }
            resolve();
          }
        );
      });
    } catch (error) {
      console.error('Failed to send queued message:', error);
    }
  }
}
