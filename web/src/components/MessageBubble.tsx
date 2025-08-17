import { useAuthStore } from '../store/auth'
import type { Message } from '../store/chat'
import cls from 'classnames'

export default function MessageBubble({ m }: { m: Message }) {
  const me = useAuthStore((s) => s.user?.id)
  const mine = m.senderId === me
  return (
    <div className={cls('max-w-[75%] rounded px-3 py-2', mine ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-gray-200 dark:bg-gray-800')}>
      {m.imageUrl ? <img src={m.imageUrl} alt="img" className="rounded" /> : null}
      {m.content}
    </div>
  )
}