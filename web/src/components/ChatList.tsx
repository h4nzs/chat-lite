import { useEffect, useState, useCallback } from 'react';
import { useChatStore } from '@store/chat';
import { useAuthStore } from '@store/auth';
import { sanitizeText } from '@utils/sanitize';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import StartNewChat from './StartNewChat';

interface ChatListProps {
  onOpen: (id: string) => void;
  activeId?: string | null;
}

const UserProfile = () => {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  return (
    <div className="p-4 flex items-center justify-between border-b border-gray-800">
      <div className="flex items-center gap-3">
        <img src={user.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-700" />
        <div>
          <p className="font-semibold text-white">{user.name}</p>
          <p className="text-xs text-text-secondary">Available</p>
        </div>
      </div>
      <button onClick={logout} className="p-2 rounded-full hover:bg-gray-700 text-text-secondary hover:text-white transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
    </div>
  );
};

export default function ChatList({ onOpen, activeId }: ChatListProps) {
  const { conversations, presence, deleteGroup, deleteConversation } = useChatStore();
  const meId = useAuthStore((s) => s.user?.id);
  const [searchQuery, setSearchQuery] = useState('');

  const formatConversationTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffInDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  const filteredConversations = conversations.filter(c => {
    const title = c.title || c.participants.filter(p => p.id !== meId).map(p => p.name).join(', ') || 'Conversation';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-full flex flex-col bg-surface">
      <UserProfile />
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search or start new chat..." 
            className="w-full p-2 pl-10 bg-primary border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searchQuery ? (
          <div className="p-2">
            <p className="text-xs font-bold text-text-secondary px-2 mb-2">NEW CHAT</p>
            <StartNewChat query={searchQuery} onStarted={(id) => { onOpen(id); setSearchQuery(''); }} />
          </div>
        ) : null}

        <div className="p-2">
          {!searchQuery && <p className="text-xs font-bold text-text-secondary px-2 mb-2">CONVERSATIONS</p>}
          {filteredConversations.length === 0 && !searchQuery ? (
            <div className="text-center p-4 text-text-secondary">No conversations yet.</div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === activeId;
              const title = c.title || c.participants.filter(p => p.id !== meId).map(p => p.name).join(', ') || 'Conversation';
              const peer = !c.isGroup ? c.participants.find(p => p.id !== meId) : null;
              const isOnline = peer ? presence.includes(peer.id) : false;

              return (
                <div key={c.id} className={`relative flex items-center justify-between mx-2 my-1 rounded-lg transition-colors ${isActive ? 'bg-accent/20' : 'hover:bg-primary/50'}`}>
                  <button onClick={() => onOpen(c.id)} className="w-full text-left p-3 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <img src={peer?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${title}`} alt="Avatar" className="w-12 h-12 rounded-full bg-gray-700" />
                      {peer && <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-white truncate">{title}</p>
                        {c.lastMessage && <p className="text-xs text-text-secondary flex-shrink-0 ml-2">{formatConversationTime(c.lastMessage.createdAt)}</p>}
                      </div>
                      <p className="text-sm text-text-secondary truncate mt-1">
                        {c.lastMessage?.preview || sanitizeText(c.lastMessage?.content || '') || 'No messages yet'}
                      </p>
                    </div>
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button onClick={(e) => e.stopPropagation()} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content sideOffset={5} align="end" className="min-w-[180px] bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 p-1">
                          {c.isGroup && c.creatorId === meId && (
                            <DropdownMenu.Item 
                              onSelect={() => { if(window.confirm('Are you sure you want to permanently delete this group?')) deleteGroup(c.id); }}
                              className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white rounded cursor-pointer outline-none"
                            >
                              Delete Group
                            </DropdownMenu.Item>
                          )}
                          {!c.isGroup && (
                            <DropdownMenu.Item 
                              onSelect={() => { if(window.confirm('Are you sure you want to hide this chat?')) deleteConversation(c.id); }}
                              className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white rounded cursor-pointer outline-none"
                            >
                              Delete Chat
                            </DropdownMenu.Item>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
