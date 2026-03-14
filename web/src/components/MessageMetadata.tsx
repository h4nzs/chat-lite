import { useState, useEffect } from "react";
import clsx from 'clsx';
import { FiClock, FiEye, FiVolumeX } from "react-icons/fi";
import { FaCheck, FaCheckDouble } from "react-icons/fa";
import { formatTime } from "@utils/date";
import { useMessageStore } from "@store/message";
import { useAuthStore } from "@store/auth";
import type { Message, MessageStatus } from "@store/conversation";

interface MessageMetadataProps {
  message: Message;
  isOwn: boolean;
  isImage: boolean;
  isDeleted: boolean;
}

export default function MessageMetadata({ message, isOwn, isImage, isDeleted }: MessageMetadataProps) {
  const user = useAuthStore(state => state.user);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!message.expiresAt || message.deletedAt) {
      setTimeLeft(null);
      return;
    }

    const checkExpiration = () => {
      const expireTime = new Date(message.expiresAt!).getTime();
      const now = Date.now();
      const diff = expireTime - now;

      if (diff <= 0) {
        useMessageStore.getState().removeMessage(message.conversationId, message.id);
        setTimeLeft(null);
      } else {
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        if (hours > 0) {
           setTimeLeft(`${hours}h ${minutes}m`);
        } else if (minutes > 0) {
           setTimeLeft(`${minutes}m ${seconds}s`);
        } else {
           setTimeLeft(`${seconds}s`);
        }
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 1000);
    return () => clearInterval(interval);
  }, [message.expiresAt, message.deletedAt, message.id, message.conversationId]);

  const getStatusIcon = () => {
    if (!isOwn) return null;
    const statuses = message.statuses || [];
    
    // Logic from original code: check if read by ANYONE other than self
    const readCount = statuses.filter((s: MessageStatus) => s.status === 'READ' && s.userId !== user?.id).length;
    const deliveredCount = statuses.filter((s: MessageStatus) => s.status === 'DELIVERED').length;

    // Restore green color for Read status
    if (readCount > 0) return <FaCheckDouble size={14} className="text-green-400" />;
    if (deliveredCount > 0) return <FaCheckDouble size={14} className="text-white/70" />;
    return <FaCheck size={14} className="text-white/70" />;
  };

  return (
    <div className={clsx("text-xs mt-1.5 flex items-center gap-1.5 select-none", {
      "absolute bottom-2 right-2 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded text-white shadow-sm": isImage && !message.content,
      "justify-end": !isImage || message.content,
      "text-white/80": isOwn && (!isImage || message.content), // Fix contrast for own messages
      "text-text-secondary/80": !isOwn && (!isImage || message.content)
    })}>
      {message.isViewOnce && <FiEye size={12} className="opacity-70" />}
      {message.isSilent && <FiVolumeX size={12} className="opacity-60 text-text-secondary" title="Sent Silently" />}
      {timeLeft && (
        <span className="flex items-center gap-1 text-[9px] font-bold text-red-500 bg-red-500/10 px-1 rounded animate-pulse mr-1">
          <FiClock size={10} /> {timeLeft}
        </span>
      )}
      <span className="text-[10px] font-medium tracking-wide opacity-90">{formatTime(message.createdAt)}</span>
      {message.isEdited && <span className="opacity-70 italic text-[10px]">(edited)</span>}
      {isOwn && !isDeleted && getStatusIcon()}
    </div>
  );
}
