// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { motion } from 'framer-motion';
import { FiX, FiEdit2 } from 'react-icons/fi';
import { useShallow } from 'zustand/react/shallow';
import { useMessageInputStore } from '@store/messageInput';
import type { Message } from '@store/conversation';

interface EditPreviewProps {
  // Optional: allow passing editingMessage directly, otherwise uses store
  editingMessage?: Message | null;
}

export function EditPreview({ editingMessage: externalEditingMessage }: EditPreviewProps) {
  const { editingMessage: storeEditingMessage, setEditingMessage } = useMessageInputStore(
    useShallow((state) => ({
      editingMessage: state.editingMessage,
      setEditingMessage: state.setEditingMessage,
    }))
  );

  const editingMessage = externalEditingMessage ?? storeEditingMessage;

  if (!editingMessage) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="px-4 pb-2"
    >
      <div className="relative flex items-center justify-between bg-bg-main rounded-t-xl p-3 border-b border-accent/20 shadow-neumorphic-concave">
        <div className="flex flex-col border-l-2 border-accent pl-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-accent flex items-center gap-1">
            <FiEdit2 size={10} /> Editing Message
          </span>
          <span className="text-xs text-text-secondary truncate max-w-[200px]">
            {editingMessage.content}
          </span>
        </div>
        <button
          onClick={() => setEditingMessage(null)}
          className="p-1 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors"
          aria-label="Cancel edit"
        >
          <FiX size={14} />
        </button>
      </div>
    </motion.div>
  );
}
