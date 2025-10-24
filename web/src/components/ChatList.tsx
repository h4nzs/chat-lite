import { useEffect, useState } from 'react';
import { useChatStore } from '@store/chat';
import { useAuthStore } from '@store/auth';
import { sanitizeText } from '@utils/sanitize';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

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

  return (
    <div className="h-full flex flex-col bg-surface">
      <UserProfile />
      <div className="p-4">
        <input type="text" placeholder="Search..." className="w-full p-2 bg-primary border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((c) => {
          const isActive = c.id === activeId;
          const title = c.title || c.participants.filter(p => p.id !== meId).map(p => p.name).join(', ') || 'Conversation';
          const peer = !c.isGroup ? c.participants.find(p => p.id !== meId) : null;
          const isOnline = peer ? presence.includes(peer.id) : false;

          return (
            <div key={c.id} className={`mx-2 my-1 rounded-lg transition-colors ${isActive ? 'bg-accent/20' : 'hover:bg-primary/50'}`}>
              <button onClick={() => onOpen(c.id)} className="w-full text-left p-3 flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <img src={peer?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${title}`} alt="Avatar" className="w-12 h-12 rounded-full bg-gray-700" />
                  {peer && <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-white truncate">{title}</p>
                    {c.lastMessage && <p className="text-xs text-text-secondary flex-shrink-0 ml-2">{new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                  </div>
                  <p className="text-sm text-text-secondary truncate mt-1">
                    {c.lastMessage?.preview || sanitizeText(c.lastMessage?.content || '') || 'No messages yet'}
                  </p>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}