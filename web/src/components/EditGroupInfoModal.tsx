import { useState } from 'react';
import { api } from '@lib/api';
import toast from 'react-hot-toast';
import { Spinner } from './Spinner';

interface EditGroupInfoModalProps {
  conversationId: string;
  currentTitle: string;
  currentDescription: string | null;
  onClose: () => void;
}

export default function EditGroupInfoModal({ conversationId, currentTitle, currentDescription, onClose }: EditGroupInfoModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api(`/api/conversations/${conversationId}/details`, {
        method: 'PUT',
        body: JSON.stringify({ title, description }),
      });
      toast.success('Group info updated!');
      onClose();
    } catch (error: any) {
      toast.error(`Failed to update: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-surface rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">Edit Group Info</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="group-title" className="block text-sm font-medium text-text-secondary mb-1">Group Name</label>
              <input
                id="group-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-color"
                required
              />
            </div>
            <div>
              <label htmlFor="group-description" className="block text-sm font-medium text-text-secondary mb-1">Description</label>
              <textarea
                id="group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full p-2 bg-bg-primary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-color"
              />
            </div>
          </div>
          <div className="p-4 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-text-primary bg-secondary hover:bg-secondary/80">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-md text-white bg-accent-gradient hover:opacity-90 disabled:opacity-50 flex items-center">
              {isLoading && <Spinner size="sm" className="mr-2" />} 
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
