import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import clsx from 'clsx';

import { useChatList } from '@hooks/useChatList';
import { useUserProfile } from '@hooks/useUserProfile';
import { useModalStore } from '@store/modal';
import { useCommandPaletteStore } from '@store/commandPalette';
import { useAuthStore } from '@store/auth';
import { useShallow } from 'zustand/react/shallow';

import type { User } from '@store/auth';
import type { Conversation } from '@store/conversation';

import { toAbsoluteUrl } from '@utils/url';

import { FiUsers, FiSearch, FiSettings, FiUser, FiMaximize2, FiSlash, FiTrash2, FiLock, FiEyeOff } from 'react-icons/fi';
import { BiQrScan } from 'react-icons/bi';

import CreateGroupChat from './CreateGroupChat';
import ScanQRModal from './ScanQRModal';
import { Spinner } from './Spinner';
import SwipeableItem from './SwipeableItem';
import { useContextMenuStore } from '../store/contextMenu';
import { useSettingsStore } from '@store/settings';
import StoryTray from './StoryTray';
import UserProfile from './UserProfile';
import SearchResults from './SearchResults';
import ConversationItem from './ConversationItem';

export default function ChatList() {
  const navigate = useNavigate();
  const {
    conversations,
    searchResults,
    searchQuery,
    showSearchResults,
    isLoading,
    error,
    activeId,
    presence,
    meId,
    setSearchQuery,
    handleConversationClick,
    handleSelectUser,
    handleRetry,
    deleteGroup,
    deleteConversation,
    togglePinConversation,
  } = useChatList();

  const {
    blockedUserIds,
    blockUser,
    unblockUser
  } = useAuthStore(useShallow(state => ({
    blockedUserIds: state.blockedUserIds,
    blockUser: state.blockUser,
    unblockUser: state.unblockUser
  })));

  const { showConfirm, openProfileModal } = useModalStore(useShallow(state => ({
    showConfirm: state.showConfirm,
    openProfileModal: state.openProfileModal,
  })));

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const { addCommands, removeCommands } = useCommandPaletteStore(useShallow(s => ({
    addCommands: s.addCommands, removeCommands: s.removeCommands
  })));
  const privacyCloak = useSettingsStore(s => s.privacyCloak);

  const openCreateGroupModal = useCallback(() => setShowGroupModal(true), []);

  useEffect(() => {
    const commands = [{
      id: 'new-group', name: 'New Group', action: openCreateGroupModal,
      icon: <FiUsers />, section: 'General', keywords: 'create group chat conversation',
    }];
    addCommands(commands);
    return () => removeCommands(commands.map(c => c.id));
  }, [addCommands, removeCommands, openCreateGroupModal]);

  const itemContent = useCallback((index: number, c: Conversation) => {
    const peerUser = !c.isGroup ? c.participants?.find(p => p.id !== meId) : null;
    const isOnline = peerUser ? presence.includes(peerUser.id) : false;
    const isBlocked = peerUser ? blockedUserIds.includes(peerUser.id) : false;

    return (
      <ConversationItem
        conversation={c}
        meId={meId}
        isOnline={isOnline}
        isBlocked={isBlocked}
        blockUser={blockUser}
        unblockUser={unblockUser}
        isActive={c.id === activeId}
        onClick={() => handleConversationClick(c.id)}
        onUserClick={openProfileModal}
        onMenuSelect={(action) => {
           if (action === 'deleteGroup') deleteGroup(c.id);
           else deleteConversation(c.id);
        }}
        onTogglePin={togglePinConversation}
        privacyCloak={privacyCloak}
      />
    );
  }, [meId, presence, blockedUserIds, activeId, handleConversationClick, openProfileModal, deleteGroup, deleteConversation, togglePinConversation, blockUser, unblockUser, privacyCloak]);

  return (
    <div className="
      h-full flex flex-col bg-bg-main relative overflow-hidden
      border-r border-black/5 dark:border-white/5 
      shadow-[1px_0_0_rgba(255,255,255,0.5)] dark:shadow-[1px_0_0_rgba(0,0,0,0.5)]
    ">
      {/* Top Section */}
      <UserProfile />
      
      <div className="px-6 pb-2">
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary z-10 pointer-events-none">
            <FiSearch size={18} />
          </div>
          <input
            id="global-search-input"
            type="text"
            placeholder="Search..."
            className="
              w-full h-12 pl-12 pr-12 rounded-full
              bg-bg-main text-text-primary font-medium
              shadow-neu-pressed dark:shadow-neu-pressed-dark
              focus:ring-2 focus:ring-accent/50 outline-none
              transition-all placeholder:text-text-secondary/50
            "
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <button 
              onClick={() => setShowScanModal(true)} 
              title="Scan QR Code"
              className="
                p-2 rounded-full text-text-secondary
                hover:text-accent active:scale-95 transition-all
              "
            >
              <BiQrScan size={18} />
            </button>
            <button 
              onClick={openCreateGroupModal} 
              title="New Group Chat"
              className="
                p-2 rounded-full text-text-secondary
                hover:text-accent active:scale-95 transition-all
              "
            >
              <FiUsers size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* STORY TRAY */}
      {!searchQuery && <StoryTray />}

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-4 pt-2 scrollbar-hide">
        {isLoading && (
          <div className="flex justify-center items-center h-full">
            <Spinner />
          </div>
        )}
        
        {error && !isLoading && (
          <div className="p-6 mx-4 text-center">
            <div className="text-red-500 font-bold mb-2 text-sm">Connection Error</div>
            <button 
              onClick={handleRetry}
              className="px-4 py-2 rounded-full bg-bg-surface shadow-neumorphic-convex text-xs font-bold hover:text-red-500 active:shadow-neumorphic-pressed"
            >
              Reconnect
            </button>
          </div>
        )}

        {!error && !isLoading && (
          showSearchResults ? (
            <SearchResults results={searchResults} onSelect={handleSelectUser} />
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%' }}
              data={conversations}
              components={{
                Header: () => <div className="h-2"></div>,
                EmptyPlaceholder: () => (
                  <div className="flex flex-col items-center justify-center h-40 text-text-secondary/50">
                    <p className="text-sm font-medium">No conversations yet</p>
                  </div>
                ),
              }}
              itemContent={itemContent}
            />
          )
        )}
      </div>
      
      {showGroupModal && <CreateGroupChat onClose={() => setShowGroupModal(false)} />}
      {showScanModal && (
        <ScanQRModal 
          onClose={() => setShowScanModal(false)} 
          onScanSuccess={(hash) => {
            setShowScanModal(false);
            navigate(`/connect?u=${hash}`);
          }} 
        />
      )}
    </div>
  );
}
