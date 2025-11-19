import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LazyImage from './LazyImage'; // Corrected: default import
import type { Message } from '@store/conversation'; // Corrected: path to type
import * as cryptoUtils from '@utils/crypto';

// --- Mocks ---
vi.mock('@utils/crypto');

// Mock global APIs
global.URL.createObjectURL = vi.fn(() => 'blob:mock-image-url');
global.URL.revokeObjectURL = vi.fn();
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the Image constructor for onload/onerror simulation
const mockImage = {
  onload: () => {},
  onerror: () => {},
  src: '',
};
vi.stubGlobal('Image', vi.fn(() => mockImage));


describe('LazyImage Component', () => {
  const mockMessage: Message = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: '',
    fileKey: 'encrypted-image-key-long-enough-to-be-decrypted',
    fileUrl: '/uploads/image.jpg',
    fileName: 'image.jpg',
    fileType: 'image/jpeg;encrypted=true',
    sessionId: 'session-123',
    createdAt: new Date().toISOString(),
    optimistic: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful fetch
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['image data'])),
    });
    // Default successful decryption
    vi.mocked(cryptoUtils.decryptMessage).mockResolvedValue('decrypted-file-key');
    vi.mocked(cryptoUtils.decryptFile).mockResolvedValue(new Blob(['image data']));
  });
  
  it('should show a loading spinner initially', () => {
    render(<LazyImage message={mockMessage} alt="test" />);
    // The component uses a div with role="status" for loading states
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render the image after successful decryption and loading', async () => {
    render(<LazyImage message={mockMessage} alt="test" />);

    // Wait for the image element to appear and have the correct src
    const img = await screen.findByRole('img');
    
    // Simulate the image loading successfully
    mockImage.onload();

    await waitFor(() => {
      expect(img).toHaveAttribute('src', 'blob:mock-image-url');
      expect(img).not.toHaveClass('opacity-0');
    });
  });

  it('should call decryption functions for an encrypted message', async () => {
    render(<LazyImage message={mockMessage} alt="test" />);
    await screen.findByRole('img'); // Wait for process to complete

    expect(cryptoUtils.decryptMessage).toHaveBeenCalledWith(mockMessage.fileKey, mockMessage.conversationId, mockMessage.sessionId);
    expect(cryptoUtils.decryptFile).toHaveBeenCalledWith(expect.any(Blob), 'decrypted-file-key', 'image/jpeg');
  });

  it('should NOT call decryption for an optimistic message', async () => {
    const optimisticMessage = { ...mockMessage, optimistic: true, fileKey: 'raw-key' };
    render(<LazyImage message={optimisticMessage} alt="test" />);
    await screen.findByRole('img');

    expect(cryptoUtils.decryptMessage).not.toHaveBeenCalled();
    // decryptFile is still called, but with the raw key
    expect(cryptoUtils.decryptFile).toHaveBeenCalledWith(expect.any(Blob), 'raw-key', 'image/jpeg');
  });

  it('should NOT call decryption for a non-encrypted file type', async () => {
    const plainMessage = { ...mockMessage, fileType: 'image/jpeg' };
    render(<LazyImage message={plainMessage} alt="test" />);
    await screen.findByRole('img');

    expect(cryptoUtils.decryptMessage).not.toHaveBeenCalled();
    expect(cryptoUtils.decryptFile).not.toHaveBeenCalled();
    // The final src should be the absolute URL
    await waitFor(() => {
       expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('/uploads/image.jpg'));
    });
  });

  it('should display an error if file key decryption fails', async () => {
    vi.mocked(cryptoUtils.decryptMessage).mockRejectedValue(new Error('Key decryption failed'));
    render(<LazyImage message={mockMessage} alt="test" />);

    expect(await screen.findByText(/Key decryption failed/)).toBeInTheDocument();
  });

  it('should display an error if file fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    render(<LazyImage message={mockMessage} alt="test" />);
    
    expect(await screen.findByText(/File not found on server/i)).toBeInTheDocument();
  });

  it('should revoke object URL on unmount', async () => {
    const { unmount } = render(<LazyImage message={mockMessage} alt="test" />);
    await screen.findByRole('img'); // Wait for decryption to finish

    unmount();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-image-url');
  });
});
