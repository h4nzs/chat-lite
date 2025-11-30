import { createWithEqualityFn } from "zustand/traditional";
import { api, apiUpload } from "@lib/api";
import { getSocket, emitSessionKeyRequest } from "@lib/socket";
import { encryptMessage, decryptMessage, ensureAndRatchetSession, encryptFile } from "@utils/crypto";
import toast from "react-hot-toast";
import { useAuthStore, type User } from "./auth";
import type { Message } from "./conversation";
import useDynamicIslandStore from './dynamicIsland';
import { useConversationStore } from "./conversation";

export async function decryptMessageObject(message: Message): Promise<Message> {
  const decryptedMsg = { ...message };
  try {
    if (decryptedMsg.content && decryptedMsg.sessionId) {
      decryptedMsg.ciphertext = decryptedMsg.content;
      const result = await decryptMessage(decryptedMsg.content, decryptedMsg.conversationId, decryptedMsg.sessionId);
      if (result.status === 'success') decryptedMsg.content = result.value;
      else if (result.status === 'pending') decryptedMsg.content = result.reason;
      else decryptedMsg.content = `[${result.error.message}]`;
    }
    if (decryptedMsg.repliedTo?.content && decryptedMsg.repliedTo.sessionId) {
      const replyResult = await decryptMessage(decryptedMsg.repliedTo.content, decryptedMsg.conversationId, decryptedMsg.repliedTo.sessionId);
      if (replyResult.status === 'success') decryptedMsg.repliedTo.content = replyResult.value;
      else decryptedMsg.repliedTo.content = '[Encrypted Reply]';
    }
    return decryptedMsg;
  } catch (e) {
    console.error("Decryption failed in decryptMessageObject", e);
    decryptedMsg.content = '[Failed to decrypt message]';
    return decryptedMsg;
  }
}

type State = {
  messages: Record<string, Message[]>;
  replyingTo: Message | null;
  isFetchingMore: Record<string, boolean>;
  hasMore: Record<string, boolean>;
  typingLinkPreview: any | null;
  hasLoadedHistory: Record<string, boolean>;
  setReplyingTo: (message: Message | null) => void;
  fetchTypingLinkPreview: (text: string) => void;
  clearTypingLinkPreview: () => void;
  sendMessage: (conversationId: string, data: Partial<Message>) => Promise<void>;
  uploadFile: (conversationId: string, file: File) => Promise<void>;
  loadMessagesForConversation: (id: string) => Promise<void>;
  loadPreviousMessages: (conversationId: string) => Promise<void>;
  addOptimisticMessage: (conversationId: string, message: Message) => void;
  addIncomingMessage: (conversationId: string, message: Message) => void;
  replaceOptimisticMessage: (conversationId: string, tempId: number, newMessage: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  addReaction: (conversationId: string, messageId: string, reaction: any) => void;
  removeReaction: (conversationId: string, messageId: string, reactionId: string) => void;
  updateSenderDetails: (user: Partial<User>) => void;
  updateMessageStatus: (conversationId: string, messageId: string, userId: string, status: string) => void;
  clearMessagesForConversation: (conversationId: string) => void;
  retrySendMessage: (message: Message) => void;
  addSystemMessage: (conversationId: string, content: string) => void;
};

export const useMessageStore = createWithEqualityFn<State>((set, get) => ({
  messages: {},
  isFetchingMore: {},
  hasMore: {},
  hasLoadedHistory: {},
  replyingTo: null,
  typingLinkPreview: null,

  setReplyingTo: (message: Message | null) => set({ replyingTo: message }),
  fetchTypingLinkPreview: async (text: string) => {
    try {
      const res = await api('/api/previews/link', { method: 'POST', body: JSON.stringify({ text }) });
      set({ typingLinkPreview: res });
    } catch {
      set({ typingLinkPreview: null });
    }
  },
  clearTypingLinkPreview: () => set({ typingLinkPreview: null }),

  sendMessage: async (conversationId, data) => {
    const tempId = Date.now();
    const { user } = useAuthStore.getState();
    if (!user) return;

    try {
      const optimisticMessage: Message = {
        ...data,
        id: `temp_${tempId}`,
        tempId: tempId,
        optimistic: true,
        sender: user,
        senderId: user.id,
        createdAt: new Date().toISOString(),
        conversationId,
        reactions: [],
        statuses: [{ userId: user.id, status: 'READ', messageId: `temp_${tempId}`, id: `temp_status_${tempId}` }],
      };

      if (data.content) {
        const { ciphertext, sessionId } = await encryptMessage(data.content, conversationId);
        optimisticMessage.content = ciphertext;
        optimisticMessage.sessionId = sessionId;
      }
      
      // For file messages, the fileKey is already encrypted and passed in `data`
      if (data.fileKey) {
        const { ciphertext, sessionId } = await encryptMessage(data.fileKey, conversationId);
        optimisticMessage.fileKey = ciphertext;
        optimisticMessage.sessionId = sessionId;
      }


      get().addOptimisticMessage(conversationId, optimisticMessage);
      useConversationStore.getState().updateConversationLastMessage(conversationId, { ...optimisticMessage, content: data.content }); // Show plaintext optimistically
      set({ replyingTo: null, typingLinkPreview: null });
      
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ ...optimisticMessage, tempId }),
      });

    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message.");
      set(state => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId]?.map(m => m.tempId === tempId ? { ...m, error: true } : m) || [],
        },
      }));
    }
  },

  uploadFile: async (conversationId, file) => {
    const { addActivity, updateActivity, removeActivity } = useDynamicIslandStore.getState();
    const uploadId = addActivity({ type: 'upload', fileName: file.name, progress: 0 });

    try {
      // 1. Encrypt the file locally
      updateActivity(uploadId, { progress: 10 });
      const { encryptedBlob, key: fileKey } = await encryptFile(file);
      
      // 2. Upload the encrypted blob
      updateActivity(uploadId, { progress: 40 });
      const formData = new FormData();
      formData.append('file', encryptedBlob, file.name);
      
      const uploadRes = await apiUpload<{ file: { url: string } }>(`/api/uploads/${conversationId}/upload`, formData);
      const fileUrl = uploadRes.file.url;
      
      // 3. Send the metadata message with the encrypted file key
      updateActivity(uploadId, { progress: 90 });
      await get().sendMessage(conversationId, {
        fileUrl,
        fileName: file.name,
        fileType: `${file.type};encrypted=true`,
        fileSize: file.size,
        fileKey, // The unencrypted file key is passed here; sendMessage will encrypt it
      });

      updateActivity(uploadId, { progress: 100 });
      setTimeout(() => removeActivity(uploadId), 1000);

    } catch (error) {
      removeActivity(uploadId);
      console.error("File upload failed:", error);
      toast.error(`Failed to upload ${file.name}.`);
    }
  },

  loadMessagesForConversation: async (id) => {
    if (get().hasLoadedHistory[id]) return;
    try {
      await ensureAndRatchetSession(id);
    } catch (ratchetError) {
      console.error("Failed to establish session, decryption may fail:", ratchetError);
    }
    try {
      set(state => ({ hasMore: { ...state.hasMore, [id]: true }, isFetchingMore: { ...state.isFetchingMore, [id]: false } }));
      const res = await api<{ items: Message[] }>(`/api/messages/${id}`);
      const fetchedMessages = res.items || [];
      const processedMessages: Message[] = [];
      const failedSessionIds = new Set<string>();
      for (const message of fetchedMessages) {
        try {
          const decryptedMessage = await decryptMessageObject(message);
          processedMessages.push(decryptedMessage);
        } catch (e) {
          processedMessages.push({ ...message, content: '[Requesting key to decrypt...]' });
          if (message.sessionId) failedSessionIds.add(message.sessionId);
        }
      }
      for (const sessionId of failedSessionIds) emitSessionKeyRequest(id, sessionId);
      set(state => {
        const existingMessages = state.messages[id] || [];
        const messageMap = new Map(existingMessages.map(m => [m.id, m]));
        processedMessages.forEach(m => messageMap.set(m.id, m));
        const allMessages = Array.from(messageMap.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return {
          ...state,
          messages: { ...state.messages, [id]: allMessages },
          hasMore: { ...state.hasMore, [id]: fetchedMessages.length >= 50 },
          hasLoadedHistory: { ...state.hasLoadedHistory, [id]: true }
        };
      });
    } catch (error) {
      console.error(`Failed to load messages for ${id}`, error);
    }
  },

  loadPreviousMessages: async (conversationId) => {
    const { isFetchingMore, hasMore, messages } = get();
    if (isFetchingMore[conversationId] || !hasMore[conversationId]) return;
    const currentMessages = messages[conversationId] || [];
    const oldestMessage = currentMessages[0];
    if (!oldestMessage) return;
    set(state => ({ isFetchingMore: { ...state.isFetchingMore, [conversationId]: true } }));
    try {
      const res = await api<{ items: Message[] }>(`/api/messages/${conversationId}?cursor=${oldestMessage.id}`);
      const decryptedItems = await Promise.all((res.items || []).map(decryptMessageObject));
      decryptedItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (decryptedItems.length < 50) set(state => ({ hasMore: { ...state.hasMore, [conversationId]: false } }));
      set(state => ({ messages: { ...state.messages, [conversationId]: [...decryptedItems, ...currentMessages] } }));
    } catch (error) {
      console.error("Failed to load previous messages", error);
    } finally {
      set(state => ({ isFetchingMore: { ...state.isFetchingMore, [conversationId]: false } }));
    }
  },

  addOptimisticMessage: (conversationId, message) => {
    set(state => ({ messages: { ...state.messages, [conversationId]: [...(state.messages[conversationId] || []), message] } }));
  },

  addIncomingMessage: (conversationId, message) => {
    set(state => {
      const currentMessages = state.messages[conversationId] || [];
      if (currentMessages.some(m => m.id === message.id)) return state;
      return { messages: { ...state.messages, [conversationId]: [...currentMessages, { ...message, linkPreview: message.linkPreview }] } };
    });
  },

  replaceOptimisticMessage: (conversationId, tempId, newMessage) => {
    set(state => ({
      messages: { ...state.messages, [conversationId]: (state.messages[conversationId] || []).map(m => m.tempId === tempId ? { ...m, id: newMessage.id, createdAt: newMessage.createdAt, optimistic: false, error: false, linkPreview: newMessage.linkPreview } : m) }
    }));
  },

  updateMessage: (conversationId, messageId, updates) => {
    set(state => ({
      messages: { ...state.messages, [conversationId]: (state.messages[conversationId] || []).map(m => m.id === messageId ? { ...m, ...updates } : m) }
    }));
  },

  addReaction: (conversationId, messageId, reaction) => {
    set(state => ({
      messages: { ...state.messages, [conversationId]: (state.messages[conversationId] || []).map(m => m.id === messageId ? { ...m, reactions: [...(m.reactions || []), reaction] } : m) }
    }));
  },

  removeReaction: (conversationId, messageId, reactionId) => {
    set(state => ({
      messages: { ...state.messages, [conversationId]: (state.messages[conversationId] || []).map(m => m.id === messageId ? { ...m, reactions: (m.reactions || []).filter(r => r.id !== reactionId) } : m) }
    }));
  },

  updateSenderDetails: (user) => {
    set(state => {
      const newMessages = { ...state.messages };
      for (const convoId in newMessages) {
        newMessages[convoId] = newMessages[convoId].map(m => m.sender?.id === user.id ? { ...m, sender: { ...m.sender, ...user } } : m);
      }
      return { messages: newMessages };
    });
  },

  updateMessageStatus: (conversationId, messageId, userId, status) => {
    set(state => {
      const newMessages = { ...state.messages };
      const convoMessages = newMessages[conversationId];
      if (!convoMessages) return state;
      newMessages[conversationId] = convoMessages.map(m => {
        if (m.id === messageId) {
          const existingStatus = m.statuses?.find(s => s.userId === userId);
          if (existingStatus) return { ...m, statuses: m.statuses!.map(s => s.userId === userId ? { ...s, status } : s) };
          else return { ...m, statuses: [...(m.statuses || []), { userId, status, messageId, id: `temp-status-${Date.now()}` }] };
        }
        return m;
      });
      return { messages: newMessages };
    });
  },

  clearMessagesForConversation: (conversationId) => {
    set(state => {
      const newMessages = { ...state.messages };
      delete newMessages[conversationId];
      return { messages: newMessages };
    });
  },

  retrySendMessage: (message: Message) => {
    const { conversationId, tempId, content, fileUrl, fileName, fileType, fileSize, repliedToId } = message;
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: state.messages[conversationId]?.filter(m => m.tempId !== tempId) || [],
      },
    }));
    get().sendMessage(conversationId, { content, fileUrl, fileName, fileType, fileSize, repliedToId });
  },
}));
