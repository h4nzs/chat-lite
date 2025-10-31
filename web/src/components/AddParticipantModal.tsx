import { useState, useEffect } from 'react';
import { api } from '@lib/api';
import toast from 'react-hot-toast';
import { toAbsoluteUrl } from '@utils/url';
import { useConversationStore } from '@store/conversation';

interface UserSearchResult {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string | null;
}

const AddParticipantModal = ({ conversationId, onClose }: {
  conversationId: string;
  onClose: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const { conversation } = useConversationStore(state => ({
    conversation: state.conversations.find(c => c.id === conversationId),
  }));

  const existingParticipantIds = conversation?.participants.map(p => p.id) || [];

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length > 2) {
        setIsSearching(true);
        try {
          const users = await api<UserSearchResult[]>(`/api/users/search?q=${searchTerm}`);
          setSearchResults(users.filter(u => !existingParticipantIds.includes(u.id)));
        } catch (error) {
          console.error("Failed to search users:", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, existingParticipantIds]);

  const handleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAddParticipants = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one user.');
      return;
    }

    setIsLoading(true);
    try {
      await api(`/api/conversations/${conversationId}/participants`, {
        method: 'POST',
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      toast.success('Participants added successfully!');
      onClose();
    } catch (error: any) {
      toast.error(`Failed to add participants: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-surface p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Add Participants</h2>
        <form onSubmit={handleAddParticipants}>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 rounded-md bg-bg-primary border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-color"
            />
            {isSearching && <p className="text-sm text-text-secondary mt-2">Searching...</p>}
          </div>

          <div className="max-h-60 overflow-y-auto mb-4 border border-border rounded-md">
            {searchResults.length > 0 ? (
              searchResults.map(user => (
                <div 
                  key={user.id} 
                  className={`flex items-center justify-between p-2 cursor-pointer ${selectedUserIds.includes(user.id) ? 'bg-accent-color/20' : 'hover:bg-secondary'}`}
                  onClick={() => handleSelectUser(user.id)}
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={toAbsoluteUrl(user.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover bg-gray-700"
                    />
                    <p className="text-text-primary">{user.name} (@{user.username})</p>
                  </div>
                  {selectedUserIds.includes(user.id) && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </div>
              ))
            ) : ( searchTerm.trim().length > 2 && !isSearching &&
              <p className="p-2 text-text-secondary">No users found.</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-secondary text-text-primary hover:bg-secondary/80 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-accent-gradient text-white hover:opacity-90 transition-colors"
              disabled={isLoading || selectedUserIds.length === 0}
            >
              {isLoading ? 'Adding...' : 'Add Selected'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddParticipantModal;
