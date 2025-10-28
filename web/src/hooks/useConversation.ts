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

  const storeSendMessage = useMemo(() => store.sendMessage, [store.sendMessage]);
  const storeUploadFile = useMemo(() => store.uploadFile, [store.uploadFile]);
  const storeLoadPreviousMessages = useMemo(() => store.loadPreviousMessages, [store.loadPreviousMessages]);

  return {
    conversation,
    messages,
    isLoading: isLoadingInitial,
    error,
    isFetchingMore,
    hasMore,
    sendMessage: (data: Partial<Message>) => storeSendMessage(conversationId, data),
    uploadFile: (file: File) => storeUploadFile(conversationId, file),
    loadPreviousMessages: () => storeLoadPreviousMessages(conversationId),
  };
}
