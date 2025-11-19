import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VoiceMessagePlayer from './VoiceMessagePlayer'; // Corrected: default import
import type { Message } from '@store/conversation'; // Corrected: path to type
import * as cryptoUtils from '@utils/crypto';

// --- Mocks ---
vi.mock('@utils/crypto');

global.URL.createObjectURL = vi.fn(() => 'blob:mock-audio-url');
global.URL.revokeObjectURL = vi.fn();
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock HTMLAudioElement
const mockAudioElement = {
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  // Add other properties if needed by the component
  currentTime: 0,
  duration: 30,
  paused: true,
};

describe('VoiceMessagePlayer Component', () => {
  const mockMessage: Message = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: '',
    fileKey: 'encrypted-voice-key-long-enough',
    fileUrl: '/uploads/voice.webm',
    fileName: 'voice.webm',
    fileType: 'audio/webm;encrypted=true',
    sessionId: 'session-123',
    duration: 30,
    createdAt: new Date().toISOString(),
    optimistic: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio data'])),
    });
    vi.mocked(cryptoUtils.decryptMessage).mockResolvedValue('decrypted-file-key');
    vi.mocked(cryptoUtils.decryptFile).mockResolvedValue(new Blob(['audio data']));

    // Mock the ref to return our mock audio element
    vi.spyOn(require('react'), 'useRef').mockReturnValue({
      current: mockAudioElement,
    });
  });

  it('should show a decrypting indicator initially', () => {
    render(<VoiceMessagePlayer message={mockMessage} />);
    expect(screen.getByText(/Decrypting.../i)).toBeInTheDocument();
  });

  it('should render the player after successful decryption', async () => {
    render(<VoiceMessagePlayer message={mockMessage} />);
    
    // Wait for the play button to be enabled (which happens after src is set)
    const playButton = await screen.findByRole('button', { name: /play voice message/i });
    expect(playButton).not.toBeDisabled();
    
    // Check if the audio element received the correct src
    expect(mockAudioElement.src).toBe('blob:mock-audio-url');
    // Check if the duration is displayed
    expect(screen.getByText(/0:30/)).toBeInTheDocument();
  });

  it('should call play on the audio element when the play button is clicked', async () => {
    render(<VoiceMessagePlayer message={mockMessage} />);
    
    const playButton = await screen.findByRole('button', { name: /play voice message/i });
    fireEvent.click(playButton);
    
    expect(mockAudioElement.play).toHaveBeenCalled();
  });

  it('should show a "waiting for key" state correctly', async () => {
    vi.mocked(cryptoUtils.decryptMessage).mockResolvedValue('[Requesting key...]');
    render(<VoiceMessagePlayer message={mockMessage} />);
    
    expect(await screen.findByText(/Waiting for key/i)).toBeInTheDocument();
  });

  it('should show an error state if file key decryption fails', async () => {
    vi.mocked(cryptoUtils.decryptMessage).mockRejectedValue(new Error('Key Decryption Failed'));
    render(<VoiceMessagePlayer message={mockMessage} />);
    
    expect(await screen.findByText(/Key Decryption Failed/i)).toBeInTheDocument();
  });
  
  it('should revoke the object URL on unmount', async () => {
    const { unmount } = render(<VoiceMessagePlayer message={mockMessage} />);
    await screen.findByRole('button', { name: /play voice message/i }); // Wait for decryption
    
    unmount();
    
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-audio-url');
  });
});
