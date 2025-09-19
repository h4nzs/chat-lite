import { useAuthStore } from '@store/auth'
import { useChatStore } from '@store/chat'
import cls from 'classnames'
import type { Message } from '@store/chat'

interface ReactionsProps {
  message: Message
  onAddReaction: (emoji: string) => void
  onRemoveReaction: (emoji: string) => void
}

export default function Reactions({ message, onAddReaction, onRemoveReaction }: ReactionsProps) {
  const me = useAuthStore((s) => s.user?.id)
  
  // Common emojis for quick reactions
  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡']
  
  // Check if user has reacted with a specific emoji
  const hasReacted = (emoji: string) => {
    return message.reactions?.some(reaction => 
      reaction.emoji === emoji && reaction.userIds.includes(me || '')
    ) || false
  }
  
  // Get count of reactions for an emoji
  const getReactionCount = (emoji: string) => {
    const reaction = message.reactions?.find(reaction => reaction.emoji === emoji)
    return reaction ? reaction.userIds.length : 0
  }
  
  return (
    <div className="mt-1">
      {/* Display existing reactions */}
      <div className="flex flex-wrap gap-1 mb-1">
        {message.reactions?.map((reaction) => (
          <button
            key={reaction.emoji}
            onClick={() => 
              hasReacted(reaction.emoji) 
                ? onRemoveReaction(reaction.emoji) 
                : onAddReaction(reaction.emoji)
            }
            className={cls(
              'flex items-center text-xs px-2 py-1 rounded-full',
              hasReacted(reaction.emoji)
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            )}
          >
            <span className="mr-1">{reaction.emoji}</span>
            {reaction.userIds.length > 1 && (
              <span>{reaction.userIds.length}</span>
            )}
          </button>
        ))}
      </div>
      
      {/* Quick reaction buttons */}
      <div className="flex flex-wrap gap-1">
        {commonEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => 
              hasReacted(emoji) 
                ? onRemoveReaction(emoji) 
                : onAddReaction(emoji)
            }
            className={cls(
              'text-sm p-1 rounded',
              hasReacted(emoji)
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}