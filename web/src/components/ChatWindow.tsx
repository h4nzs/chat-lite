import { useEffect, useState, useRef, useCallback } from "react";
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
  const [loadingOlder, setLoadingOlder] = useState(false);

  const meId = useAuthStore((s) => s.user?.id);
  const conversations = useChatStore((s) => s.conversations);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const uploadFile = useChatStore((s) => (s as any).uploadFile);
  const messages = useChatStore((s) => (id ? s.messages[id] || [] : []));
  const openConversation = useChatStore((s) => s.openConversation);
  const loadOlderMessages = useChatStore((s) => s.loadOlderMessages);
  const typingUsers = useChatStore((s) => (id ? s.typing[id] || [] : []));
  const loadingMessages = useChatStore((s) => (id ? (s as any).loading?.[id] ?? false : false));
  const deleteMessage = useChatStore((s) => (s as any).deleteMessage);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { scrollToBottom } =
    useScrollToBottom?.(listRef) ?? {
      scrollToBottom: () =>
        listRef.current?.scrollToItem(messages.length - 1, "end"),
    };
  const sizeMap = useRef<{ [key: number]: number }>({});

  // Fallback: pilih percakapan pertama kalau id null
  useEffect(() => {
    if (!id && conversations.length > 0) {
      const firstId = conversations[0].id;
      useChatStore.setState({ activeId: firstId });
      openConversation(firstId);
    } else if (id) {
      openConversation(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversations]);

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
      if (!id || loadingOlder) return;
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
      if (!id) return;

      const content = text.trim();
      if (!content) return;

      const tempId = Date.now();
      // Tambah optimistic message ke store (dengan tempId)
      useChatStore.getState().addOptimisticMessage(id, {
        id: "",
        tempId,
        conversationId: id,
        senderId: meId || "me",
        content,
        createdAt: new Date().toISOString(),
      });

      // langsung scroll ke bawah supaya pesan optimistik kelihatan segera
      scrollToBottom();

      setText("");

      // Clear typing timeout & emit false
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      const socket = getSocket();
      socket.emit("typing", { conversationId: id, isTyping: false });

      try {
        await sendMessage(id, content, tempId);
        // sendMessage logic di store akan mengganti optimistic message dengan ack
      } catch {
        toast.error("Pesan gagal dikirim");
        useChatStore.getState().markMessageError(id, tempId);
      }
    },
    [id, text, sendMessage, messages.length, meId, scrollToBottom]
  );

  // Handle typing indicator
  useEffect(() => {
    if (!id) return;

    const socket = getSocket();

    const handleTypingChange = () => {
      socket.emit("typing", { conversationId: id, isTyping: true });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", { conversationId: id, isTyping: false });
      }, 1000);
    };

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        socket.emit("typing", { conversationId: id, isTyping: false });
      }
    };
  }, [id]);

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

  // Check encryption status
  const hasEncryptionKeys = !!(localStorage.getItem('publicKey') && localStorage.getItem('encryptedPrivateKey'));
  const encryptionStatusText = hasEncryptionKeys ? "Encrypted" : "Not encrypted";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Encryption status bar */}
      <div className={`px-4 py-2 text-sm flex items-center justify-between ${
        hasEncryptionKeys 
          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
      }`}>
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${hasEncryptionKeys ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span>End-to-end encryption: {encryptionStatusText}</span>
        </div>
        {!hasEncryptionKeys && (
          <a href="/settings" className="text-xs underline">
            Enable encryption
          </a>
        )}
      </div>
      
      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-hidden">
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
      <div className="shrink-0 border-t bg-white dark:bg-gray-800 shadow-inner p-3">
        {typingUsers.length > 0 && (
          <div className="px-3 py-1 text-sm text-gray-500 border-b">
            {typingUsers.length === 1
              ? "Someone is typing..."
              : `${typingUsers.length} people are typing...`}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            aria-label="Upload file"
          >
            📎
          </button>
          <input ref={fileInputRef} type="file" className="hidden" />

          <input
            ref={inputRef}
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
        <div className="shrink-0 border-t bg-red-500 p-3">
        DEBUG FOOTER
        </div>
      </div>
    </div>
  );
}
