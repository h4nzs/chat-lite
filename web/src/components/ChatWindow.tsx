import { useEffect, useState, useRef, useCallback, ChangeEvent } from "react";
import { useChatStore } from "@store/chat";
import { useAuthStore } from "@store/auth";
import { getSocket } from "@lib/socket";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import MessageItem from "@components/MessageItem";

// --- Komponen Terpisah untuk menjaga kebersihan --- 

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
      <img src={peer?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${title}`} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-700" />
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="text-xs text-text-secondary">{isOnline ? 'Active now' : 'Offline'}</p>
      </div>
    </div>
  );
};

const MessageInput = ({ onSend, onTyping }: { onSend: (text: string) => void; onTyping: () => void; }) => {
  const [text, setText] = useState('');

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

// --- Komponen Utama --- 

export default function ChatWindow({ id }: { id: string }) {
  const meId = useAuthStore((s) => s.user?.id);
  const {
    messages,
    sendMessage,
    conversations,
    typing,
    loadMessagesForConversation,
  } = useChatStore();

  const conversation = conversations.find(c => c.id === id);
  const activeMessages = messages[id] || [];
  const typingUsers = typing[id] || [];
  const filteredTypingUsers = typingUsers.filter(uid => uid !== meId);

  const listRef = useRef<List>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id) loadMessagesForConversation(id);
  }, [id, loadMessagesForConversation]);

  useEffect(() => {
    if (activeMessages.length > 0) {
      listRef.current?.scrollToItem(activeMessages.length - 1, 'end');
    }
  }, [activeMessages.length]);

  const handleTyping = useCallback(() => {
    const socket = getSocket();
    socket.emit("typing:start", { conversationId: id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId: id });
    }, 1500);
  }, [id]);

  const handleSendMessage = (text: string) => {
    sendMessage(id, { content: text });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    getSocket().emit("typing:stop", { conversationId: id });
  };

  if (!conversation) {
    return <div className="flex-1 flex items-center justify-center text-text-secondary"><p>Loading conversation...</p></div>;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader conversation={conversation} />
      <div className="flex-1 min-h-0 relative">
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              height={height}
              itemCount={activeMessages.length}
              itemSize={120} // Estimasi tinggi, bisa disesuaikan
              width={width}
            >
              {({ index, style }) => (
                <div style={style}>
                  <MessageItem message={activeMessages[index]} />
                </div>
              )}
            </List>
          )}
        </AutoSizer>
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
      <MessageInput onSend={handleSendMessage} onTyping={handleTyping} />
    </div>
  );
}