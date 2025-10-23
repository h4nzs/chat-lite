import { memo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Message } from "@store/chat";
import LazyImage from "./LazyImage";
import { sanitizeText } from "@utils/sanitize";

// --- Helper untuk File Bubble (non-gambar) ---
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
  const isImage = m.fileType?.startsWith('image/');
  const hasFile = !!fullUrl;

  return (
    // Kontainer dari react-window, HANYA berisi style posisi & dimensi.
    // Jangan tambahkan padding/margin di sini.
    <div style={style}>
      {/* Wrapper untuk spacing. Padding vertikal (py-2) di sini menciptakan jarak antar bubble. */}
      <div ref={itemRef} className="px-4 py-2">
        <div className={`flex w-full ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
            
            {/* Kontainer Bubble Pesan */}
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

            {/* Timestamp dan Status */}
            <div className={`text-xs text-gray-400 mt-1 px-2 ${mine ? "text-right" : "text-left"}`}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {m.error && <span className="text-red-500 ml-2">Failed</span>}
              {m.optimistic && <span className="text-gray-500 ml-2">Sending...</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MessageItemComponent);