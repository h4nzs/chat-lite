import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useConversationStore } from '@store/conversation';
import { useMessageStore } from '@store/message';
import { usePresenceStore } from '@store/presence';
import { useAuthStore, type User } from '@store/auth';
import { sanitizeText } from '@utils/sanitize';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import CreateGroupChat from './CreateGroupChat';
import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@utils/url';
import { useModalStore } from '@store/modal';
import NotificationBell from './NotificationBell';
import { api } from '@lib/api';
import { Virtuoso } from 'react-virtuoso';
import { debounce } from 'lodash';

interface ChatListProps {
  onOpen: (id: string) => void;
  activeId?: string | null;
}

const UserProfile = () => {
  const { user, logout } = useAuthStore(state => ({ 
    user: state.user, 
    logout: state.logout 
  }));
  if (!user) return null;

  return (
    <div className="p-4 flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-3">
        <img src={toAbsoluteUrl(user.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`} alt="Avatar" className="w-10 h-10 rounded-full bg-bg-primary object-cover" />
        <div>
          <p className="font-semibold text-text-primary">{user.name}</p>
          <p className="text-xs text-text-secondary">Available</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <Link to="/settings" className="p-2 rounded-full hover:bg-secondary text-text-secondary hover:text-text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </Link>
        <button onClick={logout} className="p-2 rounded-full hover:bg-secondary text-text-secondary hover:text-text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>
  );
};

const SearchResults = ({ results, onSelect }: { results: User[], onSelect: (userId: string) => void }) => {
  return (
    <Virtuoso
      style={{ height: '100%' }}
      data={results}
      components={{
        Header: () => <p className="text-xs font-bold text-text-secondary px-4 mb-2">SEARCH RESULTS</p>,
        EmptyPlaceholder: () => <div className="p-4 text-center text-sm text-text-secondary">No users found.</div>,
      }}
      itemContent={(index, user) => (
        <button 
          key={user.id}
          onClick={() => onSelect(user.id)}
          className="w-full text-left p-3 flex items-center gap-3 rounded-lg hover:bg-secondary transition-colors"
        >
          <img src={toAbsoluteUrl(user.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`} alt="Avatar" className="w-12 h-12 rounded-full bg-bg-primary object-cover" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-text-primary">{user.name}</p>
            <p className="text-sm truncate text-text-secondary">@{user.username}</p>
          </div>
        </button>
      )}
    />
  );
};

export default function ChatList({ onOpen, activeId }: ChatListProps) {
  const { conversations, deleteGroup, deleteConversation, startConversation, error } = useConversationStore(state => ({
    conversations: state.conversations,
    deleteGroup: state.deleteGroup,
    deleteConversation: state.deleteConversation,
    startConversation: state.startConversation,
    error: state.error,
  }));
  const loadMessagesForConversation = useMessageStore(s => s.loadMessagesForConversation);
  const presence = usePresenceStore(state => state.presence);
  const meId = useAuthStore((s) => s.user?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const showConfirm = useModalStore(state => state.showConfirm);
  const openProfileModal = useModalStore(state => state.openProfileModal);

  const handleSearch = useCallback(debounce(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const users = await api<User[]>(`/api/users/search?q=${query}`);
      setSearchResults(users);
    } catch (err) {
      console.error("Search failed", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, 300), []);

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, handleSearch]);

  const handleSelectUser = async (userId: string) => {
    const conversationId = await startConversation(userId);
    onOpen(conversationId);
    setSearchQuery('');
    setSearchResults([]);
  };

  const openCreateGroupModal = () => setShowGroupModal(true);

  const handleDeleteGroup = (id: string) => {
    showConfirm(
      'Delete Group',
      'Are you sure you want to permanently delete this group? This action cannot be undone.',
      () => deleteGroup(id)
    );
  };

  const handleDeleteConversation = (id: string) => {
    showConfirm(
      'Delete Chat',
      'Are you sure you want to hide this chat? It will be removed from your conversation list.',
      () => deleteConversation(id)
    );
  };

  const formatConversationTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffInDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  const filteredConversations = conversations.filter(c => {
    const title = c.title || c.participants?.filter(p => p.id !== meId).map(p => p.name).join(', ') || 'Conversation';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const showSearchResults = searchQuery.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-bg-surface">
      <UserProfile />
      <div className="p-4 border-b border-border">
        <div className="relative flex items-center">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary z-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search or start new chat..." 
            className="w-full p-2.5 pl-10 pr-12 bg-bg-primary border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent-color transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <button 
              onClick={openCreateGroupModal} 
              title="New Group Chat" // Tooltip on hover
              className="p-2 rounded-full text-text-secondary hover:bg-secondary hover:text-text-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <div className="p-2 text-center text-red-400 bg-red-500/20 rounded-lg">{error}</div>}
        
        {showSearchResults ? (
          <SearchResults results={searchResults} onSelect={handleSelectUser} />
        ) : (
          <Virtuoso
            style={{ height: '100%' }}
            data={filteredConversations}
            components={{
              Header: () => <p className="text-xs font-bold text-text-secondary px-4 pt-2 mb-2">CONVERSATIONS</p>,
              EmptyPlaceholder: () => <div className="text-center p-4 text-text-secondary">No conversations yet.</div>,
            }}
            itemContent={(index, c) => {
              const isActive = c.id === activeId;
              const peerUser = !c.isGroup ? c.participants?.find(p => p.id !== meId) : null;
              const title = c.isGroup ? c.title : peerUser?.name || 'Conversation';
              const isOnline = peerUser ? presence.includes(peerUser.id) : false;

              const avatarSrc = c.isGroup 
                ? (c.avatarUrl ? `${toAbsoluteUrl(c.avatarUrl)}?t=${c.lastUpdated}` : `https://api.dicebear.com/8.x/initials/svg?seed=${c.title}`)
                : (peerUser?.avatarUrl ? toAbsoluteUrl(peerUser.avatarUrl) : `https://api.dicebear.com/8.x/initials/svg?seed=${title}`);

              return (
                <motion.div
                  key={c.id}
                  onMouseEnter={() => loadMessagesForConversation(c.id)}
                  whileHover={{ scale: 1.03 }}
                  className={`relative flex items-center justify-between mx-2 my-1 rounded-lg ${isActive ? 'bg-accent-color/20 border-l-4 border-accent-color' : ''}`}>
                  <div className="w-full text-left p-3 pr-10 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <button 
                        onClick={(e) => {
                          if (peerUser) {
                            e.stopPropagation(); // Prevent opening the chat
                            openProfileModal(peerUser.id);
                          }
                        }}
                        disabled={!peerUser}
                        className="disabled:cursor-default"
                      >
                        <img src={avatarSrc} alt="Avatar" className="w-12 h-12 rounded-full bg-bg-primary object-cover" />
                      </button>
                      {peerUser && <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-bg-surface ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />}
                    </div>
                    <div onClick={() => onOpen(c.id)} className="flex-1 min-w-0 cursor-pointer">
                      <div className="flex justify-between items-start">
                        <p className={`font-semibold truncate ${isActive ? 'text-accent-color' : 'text-text-primary'}`}>{title}</p>
                        {c.lastMessage && <p className={`text-xs flex-shrink-0 ml-2 ${isActive ? 'text-text-secondary' : 'text-text-secondary'}`}>{formatConversationTime(c.lastMessage.createdAt)}</p>}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className={`text-sm truncate ${isActive ? 'text-text-secondary' : 'text-text-secondary'}`}>
                          {c.lastMessage?.preview || sanitizeText(c.lastMessage?.content || '') || 'No messages yet'}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="bg-accent-gradient text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 ml-2">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button onClick={(e) => e.stopPropagation()} className="p-2 rounded-full hover:bg-secondary transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text-secondary" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content sideOffset={5} align="end" className="min-w-[180px] bg-card border border-border rounded-md shadow-lg z-50 p-1">
                          {c.isGroup ? (
                            <DropdownMenu.Item 
                              onSelect={() => handleDeleteGroup(c.id)}
                              className="block w-full text-left px-3 py-2 text-sm text-destructive rounded cursor-pointer outline-none hover:bg-destructive hover:text-destructive-foreground"
                            >
                              Delete Group
                            </DropdownMenu.Item>
                          ) : (
                            <DropdownMenu.Item 
                              onSelect={() => handleDeleteConversation(c.id)}
                              className="block w-full text-left px-3 py-2 text-sm text-destructive rounded cursor-pointer outline-none hover:bg-destructive hover:text-destructive-foreground"
                            >
                              Delete Chat
                            </DropdownMenu.Item>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </motion.div>
              );
            }}
          />
        )}
      </div>
      {showGroupModal && <CreateGroupChat onClose={() => setShowGroupModal(false)} />}
    </div>
  );
}
