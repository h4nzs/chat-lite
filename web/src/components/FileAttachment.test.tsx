import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FileAttachment from './FileAttachment'; // Corrected: default import
import type { Message } from '@store/conversation'; // Corrected: path to type
import * as cryptoUtils from '@utils/crypto';

// --- Mocks ---
vi.mock('@utils/crypto');
vi.mock('react-pdf', () => ({
  Document: ({ file, loading, children }: any) => <div data-testid="pdf-document" data-file={file}>{loading || children}</div>,
  Page: ({ pageNumber }: any) => <div data-testid="pdf-page" data-page-number={pageNumber} />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

global.URL.createObjectURL = vi.fn(() => 'blob:mock-file-url');
global.URL.revokeObjectURL = vi.fn();
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FileAttachment Component', () => {
  const mockMessage: Message = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: '',
    fileKey: 'encrypted-file-key-long-enough-to-be-decrypted',
    fileUrl: '/uploads/document.pdf',
    fileName: 'document.pdf',
    fileType: 'application/pdf;encrypted=true',
    sessionId: 'session-123',
    createdAt: new Date().toISOString(),
    optimistic: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['file-data'])),
    });
    vi.mocked(cryptoUtils.decryptMessage).mockResolvedValue('decrypted-file-key');
    vi.mocked(cryptoUtils.decryptFile).mockResolvedValue(new Blob(['file-data']));
  });
  
  it('should show a decrypting indicator initially', () => {
    render(<FileAttachment message={mockMessage} />);
    expect(screen.getByText(/Decrypting file/i)).toBeInTheDocument();
  });

  it('should render a PDF preview after successful decryption', async () => {
    render(<FileAttachment message={mockMessage} />);
    
    const pdfDoc = await screen.findByTestId('pdf-document');
    expect(pdfDoc).toBeInTheDocument();
    expect(pdfDoc).toHaveAttribute('data-file', 'blob:mock-file-url');
    expect(screen.getByTestId('pdf-page')).toBeInTheDocument();
  });

  it('should render a video player for video files', async () => {
    const videoMessage = { ...mockMessage, fileType: 'video/mp4;encrypted=true' };
    render(<FileAttachment message={videoMessage} />);
    
    const video = await screen.findByRole('video');
    expect(video).toBeInTheDocument();
    expect(video.querySelector('source')).toHaveAttribute('src', 'blob:mock-file-url');
  });

  it('should render a generic download link for other file types', async () => {
    const zipMessage = { ...mockMessage, fileType: 'application/zip;encrypted=true', fileName: 'archive.zip' };
    render(<FileAttachment message={zipMessage} />);
    
    const link = await screen.findByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'blob:mock-file-url');
    expect(link).toHaveAttribute('download', 'archive.zip');
    expect(screen.getByText('archive.zip')).toBeInTheDocument();
  });
  
  it('should show a "waiting for key" state if key decryption is pending', async () => {
    vi.mocked(cryptoUtils.decryptMessage).mockResolvedValue('[Requesting key to decrypt...]');
    render(<FileAttachment message={mockMessage} />);
    
    expect(await screen.findByText(/Requesting decryption key/i)).toBeInTheDocument();
  });

  it('should show an error state if decryption fails', async () => {
    vi.mocked(cryptoUtils.decryptFile).mockRejectedValue(new Error('Decryption Failed'));
    render(<FileAttachment message={mockMessage} />);
    
    expect(await screen.findByText(/Decryption Failed/i)).toBeInTheDocument();
  });

  it('should revoke object URL on unmount', async () => {
    const { unmount } = render(<FileAttachment message={mockMessage} />);
    await screen.findByTestId('pdf-document'); // Wait for decryption
    
    unmount();
    
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-file-url');
  });
});
