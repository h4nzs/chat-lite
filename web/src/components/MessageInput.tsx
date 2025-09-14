import { useState, useEffect } from 'react'
import { useChatStore } from '../store/chat'
import { getSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth'

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
          getSocket().emit('typing', { conversationId, isTyping: e.target.value.length > 0 })
        }}
        className="flex-1 p-2 border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
        placeholder="Type a message"
      />
      <button className="px-3 py-2 rounded bg-black text-white dark:bg-white dark:text-black" aria-label="Send">Send</button>
    </form>
  )
}