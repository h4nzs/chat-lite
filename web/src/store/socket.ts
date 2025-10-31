import { createWithEqualityFn } from "zustand/traditional";
import { getSocket } from "@lib/socket";
import { useAuthStore } from "./auth";
import { useConversationStore, Message, Conversation } from "./conversation";
import { useMessageStore, decryptMessageObject } from "./message";
import { usePresenceStore } from "./presence";

// --- Helper Functions ---

const getStores = () => ({
  auth: useAuthStore.getState(),
  convo: useConversationStore.getState(),
  msg: useMessageStore.getState(),
  presence: usePresenceStore.getState(),
});

type State = {
  isConnected: boolean;
  initSocketListeners: () => () => void; // Returns a cleanup function
};

export const useSocketStore = createWithEqualityFn<State>((set) => ({
  isConnected: false,

  initSocketListeners: () => {
    const socket = getSocket();
    set({ isConnected: true });

    // --- Register all listeners ---

    socket.on("presence:init", (onlineUserIds: string[]) => {
      getStores().presence.setPresence(onlineUserIds);
    });

    socket.on("presence:user_joined", (userId: string) => {
      getStores().presence.userJoined(userId);
    });

    socket.on("presence:user_left", (userId: string) => {
      getStores().presence.userLeft(userId);
    });

    socket.on("typing:update", ({ userId, conversationId, isTyping }) => {
      const { typing, setTyping } = getStores().presence;
      const currentTyping = typing[conversationId] || [];
      let newTypingUsers = [...currentTyping];

      if (isTyping && !currentTyping.includes(userId)) {
        newTypingUsers.push(userId);
      } else if (!isTyping) {
        newTypingUsers = newTypingUsers.filter(id => id !== userId);
      }
      setTyping(conversationId, newTypingUsers);
    });

    socket.on("message:new", async (newMessage: Message) => {
      const decryptedMessage = await decryptMessageObject(newMessage);
      const { convo, msg, auth } = getStores();
      const { activeId } = convo;
      const meId = auth.user?.id;

      // Handle message state update
      if (decryptedMessage.senderId === meId && decryptedMessage.tempId) {
        msg.replaceOptimisticMessage(decryptedMessage.conversationId, decryptedMessage.tempId, decryptedMessage);
      } else {
        msg.addIncomingMessage(decryptedMessage.conversationId, decryptedMessage);
      }

      // Handle conversation list update
      const existingConversation = convo.conversations.find(c => c.id === decryptedMessage.conversationId);

      if (existingConversation) {
        const newUnreadCount = activeId !== decryptedMessage.conversationId && decryptedMessage.senderId !== meId
          ? (existingConversation.unreadCount || 0) + 1
          : existingConversation.unreadCount;

        convo.addOrUpdateConversation({ 
          ...existingConversation,
          lastMessage: decryptedMessage,
          unreadCount: newUnreadCount
        });
      } else {
        // If conversation is not in the list, fetch it
        try {
          const newConversation = await api<Conversation>(`/api/conversations/${decryptedMessage.conversationId}`);
          if (newConversation) {
            convo.addOrUpdateConversation({
              ...newConversation,
              lastMessage: decryptedMessage,
              unreadCount: 1, // It's a new message, so unread count is at least 1
            });
          }
        } catch (error) {
          console.error("Failed to fetch new conversation:", error);
        }
      }
    });

    socket.on("conversation:new", (newConversation: Conversation) => {
      getStores().convo.addOrUpdateConversation(newConversation);
    });

    socket.on("conversation:deleted", ({ id }) => {
      getStores().convo.removeConversation(id);
    });

    socket.on("message:deleted", ({ messageId, conversationId }) => {
      getStores().msg.updateMessage(conversationId, messageId, {
        content: "[This message was deleted]",
        fileUrl: undefined,
        imageUrl: undefined,
        reactions: [],
      });
    });

    socket.on('message:status_updated', ({ messageId, conversationId, readBy, status }) => {
      getStores().msg.updateMessageStatus(conversationId, messageId, readBy, status);
    });

    socket.on("reaction:new", (reaction) => {
      const { messages } = getStores().msg;
      for (const cid in messages) {
        if (messages[cid].some(m => m.id === reaction.messageId)) {
          getStores().msg.addReaction(cid, reaction.messageId, reaction);
          break;
        }
      }
    });

    socket.on("reaction:remove", ({ reactionId, messageId }) => {
      const { messages } = getStores().msg;
      for (const cid in messages) {
        if (messages[cid].some(m => m.id === messageId)) {
          getStores().msg.removeReaction(cid, messageId, reactionId);
          break;
        }
      }
    });

    socket.on('user:updated', (updatedUser: any) => {
      const { auth, convo, msg } = getStores();
      if (updatedUser.id === auth.user?.id) return; // Ignore self-updates

      // Update user details in all relevant places
      convo.updateParticipantDetails(updatedUser);
      msg.updateSenderDetails(updatedUser);
    });

    // Return a cleanup function
    return () => {
      set({ isConnected: false });
      socket.off("presence:init");
      socket.off("presence:user_joined");
      socket.off("presence:user_left");
      socket.off("typing:update");
      socket.off("message:new");
      socket.off("conversation:new");
      socket.off("conversation:deleted");
      socket.off("reaction:new");
      socket.off("reaction:remove");
      socket.off("message:deleted");
      socket.off("message:status_updated");
      socket.off("user:updated");
    };
  },
}));