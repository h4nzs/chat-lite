import { useEffect } from 'react'
import { useChatStore } from '../store/chat'

export default function ChatList({ onOpen }: { onOpen: (id: string) => void }) {
  const conversations = useChatStore((s) => s.conversations)
  const loadConversations = useChatStore((s) => s.loadConversations)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpen(c.id)}
          className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <div className="font-medium">
            {c.title ||
              (Array.isArray(c.participants)
                ? c.participants.map((p) => p.name).join(', ')
                : '')}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {c.lastMessage?.content
              ? c.lastMessage.content
              : c.lastMessage?.imageUrl
              ? '📷 Image'
              : 'No messages'}
          </div>
        </button>
      ))}
    </div>
  )
}
