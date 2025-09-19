import { useState } from 'react'
import { useChatStore } from '@store/chat'
import { getSocket } from '@lib/socket'
import toast from 'react-hot-toast'

export default function CreateGroupChat({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const searchUsers = useChatStore(s => s.searchUsers)
  const [userList, setUserList] = useState<{ id: string; username: string; name: string }[]>([])

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setUserList([])
      return
    }
    try {
      const results = await searchUsers(query)
      setUserList(results)
    } catch (err) {
      toast.error('Failed to search users')
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleCreateGroup = () => {
    if (!title.trim() || selectedUsers.length === 0) return
    setLoading(true)
    const socket = getSocket()
    socket.emit(
      'group:create',
      { title: title.trim(), participantIds: selectedUsers },
      (ack: { ok: boolean; id?: string; error?: string }) => {
        setLoading(false)
        if (!ack?.ok || !ack.id) {
          toast.error(ack?.error || 'Failed to create group')
          return
        }
        useChatStore.setState({ activeId: ack.id })
        useChatStore.getState().openConversation(ack.id)
        toast.success('Group created!')
        onClose()
      }
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {/* sama seperti kode sebelumnya */}
      {/* ... */}
    </div>
  )
}
