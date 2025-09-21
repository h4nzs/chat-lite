import { memo, useEffect, useRef, useCallback } from "react"
import MessageBubble from "./MessageBubble"
import type { CSSProperties } from "react"
import type { Message } from "@store/chat"

type ItemData = {
  messages: Message[]
  conversationId: string
  setSize: (index: number, size: number) => void
  meId?: string | null
  formatTimestamp: (ts: string) => string
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>
}

interface MessageItemProps {
  index: number
  style: CSSProperties
  data: ItemData
}

// Fungsi untuk membandingkan props dan mencegah re-render yang tidak perlu
const areEqual = (prevProps: MessageItemProps, nextProps: MessageItemProps) => {
  return (
    prevProps.index === nextProps.index &&
    prevProps.style === nextProps.style &&
    prevProps.data.conversationId === nextProps.data.conversationId &&
    prevProps.data.meId === nextProps.data.meId &&
    prevProps.data.messages[prevProps.index]?.id === nextProps.data.messages[nextProps.index]?.id &&
    prevProps.data.messages[prevProps.index]?.content === nextProps.data.messages[nextProps.index]?.content &&
    prevProps.data.messages[prevProps.index]?.imageUrl === nextProps.data.messages[nextProps.index]?.imageUrl
  )
}

function MessageItemComponent({ index, style, data }: MessageItemProps) {
  const { messages, setSize, formatTimestamp, deleteMessage, conversationId, meId } = data
  const itemRef = useRef<HTMLDivElement>(null)
  
  const m = messages[index]
  if (!m) return null
  
  const mine = m.senderId === meId
  const prev = index > 0 ? messages[index - 1] : null
  const next = index < messages.length - 1 ? messages[index + 1] : null
  const isSameUser = prev?.senderId === m.senderId
  const isNextSameUser = next?.senderId === m.senderId
  const showName = !mine && !isSameUser && !m.imageUrl
  const showAvatar = !mine && !isNextSameUser
  const isFirst = !prev || prev.senderId !== m.senderId
  const isLast = !next || next.senderId !== m.senderId

  // Measure item height
  useEffect(() => {
    if (itemRef.current) {
      // Gunakan requestAnimationFrame untuk memastikan ukuran diukur setelah render
      requestAnimationFrame(() => {
        if (itemRef.current) {
          setSize(index, itemRef.current.offsetHeight)
        }
      })
    }
  }, [index, setSize, m.content, m.imageUrl])

  return (
    <div style={style} className="px-4 py-1">
      <div ref={itemRef} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-full flex flex-col ${mine ? "items-end" : "items-start"}`}>
          {showName && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 ml-2">
              {m.senderId === meId ? "You" : "Participant"}
            </div>
          )}
          
          <div className="flex items-end gap-2 max-w-full">
            {!mine && isFirst && (
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
            )}
            
            <div className="flex flex-col">
              <MessageBubble m={m} />
              <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${mine ? "text-right" : "text-left"}`}>
                {formatTimestamp(m.createdAt)}
              </div>
            </div>
            
            {mine && isFirst && (
              <div className="w-6 h-6 rounded-full bg-blue-300 dark:bg-blue-600 flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(MessageItemComponent, areEqual)