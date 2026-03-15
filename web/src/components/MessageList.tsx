import { useCallback, useRef, useEffect, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import MessageItem from "@components/MessageItem";
import { Spinner } from "./Spinner";
import { usePresenceStore } from "@store/presence";
import { useMessageSearchStore } from "@store/messageSearch";
import { useMessageStore } from "@store/message";
import { useShallow } from 'zustand/react/shallow';
import { FiShield, FiInfo } from 'react-icons/fi';
import type { Conversation, Message } from "@store/conversation";

const KeyRotationBanner = () => (
  <div className="bg-yellow-500/10 border-y border-yellow-500/20 px-4 py-3 text-yellow-600 dark:text-yellow-400">
    <div className="flex items-center gap-3">
      <FiShield className="flex-shrink-0 animate-pulse" size={18} />
      <div className="font-mono text-xs">
        <p className="font-bold uppercase tracking-wider">Security Alert: Key Rotation Required</p>
        <p className="opacity-80">Encryption keys desynchronized. Transmit message to re-establish secure handshake.</p>
      </div>
    </div>
  </div>
);

const NewConversationBanner = () => (
  <div className="bg-blue-500/10 border-y border-blue-500/20 px-4 py-3 text-blue-600 dark:text-blue-400">
    <div className="flex items-start gap-3">
      <FiInfo className="flex-shrink-0 mt-0.5" size={18} />
      <div className="font-mono text-xs">
        <p className="font-bold uppercase tracking-wider mb-1">Encryption Protocol Recommendation</p>
        <p className="opacity-90 leading-relaxed">
          For the initial handshake, ensure both parties are <strong>ONLINE</strong>. 
          Sending messages to offline users in a new conversation may require a key refresh if they come online later.
        </p>
      </div>
    </div>
  </div>
);

const ChatSpinner = () => (
  <div className="py-6 flex justify-center items-center">
    <Spinner size="sm" />
  </div>
);

interface MessageListProps {
  conversationId: string;
  conversation: Conversation;
  messages: Message[];
  isLoading: boolean;
  isFetchingMore: boolean;
  meId?: string;
  onLoadPrevious: () => void;
  onImageClick: (message: Message) => void;
}

export default function MessageList({
  conversationId,
  conversation,
  messages,
  isLoading,
  isFetchingMore,
  meId,
  onLoadPrevious,
  onImageClick
}: MessageListProps) {
  const virtuosoRef = useRef<unknown>(null);
  
  const { highlightedMessageId, setHighlightedMessageId } = useMessageSearchStore(useShallow(state => ({
    highlightedMessageId: state.highlightedMessageId,
    setHighlightedMessageId: state.setHighlightedMessageId,
  })));
  
  const loadMessageContext = useMessageStore(s => s.loadMessageContext);
  const typingIndicators = usePresenceStore(state => state.typingIndicators);

  useEffect(() => {
    if (!highlightedMessageId) return;

    const handleJump = async () => {
      let el = document.getElementById(`msg-${highlightedMessageId}`);
      
      if (!el) {
        await loadMessageContext(highlightedMessageId);
        await new Promise(resolve => setTimeout(resolve, 300));
        el = document.getElementById(`msg-${highlightedMessageId}`);
      }

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-accent', 'ring-offset-2', 'ring-offset-bg-main', 'scale-[1.02]', 'transition-all', 'duration-500', 'z-10');
        
        setTimeout(() => {
          el?.classList.remove('ring-2', 'ring-accent', 'ring-offset-2', 'ring-offset-bg-main', 'scale-[1.02]', 'z-10');
        }, 2000);
      }
      
      useMessageSearchStore.getState().setHighlightedMessageId(null);
    };

    handleJump();
  }, [highlightedMessageId, messages, loadMessageContext, setHighlightedMessageId]);

  const typingUsersInThisConvo = typingIndicators.filter(i => i.conversationId === conversationId && i.id !== meId && i.isTyping);
  const participants = useMemo(() => conversation?.participants || [], [conversation?.participants]);
  const isGroup = conversation?.isGroup || false;

  const itemContent = useCallback((index: number, message: Message) => {
    const prevMessage = messages[index - 1];
    const nextMessage = messages[index + 1];
    const isFirstInSequence = !prevMessage || prevMessage.senderId !== message.senderId;
    const isLastInSequence = !nextMessage || nextMessage.senderId !== message.senderId;

    return (
      <div className="px-1 md:px-4 py-0.5" key={message.id}>
        <MessageItem 
          message={message} 
          isGroup={isGroup}
          participants={participants}
          isHighlighted={message.id === highlightedMessageId}
          onImageClick={onImageClick}
          isFirstInSequence={isFirstInSequence}
          isLastInSequence={isLastInSequence}
        />
      </div>
    );
  }, [messages, isGroup, participants, highlightedMessageId, onImageClick]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {messages.length === 0 && !isLoading && <NewConversationBanner />}

      <div className="flex-1 min-h-0 relative z-0 shadow-neu-pressed dark:shadow-neu-pressed-dark mx-2 md:mx-4 my-2 rounded-2xl bg-bg-main overflow-hidden">
        <div className="h-full px-4 md:px-6 pt-6 pb-2">
          <Virtuoso
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            ref={virtuosoRef as any}
            initialTopMostItemIndex={messages.length - 1}
            data={messages}
            startReached={onLoadPrevious}
            components={{ Header: () => isFetchingMore ? <ChatSpinner /> : <div className="h-4" /> }}
            itemContent={itemContent}
            followOutput="auto"
          />
        </div>

        {/* Typing Indicator Overlay */}
        <AnimatePresence>
          {typingUsersInThisConvo.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-4 left-6 z-20"
            >
              <div className="
                px-4 py-2 rounded-full
                bg-bg-surface/80 backdrop-blur-md border border-white/10
                shadow-neumorphic-convex
                flex items-center gap-3
              ">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Typing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {conversation.keyRotationPending && <KeyRotationBanner />}
    </div>
  );
}
