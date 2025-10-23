import { useEffect, useState, useRef, useCallback, ChangeEvent } from "react";
import { useChatStore } from "@store/chat";
import { useAuthStore } from "@store/auth";
import { getSocket } from "@lib/socket";
import toast from "react-hot-toast";
import { VariableSizeList as List, ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import MessageItem from "@components/MessageItem";
import { useScrollToBottom } from "@hooks/useScrollToBottom";

export default function ChatWindow({ id }: { id: string | null }) {
  const [text, setText] = useState("");
  const meId = useAuthStore((s) => s.user?.id);
  const { 
    messages: allMessages, 
    sendMessage, 
    uploadFile, 
    addOptimisticMessage, 
    markMessageError 
  } = useChatStore();

  const messages = id ? allMessages[id] || [] : [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);

  const { scrollToBottom } = useScrollToBottom(listRef);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, id, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !text.trim()) return;

    const tempId = Date.now();
    addOptimisticMessage(id, {
      senderId: meId || "",
      content: text,
    } as any);

    setText("");
    scrollToBottom();

    try {
      await sendMessage(id, { content: text }, tempId);
    } catch {
      markMessageError(id, tempId);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && id) {
      const file = e.target.files[0];
      uploadFile(id, file);
    }
    // Reset file input to allow uploading the same file again
    if(fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sizeMap = useRef<Record<number, number>>({});
  const getSize = (index: number) => sizeMap.current[index] || 80;
  const setSize = (index: number, size: number) => {
    sizeMap.current = { ...sizeMap.current, [index]: size };
    listRef.current?.resetAfterIndex(index);
  };

  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => (
      <MessageItem
        index={index}
        style={style}
        data={{
          messages,
          meId,
          setSize,
        }}
      />
    ), [messages, meId]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden">
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              height={height}
              itemCount={messages.length}
              itemSize={getSize}
              width={width}
              itemData={{ messages, meId, setSize }}
            >
              {Row}
            </List>
          )}
        </AutoSizer>
      </div>

      <div className="shrink-0 border-t bg-white dark:bg-gray-800 shadow-inner p-3">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            aria-label="Upload file"
          >
            📎
          </button>
          <input 
            ref={fileInputRef} 
            type="file" 
            className="hidden" 
            onChange={handleFileChange} 
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,video/mp4,video/quicktime,video/x-msvideo,audio/mpeg,audio/wav,application/zip,application/x-rar-compressed"
          />

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
            className="flex-1 min-w-0 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none"
          />

          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold shadow hover:opacity-90 transition"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}