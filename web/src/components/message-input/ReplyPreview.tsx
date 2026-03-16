// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { useShallow } from 'zustand/react/shallow';
import { useMessageInputStore } from '@store/messageInput';
import { useUserProfile } from '@hooks/useUserProfile';
import { useAuthStore } from '@store/auth';
import type { Message } from '@store/conversation';

interface ReplyPreviewProps {
  // Optional: allow passing replyingTo directly, otherwise uses store
  replyingTo?: Message | null;
}

export function ReplyPreview({ replyingTo: externalReplyingTo }: ReplyPreviewProps) {
  const { replyingTo: storeReplyingTo, setReplyingTo } = useMessageInputStore(
    useShallow((state) => ({
      replyingTo: state.replyingTo,
      setReplyingTo: state.setReplyingTo,
    }))
  );

  const replyingTo = externalReplyingTo ?? storeReplyingTo;
  const profile = useUserProfile(replyingTo?.sender as unknown as { id: string; encryptedProfile?: string | null; isVerified?: boolean; publicKey?: string });
  const currentUser = useAuthStore((state) => state.user);

  if (!replyingTo) return null;

  const isMe = replyingTo.senderId === currentUser?.id;
  const authorName = isMe ? 'You' : (profile.name || 'Unknown');
  let contentPreview = '...';

  if (replyingTo.duration) {
    contentPreview = '[Voice Transmission]';
  } else if (replyingTo.fileName) {
    contentPreview = `[File: ${replyingTo.fileName}]`;
  } else if (replyingTo.fileUrl) {
    contentPreview = '[Attachment]';
  } else if (replyingTo.content) {
    contentPreview = replyingTo.content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="px-4 pb-2"
    >
      <div className="
        relative flex items-center justify-between
        bg-bg-main rounded-t-xl p-3 border-b border-accent/20
        shadow-neumorphic-concave
      ">
        <div className="flex flex-col border-l-2 border-accent pl-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-accent">
            Replying to {authorName}
          </span>
          <span className="text-xs text-text-secondary truncate max-w-[200px]">
            {contentPreview}
          </span>
        </div>
        <button
          onClick={() => setReplyingTo(null)}
          className="p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors"
          aria-label="Cancel reply"
        >
          <FiX size={14} />
        </button>
      </div>
    </motion.div>
  );
}
