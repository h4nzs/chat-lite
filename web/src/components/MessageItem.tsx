import { memo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Message } from "@store/chat";
import { useAuthStore } from "@store/auth";
import LazyImage from "./LazyImage";
import ReactionPopover from "./Reactions";
import { sanitizeText } from "@utils/sanitize";
import { api } from "@lib/api";

const FileAttachment = ({ url, fileName, fileSize }: { url: string; fileName?: string | null; fileSize?: number }) => {
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-all max-w-xs shadow-inner">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-white">{fileName || 'Download File'}</p>
        {fileSize && <p className="text-xs text-gray-300">{formatBytes(fileSize)}</p>}
      </div>
    </a>
  );
};

type MessageItemProps = {
  index: number;
  style?: CSSProperties;
  data: {
    messages: Message[];
    setSize: (index: number, size: number) => void;
  };
};

function MessageItemComponent({ index, style, data }: MessageItemProps) {
  const { messages, setSize } = data;
  const meId = useAuthStore((s) => s.user?.id);
  const itemRef = useRef<HTMLDivElement>(null);

  const m = messages[index];
  if (!m) return null;

  const mine = m.senderId === meId;
  const fullUrl = m.fileUrl && !m.fileUrl.startsWith('http') 
    ? `${import.meta.env.VITE_API_URL || "http://localhost:4000"}${m.fileUrl}` 
    : m.fileUrl;

  useEffect(() => {
    if (itemRef.current) {
      setSize(index, itemRef.current.offsetHeight);
    }
  }, [index, m?.content, m?.fileUrl, setSize]);

  const hasContent = m.content && m.content.trim().length > 0;
  const isImage = m.fileType?.startsWith('image/');
  const hasFile = !!fullUrl;
  const isDeleted = m.content === "[This message was deleted]";

  // FIX: Pastikan fungsi ini ada dan dipanggil dengan benar
  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      api(`/api/messages/${m.id}`, { method: 'DELETE' }).catch(err => {
        console.error("Failed to delete message:", err);
      });
    }
  }

  const groupedReactions = m.reactions?.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={style}>
      <div ref={itemRef} className="px-4 py-2 group">
        {isDeleted ? (
          <div className={`flex w-full ${mine ? 'justify-end' : 'justify-start'}`}>
            <p className="text-xs italic text-gray-500">This message was deleted</p>
          </div>
        ) : (
          <div className={`relative flex items-center gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
            <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div
                className={`flex flex-col max-w-xs md:max-w-md rounded-2xl shadow-md ${
                  isImage && !hasContent ? '' : 'p-2 ' + (mine 
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                    : 'bg-gray-700 text-white')
                }`}
              >
                {hasContent && (
                  <p className="whitespace-pre-wrap break-words px-2 pb-1">{sanitizeText(m.content)}</p>
                )}
                {hasFile && (
                  isImage ? (
                    <LazyImage 
                      src={fullUrl!} 
                      alt={m.fileName || "uploaded image"} 
                      className="rounded-xl max-w-[250px] object-cover cursor-pointer" 
                      onClick={() => window.open(fullUrl, "_blank")} 
                    />
                  ) : (
                    <FileAttachment url={fullUrl!} fileName={m.fileName} fileSize={m.fileSize} />
                  )
                )}
              </div>
              {groupedReactions && Object.keys(groupedReactions).length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {Object.entries(groupedReactions).map(([emoji, count]) => (
                    <span key={emoji} className="px-2 py-0.5 rounded-full bg-gray-700/80 text-white text-xs cursor-default">
                      {emoji} {count > 1 ? count : ''}
                    </span>
                  ))}
                </div>
              )}
              <div className={`text-xs text-gray-400 mt-1 px-2 ${mine ? 'text-right' : 'text-left'}`}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {m.error && <span className="text-red-500 ml-2">Failed</span>}
                {m.optimistic && <span className="text-gray-500 ml-2">Sending...</span>}
              </div>
            </div>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="p-1.5 rounded-full hover:bg-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 12a2 2 0 110-4 2 2 0 010 4zm0-6a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content sideOffset={5} align="center" className="min-w-[150px] bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 p-1">
                    <ReactionPopover message={m}>
                      <div className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded cursor-pointer outline-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a.75.75 0 01.028.022l.028.027a.75.75 0 01.027.028l.027.028a.75.75 0 01.022.028l.022.028a.75.75 0 01.016.023l.016.023a.75.75 0 01.01.016l.01.016c.004.005.007.01.01.015l.004.005a.75.75 0 01.005.004l.005.004a.75.75 0 01.002.002l.002.002a.75.75 0 010 .004c0 .001 0 .002 0 .002a.75.75 0 01-.004 0l-.002-.002a.75.75 0 01-.005-.004l-.005-.004a.75.75 0 01-.01-.015l-.01-.016a.75.75 0 01-.016-.023l-.016-.023a.75.75 0 01-.022-.028l-.022-.028a.75.75 0 01-.027-.028l-.027-.028a.75.75 0 01-.028-.022l-.028-.027a.75.75 0 01-.022-.028l-.022-.028a.75.75 0 01-.016-.023l-.016-.023a.75.75 0 01-.01-.016l-.01-.016a.75.75 0 01-.005-.004l-.005-.004a.75.75 0 01-.002-.002l-.002-.002a.75.75 0 010-.004c.09.34.26.65.49.93a.75.75 0 01-1.06 1.06 5.25 5.25 0 00-1.5 3.75.75.75 0 01-1.5 0 6.75 6.75 0 011.94-4.71.75.75 0 011.06-1.06z" clipRule="evenodd" /></svg>
                        React
                      </div>
                    </ReactionPopover>
                    {mine && (
                      <DropdownMenu.Item onClick={handleDelete} className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white rounded cursor-pointer outline-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                        Delete Message
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageItemComponent);
