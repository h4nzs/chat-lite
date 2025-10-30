import { usePresenceStore } from '@store/presence';

export default function TypingIndicator({ conversationId }: { conversationId: string }) {
  const typing = usePresenceStore((s) => s.typing[conversationId] || []);
  if (!typing.length) return null
  return <div className="text-sm text-gray-500">Someone is typing…</div>
}