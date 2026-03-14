import { useCallback, useRef, useState, useEffect } from "react";
import { useAuthStore } from "@store/auth";
import { getSocket } from "@lib/socket";
import { useConversation } from "@hooks/useConversation";
import { useMessageStore } from '@store/message';
import { useMessageInputStore } from '@store/messageInput';
import { useMessageSearchStore } from '@store/messageSearch';
import { useModalStore } from "@store/modal";
import { useShallow } from 'zustand/react/shallow';
import Lightbox from "./Lightbox";
import GroupInfoPanel from './GroupInfoPanel';
import { FiShield, FiX, FiTrash2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MessageInput from './MessageInput';
import MessageSkeleton from './MessageSkeleton';
import { useEdgeSwipe } from '@hooks/useEdgeSwipe';
import { useConversationStore, type Message } from "@store/conversation";

import ChatWindowHeader from './ChatWindowHeader';
import MessageList from './MessageList';

export default function ChatWindow({ id, onMenuClick }: { id: string, onMenuClick: () => void }) {
  const meId = useAuthStore((s) => s.user?.id);
  const { conversation, messages, isLoading, error, actions, isFetchingMore } = useConversation(id);

  const { loadMessagesForConversation, selectedMessageIds, clearMessageSelection, removeMessages } = useMessageStore(useShallow(s => ({
      loadMessagesForConversation: s.loadMessagesForConversation,
      selectedMessageIds: s.selectedMessageIds,
      clearMessageSelection: s.clearMessageSelection,
      removeMessages: s.removeMessages
  })));
  const isSelectionMode = selectedMessageIds.length > 0;
  
  const openConversation = useConversationStore(state => state.openConversation);
  const showConfirm = useModalStore(s => s.showConfirm);
  const clearSearch = useMessageSearchStore(s => s.clearSearch);
  
  useEdgeSwipe(() => {
    if (window.innerWidth < 768) {
      openConversation(null);
    }
  });

  const handleStopRecording = useMessageInputStore(state => state.handleStopRecording);
  
  const [lightboxMessage, setLightboxMessage] = useState<Message | null>(null);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
        loadMessagesForConversation(id);
        clearSearch();
    }
    clearMessageSelection();
  }, [id, loadMessagesForConversation, clearMessageSelection, clearSearch]);

  const handleImageClick = useCallback((message: Message) => setLightboxMessage(message), []);

  const handleBulkDelete = () => {
    if (!conversation || !messages || !meId) return;
    
    const selectedMessages = messages.filter(m => selectedMessageIds.includes(m.id));
    const allMine = selectedMessages.every(m => m.senderId === meId);
    
    const confirmMessage = allMine 
      ? `Permanently delete ${selectedMessageIds.length} messages for everyone?` 
      : `Delete ${selectedMessageIds.length} messages? This will only remove them from your device. Messages from others will remain on their devices.`;

    showConfirm(
      'Bulk Deletion', 
      confirmMessage,
      async () => {
          await removeMessages(conversation.id, selectedMessageIds);
          toast.success(`${selectedMessageIds.length} messages processed`);
      }
    );
  };

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = useCallback(() => {
    const socket = getSocket();
    socket.emit("typing:start", { conversationId: id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId: id });
    }, 1500);
  }, [id]);

  const handleSendMessage = (data: { content: string }) => {
    actions.sendMessage(data);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    getSocket().emit("typing:stop", { conversationId: id });
  };

  const handleVoiceSend = (blob: Blob, duration: number) => {
    handleStopRecording(id, blob, duration);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col h-full bg-bg-main relative overflow-hidden"
      >
        {(() => {
          if (error) {
            return (
              <div className="flex-1 flex flex-col items-center justify-center text-red-500 font-mono">
                <FiShield size={40} className="mb-4 opacity-50" />
                <p className="uppercase tracking-widest">Signal Lost</p>
                <p className="text-xs mt-2 opacity-70">{error}</p>
              </div>
            );
          }

          if (isLoading || !conversation) {
            return (
              <div className="flex-1 flex flex-col justify-end pb-20">
                <MessageSkeleton />
              </div>
            );
          }

          return (
            <>
              {isSelectionMode ? (
                  <div className="h-16 flex items-center justify-between px-4 bg-accent/10 border-b border-white/5 backdrop-blur-md z-30">
                      <div className="flex items-center gap-4">
                          <button onClick={clearMessageSelection} className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white">
                              <FiX size={20} />
                          </button>
                          <span className="font-bold text-lg text-accent tracking-wide">{selectedMessageIds.length} Selected</span>
                      </div>
                      <button 
                          onClick={handleBulkDelete} 
                          className="p-2 text-red-500 hover:bg-red-500/20 rounded-full transition-all active:scale-95 shadow-neumorphic-concave"
                          title="Delete Selected"
                      >
                          <FiTrash2 size={20} />
                      </button>
                  </div>
              ) : (
                  <ChatWindowHeader 
                    conversation={conversation} 
                    onBack={() => {
                        openConversation(null);
                        navigate('/chat');
                    }} 
                    onInfoToggle={() => setIsGroupInfoOpen(true)} 
                    onMenuClick={onMenuClick} 
                  />
              )}
              
              <MessageList 
                 conversationId={id}
                 conversation={conversation}
                 messages={messages}
                 isLoading={isLoading}
                 isFetchingMore={isFetchingMore}
                 meId={meId}
                 onLoadPrevious={actions.loadPrevious}
                 onImageClick={handleImageClick}
              />
              
              <MessageInput
                onSend={handleSendMessage}
                onTyping={handleTyping}
                onVoiceSend={handleVoiceSend}
                conversation={conversation}
              />

              {lightboxMessage && <Lightbox message={lightboxMessage} onClose={() => setLightboxMessage(null)} />}
              {isGroupInfoOpen && <GroupInfoPanel conversationId={id} onClose={() => setIsGroupInfoOpen(false)} />}
            </>
          );
        })()}
      </motion.div>
    </AnimatePresence>
  );
}
