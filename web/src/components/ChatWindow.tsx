import { useEffect, useState, useRef, useCallback } from 'react'
import { useChatStore } from '../store/chat'
import { useAuthStore } from '../store/auth'
import { getSocket } from '../lib/socket'
import toast from 'react-hot-toast'

export default function ChatWindow({ id }: { id: string }) {
  const [text, setText] = useState('')
  const [loadingOlder, setLoadingOlder] = useState(false)

  const meId = useAuthStore(s => s.user?.id)
  const sendMessage = useChatStore(s => s.sendMessage)
  const uploadImage = useChatStore(s => s.uploadImage)
  const messages = useChatStore(s => s.messages[id] || [])
  const openConversation = useChatStore(s => s.openConversation)
  const loadOlderMessages = useChatStore(s => s.loadOlderMessages)
  const typingUsers = useChatStore(s => s.typing[id] || [])

  // kalau kamu sudah menambahkan flag loading di store (sesuai patch),
  // baris ini akan aman; kalau belum, nilainya fallback ke false.
  const loadingMessages = useChatStore(s => (s as any).loading?.[id] ?? false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // buka percakapan dan load pesan saat id berubah
  useEffect(() => {
    openConversation(id)
  }, [id, openConversation])

  // scroll ke bawah saat pesan baru datang
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  // handler untuk infinite scroll (ambil older saat scrollTop = 0)
  const handleScroll = useCallback(async () => {
    const el = listRef.current
    if (!el) return
    if (el.scrollTop === 0 && !loadingOlder) {
      setLoadingOlder(true)
      try {
        // Versi store terbaru pakai cursor -> cukup panggil tanpa argumen
        await loadOlderMessages(id)
      } catch {
        toast.error('Gagal memuat pesan lama')
      } finally {
        setLoadingOlder(false)
      }
    }
  }, [id, loadingOlder, loadOlderMessages])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return

    const tempId = Date.now()
    // optimistic message (lengkapi field biar aman di TS)
    useChatStore.getState().addOptimisticMessage(id, {
      id: '',
      tempId,
      conversationId: id,
      senderId: meId || 'me',
      content,
      createdAt: new Date().toISOString()
    })

    setText('')
    const socket = getSocket()
    socket.emit('typing', { conversationId: id, isTyping: false })

    try {
      await sendMessage(id, content, tempId)
    } catch {
      toast.error('Pesan gagal dikirim')
      useChatStore.getState().markMessageError(id, tempId)
    }
  }, [id, text, sendMessage])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* AREA PESAN: hanya bagian ini yang scroll */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
      >
        {loadingOlder && (
          <div className="text-center text-gray-400 text-sm">Loading...</div>
        )}

        {loadingMessages ? (
          // Bubble skeleton (dibungkus PENUH agar JSX tertutup rapi)
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2 max-w-[70%] h-6 w-[60%] ${
                    i % 2 === 0
                      ? 'bg-gray-300 dark:bg-gray-700'
                      : 'bg-blue-300 dark:bg-blue-700'
                  }`}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            {messages.map(m => {
  const isMe = m.senderId === meId // nanti ganti dengan user?.id
  return (
    <div
      key={m.tempId || m.id}
      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`
          max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow
          ${isMe
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'}
        `}
      >
        {/* isi pesan text */}
        {m.content && <p>{m.content}</p>}

        {/* isi pesan image */}
        {m.imageUrl && (
          <img
            src={
              m.imageUrl.startsWith('http')
                ? m.imageUrl
                : `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${m.imageUrl}`
            }
            alt="uploaded"
            className="max-w-[200px] rounded-md mt-1"
          />
        )}

        {/* error info */}
        {m.error && (
          <p className="text-xs text-red-300 mt-1">Failed to send</p>
        )}

        {/* timestamp */}
        <div className="text-[10px] opacity-70 mt-1 text-right">
          {new Date(m.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  )
})}

          </>
        )}
      </div>

      {/* FOOTER: typing indicator + form input (tetap di bawah, tidak ikut scroll) */}
      <div className="border-t shrink-0">
        {typingUsers.length > 0 && (
          <div className="px-3 py-1 text-sm text-gray-500 border-b">
            {typingUsers.length === 1
              ? 'Someone is typing...'
              : `${typingUsers.length} people are typing...`}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-2 flex gap-2">
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
                  toast.error('Upload gagal')
                }
                e.target.value = ''
              }
            }}
          />

          {/* input pesan */}
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              const socket = getSocket()
              socket.emit('typing', { conversationId: id, isTyping: true })
              clearTimeout((window as any).typingTimer)
              ;(window as any).typingTimer = setTimeout(() => {
                socket.emit('typing', { conversationId: id, isTyping: false })
              }, 1000)
            }}
            placeholder="Type a message"
            className="flex-1 p-2 border rounded"
          />

          <button type="submit" className="px-4 bg-blue-600 text-white rounded">
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
