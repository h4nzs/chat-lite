import { createWithEqualityFn } from "zustand/traditional";
import { api, apiUpload, handleApiError } from "@lib/api";
import { getSocket } from "@lib/socket";
import { encryptMessage } from "@utils/crypto";
import toast from "react-hot-toast";
import { useAuthStore } from "./auth";
import { useMessageStore } from "./message";
import type { Message } from "./conversation";
import useDynamicIslandStore from "./dynamicIsland";

type State = {
  replyingTo: Message | null;
  typingLinkPreview: any | null;

  // Actions
  setReplyingTo: (message: Message | null) => void;
  fetchTypingLinkPreview: (text: string) => void;
  clearTypingLinkPreview: () => void;
  sendMessage: (conversationId: string, data: Partial<Message>) => Promise<void>;
  uploadFile: (conversationId: string, file: File) => Promise<void>;
  retrySendMessage: (message: Message) => void;
};

export const useMessageInputStore = createWithEqualityFn<State>((set, get) => ({
  replyingTo: null,
  typingLinkPreview: null,

  setReplyingTo: (message) => set({ replyingTo: message }),

  fetchTypingLinkPreview: async (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    if (urls && urls.length > 0) {
      try {
        const preview = await api("/api/previews", {
          method: "POST",
          body: JSON.stringify({ url: urls[0] }),
        });
        set({ typingLinkPreview: preview });
      } catch (error) {
        set({ typingLinkPreview: null });
      }
    } else {
      set({ typingLinkPreview: null });
    }
  },

  clearTypingLinkPreview: () => set({ typingLinkPreview: null }),

  sendMessage: async (conversationId, data) => {
    const tempId = Date.now();
    const me = useAuthStore.getState().user;
    const { replyingTo } = get();
    const { addOptimisticMessage, updateMessage } = useMessageStore.getState();

    let payload: Partial<Message> = { ...data };

    if (data.content) {
      try {
        const { ciphertext, sessionId } = await encryptMessage(data.content, conversationId);
        payload.content = ciphertext;
        payload.sessionId = sessionId;
      } catch (e: any) {
        toast.error(`Encryption failed: ${e.message}`);
        return;
      }
    }

    const optimisticMessage: Message = {
      id: `temp-${tempId}`,
      tempId,
      conversationId,
      senderId: me!.id,
      sender: me!,
      createdAt: new Date().toISOString(),
      optimistic: true,
      ...data,
      repliedTo: replyingTo || undefined,
    };

    addOptimisticMessage(conversationId, optimisticMessage);
    
    const socket = getSocket();
    const finalPayload = { 
      ...payload, 
      repliedToId: replyingTo?.id,
    };

    socket.emit("message:send", { conversationId, tempId, ...finalPayload }, (ack: { ok: boolean, error?: string }) => {
      if (!ack.ok) {
        toast.error(`Failed to send message: ${ack.error || 'Unknown error'}`);
        updateMessage(conversationId, `temp-${tempId}`, { error: true, optimistic: false });
      }
    });

    set({ replyingTo: null });
  },
  
  uploadFile: async (conversationId, file) => {
    const { addActivity, updateActivity, removeActivity } = useDynamicIslandStore.getState();
    
    const activityId = addActivity({
      type: 'upload',
      fileName: file.name,
      progress: 0,
    });

    try {
      const form = new FormData();
      form.append("file", file);

      const { file: fileData } = await apiUpload<{ file: any }>({
        path: `/api/uploads/${conversationId}/upload`,
        formData: form,
        onUploadProgress: (progress) => {
          updateActivity(activityId, { progress });
        },
      });
      
      setTimeout(() => removeActivity(activityId), 1000); 

      get().sendMessage(conversationId, { 
        fileUrl: fileData.url, 
        fileName: fileData.filename, 
        fileType: fileData.mimetype, 
        fileSize: fileData.size, 
        content: '' 
      });
    } catch (uploadError: any) {
      const errorMsg = handleApiError(uploadError);
      toast.error(`Upload failed: ${errorMsg}`);
      removeActivity(activityId);
    }
  },

  retrySendMessage: (message: Message) => {
    const { conversationId, tempId, content, fileUrl, fileName, fileType, fileSize, repliedToId } = message;
    
    useMessageStore.getState().updateMessage(conversationId, `temp-${tempId}`, { tobeDeleted: true } as any);

    get().sendMessage(conversationId, { content, fileUrl, fileName, fileType, fileSize, repliedToId });
  },
}));