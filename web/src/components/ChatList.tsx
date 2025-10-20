import { useEffect, useCallback, useRef, useMemo } from 'react'
import { useChatStore } from '@store/chat'
import { getSocket } from '@lib/socket'

function sanitizeHtml(content: any): string {
  const str = typeof content === "string" ? content : (content?.content ?? "");
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}

interface ChatListProps {
  onOpen: (id: string) => void
  activeId?: string | null
}

export default function ChatList({ onOpen, activeId }: ChatListProps) {
  const conversations = useChatStore((s) => s.conversations)
  const loadConversations = useChatStore((s) => s.loadConversations)
  const presence = useChatStore((s) => s.presence)
  const storeActiveId = useChatStore((s) => s.activeId)
  const conversationCursor = useChatStore((s) => s.conversationCursor)
  const listRef = useRef<HTMLDivElement>(null)

  // Debug: log conversations to see if data is loaded
  useEffect(() => {
    console.log('Conversations loaded:', conversations)
  }, [conversations])

  const handleLoadMore = useCallback(() => {
    if (conversationCursor) {
      loadConversations(conversationCursor)
    }
  }, [conversationCursor, loadConversations])

  useEffect(() => {
    loadConversations()
    const socket = getSocket()
    socket.off('conversation:new')
    socket.on('conversation:new', (conv) => {
      useChatStore.setState((s) => {
        if (s.conversations.some((c) => c.id === conv.id)) return {}
        const updated = [...s.conversations, conv].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        return { conversations: updated }
      })
    })

    return () => {
      socket.off('conversation:new')
    }
  }, [loadConversations])

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (isNearBottom && conversationCursor) {
        handleLoadMore();
      }
    };

    const currentListRef = listRef.current;
    if (currentListRef) {
      currentListRef.addEventListener('scroll', handleScroll);
      return () => currentListRef.removeEventListener('scroll', handleScroll);
    }
  }, [conversationCursor, handleLoadMore]);

  const formatConversationTime = useCallback((timestamp: string) => {
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
  }, [])

  const activeConversationId = useMemo(() => activeId ?? storeActiveId, [activeId, storeActiveId])

  // Show a message when there are no conversations
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-gray-500">
        No conversations yet. Start a new chat!
      </div>
    )
  }

  return (
    <div ref={listRef} className="overflow-y-auto flex-1">
      {conversations.map((c) => {
        // Validate conversation data
        if (!c.id) {
          console.warn("Skipping conversation without ID:", c);
          return null;
        }
        
        const isActive = c.id === activeConversationId
        const title = c.title || (Array.isArray(c.participants) ? c.participants.map((p) => p.name || p.username || 'Unknown').join(', ') : 'Unknown')
        const peer = Array.isArray(c.participants) && c.participants.length > 0 ? c.participants[0] : null
        const isOnline = peer ? presence[peer.id] : false

        return (
          <button
            key={c.id}
            onClick={() => {
              useChatStore.setState({ activeId: c.id })
              onOpen(c.id)
            }}
            className={`w-full text-left p-4 transition flex items-center ${
              isActive 
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <div className="relative mr-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                {(title.charAt(0) || 'U').toUpperCase()}
              </div>
              {peer && (
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                }`} title={isOnline ? 'Online' : 'Offline'} />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{title}</div>
                {c.lastMessage && c.lastMessage.createdAt && (
                  <div className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                    {formatConversationTime(c.lastMessage.createdAt)}
                  </div>
                )}
              </div>
              
              <div className={`text-sm truncate mt-1 ${
                isActive ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {c.lastMessage?.preview || sanitizeHtml(c.lastMessage?.content || '') || 'No messages yet'}
              </div>
            </div>
          </button>
        )
      })}
      
      {conversationCursor && (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          Loading more conversations...
        </div>
      )}
    </div>
  )
}