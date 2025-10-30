import { useCallback, useRef, ChangeEvent, useState, useEffect } from "react";
import { useAuthStore } from "@store/auth";
import { getSocket } from "@lib/socket";
import { Virtuoso } from "react-virtuoso";
import MessageItem from "@components/MessageItem";
import { useConversation } from "@hooks/useConversation";
import { Spinner } from "./Spinner";
import { useConversationStore } from "@store/conversation";
import { useMessageStore } from "@store/message";
import { usePresenceStore } from "@store/presence";
import { toAbsoluteUrl } from "@utils/url";
import SearchMessages from './SearchMessages';
import Lightbox from "./Lightbox";

// --- Sub-Components ---

const ChatHeader = ({ conversation }: { conversation: any }) => {
  const meId = useAuthStore(s => s.user?.id);
  const { toggleSidebar } = useConversationStore();
  const { presence } = usePresenceStore();
  const peerUser = !conversation.isGroup ? conversation.participants.find((p: any) => p.id !== meId) : null;
  const title = conversation.isGroup ? (conversation.title || 'Group Chat') : (peerUser?.name || 'Chat');
  const isOnline = peerUser ? presence.includes(peerUser.id) : false;

  return (
    <div className="p-4 border-b border-gray-800 flex items-center gap-4 flex-shrink-0">
      <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-text-secondary hover:text-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <img src={toAbsoluteUrl(peerUser?.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${title}`} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-700 object-cover" />
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="text-xs text-text-secondary">{isOnline ? 'Active now' : 'Offline'}</p>
      </div>
      <div className="flex-grow" />
      <SearchMessages conversationId={conversation.id} />
    </div>
  );
};

const ReplyPreview = () => {
  const { replyingTo, setReplyingTo } = useMessageStore();

  if (!replyingTo) return null;

  const authorName = replyingTo.sender?.name || 'User';
  const contentPreview = replyingTo.content || (replyingTo.fileUrl ? 'File' : '...');

  return (
    <div className="px-4 pt-3">
      <div className="relative bg-primary p-2 rounded-lg border-l-4 border-accent">
        <p className="text-xs font-bold text-accent">Replying to {authorName}</p>
        <p className="text-sm text-text-secondary truncate">{contentPreview}</p>
        <button 
          onClick={() => setReplyingTo(null)} 
          className="absolute top-1 right-1 p-1 rounded-full hover:bg-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
  );
};

const MessageInput = ({ onSend, onTyping, onFileChange }: { onSend: (data: { content: string }) => void; onTyping: () => void; onFileChange: (e: ChangeEvent<HTMLInputElement>) => void; }) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend({ content: text });
    setText('');
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    onTyping();
  }

  return (
    <div className="border-t border-gray-800 bg-background">
      <ReplyPreview />
      <div className="p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-text-secondary hover:text-accent transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <input 
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFileChange}
          />
          <input 
            type="text" 
            value={text} 
            onChange={handleTextChange}
            placeholder="Type a message..."
            className="flex-1 bg-primary px-4 py-2.5 rounded-full text-white placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button type="submit" className="p-3 rounded-full bg-accent hover:bg-accent-hover transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

const ChatSpinner = () => (
  <div className="py-4 flex justify-center items-center">
    <Spinner />
  </div>
);

// --- Main Component ---

export default function ChatWindow({ id }: { id: string }) {
  const meId = useAuthStore((s) => s.user?.id);
  const { 
    conversation, 
    messages, 
    isLoading, 
    error, 
    sendMessage, 
    uploadFile, 
    isFetchingMore, 
    loadPreviousMessages 
  } = useConversation(id);
  
  const { highlightedMessageId, setHighlightedMessageId } = useMessageStore();
  const { typing } = usePresenceStore();
  
  const virtuosoRef = useRef<any>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const handleImageClick = (src: string) => setLightboxSrc(src);

  useEffect(() => {
    if (highlightedMessageId && virtuosoRef.current && messages.length > 0) {
      const index = messages.findIndex(m => m.id === highlightedMessageId);
      if (index !== -1) {
        virtuosoRef.current.scrollToIndex({
          index,
          align: 'center',
          behavior: 'smooth',
        });
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }
    }
  }, [highlightedMessageId, messages, setHighlightedMessageId]);

  const typingUsers = typing[id] || [];
  const filteredTypingUsers = typingUsers.filter(uid => uid !== meId);
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
    sendMessage(data);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    getSocket().emit("typing:stop", { conversationId: id });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-red-400">
        <p>Error loading messages.</p>
        <p className="text-sm text-text-secondary">{error}</p>
      </div>
    );
  }

  if (isLoading || !conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader conversation={conversation} />
      <div className="flex-1 min-h-0 relative">
        <Virtuoso
          ref={virtuosoRef}
          initialTopMostItemIndex={messages.length - 1}
          data={messages}
          startReached={loadPreviousMessages}
          components={{ Header: () => isFetchingMore ? <ChatSpinner /> : null }}
          itemContent={(index, message) => (
            <div className="px-4">
              <MessageItem 
                message={message} 
                conversation={conversation} 
                isHighlighted={message.id === highlightedMessageId}
                onImageClick={handleImageClick}
              />
            </div>
          )}
          followOutput="auto"
        />
        {filteredTypingUsers.length > 0 && (
          <div className="absolute bottom-2 left-4 flex items-center gap-2 bg-surface/80 backdrop-blur-sm text-text-secondary text-xs rounded-full px-3 py-1.5 shadow-lg animate-fade-in">
             <div className="flex gap-1 items-end h-4">
               <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></span>
               <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></span>
               <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
             </div>
             <span>typing...</span>
           </div>
        )}
      </div>
      <MessageInput onSend={handleSendMessage} onTyping={handleTyping} onFileChange={handleFileChange} />
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}