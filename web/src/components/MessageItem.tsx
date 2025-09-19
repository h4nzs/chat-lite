import { useAuthStore } from '@store/auth'
import { useChatStore } from '@store/chat'
import toast from 'react-hot-toast'
import cls from 'classnames'
import type { Message } from '@store/chat'
import LazyImage from './LazyImage'
import Reactions from './Reactions'
import { getSocket } from '@lib/socket'
import { useEffect, useRef } from 'react'

interface MessageItemProps {
  data: {
    messages: Message[]
    conversationId: string
    formatTimestamp: (timestamp: string) => string
    isImageFile: (fileUrl: string | null | undefined) => boolean
    deleteMessage: (conversationId: string, messageId: string) => Promise<void>
    setSize: (index: number, size: number) => void
  }
  index: number
  style: React.CSSProperties
}

export default function MessageItem({ data, index, style }: MessageItemProps) {
  const { messages, conversationId, formatTimestamp, isImageFile, deleteMessage, setSize } = data
  const m = messages[index]
  const meId = useAuthStore(s => s.user?.id)
  const isMe = m.senderId === meId
  const ref = useRef<HTMLDivElement>(null)

  // ukur tinggi bubble dinamis
  useEffect(() => {
    if (ref.current) {
      const h = ref.current.getBoundingClientRect().height
      setSize(index, h + 20) // + spacing antar item
    }
  }, [m.content, m.fileUrl, m.imageUrl, m.error, m.reactions])

  const getFullUrl = (url: string) => {
    if (url.startsWith('http')) return url
    return `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${url}`
  }

  const socket = getSocket()

  const handleAddReaction = (emoji: string) => {
    socket.emit('message:react', { messageId: m.id, conversationId, emoji })
  }

  const handleRemoveReaction = (emoji: string) => {
    socket.emit('message:unreact', { messageId: m.id, conversationId, emoji })
  }

  return (
    <div style={{ ...style, left: (style.left as number) + 8 }} className="px-2 py-1">
  <div
    ref={ref}
    className={cls(
      "inline-block max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-md break-words whitespace-pre-wrap",
      isMe
        ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-br-none ml-auto"
        : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-bl-none mr-auto"
    )}
  >
        {/* TEXT */}
        {m.content && <p className="leading-relaxed">{m.content}</p>}

        {/* IMAGE PREVIEW */}
        {(m.imageUrl || (m.fileUrl && isImageFile(m.fileUrl))) && (
          <div className="mt-2 flex flex-col items-start">
            <LazyImage
              src={getFullUrl(m.imageUrl || m.fileUrl || '')}
              alt={m.fileName || 'uploaded'}
              className="max-w-[220px] max-h-[200px] rounded-md shadow-sm cursor-pointer hover:opacity-90 transition object-contain bg-white"
              onClick={() =>
                window.open(getFullUrl(m.imageUrl || m.fileUrl || ''), '_blank')
              }
            />
            <button
              className="mt-1 text-xs text-white/80 hover:text-white underline"
              onClick={() =>
                window.open(getFullUrl(m.imageUrl || m.fileUrl || ''), '_blank')
              }
            >
              Zoom
            </button>
          </div>
        )}

        {/* FILE ATTACHMENT */}
        {m.fileUrl && !m.imageUrl && !isImageFile(m.fileUrl) && (
          <a
            href={getFullUrl(m.fileUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm underline mt-2 hover:opacity-80"
          >
            📎 {m.fileName || 'Download file'}
          </a>
        )}

        {/* REACTIONS */}
        {m.reactions && m.reactions.length > 0 && (
          <Reactions
            message={m}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
          />
        )}

        {/* ERROR STATE */}
        {m.error && <p className="text-xs text-red-300 mt-1">Failed to send</p>}

        {/* TIMESTAMP + DELETE */}
        <div className="flex justify-between items-center mt-1 text-[10px] opacity-70">
          <span>{formatTimestamp(m.createdAt)}</span>
          {isMe && !m.error && m.id && (
            <button
              onClick={async () => {
                const original = { ...m }
                useChatStore.setState((s) => ({
                  messages: {
                    ...s.messages,
                    [conversationId]: (s.messages[conversationId] || []).map(
                      (msg) =>
                        msg.id === m.id
                          ? { ...msg, content: '[deleting…]' }
                          : msg
                    ),
                  },
                }))

                try {
                  await deleteMessage(conversationId, m.id)
                } catch {
                  toast.error('Gagal menghapus pesan')
                  useChatStore.setState((s) => ({
                    messages: {
                      ...s.messages,
                      [conversationId]: (s.messages[conversationId] || []).map(
                        (msg) => (msg.id === original.id ? original : msg)
                      ),
                    },
                  }))
                }
              }}
              className="ml-2 text-xs text-red-300 hover:text-red-500"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
