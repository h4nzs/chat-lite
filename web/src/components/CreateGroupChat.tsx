import { useState, useEffect } from 'react'
import { useChatStore } from '@store/chat'
import { getSocket } from '@lib/socket'
import toast from 'react-hot-toast'

export default function CreateGroupChat({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const searchUsers = useChatStore(s => s.searchUsers)
  const [userList, setUserList] = useState<{ id: string; username: string; name: string; avatarUrl?: string | null }[]>([])

  useEffect(() => {
    if (searchQuery) {
      const timeoutId = setTimeout(() => {
        handleSearch(searchQuery)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setUserList([])
    }
  }, [searchQuery])

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setUserList([])
      return
    }
    try {
      const results = await searchUsers(query)
      // Filter out already selected users
      const filteredResults = results.filter(user => !selectedUsers.includes(user.id))
      setUserList(filteredResults)
    } catch (err) {
      toast.error('Failed to search users')
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleCreateGroup = async () => {
    if (!title.trim() || selectedUsers.length === 0) {
      toast.error('Please enter a group title and select at least one user')
      return
    }
    setLoading(true)
    
    // API call to create group
    try {
      // First, make API call to create the group
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/conversations/group`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          participantIds: selectedUsers
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create group')
      }

      const result = await response.json()
      
      // Update the conversation store with the new group
      useChatStore.setState({ activeId: result.id })
      await useChatStore.getState().openConversation(result.id)
      
      toast.success('Group created!')
      onClose()
    } catch (error: any) {
      console.error('Error creating group:', error)
      toast.error(error.message || 'Failed to create group')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Create Group Chat</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Group Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter group name"
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Add Members</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
          
          <div className="max-h-40 overflow-y-auto border rounded-lg dark:border-gray-700">
            {userList.map(user => (
              <div
                key={user.id}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                onClick={() => toggleUserSelection(user.id)}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold mr-2">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800 dark:text-white">{user.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</div>
                </div>
                {selectedUsers.includes(user.id) && (
                  <span className="text-green-500">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Selected Members</label>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.length === 0 ? (
              <span className="text-gray-500 text-sm">No members selected</span>
            ) : (
              selectedUsers.map(userId => {
                const user = userList.find(u => u.id === userId) || { name: 'Unknown', username: 'unknown' }
                return (
                  <div key={userId} className="flex items-center bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1">
                    <span className="text-sm">{user.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleUserSelection(userId)
                      }}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={loading || !title.trim() || selectedUsers.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
