import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMessageInputStore } from './messageInput';
import { useAuthStore } from './auth';
import { useMessageStore } from './message';
import { useDynamicIslandStore } from './dynamicIsland';
import { getSocket } from '@lib/socket';
import { apiUpload } from '@lib/api';
import { encryptMessage, encryptFile } from '@utils/crypto';

// --- Mocks ---
vi.mock('@lib/api', () => ({
  apiUpload: vi.fn(),
}));

vi.mock('@lib/socket', () => ({
  getSocket: vi.fn(),
}));

vi.mock('@utils/crypto', () => ({
  encryptMessage: vi.fn(),
  encryptFile: vi.fn(),
}));

// Mock other stores
vi.mock('./auth');
vi.mock('./message');
vi.mock('./dynamicIsland');

const mockSocket = { emit: vi.fn() };
const mockAddOptimisticMessage = vi.fn();
const mockAddActivity = vi.fn(() => 'activity-123');
const mockUpdateActivity = vi.fn();
const mockRemoveActivity = vi.fn();

const mockUser = { id: 'user-1', name: 'Test User' };
const conversationId = 'conv-1';
const initialState = useMessageInputStore.getState();

describe('useMessageInputStore', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    useMessageInputStore.setState(initialState, true);

    // Provide mock implementations for dependencies
    vi.mocked(getSocket).mockReturnValue(mockSocket as any);
    vi.mocked(useAuthStore).mockReturnValue({ user: mockUser } as any);
    vi.mocked(useMessageStore).mockReturnValue({ addOptimisticMessage: mockAddOptimisticMessage } as any);
    vi.mocked(useDynamicIslandStore).mockReturnValue({
      addActivity: mockAddActivity,
      updateActivity: mockUpdateActivity,
      removeActivity: mockRemoveActivity,
    } as any);

    // Mock crypto functions to return predictable values
    vi.mocked(encryptMessage).mockResolvedValue({
      ciphertext: 'encrypted-content',
      sessionId: 'session-123',
    });
    vi.mocked(encryptFile).mockResolvedValue({
      encryptedBlob: new Blob(['encrypted-file']),
      key: 'raw-file-key',
    });
    vi.mocked(apiUpload).mockResolvedValue({
      file: { url: '/uploads/mock-file.bin' },
    });
  });

  describe('sendMessage', () => {
    it('should encrypt and optimistically send a text message', async () => {
      const textContent = 'Hello, world!';
      await useMessageInputStore.getState().sendMessage(conversationId, { content: textContent });

      // 1. Check if message was encrypted
      expect(encryptMessage).toHaveBeenCalledWith(textContent, conversationId);

      // 2. Check if an optimistic message was added
      expect(mockAddOptimisticMessage).toHaveBeenCalledOnce();
      const optimisticMessage = mockAddOptimisticMessage.mock.calls[0][1];
      expect(optimisticMessage.content).toBe(textContent);
      expect(optimisticMessage.optimistic).toBe(true);

      // 3. Check if the message was sent via socket with encrypted content
      expect(mockSocket.emit).toHaveBeenCalledOnce();
      const socketPayload = mockSocket.emit.mock.calls[0][1];
      expect(socketPayload.content).toBe('encrypted-content');
      expect(socketPayload.sessionId).toBe('session-123');
    });
  });

  describe('uploadFile', () => {
    it('should encrypt file and key, upload, and send message', async () => {
      const file = new File(['file content'], 'test.txt', { type: 'text/plain' });
      await useMessageInputStore.getState().uploadFile(conversationId, file);

      // 1. Check if file and file key were encrypted
      expect(encryptFile).toHaveBeenCalledWith(file);
      expect(encryptMessage).toHaveBeenCalledWith('raw-file-key', conversationId);

      // 2. Check if file was uploaded
      expect(apiUpload).toHaveBeenCalledOnce();

      // 3. Check if optimistic message was added with RAW file key
      expect(mockAddOptimisticMessage).toHaveBeenCalledOnce();
      const optimisticMessage = mockAddOptimisticMessage.mock.calls[0][1];
      expect(optimisticMessage.fileUrl).toBe('/uploads/mock-file.bin');
      expect(optimisticMessage.fileKey).toBe('raw-file-key'); // Important for local decryption

      // 4. Check if socket message was sent with ENCRYPTED file key
      expect(mockSocket.emit).toHaveBeenCalledOnce();
      const socketPayload = mockSocket.emit.mock.calls[0][1];
      expect(socketPayload.fileUrl).toBe('/uploads/mock-file.bin');
      expect(socketPayload.fileKey).toBe('encrypted-content'); // Encrypted version of 'raw-file-key'
    });
  });

  describe('handleStopRecording', () => {
    it('should process and send a voice message', async () => {
      const voiceBlob = new Blob(['voice-data'], { type: 'audio/webm' });
      const duration = 5; // 5 seconds

      await useMessageInputStore.getState().handleStopRecording(conversationId, voiceBlob, duration);

      // Logic is nearly identical to uploadFile, so we check the same things
      expect(encryptFile).toHaveBeenCalledWith(voiceBlob);
      expect(encryptMessage).toHaveBeenCalledWith('raw-file-key', conversationId);
      expect(apiUpload).toHaveBeenCalledOnce();
      expect(mockAddOptimisticMessage).toHaveBeenCalledOnce();
      expect(mockSocket.emit).toHaveBeenCalledOnce();

      // Check specific voice message properties
      const socketPayload = mockSocket.emit.mock.calls[0][1];
      expect(socketPayload.duration).toBe(duration);
      expect(socketPayload.fileType).toContain('audio/webm');
    });
  });

  describe('setReplyingTo', () => {
    it('should set a message to reply to', () => {
      const message: Message = { id: 'msg-1', content: 'hello', conversationId, senderId: 'user-2', createdAt: '' };
      useMessageInputStore.getState().setReplyingTo(message);
      expect(useMessageInputStore.getState().replyingTo).toEqual(message);
    });

    it('should clear the message to reply to', () => {
      useMessageInputStore.getState().setReplyingTo({} as Message);
      useMessageInputStore.getState().setReplyingTo(null);
      expect(useMessageInputStore.getState().replyingTo).toBeNull();
    });
  });
});
