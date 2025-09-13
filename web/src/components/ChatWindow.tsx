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
  const uploadFile = useChatStore(s => (s as any).uploadFile)
  const deleteMessage = useChatStore(s => s.deleteMessage)
  const messages = useChatStore(s => s.messages[id] || [])
  const openConversation = useChatStore(s => s.openConversation)
  const loadOlderMessages = useChatStore(s => s.loadOlderMessages)
  const typingUsers = useChatStore(s => s.typing[id] || [])
  const loadingMessages = useChatStore(s => (s as any).loading?.[id] ?? false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  useEffect(() => {
    openConversation(id)
  }, [id, openConversation])

  // auto scroll + infinite scroll
  useEffect(() => {
    const el = listRef.current
    if (!el) return

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
    setShowScrollButton(!nearBottom)

    if (el.scrollTop === 0 && !loadingOlder) {
      setLoadingOlder(true)
      ;(async () => {
        try {
          await loadOlderMessages(id)
        } catch {
          toast.error('Gagal memuat pesan lama')
        } finally {
          setLoadingOlder(false)
        }
      })()
    }
  }, [id, loadingOlder, loadOlderMessages])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el || loadingOlder) return

    if (el.scrollTop < 50) {
      setLoadingOlder(true)
      loadOlderMessages(id).finally(() => setLoadingOlder(false))
    }
  }, [id, loadingOlder, loadOlderMessages])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return

    const tempId = Date.now()
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
    <div className="flex flex-col h-full min-h-0 relative">
      {/* AREA PESAN */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
      >
        {loadingOlder && (
          <div className="text-center text-gray-400 text-sm py-2">Loading older...</div>
        )}

        {loadingMessages ? (
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
              const isMe = m.senderId === meId
              return (
                <div
                  key={m.tempId || m.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[70%] px-4 py-2 rounded-2xl text-sm shadow-md break-words
                      ${isMe
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-br-none'
                        : 'bg-gradient-to-r from-red-500 to-blue-500 text-white rounded-bl-none'
                      }
                    `}
                  >
                    {/* TEXT */}
                    {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}

                    {/* IMAGE PREVIEW */}
                    {(m.imageUrl || (m.fileUrl && /\.(png|jpe?g|gif|webp)$/i.test(m.fileUrl))) && (
                      <img
                        src={
                          (m.imageUrl || m.fileUrl)!.startsWith('http')
                            ? (m.imageUrl || m.fileUrl)!
                            : `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${m.imageUrl || m.fileUrl}`
                        }
                        alt={m.fileName || 'uploaded'}
                        className="max-w-[220px] rounded-md mt-2 shadow-sm cursor-pointer hover:opacity-90 transition"
                        onClick={() => window.open(
                          (m.imageUrl || m.fileUrl)!.startsWith('http')
                            ? (m.imageUrl || m.fileUrl)!
                            : `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${m.imageUrl || m.fileUrl}`,
                          '_blank'
                        )}
                      />
                    )}

                    {/* FILE ATTACHMENT */}
                    {m.fileUrl && !m.imageUrl && (
                      <a
                        href={
                          m.fileUrl.startsWith('http')
                            ? m.fileUrl
                            : `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${m.fileUrl}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm underline mt-2 hover:opacity-80"
                      >
                        📎 {m.fileName || 'Download file'}
                      </a>
                    )}

                    {/* ERROR STATE */}
                    {m.error && <p className="text-xs text-red-300 mt-1">Failed to send</p>}

                    {/* TIMESTAMP + DELETE BUTTON */}
                    <div className="flex justify-between items-center mt-1 text-[10px] opacity-70">
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {isMe && !m.error && m.id && (
                        <button
                          onClick={async () => {
                            // 🔥 Optimistic delete
                            const original = { ...m }
                            useChatStore.setState(s => ({
                              messages: {
                                ...s.messages,
                                [id]: (s.messages[id] || []).map(msg =>
                                  msg.id === m.id
                                    ? { ...msg, content: '[deleting…]' }
                                    : msg
                                )
                              }
                            }))

                            try {
                              await deleteMessage(id, m.id)
                            } catch {
                              toast.error('Gagal menghapus pesan')
                              // rollback
                              useChatStore.setState(s => ({
                                messages: {
                                  ...s.messages,
                                  [id]: (s.messages[id] || []).map(msg =>
                                    msg.id === original.id ? original : msg
                                  )
                                }
                              }))
                            }
                          }}
                          className="ml-2 text-xs text-red-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="border-t shrink-0">
        {typingUsers.length > 0 && (
          <div className="px-3 py-1 text-sm text-gray-500 border-b">
            {typingUsers.length === 1
              ? 'Someone is typing...'
              : `${typingUsers.length} people are typing...`}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="p-3 flex gap-2 items-center bg-white/60 dark:bg-gray-800/50 backdrop-blur-md shadow-inner rounded-t-xl"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            aria-label="Upload file"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              if (e.target.files?.[0]) {
                try {
                  await uploadFile(id, e.target.files[0])
                } catch {
                  toast.error('Upload gagal')
                }
                e.target.value = ''
              }
            }}
          />

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
            className="flex-1 p-2 rounded-full border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold shadow hover:opacity-90 transition"
          >
            Send
          </button>
        </form>
      </div>

      {showScrollButton && (
        <button
          onClick={() => {
            if (listRef.current) {
              listRef.current.scrollTo({
                top: listRef.current.scrollHeight,
                behavior: 'smooth',
              })
            }
            setShowScrollButton(false)
          }}
          className="absolute bottom-20 right-6 p-2 rounded-full shadow-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90 transition"
          aria-label="Scroll to bottom"
        >
          ⬇️
        </button>
      )}
    </div>
  )
}