import { memo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Message } from "@store/chat";
import LazyImage from "./LazyImage";
import { sanitizeText } from "@utils/sanitize";

// --- Sub-komponen untuk Bubble Teks ---
const TextBubble = ({ content }: { content: string }) => (
  <div className="px-4 py-2 rounded-2xl break-words bg-gray-200 dark:bg-gray-700">
    <p className="whitespace-pre-wrap break-words">{sanitizeText(content)}</p>
  </div>
);

// --- Sub-komponen untuk Bubble File ---
const FileBubble = ({ url, fileName, fileType, fileSize }: { url: string; fileName?: string | null; fileType?: string; fileSize?: number }) => {
  const isImage = fileType?.startsWith('image/');
  const isVideo = fileType?.startsWith('video/');
  const isAudio = fileType?.startsWith('audio/');

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (isImage) {
    return <LazyImage src={url} alt={fileName || "uploaded image"} className="max-w-[250px] max-h-[250px] rounded-lg shadow-md object-cover cursor-pointer" onClick={() => window.open(url, "_blank")} />;
  }

  if (isVideo) {
    return <video src={url} controls className="max-w-[300px] rounded-lg shadow-md" />;
  }

  if (isAudio) {
    return <audio src={url} controls className="w-full max-w-xs" />;
  }

  // Fallback untuk dokumen dan file lainnya
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition-all max-w-xs shadow">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500 dark:text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-gray-800 dark:text-gray-200">{fileName || 'Download File'}</p>
        {fileSize && <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(fileSize)}</p>}
      </div>
    </a>
  );
};


// --- Komponen Utama (Dispatcher) ---
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
  const fullUrl = m.fileUrl && !m.fileUrl.startsWith('http') 
    ? `${import.meta.env.VITE_API_URL || "http://localhost:4000"}${m.fileUrl}` 
    : m.fileUrl;

  useEffect(() => {
    if (itemRef.current) {
      setSize(index, itemRef.current.offsetHeight);
    }
  }, [index, m?.content, m?.fileUrl, setSize]);

  const hasContent = m.content && m.content.trim().length > 0;
  const hasFile = !!fullUrl;

  return (
    <div style={style} className="w-full px-4 py-1">
      <div ref={itemRef} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
        <div className={`flex flex-col gap-2 ${mine ? "items-end" : "items-start"}`}>
          {/* Render bubble berdasarkan konten */}
          {hasFile && (
            <div className={`p-2 rounded-2xl ${mine ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white" : "bg-gray-700 text-gray-100"}`}>
              {hasContent && <p className="px-2 pb-2 text-sm">{sanitizeText(m.content)}</p>}
              <FileBubble url={fullUrl!} fileName={m.fileName} fileType={m.fileType} fileSize={m.fileSize} />
            </div>
          )}
          {!hasFile && hasContent && (
            <div className={`px-4 py-2 rounded-2xl break-words shadow-md ${mine ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white" : "bg-gray-200 dark:bg-gray-700"}`}>
                <p className="whitespace-pre-wrap break-words">{sanitizeText(m.content!)}</p>
            </div>
          )}
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