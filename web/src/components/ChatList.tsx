import { useEffect } from 'react'
import { useChatStore } from '../store/chat'

export default function ChatList({
  onOpen,
  activeId
}: {
  onOpen: (id: string) => void
  activeId?: string | null
}) {
  const conversations = useChatStore((s) => s.conversations)
  const loadConversations = useChatStore((s) => s.loadConversations)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {conversations.map((c) => {
        const isActive = c.id === activeId
        const title =
          c.title ||
          (Array.isArray(c.participants)
            ? c.participants.map((p) => p.name).join(', ')
            : '')

        return (
          <button
            key={c.id}
            onClick={() => onOpen(c.id)}
            className={`w-full text-left p-4 transition flex flex-col
              ${isActive
                ? 'bg-gradient-to-r from-purple-500/90 to-blue-500/90 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
          >
            {/* Judul percakapan */}
            <div className="font-medium truncate">{title}</div>

            {/* Preview pesan terakhir */}
            <div
              className={`text-sm truncate ${
                isActive
                  ? 'text-white/80'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {c.lastMessage?.preview || 'No messages'}
            </div>
          </button>
        )
      })}
    </div>
  )
}
