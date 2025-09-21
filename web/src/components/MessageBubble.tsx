import { useAuthStore } from '@store/auth'
import type { Message } from '@store/chat'
import cls from 'classnames'
import { useChatStore } from '@store/chat'
import { Spinner } from './Spinner'
import { memo } from 'react'

function MessageBubble({ m }: { m: Message }) {
  const me = useAuthStore((s) => s.user?.id)
  const mine = m.senderId === me
  const activeId = useChatStore((s) => s.activeId)
  const conversations = useChatStore((s) => s.conversations)
  const deleteLoading = useChatStore((state) => state.deleteLoading[m.id])
  
  // Get conversation participants
  const conversation = conversations.find(c => c.id === activeId)
  const participants = conversation?.participants || []
  const otherParticipants = participants.filter(p => p.id !== me)
  
  // Check if content failed to decrypt
  const isDecryptionFailed = m.content && (
    m.content.includes('[Failed to decrypt') || 
    m.content.includes('[Invalid encrypted message]') ||
    m.content.includes('[Decryption key not available]')
  )
  
  // Check if message is read by other participants
  const isRead = mine && m.readBy && m.readBy.length > 0
  const readByCount = m.readBy ? m.readBy.length : 0
  
  return (
    <div className={cls('max-w-[75%] rounded px-3 py-2 relative', mine ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-gray-200 dark:bg-gray-800')}>
      {deleteLoading ? (
        <div className="flex items-center">
          <Spinner size="sm" />
          <span className="ml-2">Deleting...</span>
        </div>
      ) : m.imageUrl ? (
        <img src={m.imageUrl} alt="img" className="rounded" />
      ) : isDecryptionFailed ? (
        <div className="text-red-300 italic">
          <span className="font-semibold">Decryption Error:</span> This message could not be decrypted. It may have been corrupted or the encryption key is not available.
        </div>
      ) : (
        m.content
      )}
      
      {/* Read receipts */}
      {mine && isRead && (
        <div className="absolute -bottom-5 right-0 text-xs text-gray-500 flex items-center">
          <span className="mr-1">✓✓</span>
          {otherParticipants.length > 1 && readByCount > 0 && (
            <span>{readByCount}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(MessageBubble, (prevProps, nextProps) => {
  // Memoization untuk mencegah re-render yang tidak perlu
  return (
    prevProps.m.id === nextProps.m.id &&
    prevProps.m.content === nextProps.m.content &&
    prevProps.m.imageUrl === nextProps.m.imageUrl &&
    prevProps.m.senderId === nextProps.m.senderId
  )
})