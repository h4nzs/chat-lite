import * as Popover from '@radix-ui/react-popover';
import { useAuthStore } from '@store/auth';
import { Message } from '@store/chat';
import { api } from '@lib/api';

interface ReactionPopoverProps {
  message: Message;
  children: React.ReactNode; // Tombol pemicu
}

const COMMON_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export default function ReactionPopover({ message, children }: ReactionPopoverProps) {
  const meId = useAuthStore((s) => s.user?.id);

  const handleSelectReaction = async (emoji: string) => {
    const userReaction = message.reactions?.find(r => r.userId === meId);

    // Jika user sudah bereaksi, hapus reaksi lama dulu (jika emojinya beda)
    if (userReaction && userReaction.emoji !== emoji) {
      await api(`/api/messages/reactions/${userReaction.id}`, { method: 'DELETE' }).catch(console.error);
    }

    // Jika user mengklik emoji yang sama dengan reaksinya, hapus reaksi itu
    if (userReaction?.emoji === emoji) {
      await api(`/api/messages/reactions/${userReaction.id}`, { method: 'DELETE' }).catch(console.error);
    } else {
      // Tambah reaksi baru
      await api(`/api/messages/${message.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      }).catch(console.error);
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content 
          side="top" 
          align="center" 
          sideOffset={10}
          className="flex gap-2 bg-gray-800 border border-gray-700 rounded-full px-3 py-2 shadow-lg z-[99]"
        >
          {COMMON_EMOJIS.map(emoji => (
            <button 
              key={emoji} 
              onClick={() => handleSelectReaction(emoji)}
              className="text-2xl hover:scale-125 transition-transform duration-150 ease-in-out"
            >
              {emoji}
            </button>
          ))}
          <Popover.Arrow className="fill-current text-gray-700" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
