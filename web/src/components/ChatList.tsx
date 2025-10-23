import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useChatStore } from '@store/chat';
import { useAuthStore } from '@store/auth';
import { sanitizeText } from '@utils/sanitize';

interface ChatListProps {
  onOpen: (id: string) => void;
  activeId?: string | null;
}

export default function ChatList({ onOpen, activeId }: ChatListProps) {
  const { conversations, loadConversations, presence, deleteGroup, deleteConversation } = useChatStore();
  const meId = useAuthStore((s) => s.user?.id);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const formatConversationTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }, []);

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-gray-500">
        No conversations yet. Start a new chat!
      </div>
    );
  }

  return (
    <div ref={listRef} className="overflow-y-auto flex-1">
      {conversations.map((c) => {
        const isActive = c.id === activeId;
        const title = c.title || c.participants.filter(p => p.id !== meId).map(p => p.name).join(', ') || 'Conversation';
        const peer = c.isGroup ? null : c.participants.find(p => p.id !== meId);
        const isOnline = peer ? presence.includes(peer.id) : c.participants.some(p => p.id !== meId && presence.includes(p.id));

        return (
          <div key={c.id} className={`relative w-full text-left p-4 transition flex items-center gap-4 ${isActive ? 'bg-blue-500/20' : 'hover:bg-gray-800'}`}>
            <button onClick={() => onOpen(c.id)} className="flex-1 flex items-center gap-4 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold text-xl">
                  {(title.charAt(0) || 'U').toUpperCase()}
                </div>
                {!c.isGroup && (
                  <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={isOnline ? 'Online' : 'Offline'} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate text-gray-200">{title}</div>
                  {c.lastMessage && c.lastMessage.createdAt && (
                    <div className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                      {formatConversationTime(c.lastMessage.createdAt)}
                    </div>
                  )}
                </div>
                <div className={`text-sm truncate mt-1 ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                  {c.lastMessage?.preview || sanitizeText(c.lastMessage?.content || '') || 'No messages yet'}
                </div>
              </div>
            </button>

            <div className="relative flex-shrink-0">
              <button onClick={() => setMenuOpenFor(menuOpenFor === c.id ? null : c.id)} className="p-1 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
              </button>
              {menuOpenFor === c.id && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                  {c.isGroup && c.creatorId === meId && (
                    <button 
                      onClick={() => { if(window.confirm('Are you sure you want to permanently delete this group?')) deleteGroup(c.id); setMenuOpenFor(null); }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white"
                    >
                      Delete Group
                    </button>
                  )}
                  {!c.isGroup && (
                    <button 
                      onClick={() => { if(window.confirm('Are you sure you want to hide this chat?')) deleteConversation(c.id); setMenuOpenFor(null); }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white"
                    >
                      Delete Chat
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
