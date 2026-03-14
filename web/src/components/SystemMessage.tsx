import clsx from 'clsx';
import { FiLock, FiPaperclip, FiRefreshCw, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import { useMessageStore } from '@store/message';
import type { Message } from '@store/conversation';

interface SystemMessageProps {
  message: Message;
  isGroup: boolean;
}

export default function SystemMessage({ message, isGroup }: SystemMessageProps) {
  const getSystemIcon = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('encrypt') || lowerText.includes('decrypt') || lowerText.includes('key')) return <FiLock size={12} className="text-emerald-500" />;
    if (lowerText.includes('file') || lowerText.includes('attachment')) return <FiPaperclip size={12} className="text-blue-400" />;
    if (lowerText.includes('restart') || lowerText.includes('sync')) return <FiRefreshCw size={12} className="text-blue-500" />;
    if (lowerText.includes('error') || lowerText.includes('failed')) return <FiAlertTriangle size={12} className="text-red-500" />;
    return <FiInfo size={12} className="text-text-secondary" />;
  };

  const isError = message.content?.includes('Error') || message.content?.includes('Unreadable') || message.content?.includes('Key out of sync');
  const isDesyncError = message.content?.includes('Key out of sync');

  return (
    <div className="flex justify-center my-4 w-full">
      <div className="flex flex-col items-center gap-2">
        <div className={clsx(
          "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium shadow-neu-pressed-dark border border-white/5",
          isError 
            ? "bg-red-500/10 text-red-500" 
            : "bg-black/20 text-text-secondary"
        )}>
          {getSystemIcon(message.content || '')}
          <span>{message.content}</span>
        </div>
        
        {isDesyncError && (
            <button 
                onClick={() => useMessageStore.getState().repairSecureSession(message.conversationId, isGroup)}
                className="text-[10px] text-blue-500 hover:text-blue-400 font-bold bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wide"
            >
                Repair Session
            </button>
        )}
      </div>
    </div>
  );
}
