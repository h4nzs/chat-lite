// chat-lite/web/src/components/MessageItem.tsx
import { memo, useEffect, useRef } from "react";
import ErrorBoundary from "./ErrorBoundary";
import type { CSSProperties } from "react";
import type { Message } from "@store/chat";
import LazyImage from "./LazyImage";
import Reactions from "./Reactions";
import { getSocket } from "@lib/socket";
import { isImageFile, isVideoFile, isAudioFile } from "@lib/fileUtils";
import { sanitizeText } from "@utils/sanitize";



type MessageItemProps = {
  index: number;
  style?: CSSProperties;
  data: {
    messages: Message[];
    setSize: (index: number, size: number) => void;
    formatTimestamp: (ts: string) => string;
    deleteMessage?: (id: string) => void;
    conversationId?: string;
    meId?: string | null;
  };
};

function areEqual(prev: any, next: any) {
  return (
    prev.index === next.index &&
    prev.data.conversationId === next.data.conversationId &&
    prev.data.messages[prev.index]?.id ===
      next.data.messages[next.index]?.id &&
    prev.data.messages[prev.index]?.content ===
      next.data.messages[next.index]?.content &&
    prev.data.messages[prev.index]?.imageUrl ===
      next.data.messages[next.index]?.imageUrl &&
    prev.data.messages[prev.index]?.fileUrl ===
      next.data.messages[next.index]?.fileUrl
  );
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, m?.content, m?.imageUrl, m?.fileUrl]);

  const fileUrl = (m as any).fileUrl || (m as any).imageUrl || null;
  const fullUrl =
    fileUrl && fileUrl.startsWith("http")
      ? fileUrl
      : `${import.meta.env.VITE_API_URL || "http://localhost:4000"}${fileUrl}`;

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
    if (m.content === null || m.content === undefined) {
      return null;
    }

    // Use whitespace-pre-wrap so normal words wrap, not letter-by-letter.
    return (
      <div
        className={`px-3 py-2 rounded-2xl break-words whitespace-pre-wrap max-w-[70%] shadow ${
          mine
            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
            : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        }`}
      >
        {/* Safely render content using textContent to prevent XSS */}
        <p>{sanitizeText(m.content)}</p>
        {m.error && <p className="text-xs text-red-500 mt-1">Failed to send</p>}
      </div>
    );
  };

  return (
    // IMPORTANT: keep style from react-window, but ensure the item uses full width of the row
    <div style={style} className="w-full px-4 py-1">
      <div
        ref={itemRef}
        className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}
      >
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
              className="mt-2 max-w-[240px] max-h-[200px] rounded-md shadow-sm object-contain"
            />
          )}

          {fileUrl && isAudioFile(fileUrl) && (
            <audio src={fullUrl} controls className="mt-2" />
          )}

          {/* Timestamp & reactions */}
          <div className={`flex items-center mt-1 ${mine ? "justify-end" : "justify-start"}`}>
            <div className="text-xs text-gray-400 mr-2">{formatTimestamp(m.createdAt)}</div>
            {m.reactions && m.reactions.length > 0 && (
              <Reactions
                message={m}
                conversationId={conversationId}
                onAddReaction={() => {}}
                onRemoveReaction={() => {}}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MessageItemComponent, areEqual);