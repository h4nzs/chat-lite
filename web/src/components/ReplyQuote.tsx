import { useUserProfile } from '@hooks/useUserProfile';
import { useAuthStore } from '@store/auth';
import MarkdownMessage from './MarkdownMessage';
import type { Message } from '@store/conversation';

export default function ReplyQuote({ message }: { message: Message }) {
  const profile = useUserProfile(message.sender as unknown as { id: string; encryptedProfile?: string | null; isVerified?: boolean; publicKey?: string });
  const currentUser = useAuthStore.getState().user;
  const isMe = message.senderId === currentUser?.id;
  const authorName = isMe ? 'You' : (profile.name || 'Unknown');
  
  let contentPreview: string;
  if (message.duration) contentPreview = 'Voice Message';
  else if (message.fileName) contentPreview = message.fileName;
  else if (message.fileUrl) contentPreview = 'File';
  else contentPreview = message.content || '...';
  
  return (
    <div className="mb-1.5 p-2 rounded-lg bg-black/20 border-l-4 border-accent/50">
      <p className="text-xs font-bold text-accent/80">{authorName}</p>
      <div className="text-text-primary/70 truncate text-sm">
        <MarkdownMessage content={contentPreview} />
      </div>
    </div>
  );
}
