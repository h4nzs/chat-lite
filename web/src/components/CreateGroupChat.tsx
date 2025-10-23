import { useState, useEffect } from 'react';
import { useChatStore } from '@store/chat';
import { useAuthStore } from '@store/auth';
import { api } from '@lib/api';
import toast from 'react-hot-toast';

export default function CreateGroupChat({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userList, setUserList] = useState<{ id: string; username: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const me = useAuthStore(s => s.user);

  // Fungsi untuk mencari pengguna
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setUserList([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        // FIX: API mengembalikan array langsung, bukan objek { users: [...] }
        const results = await api<any[]>(`/api/users/search?q=${searchQuery}`);
        // Filter diri sendiri dan user yang sudah dipilih
        setUserList(results.filter(u => u.id !== me?.id && !selectedUsers.includes(u.id)));
      } catch (error) {
        toast.error("Failed to search users.");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, me?.id, selectedUsers]);

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!title.trim() || selectedUsers.length === 0) {
      return toast.error("Group name and at least one member are required.");
    }
    setLoading(true);
    try {
      const newConversation = await api<any>("/api/conversations/group", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          participantIds: selectedUsers,
        }),
      });

      // Tidak perlu update manual, karena socket akan mengirim event `conversation:new`
      // Cukup tutup modal dan mungkin switch ke percakapan baru
      useChatStore.setState({ activeId: newConversation.id });
      toast.success(`Group "${newConversation.title}" created!`);
      onClose();

    } catch (error: any) {
      const errorMsg = error.details ? JSON.parse(error.details).error : error.message;
      toast.error(`Failed to create group: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-white">Create New Group</h2>
        
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Group Name"
          className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />
        
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users to add..."
          className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        />
        
        <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-lg mb-4">
          {userList.map(user => (
            <div key={user.id} onClick={() => handleToggleUser(user.id)} className="p-3 hover:bg-gray-700 cursor-pointer flex items-center justify-between">
              <span className="text-white">{user.name} (@{user.username})</span>
              <input type="checkbox" readOnly checked={selectedUsers.includes(user.id)} className="form-checkbox h-5 w-5 text-blue-500 bg-gray-600 border-gray-500 rounded" />
            </div>
          ))}
        </div>
        
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700">Cancel</button>
          <button onClick={handleCreateGroup} disabled={loading || !title.trim() || selectedUsers.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}