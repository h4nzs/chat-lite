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
  const presence = useChatStore((s) => s.presence)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Format timestamp for conversation
  const formatConversationTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {conversations.map((c) => {
        const isActive = c.id === activeId
        const title =
          c.title ||
          (Array.isArray(c.participants)
            ? c.participants.map((p) => p.name).join(', ')
            : '')

        // 🔑 Ambil participant lain (selain diri kita)
        const peer = c.participants[0]
        const isOnline = peer ? presence[peer.id] : false

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
            {/* Judul percakapan + indikator online */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{title}</div>
                {peer && (
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    title={isOnline ? 'Online' : 'Offline'}
                  ></span>
                )}
              </div>
              {c.lastMessage && (
                <div className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                  {formatConversationTime(c.lastMessage.createdAt)}
                </div>
              )}
            </div>

            {/* Preview pesan terakhir */}
            <div className="flex items-center justify-between mt-1">
              <div
                className={`text-sm truncate ${
                  isActive
                    ? 'text-white/80'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {c.lastMessage?.preview || c.lastMessage?.content || 'No messages'}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}