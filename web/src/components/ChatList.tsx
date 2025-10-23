import { useEffect, useCallback, useRef, useMemo } from 'react'
import { useChatStore } from '@store/chat';
import { useAuthStore } from '@store/auth';
import { getSocket } from '@lib/socket';
import { sanitizeText } from '@utils/sanitize';

interface ChatListProps {
  onOpen: (id: string) => void
  activeId?: string | null
}

export default function ChatList({ onOpen, activeId }: ChatListProps) {
  const conversations = useChatStore((s) => s.conversations);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const presence = useChatStore((s) => s.presence);
  const storeActiveId = useChatStore((s) => s.activeId);
  const meId = useAuthStore((s) => s.user?.id); // Deklarasikan meId di sini
  const listRef = useRef<HTMLDivElement>(null);

  // Debug: log conversations to see if data is loaded
  useEffect(() => {
    console.log('Conversations loaded:', conversations)
  }, [conversations])

  const handleLoadMore = useCallback(() => {
    // No pagination implemented for conversations in the current store
  }, [])

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
      
      if (isNearBottom) { // Removed conversationCursor check since it doesn't exist
        handleLoadMore();
      }
    };

    const currentListRef = listRef.current;
    if (currentListRef) {
      currentListRef.addEventListener('scroll', handleScroll);
      return () => currentListRef.removeEventListener('scroll', handleScroll);
    }
  }, [handleLoadMore]);

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
        const peer = c.isGroup ? null : c.participants.find(p => p.id !== meId);
        const isOnline = peer ? !!presence[peer.id] : c.participants.some(p => p.id !== meId && presence[p.id]);

        return (
          <button
            key={c.id}
            onClick={() => {
              useChatStore.setState({ activeId: c.id });
              onOpen(c.id);
            }}
            className={`w-full text-left p-4 transition flex items-center gap-4 ${isActive ? 'bg-blue-500/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold text-xl">
                {(title.charAt(0) || 'U').toUpperCase()}
              </div>
              {!c.isGroup && (
                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={isOnline ? 'Online' : 'Offline'} />
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
                {c.lastMessage?.preview || sanitizeText(c.lastMessage?.content || '') || 'No messages yet'}
              </div>
            </div>
          </button>
        )
      })}
      
    </div>
  )
}