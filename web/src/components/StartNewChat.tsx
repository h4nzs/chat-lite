import { useEffect, useState } from 'react'
import { useChatStore } from '@store/chat'
import Alert from './Alert'
import { handleApiError } from '@lib/api'
import CreateGroupChat from './CreateGroupChat'

export default function StartNewChat({ onStarted }: { onStarted: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<{ id: string; username: string; name: string; avatarUrl?: string | null }[]>([])
  const [err, setErr] = useState('')
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const searchUsers = useChatStore(s => s.searchUsers)
  const startConversation = useChatStore(s => s.startConversation)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setList([])
        return
      }
      try {
        setErr('')
        const r = await searchUsers(q)
        setList(r)
      } catch (e) {
        setErr(handleApiError(e))
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, searchUsers])

  return (
    <div className="p-3 space-y-2">
      <div className="flex gap-2">
        <input 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          placeholder="Search users…" 
          className="flex-1 p-2 border rounded" 
        />
        <button
          onClick={() => setShowGroupModal(true)}
          className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          title="Create group chat"
        >
          +
        </button>
      </div>
      
      {err ? <Alert message={err} /> : null}
      
      <div className="space-y-1">
        {list.map(u => (
          <button 
            key={u.id} 
            disabled={loadingId === u.id}
            onClick={async () => {
              try {
                setLoadingId(u.id)
                const id = await startConversation(u.id)
                onStarted(id) // parent akan set activeId + openConversation
              } catch (e) {
                setErr(handleApiError(e))
              } finally {
                setLoadingId(null)
              }
            }} 
            className={`w-full text-left p-2 rounded transition ${
              loadingId === u.id
                ? 'bg-gray-200 dark:bg-gray-700 cursor-wait'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {u.name} <span className="text-gray-500">@{u.username}</span>
            {loadingId === u.id && <span className="ml-2 text-xs text-gray-400">Starting…</span>}
          </button>
        ))}
      </div>
      
      {showGroupModal && (
        <CreateGroupChat onClose={() => setShowGroupModal(false)} />
      )}
    </div>
  )
}
