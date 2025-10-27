import { useState, useEffect } from 'react';
import { useChatStore } from '@store/chat';
import { useAuthStore } from '@store/auth';
import { api } from '@lib/api';
import toast from 'react-hot-toast';

export default function CreateGroupChat({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]); // Simpan objek user, bukan hanya ID
  const [searchQuery, setSearchQuery] = useState('');
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const me = useAuthStore(s => s.user);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setUserList([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await api<any[]>(`/api/users/search?q=${searchQuery}`);
        const selectedIds = selectedUsers.map(u => u.id);
        setUserList(results.filter(u => u.id !== me?.id && !selectedIds.includes(u.id)));
      } catch (error) {
        toast.error("Failed to search users.");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, me?.id, selectedUsers]);

  const handleSelectUser = (user: any) => {
    setSelectedUsers(prev => [...prev, user]);
    setSearchQuery(''); // Kosongkan pencarian setelah memilih
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreateGroup = async () => {
    if (!title.trim() || selectedUsers.length === 0) {
      return toast.error("Group name and at least one member are required.");
    }
    setLoading(true);
    try {
      const newConversation = await api<any>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          userIds: selectedUsers.map(u => u.id),
          isGroup: true,
        }),
      });

      // Add the new conversation to the store and set it as active
      useChatStore.setState(state => ({
        conversations: [newConversation, ...state.conversations],
        activeId: newConversation.id,
      }));

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
        
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users to add..."
            className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {userList.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-gray-700 border border-gray-600 rounded-b-lg max-h-40 overflow-y-auto z-10">
              {userList.map(user => (
                <div key={user.id} onClick={() => handleSelectUser(user)} className="p-3 hover:bg-gray-600 cursor-pointer text-white">
                  {user.name} (@{user.username})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Area untuk menampilkan tag user yang dipilih */}
        <div className="flex flex-wrap gap-2 mt-4 mb-4 min-h-[40px]">
          {selectedUsers.map(user => (
            <div key={user.id} className="flex items-center bg-blue-600 text-white rounded-full px-3 py-1 text-sm font-medium">
              <span>{user.name}</span>
              <button onClick={() => handleRemoveUser(user.id)} className="ml-2 text-blue-200 hover:text-white font-bold">
                &times;
              </button>
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
