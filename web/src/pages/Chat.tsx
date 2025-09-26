import ChatList from '@components/ChatList'
import ChatWindow from '@components/ChatWindow'
import { useChatStore } from '@store/chat'
import { useAuthStore } from '@store/auth'
import StartNewChat from '@components/StartNewChat'
import { useEffect, useState } from 'react'
import { usePushNotifications } from '@hooks/usePushNotifications'

export default function Chat() {
  const activeId = useChatStore(s => s.activeId)
  const conversations = useChatStore(s => s.conversations)
  const loadConversations = useChatStore(s => s.loadConversations)
  const logout = useAuthStore(s => s.logout)
  const [showNewChat, setShowNewChat] = useState(false)
  const [loading, setLoading] = useState(true)

  usePushNotifications()

  // 📥 Load daftar percakapan
  useEffect(() => {
    setLoading(true)
    loadConversations().finally(() => setLoading(false))
  }, [loadConversations])

  // 🔄 Restore activeId dari localStorage
  useEffect(() => {
    if (!activeId) {
      const saved = localStorage.getItem("activeId")
      if (saved) {
        useChatStore.setState({ activeId: saved })
        useChatStore.getState().openConversation(saved)
      }
    }
  }, [activeId])

  // 🔥 Auto pilih conversation pertama setelah load selesai
  useEffect(() => {
    if (!loading) {
      if ((!activeId || !conversations.find(c => c.id === activeId)) && conversations.length > 0) {
        const firstId = conversations[0].id
        useChatStore.setState({ activeId: firstId })
        useChatStore.getState().openConversation(firstId)
      }
    }
  }, [loading, activeId, conversations])

  // ⬆️ Simpan activeId ke localStorage setiap berubah
  useEffect(() => {
    if (activeId) {
      localStorage.setItem("activeId", activeId)
    } else {
      localStorage.removeItem("activeId")
    }
  }, [activeId])

  return (
    <div className="h-screen flex flex-col">
      {/* 🔝 Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h1 className="font-bold text-xl">💬 ChatLite</h1>
        <button
          onClick={() => {
            localStorage.removeItem("activeId")
            logout()
          }}
          className="text-sm text-red-500 hover:underline"
        >
          Logout
        </button>
      </div>

      {/* 🔽 Main Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <div className={`border-r flex flex-col min-h-0 transition-all duration-300 ${activeId ? 'w-1/3' : 'w-full'}`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center gap-2 mb-3">
              <div className="font-semibold text-lg">Chats</div>
              <button
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
                onClick={() => setShowNewChat(prev => !prev)}
                title="New Chat"
              >
                + New
              </button>
            </div>

            {showNewChat ? (
              <StartNewChat
                onStarted={id => {
                  useChatStore.setState({ activeId: id })
                  useChatStore.getState().openConversation(id)
                  setShowNewChat(false)
                }}
              />
            ) : (
              <>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onFocus={() => setShowNewChat(true)}
                  />
                </div>
                <ChatList
                  activeId={activeId}
                  onOpen={(id) => {
                    if (!id) return
                    useChatStore.setState({ activeId: id })
                    useChatStore.getState().openConversation(id)
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Loading chats...
            </div>
          ) : activeId ? (
            <ChatWindow id={activeId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {showNewChat ? null : 'Select a chat to start messaging'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
