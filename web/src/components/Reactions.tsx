import { useAuthStore } from '@store/auth';
import { useChatStore, Message } from '@store/chat';
import { api } from '@lib/api';

interface ReactionsProps {
  message: Message;
}

const COMMON_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export default function Reactions({ message }: ReactionsProps) {
  const meId = useAuthStore((s) => s.user?.id);

  const handleReaction = async (emoji: string) => {
    const existingReaction = message.reactions?.find(
      (r) => r.emoji === emoji && r.userIds.some(uid => uid === meId)
    );

    try {
      if (existingReaction) {
        // Untuk simplisitas, kita asumsikan satu user hanya bisa memberi satu reaksi per emoji.
        // Di DB, ini akan jadi record unik. Kita perlu ID reaksi untuk menghapus.
        // Logika ini perlu disempurnakan jika kita menyimpan ID reaksi di frontend.
        // Untuk saat ini, kita akan coba cari dan hapus.
        console.warn("Penghapusan reaksi belum diimplementasikan sepenuhnya di UI.");
      } else {
        await api(`/api/messages/${message.id}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        });
      }
    } catch (error) {
      console.error("Failed to update reaction:", error);
    }
  };

  // Kelompokkan userIds berdasarkan emoji
  const groupedReactions = message.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = { userIds: [], reactionIds: [] };
    }
    acc[reaction.emoji].userIds.push(reaction.userId);
    acc[reaction.emoji].reactionIds.push(reaction.id);
    return acc;
  }, {} as Record<string, { userIds: string[], reactionIds: string[] }>);

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {groupedReactions && Object.entries(groupedReactions).map(([emoji, { userIds, reactionIds }]) => {
        const userHasReacted = userIds.includes(meId || '');
        return (
          <button
            key={emoji}
            onClick={() => {
              if (userHasReacted) {
                // Ambil ID reaksi spesifik milik user ini
                const reactionIndex = message.reactions?.findIndex(r => r.emoji === emoji && r.userId === meId);
                if (reactionIndex !== -1 && message.reactions) {
                  const reactionId = message.reactions[reactionIndex].id;
                  api(`/api/messages/reactions/${reactionId}`, { method: 'DELETE' });
                }
              } else {
                handleReaction(emoji);
              }
            }}
            className={`px-2 py-0.5 rounded-full flex items-center gap-1 text-xs transition-transform duration-150 ease-in-out ${userHasReacted ? 'bg-blue-500/20 border border-blue-500 text-blue-800 dark:text-blue-300' : 'bg-gray-500/20 hover:bg-gray-500/30'}`}
          >
            <span>{emoji}</span>
            <span className="font-medium">{userIds.length}</span>
          </button>
        );
      })}
      {/* Placeholder untuk tombol tambah reaksi */}
      <button className="text-gray-400 hover:text-gray-200">⊕</button>
    </div>
  );
}
