import ChatList from '@components/ChatList'
import ChatWindow from '@components/ChatWindow'
import { useChatStore } from '@store/chat'
import { useAuthStore } from '@store/auth'
import StartNewChat from '@components/StartNewChat'
import { useEffect } from 'react'
import { usePushNotifications } from '@hooks/usePushNotifications'

export default function Chat() {
  const activeId = useChatStore(s => s.activeId)
  const loadConversations = useChatStore(s => s.loadConversations)
  const logout = useAuthStore(s => s.logout)

  // Load push notifications hook
  usePushNotifications()

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h1 className="font-bold text-xl">💬 ChatLite</h1>
        <button
          onClick={logout}
          className="text-sm text-red-500 hover:underline"
        >
          Logout
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-1/3 border-r flex flex-col min-h-0">
          <StartNewChat
            onStarted={id => {
              useChatStore.setState({ activeId: id })
              useChatStore.getState().openConversation(id)
            }}
          />
          <ChatList
            activeId={activeId}
            onOpen={(id) => {
              useChatStore.setState({ activeId: id })
              useChatStore.getState().openConversation(id)
            }}
          />
        </div>

        {/* Main Chat Window */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeId ? (
            <ChatWindow id={activeId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a chat or start a new one
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
