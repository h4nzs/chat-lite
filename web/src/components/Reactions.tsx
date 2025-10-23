import { useAuthStore } from '@store/auth';
import { Message } from '@store/chat';
import { api } from '@lib/api';
import { useState } from 'react';

interface ReactionsProps {
  message: Message;
}

const COMMON_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export default function Reactions({ message }: ReactionsProps) {
  const meId = useAuthStore((s) => s.user?.id);
  const [showPicker, setShowPicker] = useState(false);

  // Kelompokkan reaksi untuk mendapatkan ID yang benar saat menghapus
  const userReaction = message.reactions?.find(r => r.userId === meId);

  const handleReaction = async (emoji: string) => {
    // Jika user sudah bereaksi dengan emoji yang sama, hapus reaksi itu.
    if (userReaction?.emoji === emoji) {
      try {
        await api(`/api/messages/reactions/${userReaction.id}`, { method: 'DELETE' });
      } catch (error) {
        console.error("Failed to remove reaction:", error);
      }
    } else {
      // Jika user bereaksi dengan emoji lain, atau belum bereaksi, buat reaksi baru.
      // (Backend akan menangani logika upsert jika diperlukan)
      try {
        await api(`/api/messages/${message.id}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        });
      } catch (error) {
        console.error("Failed to add reaction:", error);
      }
    }
    setShowPicker(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowPicker(!showPicker)}
        className="p-1.5 rounded-full bg-gray-600 hover:bg-gray-500 text-white transition-colors"
      >
        😊
      </button>

      {showPicker && (
        <div className="absolute bottom-full mb-2 flex gap-2 bg-gray-800 border border-gray-700 rounded-full p-2 shadow-lg">
          {COMMON_EMOJIS.map(emoji => (
            <button 
              key={emoji} 
              onClick={() => handleReaction(emoji)}
              className="text-xl hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}