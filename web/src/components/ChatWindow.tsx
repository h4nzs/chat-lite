import { useEffect, useState, useRef, useCallback } from "react";
import { useChatStore } from "@store/chat";
import { useAuthStore } from "@store/auth";
import { getSocket } from "@lib/socket";
import toast from "react-hot-toast";
import { VariableSizeList as List, ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import MessageItem from "@components/MessageItem";
import { useScrollToBottom } from "@hooks/useScrollToBottom";

export default function ChatWindow({ id }: { id: string }) {
  const [text, setText] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);

  const meId = useAuthStore((s) => s.user?.id);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const uploadFile = useChatStore((s) => (s as any).uploadFile);
  const messages = useChatStore((s) => s.messages[id] || []);
  const openConversation = useChatStore((s) => s.openConversation);
  const loadOlderMessages = useChatStore((s) => s.loadOlderMessages);
  const typingUsers = useChatStore((s) => s.typing[id] || []);
  const loadingMessages = useChatStore((s) => (s as any).loading?.[id] ?? false);
  const deleteMessage = useChatStore((s) => (s as any).deleteMessage);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);
  const { scrollToBottom } =
    useScrollToBottom?.(listRef) ?? {
      scrollToBottom: () =>
        listRef.current?.scrollToItem(messages.length - 1, "end"),
    };
  const sizeMap = useRef<{ [key: number]: number }>({});

  useEffect(() => {
    if (id) openConversation(id);
  }, [id, openConversation]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, id, scrollToBottom]);

  const getSize = (index: number) => sizeMap.current[index] || 80;
  const setSize = (index: number, size: number) => {
    sizeMap.current = { ...sizeMap.current, [index]: size };
    listRef.current?.resetAfterIndex(index);
  };

  const handleScroll = useCallback(
    ({ scrollOffset }: { scrollOffset: number }) => {
      if (loadingOlder) return;
      if (scrollOffset < 50) {
        setLoadingOlder(true);
        loadOlderMessages(id).finally(() => setLoadingOlder(false));
      }
    },
    [id, loadingOlder, loadOlderMessages]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const content = text.trim();
      if (!content) return;

      const tempId = Date.now();
      useChatStore.getState().addOptimisticMessage(id, {
        id: "",
        tempId,
        conversationId: id,
        senderId: meId || "me",
        content,
        createdAt: new Date().toISOString(),
      });

      setText("");
      const socket = getSocket();
      socket.emit("typing", { conversationId: id, isTyping: false });

      try {
        await sendMessage(id, content, tempId);
        listRef.current?.scrollToItem(messages.length, "end");
      } catch {
        toast.error("Pesan gagal dikirim");
        useChatStore.getState().markMessageError(id, tempId);
      }
    },
    [id, text, sendMessage, messages.length, meId]
  );

  const formatTimestamp = (ts: string) =>
    new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const Row = useCallback(
    ({ index, style, data }: ListChildComponentProps) => (
      <MessageItem
        data={{
          ...data,
          formatTimestamp,
          deleteMessage,
        }}
        index={index}
        style={style}
      />
    ),
    [deleteMessage, formatTimestamp]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        {loadingOlder && (
          <div className="text-center text-gray-400 text-sm py-2">
            Loading older...
          </div>
        )}

        {loadingMessages ? (
          <div className="space-y-4 animate-pulse p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2 max-w-[70%] h-6 w-[60%] ${
                    i % 2 === 0
                      ? "bg-gray-300 dark:bg-gray-700"
                      : "bg-blue-300 dark:bg-blue-700"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : (
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                itemCount={messages.length}
                itemSize={getSize}
                width={width}
                onScroll={handleScroll}
                itemData={{
                  messages,
                  conversationId: id,
                  setSize,
                  meId,
                }}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        )}
      </div>

      {/* Footer input */}
      <div className="border-t bg-white dark:bg-gray-800 shadow-inner p-3">
        {typingUsers.length > 0 && (
          <div className="px-3 py-1 text-sm text-gray-500 border-b">
            {typingUsers.length === 1
              ? "Someone is typing..."
              : `${typingUsers.length} people are typing...`}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 items-center mt-2"
        >
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
            onChange={async (e) => {
              if (e.target.files?.[0]) {
                try {
                  await uploadFile(id, e.target.files[0]);
                  scrollToBottom();
                } catch {
                  toast.error("Upload gagal");
                }
                e.target.value = "";
              }
            }}
          />

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none"
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
