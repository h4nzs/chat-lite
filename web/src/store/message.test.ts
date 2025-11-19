import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMessageStore } from './message';
import type { Message } from './conversation';

describe('useMessageStore', () => {
  const conversationId = 'conv1';
  const meId = 'user1';
  const otherUserId = 'user2';

  // Define a clean initial state to reset to
  const initialState = useMessageStore.getState();

  beforeEach(() => {
    // Reset the store to its initial state before each test
    useMessageStore.setState(initialState, true);
  });

  const optimisticMessage: Message = {
    id: `temp-${Date.now()}`,
    tempId: Date.now(),
    conversationId,
    senderId: meId,
    content: 'Hello',
    createdAt: new Date().toISOString(),
    optimistic: true,
  };

  it('should add an optimistic message to the correct conversation', () => {
    expect(useMessageStore.getState().messages[conversationId]).toBeUndefined();
    
    useMessageStore.getState().addOptimisticMessage(conversationId, optimisticMessage);
    
    const messages = useMessageStore.getState().messages[conversationId];
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(optimisticMessage.id);
    expect(messages[0].optimistic).toBe(true);
  });

  it('should replace an optimistic message with the final message from the server', () => {
    useMessageStore.getState().addOptimisticMessage(conversationId, optimisticMessage);

    const finalMessage: Message = {
      id: 'real-id-456',
      conversationId,
      senderId: meId,
      content: 'Hello',
      createdAt: new Date().toISOString(),
    };

    useMessageStore.getState().replaceOptimisticMessage(conversationId, optimisticMessage.tempId!, finalMessage);
    
    const messages = useMessageStore.getState().messages[conversationId];
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('real-id-456');
    expect(messages[0].optimistic).toBe(false);
    expect(messages[0].tempId).toBe(optimisticMessage.tempId); // tempId is preserved
  });

  it('should add an incoming message from another user', () => {
    const incomingMessage: Message = {
      id: 'incoming-msg-1',
      conversationId,
      senderId: otherUserId,
      content: 'Hi there!',
      createdAt: new Date().toISOString(),
    };

    useMessageStore.getState().addIncomingMessage(conversationId, incomingMessage);

    const messages = useMessageStore.getState().messages[conversationId];
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hi there!');
  });
  
  it('should not add a duplicate incoming message', () => {
    const incomingMessage: Message = { id: 'incoming-msg-1', conversationId, senderId: otherUserId, content: 'Hi!', createdAt: new Date().toISOString() };
    
    // Add once
    useMessageStore.getState().addIncomingMessage(conversationId, incomingMessage);
    expect(useMessageStore.getState().messages[conversationId]).toHaveLength(1);

    // Add again
    useMessageStore.getState().addIncomingMessage(conversationId, incomingMessage);
    expect(useMessageStore.getState().messages[conversationId]).toHaveLength(1);
  });

  it('should remove a message from a conversation', () => {
    // Setup: add two messages
    useMessageStore.getState().addIncomingMessage(conversationId, { id: 'msg-1', conversationId, senderId: 'user1', content: 'A', createdAt: new Date().toISOString() });
    useMessageStore.getState().addIncomingMessage(conversationId, { id: 'msg-2', conversationId, senderId: 'user1', content: 'B', createdAt: new Date().toISOString() });
    expect(useMessageStore.getState().messages[conversationId]).toHaveLength(2);

    // Action: remove one message
    useMessageStore.getState().removeMessage(conversationId, 'msg-1');

    // Assert
    const messages = useMessageStore.getState().messages[conversationId];
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-2');
  });

  it('should add a system message correctly', () => {
    useMessageStore.getState().addSystemMessage(conversationId, 'User has joined.');
    
    const messages = useMessageStore.getState().messages[conversationId];
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('SYSTEM');
    expect(messages[0].content).toBe('User has joined.');
  });
});