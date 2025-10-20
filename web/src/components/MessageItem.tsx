import { memo, useEffect, useRef } from "react";
import ErrorBoundary from "./ErrorBoundary";
import type { CSSProperties } from "react";
import type { Message } from "@store/chat";
import LazyImage from "./LazyImage";
import Reactions from "./Reactions";
import { getSocket } from "@lib/socket";
import { isImageFile, isVideoFile, isAudioFile } from "@lib/fileUtils";

// Simple function to sanitize HTML content to prevent XSS
function sanitizeHtml(content: string): string {
  if (!content) return '';
  
  // Remove potentially dangerous tags and attributes
  let sanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
  
  return sanitized;
}

type ItemData = {
  messages: Message[];
  conversationId: string;
  setSize: (index: number, size: number) => void;
  meId?: string | null;
  formatTimestamp: (ts: string) => string;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
};

interface MessageItemProps {
  index: number;
  style: CSSProperties;
  data: ItemData;
}

const areEqual = (prev: MessageItemProps, next: MessageItemProps) =>
  prev.index === next.index &&
  prev.data.conversationId === next.data.conversationId &&
  prev.data.messages[prev.index]?.id ===
    next.data.messages[next.index]?.id &&
  prev.data.messages[prev.index]?.content ===
    next.data.messages[next.index]?.content;

function MessageItemComponent({ index, style, data }: MessageItemProps) {
  const { messages, setSize, formatTimestamp, deleteMessage, conversationId, meId } =
    data;
  const itemRef = useRef<HTMLDivElement>(null);

  const m = messages[index];
  if (!m) return null;

  const mine = m.senderId === meId;
  const prev = index > 0 ? messages[index - 1] : null;
  const showName = !mine && prev?.senderId !== m.senderId && !m.imageUrl;

  useEffect(() => {
    if (itemRef.current) {
      requestAnimationFrame(() => {
        if (itemRef.current) setSize(index, itemRef.current.offsetHeight);
      });
    }
  }, [index, setSize, m.content, m.imageUrl, m.fileUrl, m.reactions]);

  const socket = getSocket();

  const handleAddReaction = (emoji: string) => {
    socket.emit("message:react", { messageId: m.id, conversationId, emoji });
  };
  const handleRemoveReaction = (emoji: string) => {
    socket.emit("message:unreact", { messageId: m.id, conversationId, emoji });
  };

  const fileUrl = m.imageUrl || m.fileUrl || "";
  const fullUrl =
    fileUrl && fileUrl.startsWith("http")
      ? fileUrl
      : `${import.meta.env.VITE_API_URL || "http://localhost:4000"}${fileUrl}`;

  // === Error decrypt / deleted message styling ===
  const renderContent = () => {
    if (m.content?.startsWith("Decryption Error")) {
      return (
        <div
          className={`italic text-sm px-3 py-2 rounded-2xl max-w-[70%] ${
            mine ? "bg-blue-500 text-white" : "bg-gray-600 text-red-200"
          }`}
        >
          🔒 Message could not be decrypted
        </div>
      );
    }
    if (m.content === "[deleted]") {
      return (
        <div className="italic text-xs text-gray-400 px-3 py-1">
          This message was deleted
        </div>
      );
    }
    if (!m.content) {
      return null;
    }
    return (
      <div
        className={`px-3 py-2 rounded-2xl break-words max-w-[70%] shadow ${
          mine
            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
            : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        }`}
      >
        <p>{m.content}</p>
      </div>
    );
  };

  return (
    <div style={style} className="px-4 py-1">
      <div ref={itemRef} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="flex flex-col max-w-full">
          {showName && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-2">
              Participant
            </div>
          )}

          {/* Bubble */}
          {renderContent()}

          {/* Media attachments */}
          {fileUrl && isImageFile(fileUrl) && (
            <LazyImage
              src={fullUrl}
              alt={m.fileName || "uploaded"}
              className="mt-2 max-w-[220px] max-h-[200px] rounded-md shadow-sm object-contain cursor-pointer hover:opacity-90"
              onClick={() => window.open(fullUrl, "_blank")}
            />
          )}
          {fileUrl && isVideoFile(fileUrl) && (
            <video
              src={fullUrl}
              controls
              className="mt-2 max-w-[240px] max-h-[200px] rounded-md shadow-sm bg-black"
            />
          )}
          {fileUrl && isAudioFile(fileUrl) && (
            <audio src={fullUrl} controls className="mt-2 w-[220px]" />
          )}
          {fileUrl &&
            !isImageFile(fileUrl) &&
            !isVideoFile(fileUrl) &&
            !isAudioFile(fileUrl) && (
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm underline mt-2 hover:opacity-80"
              >
                📎 {m.fileName || "Download file"}
              </a>
            )}

          {/* Reactions */}
          {m.reactions && m.reactions.length > 0 && (
            <Reactions
              message={m}
              onAddReaction={handleAddReaction}
              onRemoveReaction={handleRemoveReaction}
            />
          )}

          {/* Error sending */}
          {m.error && <p className="text-xs text-red-500 mt-1">Failed to send</p>}

          {/* Timestamp */}
          <ErrorBoundary
            fallback={
              <div className="text-xs text-gray-500 mt-1 text-right">
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            }
          >
            <div
              className={`text-xs text-gray-500 mt-1 ${
                mine ? "text-right" : "text-left"
              }`}
            >
              {formatTimestamp(m.createdAt)}
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default memo(MessageItemComponent, areEqual);
