import { useEffect, useState, useRef, useCallback } from "react"
import { useChatStore } from "@store/chat"
import { useAuthStore } from "@store/auth"
import { getSocket } from "@lib/socket"
import toast from "react-hot-toast"
import { VariableSizeList as List } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"
import MessageItem from "./MessageItem"

export default function ChatWindow({ id }: { id: string }) {
  const [text, setText] = useState("")
  const [loadingOlder, setLoadingOlder] = useState(false)

  const meId = useAuthStore((s) => s.user?.id)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const uploadFile = useChatStore((s) => (s as any).uploadFile)
  const messages = useChatStore((s) => s.messages[id] || [])
  const openConversation = useChatStore((s) => s.openConversation)
  const loadOlderMessages = useChatStore((s) => s.loadOlderMessages)
  const typingUsers = useChatStore((s) => s.typing[id] || [])
  const loadingMessages = useChatStore((s) => (s as any).loading?.[id] ?? false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<List | null>(null)
  const sizeMap = useRef<{ [key: number]: number }>({})
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    openConversation(id)
  }, [id, openConversation])

  // autoscroll to bottom when messages change (only if at bottom)
  useEffect(() => {
    if (messages.length === 0) return
    if (atBottom) {
      listRef.current?.scrollToItem(messages.length - 1, "end")
    }
  }, [messages.length, atBottom])

  const getSize = (index: number) => sizeMap.current[index] || 80
  const setSize = (index: number, size: number) => {
    if (sizeMap.current[index] !== size) {
      sizeMap.current = { ...sizeMap.current, [index]: size }
      listRef.current?.resetAfterIndex(index)
    }
  }

  // handle list scroll (detect near-top for loading more and atBottom state)
  const handleScroll = useCallback(
    ({ scrollDirection, scrollOffset, scrollUpdateWasRequested, clientHeight, scrollHeight }: any) => {
      // near top?
      if (scrollOffset < 80 && !loadingOlder) {
        setLoadingOlder(true)
        loadOlderMessages(id).finally(() => setLoadingOlder(false))
      }
      // at bottom?
      const nearBottom = scrollHeight - (scrollOffset + clientHeight) < 120
      setAtBottom(nearBottom)
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
      socket.emit("typing", { conversationId: id, isTyping: false })

      try {
        await sendMessage(id, content, tempId)
        // ensure scroll to bottom after send
        listRef.current?.scrollToItem(messages.length, "end")
      } catch {
        toast.error("Pesan gagal dikirim")
        useChatStore.getState().markMessageError(id, tempId)
      }
    },
    [id, text, sendMessage, messages.length, meId]
  )

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const isImageFile = (fileUrl: string | null | undefined) => {
    if (!fileUrl) return false
    return /\.(png|jpe?g|gif|webp)$/i.test(fileUrl)
  }

  const deleteMessage = async (conversationId: string, messageId: string) => {
    try {
      await fetch(`/api/conversations/${conversationId}/messages/${messageId}`, {
        method: "DELETE",
        credentials: "include",
      })
    } catch {
      toast.error("Gagal menghapus pesan")
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message area (flex-1) */}
      <div className="flex-1 min-h-0">
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
          // AutoSizer + VariableSizeList
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
                  formatTimestamp,
                  isImageFile,
                  deleteMessage,
                  setSize,
                  meId,
                }}
              >
                {MessageItem}
              </List>
            )}
          </AutoSizer>
        )}
      </div>

      {/* Footer / input area (sticky at bottom) */}
      <div className="shrink-0 border-t bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
        {typingUsers.length > 0 && (
          <div className="px-3 py-1 text-sm text-gray-500 border-b">
            {typingUsers.length === 1
              ? "Someone is typing..."
              : `${typingUsers.length} people are typing...`}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-3 flex gap-2 items-center">
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
                  listRef.current?.scrollToItem(messages.length, "end")
                } catch {
                  toast.error("Upload gagal")
                }
                e.target.value = ""
              }
            }}
          />

          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              const socket = getSocket()
              socket.emit("typing", { conversationId: id, isTyping: true })
              clearTimeout((window as any).typingTimer)
              ;(window as any).typingTimer = setTimeout(() => {
                socket.emit("typing", { conversationId: id, isTyping: false })
              }, 1000)
            }}
            placeholder="Type a message"
            className="flex-1 p-2 rounded-full border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none"
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
  )
}
