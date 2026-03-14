import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { FiUser, FiMaximize2, FiSlash, FiTrash2, FiLock, FiEyeOff } from 'react-icons/fi';
import SwipeableItem from './SwipeableItem';
import { useContextMenuStore } from '@store/contextMenu';
import { useUserProfile } from '@hooks/useUserProfile';
import { toAbsoluteUrl } from '@utils/url';
import type { Conversation } from '@store/conversation';

export default memo(function ConversationItem({ 
  conversation, 
  meId, 
  isOnline, 
  isBlocked, 
  blockUser, 
  unblockUser, 
  isActive,
  onClick, 
  onUserClick, 
  onMenuSelect, 
  onTogglePin,
  privacyCloak
}: {
  conversation: Conversation;
  meId?: string;
  isOnline: boolean;
  isBlocked: boolean;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  isActive: boolean;
  onClick: () => void;
  onUserClick: (userId: string) => void;
  onMenuSelect: (action: 'deleteGroup' | 'deleteChat') => void;
  onTogglePin: (id: string) => void;
  privacyCloak: boolean;
}) {
  const peerUser = !conversation.isGroup ? conversation.participants?.find(p => p.id !== meId) : null;
  const peerProfile = useUserProfile(peerUser as any);
  const title = conversation.isGroup ? conversation.title : peerProfile.name || 'Conversation';
  const isUnread = conversation.unreadCount > 0;
  const isPinnedByMe = Boolean(conversation.participants?.some(p => p.id === meId && p.isPinned));
  const openMenu = useContextMenuStore(s => s.openMenu);
  
  const cloakClass = privacyCloak ? "blur-[6px] opacity-70 group-hover:blur-none group-hover:opacity-100 group-active:blur-none group-active:opacity-100 transition-all duration-300 select-none" : "";

  const avatarSrc = conversation.isGroup 
    ? (conversation.avatarUrl ? `${toAbsoluteUrl(conversation.avatarUrl)}?t=${conversation.lastUpdated}` : `https://api.dicebear.com/8.x/initials/svg?seed=${conversation.title}`)
    : (peerProfile.avatarUrl ? toAbsoluteUrl(peerProfile.avatarUrl) : `https://api.dicebear.com/8.x/initials/svg?seed=${title}`);

  const formatConversationTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffInDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  const renderPreviewText = () => {
    if (!conversation.lastMessage) return 'No messages yet';
    if (conversation.lastMessage.isViewOnce) {
        return (
            <span className="flex items-center gap-1 text-accent text-sm font-medium">
               {conversation.lastMessage.isViewed ? (
                 <span className="flex items-center gap-1"><FiLock size={12} /> Opened</span>
               ) : (
                 <span className="flex items-center gap-1"><FiEyeOff size={12} /> View Once Message</span>
               )}
            </span>
        );
    }
    if (conversation.lastMessage.preview !== undefined) {
        return conversation.lastMessage.preview || 'No messages yet';
    }
    return conversation.lastMessage.content || 'No messages yet';
  };

  const previewText = renderPreviewText();

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    openMenu(e, [
      ...(peerUser ? [{ label: 'View Profile', icon: <FiUser />, onClick: () => onUserClick(peerUser.id) }] : []),
      { label: isPinnedByMe ? 'Unpin Chat' : 'Pin Chat', icon: <FiMaximize2 />, onClick: () => onTogglePin(conversation.id) },
      ...(!conversation.isGroup ? [{ label: isBlocked ? 'Unblock User' : 'Block User', icon: <FiSlash />, onClick: () => {
         const other = conversation.participants.find(p => p.id !== meId);
         if (other) {
           if (isBlocked) unblockUser(other.id);
           else blockUser(other.id);
         }
      } }] : []),
      { label: conversation.isGroup ? 'Delete Group' : 'Delete Chat', icon: <FiTrash2 />, destructive: true, onClick: () => onMenuSelect(conversation.isGroup ? 'deleteGroup' : 'deleteChat') },
    ]);
  };

  return (
    <motion.div 
      key={conversation.id} 
      className={clsx(
        'relative mx-4 my-3 rounded-2xl p-1 transition-all duration-200 select-none group',
        isActive 
          ? 'bg-bg-main shadow-neu-pressed dark:shadow-neu-pressed-dark border border-transparent' 
          : 'bg-bg-main shadow-neu-flat dark:shadow-neu-flat-dark border border-white/50 dark:border-white/5 active:scale-[0.98]'
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <SwipeableItem
        leftAction={{ icon: <FiMaximize2 size={24} />, color: isPinnedByMe ? 'bg-blue-500' : 'bg-green-500', onAction: () => onTogglePin(conversation.id) }}
        rightAction={{ icon: <FiTrash2 size={24} />, color: 'bg-red-500', onAction: () => onMenuSelect(conversation.isGroup ? 'deleteGroup' : 'deleteChat') }}
      >
        <div 
          onContextMenu={handleContextMenu}
          className="w-full text-left p-3 pr-4 flex items-center gap-4 cursor-pointer rounded-xl bg-bg-main" 
          onClick={onClick}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <button 
              onClick={(e) => {
                if (peerUser) {
                  e.stopPropagation();
                  onUserClick(peerUser.id);
                }
              }}
              disabled={!peerUser}
              className="block"
            >
              <img
                src={avatarSrc}
                alt="Avatar"
                className={clsx(
                  "w-12 h-12 rounded-full object-cover border-2 transition-all pointer-events-none",
                  isActive ? "border-bg-surface shadow-inner" : "border-bg-main shadow-sm",
                  cloakClass
                )}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (conversation.isGroup) {
                    target.src = `https://api.dicebear.com/8.x/initials/svg?seed=${conversation.title}`;
                  } else {
                    target.src = `https://api.dicebear.com/8.x/initials/svg?seed=${title}`;
                  }
                }}
              />
            </button>
            {peerUser && (
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-bg-surface ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pointer-events-none">
            <div className="flex justify-between items-center mb-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {isPinnedByMe && (
                  <span className="text-accent flex-shrink-0">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 8 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                )}
                <p className={clsx(
                  "text-sm font-bold truncate transition-colors",
                  isActive ? 'text-accent' : 'text-text-primary',
                  cloakClass
                )}>
                  {title}
                </p>
              </div>
              {conversation.lastMessage && (
                <p className="text-[10px] font-medium text-text-secondary flex-shrink-0 opacity-80">
                  {formatConversationTime(conversation.lastMessage.createdAt)}
                </p>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <div className={clsx(
                "text-xs truncate max-w-[85%]",
                isUnread ? 'font-bold text-text-primary' : 'text-text-secondary opacity-80',
                cloakClass
              )}>
                {previewText}
              </div>
              {isUnread && (
                <span className="
                  flex items-center justify-center min-w-[1.25rem] h-5 px-1.5
                  bg-accent text-white text-[10px] font-bold 
                  rounded-full shadow-sm
                ">
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </SwipeableItem>
    </motion.div>
  );
}, (prev, next) => {
  return (
    prev.conversation === next.conversation &&
    prev.isActive === next.isActive &&
    prev.isOnline === next.isOnline &&
    prev.isBlocked === next.isBlocked &&
    prev.meId === next.meId &&
    prev.privacyCloak === next.privacyCloak
  );
});
