import { memo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Message } from "@store/chat";
import LazyImage from "./LazyImage";
import { sanitizeText } from "@utils/sanitize";

// A simple component to render a generic file icon and link
const FileAttachment = ({ url, fileName }: { url: string; fileName?: string | null }) => (
  <a 
    href={url} 
    target="_blank" 
    rel="noopener noreferrer"
    className="flex items-center gap-3 p-3 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition max-w-xs"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{fileName || 'Download File'}</span>
  </a>
);

type MessageItemProps = {
  index: number;
  style?: CSSProperties;
  data: {
    messages: Message[];
    setSize: (index: number, size: number) => void;
    meId?: string | null;
  };
};

function MessageItemComponent({ index, style, data }: MessageItemProps) {
  const { messages, setSize, meId } = data;
  const itemRef = useRef<HTMLDivElement>(null);

  const m = messages[index];
  if (!m) return null;

  const mine = m.senderId === meId;

  useEffect(() => {
    if (itemRef.current) {
      setSize(index, itemRef.current.offsetHeight);
    }
  }, [index, m?.content, m?.fileUrl, setSize]);

  const fullUrl = m.fileUrl && !m.fileUrl.startsWith('http') 
    ? `${import.meta.env.VITE_API_URL || "http://localhost:4000"}${m.fileUrl}` 
    : m.fileUrl;

  const renderAttachment = () => {
    if (!fullUrl) return null;

    if (m.fileType?.startsWith('image/')) {
      return <LazyImage src={fullUrl} alt={m.fileName || "uploaded image"} className="mt-2 max-w-[250px] max-h-[250px] rounded-md shadow-sm object-contain cursor-pointer" onClick={() => window.open(fullUrl, "_blank")} />;
    }
    if (m.fileType?.startsWith('video/')) {
      return <video src={fullUrl} controls className="mt-2 max-w-[300px] rounded-md shadow-sm" />;
    }
    if (m.fileType?.startsWith('audio/')) {
      return <audio src={fullUrl} controls className="mt-2 w-full max-w-xs" />;
    }
    // Fallback for documents and other file types
    return <FileAttachment url={fullUrl} fileName={m.fileName} />;
  };

  const renderContent = () => {
    if (m.content === null || m.content === undefined || m.content.trim() === '') {
      return null; // Don't render a bubble for file-only messages with no text content
    }
    return (
      <div className={`px-4 py-2 rounded-2xl break-words whitespace-pre-wrap max-w-[70%] shadow ${mine ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
        <p>{sanitizeText(m.content)}</p>
      </div>
    );
  };

  return (
    <div style={style} className="w-full px-4 py-1">
      <div ref={itemRef} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
        <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
          {renderContent()}
          {renderAttachment()}
        </div>
        <div className={`text-xs text-gray-400 mt-1 px-2 ${mine ? "text-right" : "text-left"}`}>
          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {m.error && <span className="text-red-500 ml-2">Failed</span>}
          {m.optimistic && <span className="text-gray-500 ml-2">Sending...</span>}
        </div>
      </div>
    </div>
  );
}

export default memo(MessageItemComponent);
