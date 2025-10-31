import { createWithEqualityFn } from "zustand/traditional";
import { getSocket } from "@lib/socket";
import { useAuthStore } from "./auth";
import { useConversationStore, Message, Conversation } from "./conversation";
import { useMessageStore, decryptMessageObject } from "./message";
import { usePresenceStore } from "./presence";
import useNotificationStore from './notification';

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

      // Trigger in-app notification if the message is not from the current user and the conversation is not active
      if (decryptedMessage.senderId !== meId && activeId !== decryptedMessage.conversationId) {
        const senderName = decryptedMessage.sender?.name || 'Someone';
        const messageContent = decryptedMessage.content || (decryptedMessage.fileUrl ? 'Sent a file' : 'New message');
        
        const notificationPayload = {
          id: decryptedMessage.id,
          message: `${senderName}: ${messageContent}`,
          link: decryptedMessage.conversationId,
          sender: decryptedMessage.sender
        };

        useNotificationStore.getState().addNotification(notificationPayload);
      }

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
      // When being re-added to a group, clear the old message history first
      getStores().msg.clearMessagesForConversation(newConversation.id);
      getStores().convo.addOrUpdateConversation(newConversation);

      // Notify user they were added to a new group
      if (newConversation.isGroup) {
        useNotificationStore.getState().addNotification({
          message: `You have been added to the group: ${newConversation.title}`,
          link: `/` // Or a more specific link if available
        });
      }
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

    // --- New listeners for group management ---

    socket.on("conversation:updated", (data) => {
      getStores().convo.updateConversation(data.id, { ...data, lastUpdated: Date.now() });
    });

    socket.on("conversation:participants_added", ({ conversationId, newParticipants }) => {
      getStores().convo.addParticipants(conversationId, newParticipants);
    });

    socket.on("conversation:participant_removed", ({ conversationId, userId }) => {
      getStores().convo.removeParticipant(conversationId, userId);
    });

    socket.on("conversation:participant_updated", ({ conversationId, userId, role }) => {
      const { auth, convo } = getStores();
      if (auth.user?.id === userId) {
        const conversation = convo.conversations.find(c => c.id === conversationId);
        if (conversation) {
          useNotificationStore.getState().addNotification({
            message: `You are now an ${role.toLowerCase()} in "${conversation.title}".`,
            link: `/`
          });
        }
      }
      getStores().convo.updateParticipantRole(conversationId, userId, role);
      getStores().convo.updateConversation(conversationId, { lastUpdated: Date.now() });
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
      socket.off("conversation:updated");
      socket.off("conversation:participants_added");
      socket.off("conversation:participant_removed");
      socket.off("conversation:participant_updated");
    };
  },
}));