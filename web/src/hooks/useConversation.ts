import { useEffect, useMemo } from 'react';
import { useChatStore } from '@store/chat';
import { shallow } from 'zustand/shallow';

/**
 * Custom hook to manage all logic for a single conversation.
 * Encapsulates message loading, sending, and provides filtered data from the store.
 * @param conversationId The ID of the conversation to manage.
 */
export function useConversation(conversationId: string) {
  const store = useChatStore();

  // Select relevant data from the store
  const { conversation, messages, isLoadingInitial, error } = useChatStore(state => ({
    conversation: state.conversations.find(c => c.id === conversationId),
    messages: state.messages[conversationId] || [],
    isLoadingInitial: !state.messages[conversationId], // Simple loading state
    error: state.error,
  }), shallow);

  // Effect to load messages when the conversation ID changes
  useEffect(() => {
    if (conversationId) {
      store.loadMessagesForConversation(conversationId);
    }
  }, [conversationId, store.loadMessagesForConversation]);

  // Memoize actions to prevent unnecessary re-renders
  const sendMessage = useMemo(() => store.sendMessage, [store.sendMessage]);
  const uploadFile = useMemo(() => store.uploadFile, [store.uploadFile]);

  return {
    conversation,
    messages,
    isLoading: isLoadingInitial,
    error,
    sendMessage: (content: string) => sendMessage(conversationId, { content }),
    uploadFile: (file: File) => uploadFile(conversationId, file),
  };
}
