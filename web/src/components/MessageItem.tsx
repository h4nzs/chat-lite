import { memo, useEffect, useRef } from "react";
import type { Message, Conversation } from "@store/chat";
import { useAuthStore } from "@store/auth";
import { useChatStore } from "@store/chat";
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api } from "@lib/api";
import ReactionPopover from "./Reactions";
import { getSocket } from "@lib/socket";
import { toAbsoluteUrl } from "@utils/url";

const MessageStatusIcon = ({ message, conversation }: { message: Message; conversation: Conversation | undefined }) => {
  const meId = useAuthStore((s) => s.user?.id);

  if (message.senderId !== meId) return null;
  if (message.error) {
    return <svg title="Failed to send" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>;
  }
  if (message.optimistic) {
    return <svg title="Sending..." xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>;
  }

  const otherParticipants = conversation?.participants.filter(p => p.id !== meId) || [];
  // Jika tidak ada peserta lain (misalnya, chat dengan diri sendiri), anggap saja terkirim.
  if (otherParticipants.length === 0) {
    return <svg title="Sent" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
  }

  const statuses = message.statuses || [];
  const isReadAll = otherParticipants.every(p => 
    statuses.some(s => s.userId === p.id && s.status === 'READ')
  );

  if (isReadAll) {
    return <svg title="Read by all" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F86F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
  }

  // Default: Tampilkan centang satu jika belum dibaca semua
  return <svg title="Sent" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
};

const MessageBubble = ({ message, mine, conversation }: { message: Message; mine: boolean; conversation: Conversation | undefined }) => {
  const hasContent = message.content && message.content.trim().length > 0 && message.content !== "[This message was deleted]";

  return (
    <div className={`relative max-w-md md:max-w-lg px-4 py-2.5 rounded-2xl shadow-sm ${mine ? 'bg-gradient-to-r from-accent to-magenta text-white' : 'bg-primary text-text-primary'}`}>
      {hasContent ? (
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      ) : (
        <p className="italic text-gray-400">File attachment</p>
      )}
      <div className="text-xs text-right mt-1 opacity-60 flex items-center justify-end gap-1.5">
        <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <MessageStatusIcon message={message} conversation={conversation} />
      </div>
    </div>
  );
};

const ReactionsDisplay = ({ reactions }: { reactions: Message['reactions'] }) => {
  if (!reactions || reactions.length === 0) return null;
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex gap-1 mt-1.5">
      {Object.entries(grouped).map(([emoji, count]) => (
        <span key={emoji} className="px-2 py-0.5 rounded-full bg-primary/80 text-white text-xs cursor-default">
          {emoji} {count > 1 ? count : ''}
        </span>
      ))}
    </div>
  );
};

interface MessageItemProps {
  message: Message;
  conversation: Conversation | undefined;
}

const MessageItem = ({ message, conversation }: MessageItemProps) => {
  const meId = useAuthStore((s) => s.user?.id);
  const mine = message.senderId === meId;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || mine) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const alreadyRead = message.statuses?.some(s => s.userId === meId && s.status === 'READ');
        const shouldSendReceipt = useAuthStore.getState().sendReadReceipts;

        if (!alreadyRead && shouldSendReceipt) {
          getSocket().emit('message:mark_as_read', { 
            messageId: message.id, 
            conversationId: message.conversationId 
          });
        }
        observer.disconnect();
      }
    }, { threshold: 0.8 });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [message.id, message.conversationId, mine, meId, message.statuses]);

  const handleDelete = () => {
    if (window.confirm("Are you sure?")) {
      api(`/api/messages/${message.id}`, { method: 'DELETE' }).catch(console.error);
    }
  };

  if (message.content === "[This message was deleted]") {
    return (
      <div ref={ref} className={`flex items-center p-2 ${mine ? 'justify-end' : 'justify-start'}`}>
        <p className="text-xs italic text-text-secondary">This message was deleted</p>
      </div>
    );
  }

  return (
    <div ref={ref} className={`group flex items-end gap-2 p-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && <img src={toAbsoluteUrl(message.sender?.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${message.sender?.name || 'U'}`} alt="Avatar" className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 mb-6 object-cover" />}
      
      <div className={`flex items-center gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="flex flex-col">
          <MessageBubble message={message} mine={mine} conversation={conversation} />
          <ReactionsDisplay reactions={message.reactions} />
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="p-1.5 rounded-full hover:bg-primary">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 12a2 2 0 110-4 2 2 0 010 4zm0-6a2 2 0 110-4 2 2 0 010 4z" /></svg>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={5} align="center" className="min-w-[150px] bg-surface border border-gray-700 rounded-md shadow-lg z-50 p-1">
                <ReactionPopover message={message}>
                  <div className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded cursor-pointer outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a.75.75 0 01.028.022l.028.027a.75.75 0 01.027.028l.027.028a.75.75 0 01.022.028l.022.028a.75.75 0 01.016.023l.016.023a.75.75 0 01.01.016l.01.016c.004.005.007.01.01.015l.004.005a.75.75 0 01.005.004l.005.004a.75.75 0 01.002.002l.002.002a.75.75 0 010 .004c0 .001 0 .002 0 .002a.75.75 0 01-.004 0l-.002-.002a.75.75 0 01-.005-.004l-.005-.004a.75.75 0 01-.01-.015l-.01-.016a.75.75 0 01-.016-.023l-.016-.023a.75.75 0 01-.022-.028l-.022-.028a.75.75 0 01-.027-.028l-.027-.028a.75.75 0 01-.028-.022l-.028-.027a.75.75 0 01-.022-.028l-.022-.028a.75.75 0 01-.016-.023l-.016-.023a.75.75 0 01-.01-.016l-.01-.016a.75.75 0 01-.005-.004l-.005-.004a.75.75 0 01-.002-.002l-.002-.002a.75.75 0 010-.004c.09.34.26.65.49.93a.75.75 0 01-1.06 1.06 5.25 5.25 0 00-1.5 3.75.75.75 0 01-1.5 0 6.75 6.75 0 011.94-4.71.75.75 0 011.06-1.06z" clipRule="evenodd" /></svg>
                    React
                  </div>
                </ReactionPopover>
                {mine && (
                  <DropdownMenu.Item onSelect={handleDelete} className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white rounded cursor-pointer outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                    Delete Message
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
};

export default memo(MessageItem);
