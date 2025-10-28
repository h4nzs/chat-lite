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
  const { 
    conversation, 
    messages, 
    isLoadingInitial, 
    error, 
    isFetchingMore, 
    hasMore 
  } = useChatStore(state => ({
    conversation: state.conversations.find(c => c.id === conversationId),
    messages: state.messages[conversationId] || [],
    isLoadingInitial: state.messages[conversationId] === undefined, // More precise loading state
    error: state.error,
    isFetchingMore: state.isFetchingMore[conversationId] || false,
    hasMore: state.hasMore[conversationId] ?? true,
  }), shallow);

  // Effect to load initial messages when the conversation ID changes
  useEffect(() => {
    if (conversationId) {
      store.loadMessagesForConversation(conversationId);
    }
  }, [conversationId, store.loadMessagesForConversation]);

  // Memoize actions to prevent unnecessary re-renders
  const sendMessage = useMemo(() => store.sendMessage, [store.sendMessage]);
  const uploadFile = useMemo(() => store.uploadFile, [store.uploadFile]);
  const loadPreviousMessages = useMemo(() => store.loadPreviousMessages, [store.loadPreviousMessages]);

  return {
    conversation,
    messages,
    isLoading: isLoadingInitial,
    error,
    isFetchingMore,
    hasMore,
    sendMessage: (content: string) => sendMessage(conversationId, { content }),
    uploadFile: (file: File) => uploadFile(conversationId, file),
    loadPreviousMessages: () => loadPreviousMessages(conversationId),
  };
}
