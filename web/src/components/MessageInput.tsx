import { useState, useEffect } from 'react'
import { useChatStore } from '@store/chat'
import { getSocket } from '@lib/socket'
import { useAuthStore } from '@store/auth'

export default function MessageInput({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState('')
  const sendMessage = useChatStore((s) => s.sendMessage)

  useEffect(() => {
    const socket = getSocket()
    return () => {
      socket.emit('typing', { conversationId, isTyping: false })
    }
  }, [conversationId])

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        sendMessage(conversationId, text)
        setText('')
      }}
    >
      <input
        aria-label="Message"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const socket = getSocket()
          socket.emit('typing', { conversationId, isTyping: !!e.target.value.trim() })
        }}
        className="flex-1 px-4 py-2 border rounded-full dark:bg-gray-800 dark:border-gray-700"
        placeholder="Type a message..."
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50"
        disabled={!text.trim()}
      >
        Send
      </button>
    </form>
  )
}