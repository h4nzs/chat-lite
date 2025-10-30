import { useEffect, useMemo } from 'react';
import { useConversationStore, type Message } from '@store/conversation';
import { useMessageStore } from '@store/message';

export function useConversation(conversationId: string) {
  const { conversation, error: convoError } = useConversationStore(state => ({
    conversation: state.conversations.find(c => c.id === conversationId),
    error: state.error,
  }));

  const { 
    messages, 
    isLoadingInitial, 
    error: msgError, 
    isFetchingMore, 
    hasMore,
    loadMessagesForConversation,
    sendMessage,
    uploadFile,
    loadPreviousMessages
  } = useMessageStore(state => ({
    messages: state.messages[conversationId] || [],
    isLoadingInitial: state.messages[conversationId] === undefined,
    error: state.error,
    isFetchingMore: state.isFetchingMore[conversationId] || false,
    hasMore: state.hasMore[conversationId] ?? true,
    loadMessagesForConversation: state.loadMessagesForConversation,
    sendMessage: state.sendMessage,
    uploadFile: state.uploadFile,
    loadPreviousMessages: state.loadPreviousMessages,
  }));

  useEffect(() => {
    if (conversationId) {
      loadMessagesForConversation(conversationId);
    }
  }, [conversationId, loadMessagesForConversation]);

  return {
    conversation,
    messages,
    isLoading: isLoadingInitial,
    error: convoError || msgError,
    isFetchingMore,
    hasMore,
    sendMessage: (data: Partial<Message>) => sendMessage(conversationId, data),
    uploadFile: (file: File) => uploadFile(conversationId, file),
    loadPreviousMessages: () => loadPreviousMessages(conversationId),
  };
}
