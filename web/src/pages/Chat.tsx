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
    <div className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-56px)] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="border-r border-gray-200 dark:border-gray-800 flex flex-col backdrop-blur-md bg-white/60 dark:bg-gray-800/40">
        <div className="p-4 flex justify-between items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          <div className="font-semibold text-lg">Conversations</div>
          <div className="flex gap-2">
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline" onClick={() => setNewChat(v => !v)}>New</button>
            <button className="text-sm text-red-600 dark:text-red-400 hover:underline" onClick={logout}>Logout</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {newChat ? (
            <StartNewChat onStarted={(id) => { setOpen(id); setNewChat(false) }} />
          ) : (
            <ChatList onOpen={(id) => setOpen(id)} activeId={open} />
          )}
        </div>
      </aside>

      {/* Chat Window */}
      <main className="md:col-span-2 flex flex-col h-full min-h-0">
        {open ? (
          <ChatWindow id={open} />
        ) : (
          <div className="flex-1 grid place-items-center text-gray-400">
            Pick a conversation
          </div>
        )}
      </main>
    </div>
  )
}