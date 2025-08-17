import { useEffect, useState } from 'react'
import ChatList from '../components/ChatList'
import ChatWindow from '../components/ChatWindow'
import { useChatStore } from '../store/chat'
import { useAuthStore } from '../store/auth'
import StartNewChat from '../components/StartNewChat'

export default function Chat() {
  const [open, setOpen] = useState<string | null>(null)
  const [newChat, setNewChat] = useState(false)
  const loadConversations = useChatStore((s) => s.loadConversations)
  const logout = useAuthStore((s) => s.logout)
  useEffect(() => { loadConversations() }, [loadConversations])
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-56px)]">
      <aside className="border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
        <div className="p-3 flex justify-between items-center gap-2">
          <div className="font-semibold">Conversations</div>
          <div className="flex gap-2">
            <button className="text-sm underline" onClick={() => setNewChat(v => !v)}>Start new</button>
            <button className="text-sm underline" onClick={logout}>Sign out</button>
          </div>
        </div>
        {newChat ? (
          <StartNewChat onStarted={(id) => { setOpen(id); setNewChat(false) }} />
        ) : (
          <ChatList onOpen={(id) => setOpen(id)} />
        )}
      </aside>
      <main className="md:col-span-2 h-full">
        {open ? <ChatWindow id={open} /> : <div className="h-full grid place-items-center text-gray-500">Pick a conversation</div>}
      </main>
    </div>
  )
}