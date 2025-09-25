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
        console.log("Searching users with query:", q); // Debug log
        const r = await searchUsers(q)
        console.log("Search users result:", r); // Debug log
        setList(r)
      } catch (e) {
        setErr(handleApiError(e))
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, searchUsers])

  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input 
            value={q} 
            onChange={e => setQ(e.target.value)} 
            placeholder="Search users…" 
            className="w-full p-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
          <div className="absolute left-3 top-2.5 text-gray-400">🔍</div>
        </div>
        <button
          onClick={() => setShowGroupModal(true)}
          className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition flex items-center"
          title="Create group chat"
        >
          + Group
        </button>
      </div>
      
      {err ? <Alert message={err} /> : null}
      
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {list.length > 0 ? (
          list.map(u => (
            <button 
              key={u.id} 
              disabled={loadingId === u.id}
              onClick={async () => {
                try {
                  setLoadingId(u.id)
                  const id = await startConversation(u.id)

                  if (!id) {
                    throw new Error("Conversation ID kosong")
                  }

                  // ✅ Normalisasi supaya ID tidak undefined
                  const validId = String(id)
                  // Fix: Add guard for undefined/empty id
                  if (validId && validId !== "undefined" && validId !== "null") {
                    onStarted(validId) // parent akan set activeId + openConversation
                  } else {
                    console.warn("onStarted called with invalid id:", validId)
                  }
                } catch (e) {
                  setErr(handleApiError(e))
                } finally {
                  setLoadingId(null)
                }
              }} 
              className={`w-full text-left p-3 rounded-lg transition flex items-center ${
                loadingId === u.id
                  ? 'bg-gray-200 dark:bg-gray-700 cursor-wait'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold mr-3">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">{u.name}</div>
                <div className="text-sm text-gray-500">@{u.username}</div>
              </div>
              {loadingId === u.id && <span className="ml-2 text-xs text-gray-400">Starting…</span>}
            </button>
          ))
        ) : q.trim() ? (
          <div className="text-center py-4 text-gray-500">No users found</div>
        ) : (
          <div className="text-center py-4 text-gray-500">Type to search for users</div>
        )}
      </div>
      
      {showGroupModal ? (
        <CreateGroupChat onClose={() => setShowGroupModal(false)} />
      ) : null}
    </div>
  )
}
