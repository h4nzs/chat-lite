import { useEffect, useState, useRef, useCallback, memo, useMemo } from "react"
import { useChatStore } from "@store/chat"
import { useAuthStore } from "@store/auth"
import { getSocket } from "@lib/socket"
import toast from "react-hot-toast"
import { VariableSizeList as List, ListChildComponentProps } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"
import MessageItem from "./MessageItem"
import { useScrollToBottom } from "@hooks/useScrollToBottom"

type ItemData = {
  messages: any[]
  conversationId: string
  setSize: (index: number, size: number) => void
  meId?: string | null
  formatTimestamp: (ts: string) => string
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>
}

function ChatWindow({ id }: { id: string }) {
  const [text, setText] = useState("")
  const [loadingOlder, setLoadingOlder] = useState(false)

  const meId = useAuthStore((s) => s.user?.id)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const uploadFile = useChatStore((s) => s.uploadFile)
  const messages = useChatStore((s) => s.messages[id] || [])
  const openConversation = useChatStore((s) => s.openConversation)
  const loadOlderMessages = useChatStore((s) => s.loadOlderMessages)
  const typingUsers = useChatStore((s) => s.typing[id] || [])
  const loadingMessages = useChatStore((s) => s.loading?.[id] ?? false)
  const deleteMessage = useChatStore((s) => s.deleteMessage)

  // Debug: log messages to see if data is loaded
  useEffect(() => {
    console.log(`Messages for conversation ${id}:`, messages)
  }, [id, messages])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<List>(null)
  const { scrollToBottom } = useScrollToBottom(listRef)
  const sizeMap = useRef<{ [key: number]: number }>({})

  useEffect(() => {
    openConversation(id)
  }, [id, openConversation])

  useEffect(() => {
    if (messages.length > 0) scrollToBottom()
  }, [messages.length, id, scrollToBottom])

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Reset size map when component unmounts
      sizeMap.current = {}
    }
  }, [])

  const getSize = useCallback((index: number) => sizeMap.current[index] || 80, [])

  const setSize = useCallback((index: number, size: number) => {
    sizeMap.current = { ...sizeMap.current, [index]: size }
    listRef.current?.resetAfterIndex(index)
  }, [])

  const handleScroll = useCallback(
    ({ scrollOffset }: { scrollOffset: number }) => {
      if (loadingOlder) return
      if (scrollOffset < 50) {
        setLoadingOlder(true)
        loadOlderMessages(id).finally(() => setLoadingOlder(false))
      }
    },
    [id, loadingOlder, loadOlderMessages]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const content = text.trim()
      if (!content) return

      const tempId = Date.now()
      useChatStore.getState().addOptimisticMessage(id, {
        id: "",
        tempId,
        conversationId: id,
        senderId: meId || "me",
        content,
        createdAt: new Date().toISOString(),
      })

      setText("")
      const socket = getSocket()
      try {
        socket.emit("typing", { conversationId: id, isTyping: false })
      } catch (err) {
        // ignore socket errors
      }

      try {
        await sendMessage(id, content, tempId)
        // scroll to new bottom
        listRef.current?.scrollToItem(messages.length, "end")
      } catch {
        toast.error("Pesan gagal dikirim")
        useChatStore.getState().markMessageError(id, tempId)
      }
    },
    [id, text, sendMessage, messages.length, meId]
  )

  const formatTimestamp = useCallback((ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  , [])

  // Prepare itemData --- ensure MessageItem ALWAYS receives formatTimestamp & deleteMessage
  const itemData: ItemData = useMemo(() => ({
    messages,
    conversationId: id,
    setSize,
    meId,
    formatTimestamp,
    deleteMessage,
  }), [messages, id, setSize, meId, formatTimestamp, deleteMessage])

  // Row component for react-window
  const Row = memo(({ index, style, data }: ListChildComponentProps<ItemData>) => {
    return <MessageItem index={index} style={style} data={data} />
  }, (prevProps, nextProps) => {
    // Optimasi memoization untuk Row component
    return (
      prevProps.index === nextProps.index &&
      prevProps.style === nextProps.style &&
      prevProps.data.conversationId === nextProps.data.conversationId
    )
  })

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50 dark:bg-gray-900">
      {/* Area pesan */}
      <div className="flex-1 flex flex-col min-h-0">
        {loadingOlder && (
          <div className="text-center text-gray-400 text-sm py-2">
            Loading older messages...
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
                    i % 2 === 0 ? "bg-gray-300 dark:bg-gray-700" : "bg-blue-300 dark:bg-blue-700"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            No messages yet. Start the conversation!
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
                itemData={itemData}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        )}
      </div>

      {/* Footer / input */}
      <div className="shrink-0 border-t bg-white dark:bg-gray-800 shadow-lg p-3">
        {typingUsers.length > 0 && (
          <div className="px-3 py-1 text-sm text-gray-500 border-b">
            {typingUsers.length === 1 ? "Someone is typing..." : `${typingUsers.length} people are typing...`}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-center mt-2">
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
                  await uploadFile(id, e.target.files[0])
                  scrollToBottom()
                } catch {
                  toast.error("Upload gagal")
                }
                e.target.value = ""
              }
            }}
          />

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className={`px-6 py-3 rounded-full font-semibold shadow transition ${
              text.trim() 
                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90" 
                : "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
            }`}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

export default memo(ChatWindow, (prevProps, nextProps) => {
  return prevProps.id === nextProps.id
})
