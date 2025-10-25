import { useCallback, useRef, ChangeEvent, useState } from "react";
import { useAuthStore } from "@store/auth";
import { getSocket } from "@lib/socket";
import { Virtuoso } from "react-virtuoso";
import MessageItem from "@components/MessageItem";
import { useConversation } from "@hooks/useConversation";
import { Spinner } from "./Spinner";
import { useChatStore } from "@store/chat";
import { toAbsoluteUrl } from "@utils/url"; // Impor utilitas URL

// --- Komponen Terpisah --- 

const ChatHeader = ({ conversation }: { conversation: any }) => {
  const meId = useAuthStore(s => s.user?.id);
  const { presence, toggleSidebar } = useChatStore();
  const peer = !conversation.isGroup ? conversation.participants.find((p: any) => p.id !== meId) : null;
  const title = conversation.title || peer?.name || 'Chat';
  const isOnline = peer ? presence.includes(peer.id) : false;

  return (
    <div className="p-4 border-b border-gray-800 flex items-center gap-4 flex-shrink-0">
      <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-text-secondary hover:text-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <img src={toAbsoluteUrl(peer?.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${title}`} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-700 object-cover" />
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="text-xs text-text-secondary">{isOnline ? 'Active now' : 'Offline'}</p>
      </div>
    </div>
  );
};

const MessageInput = ({ onSend, onTyping, onFileChange }: { onSend: (text: string) => void; onTyping: () => void; onFileChange: (e: ChangeEvent<HTMLInputElement>) => void; }) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    onTyping();
  }

  return (
    <div className="p-4 border-t border-gray-800">
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
  );
};

export default function ChatWindow({ id }: { id: string }) {
  const meId = useAuthStore((s) => s.user?.id);
  const { conversation, messages, isLoading, error, sendMessage, uploadFile } = useConversation(id);
  const { typing } = useChatStore(); // Keep this for typing indicator

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

  const handleSendMessage = (text: string) => {
    sendMessage(text);
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
          initialTopMostItemIndex={messages.length - 1}
          data={messages}
          itemContent={(index, message) => (
            <div className="px-4">
              <MessageItem message={message} conversation={conversation} />
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
    </div>
  );
}
