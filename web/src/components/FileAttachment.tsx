import type { Message } from "@store/chat";
import { toAbsoluteUrl } from "@utils/url";

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

interface FileAttachmentProps {
  message: Message;
}

export default function FileAttachment({ message }: FileAttachmentProps) {
  if (!message.fileUrl) return null;

  return (
    <a 
      href={toAbsoluteUrl(message.fileUrl)}
      target="_blank"
      rel="noopener noreferrer"
      download={message.fileName || 'download'}
      className="flex items-center gap-3 p-3 rounded-lg bg-black/20 hover:bg-black/30 transition-colors my-2"
    >
      <div className="flex-shrink-0 p-2 bg-gray-600 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-white truncate">{message.fileName || 'File'}</p>
        {message.fileSize && <p className="text-xs text-text-secondary">{formatBytes(message.fileSize)}</p>}
      </div>
      <div className="ml-auto p-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="m8 12 4 4 4-4"/></svg>
      </div>
    </a>
  );
}
