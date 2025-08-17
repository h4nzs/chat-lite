import { useEffect, useState, useRef } from 'react'
import { useChatStore } from '../store/chat'

export default function ChatWindow({ id }: { id: string }) {
  const [text, setText] = useState('')
  const sendMessage = useChatStore(s => s.sendMessage)
  const uploadImage = useChatStore(s => s.uploadImage)
  const messages = useChatStore(s => s.messages[id] || [])
  const openConversation = useChatStore(s => s.openConversation)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // buka percakapan dan load pesan saat component mount / id berubah
  useEffect(() => {
    openConversation(id)
  }, [id, openConversation])

  return (
    <div className="flex flex-col h-full">
      {/* AREA PESAN */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(m => (
          <div key={m.id} className="mb-2">
            {m.content ? <p>{m.content}</p> : null}
            {m.imageUrl ? (
              <img
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${m.imageUrl}`}
                alt="uploaded"
                className="max-w-xs rounded border"
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* FORM INPUT */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) {
            sendMessage(id, text)
            setText('')
          }
        }}
        className="p-2 border-t flex gap-2"
      >
        {/* tombol upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2"
          aria-label="Upload image"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            if (e.target.files?.[0]) {
              try {
                await uploadImage(id, e.target.files[0])
              } catch {
                alert('Upload gagal')
              }
              e.target.value = '' // reset input
            }
          }}
        />

        {/* input pesan */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          className="flex-1 p-2 border rounded"
        />

        <button type="submit" className="px-4 bg-blue-600 text-white rounded">
          Send
        </button>
      </form>
    </div>
  )
}