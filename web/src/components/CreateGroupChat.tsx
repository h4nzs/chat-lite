import { useState, useEffect } from 'react';
import { useConversationStore, type Conversation } from '@store/conversation';
import { useAuthStore } from '@store/auth';
import { api } from '@lib/api';
import toast from 'react-hot-toast';

type UserSearchResult = {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string | null;
};

export default function CreateGroupChat({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userList, setUserList] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const me = useAuthStore(s => s.user);
  const { addOrUpdateConversation, openConversation } = useConversationStore(state => ({
    addOrUpdateConversation: state.addOrUpdateConversation,
    openConversation: state.openConversation,
  }));

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setUserList([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await api<UserSearchResult[]>(`/api/users/search?q=${searchQuery}`);
        const selectedIds = selectedUsers.map(u => u.id);
        setUserList(results.filter(u => u.id !== me?.id && !selectedIds.includes(u.id)));
      } catch {
        toast.error("Failed to search users.");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, me?.id, selectedUsers]);

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUsers(prev => [...prev, user]);
    setSearchQuery('');
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
      const newConversation = await api<Conversation>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          userIds: selectedUsers.map(u => u.id),
          isGroup: true,
        }),
      });

      addOrUpdateConversation(newConversation);
      openConversation(newConversation.id);

      toast.success(`Group "${newConversation.title}" created!`);
      onClose();

    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(`Failed to create group: ${error.message}`);
      } else {
        toast.error("An unknown error occurred while creating the group.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-bg-surface rounded-lg shadow-xl w-full max-w-md p-6 border border-border" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-text-primary">Create New Group</h2>
        
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Group Name"
          className="w-full p-3 border border-border bg-bg-primary text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-color mb-4"
        />
        
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users to add..."
            className="w-full p-3 border border-border bg-bg-primary text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-color"
          />
          {userList.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-bg-primary border border-border rounded-b-lg max-h-40 overflow-y-auto z-10">
              {userList.map(user => (
                <div key={user.id} onClick={() => handleSelectUser(user)} className="p-3 hover:bg-secondary cursor-pointer text-text-primary">
                  {user.name} (@{user.username})
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4 mb-4 min-h-[40px]">
          {selectedUsers.map(user => (
            <div key={user.id} className="flex items-center bg-accent-gradient text-white rounded-full px-3 py-1 text-sm font-medium">
              <span>{user.name}</span>
              <button onClick={() => handleRemoveUser(user.id)} className="ml-2 text-white/70 hover:text-white font-bold">
                &times;
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border border-border rounded-lg text-text-primary hover:bg-secondary">
            Cancel
          </button>
          <button onClick={handleCreateGroup} disabled={loading || !title.trim() || selectedUsers.length === 0} className="px-4 py-2 bg-accent-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}