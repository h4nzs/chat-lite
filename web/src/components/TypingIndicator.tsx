import { useChatStore } from '../store/chat'

export default function TypingIndicator({ conversationId }: { conversationId: string }) {
  const typing = useChatStore((s) => s.typing[conversationId] || [])
  if (!typing.length) return null
  return <div className="text-sm text-gray-500">Someone is typing…</div>
}