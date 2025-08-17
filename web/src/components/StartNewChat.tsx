import { useEffect, useState } from 'react'
import { useChatStore } from '../store/chat'
import Alert from './Alert'
import { handleApiError } from '../lib/api'

export default function StartNewChat({ onStarted }: { onStarted: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<{ id: string; username: string; name: string; avatarUrl?: string | null }[]>([])
  const [err, setErr] = useState('')
  const searchUsers = useChatStore(s => s.searchUsers)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setList([]); return }
      try { setErr(''); const r = await searchUsers(q); setList(r) }
      catch (e) { setErr(handleApiError(e)) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, searchUsers])

  const start = useChatStore(s => s.startConversation)

  return (
    <div className="p-3 space-y-2">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users…" className="w-full p-2 border rounded" />
      {err ? <Alert message={err} /> : null}
      <div className="space-y-1">
        {list.map(u => (
          <button key={u.id} onClick={async () => { const id = await start(u.id); onStarted(id) }} className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            {u.name} <span className="text-gray-500">@{u.username}</span>
          </button>
        ))}
      </div>
    </div>
  )
}