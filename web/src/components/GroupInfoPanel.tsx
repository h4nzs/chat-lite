import { useState, useRef, useEffect } from 'react';
import { useConversationStore, Participant } from '@store/conversation';
import { useAuthStore } from '@store/auth';
import ParticipantList from './ParticipantList';
import EditGroupInfoModal from './EditGroupInfoModal';
import AddParticipantModal from './AddParticipantModal';
import { api } from '@lib/api';
import toast from 'react-hot-toast';
import { toAbsoluteUrl } from '@utils/url';

const GroupInfoPanel = ({ conversationId, onClose }: { conversationId: string; onClose: () => void; }) => {
  const { conversation } = useConversationStore(state => ({
    conversation: state.conversations.find(c => c.id === conversationId),
  }));
  const { user } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsPanelOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsPanelOpen(false);
    setTimeout(onClose, 300);
  };

  if (!conversation || !conversation.isGroup) {
    return null;
  }

  const amIAdmin = conversation.participants.find(p => p.id === user?.id)?.role === 'ADMIN';

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('avatar', file);

    const toastId = toast.loading('Uploading avatar...');
    try {
      await api(`/api/conversations/${conversation.id}/avatar`, {
        method: 'POST',
        body: formData,
      });
      toast.success('Avatar updated!', { id: toastId });
    } catch (error: any) {
      toast.error(`Failed to upload avatar: ${error.message || 'Unknown error'}`, { id: toastId });
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;

    const toastId = toast.loading('Leaving group...');
    try {
      await api(`/api/conversations/${conversation.id}/leave`, { method: 'DELETE' });
      toast.success('You have left the group.', { id: toastId });
      handleClose(); // Close the panel on success
    } catch (error: any) {
      toast.error(`Failed to leave group: ${error.message || 'Unknown error'}`, { id: toastId });
    }
  };

  const avatarSrc = conversation.avatarUrl 
    ? `${toAbsoluteUrl(conversation.avatarUrl)}?t=${conversation.lastUpdated}` 
    : `https://api.dicebear.com/8.x/initials/svg?seed=${conversation.title}`;

  return (
    <div className="fixed inset-0 z-40">
      <div 
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isPanelOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      ></div>

      <div className={`absolute top-0 right-0 h-full w-full max-w-md bg-bg-surface border-l border-border z-50 flex flex-col transition-transform duration-300 ease-in-out ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-border flex items-center">
          <button onClick={handleClose} className="p-2 -ml-2 mr-2 text-text-secondary hover:text-text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <h2 className="text-xl font-bold text-text-primary">Group Info</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center mb-6">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <img 
                src={avatarSrc}
                alt="Group Avatar"
                className="w-full h-full rounded-full object-cover bg-bg-primary"
              />
              {amIAdmin && (
                <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-accent-gradient rounded-full p-2 text-white hover:opacity-90">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9z"/><path d="m16.5 9.4-9.3 9.3"/><path d="m16.5 15.6 3.3-3.3"/></svg>
                </button>
              )}
              <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
            </div>
            <h3 className="text-2xl font-bold text-text-primary">{conversation.title}</h3>
            <p className="text-text-secondary mt-1">{conversation.description || 'No description'}</p>
            {amIAdmin && (
              <button onClick={() => setIsEditing(true)} className="text-sm text-accent-color hover:underline mt-2">Edit</button>
            )}
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-2 text-text-primary">{conversation.participants.length} Members</h4>
            {amIAdmin && (
              <button 
                onClick={() => setIsAddParticipantModalOpen(true)}
                className="w-full flex items-center justify-center p-2 mb-4 rounded-md bg-transparent border border-border text-accent-color hover:bg-secondary transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="10" x2="16" y2="16"/></svg>
                <span className="ml-2">Add Participants</span>
              </button>
            )}
            <ParticipantList conversationId={conversation.id} participants={conversation.participants} amIAdmin={amIAdmin} />
          </div>
        </div>

        {!amIAdmin && (
          <div className="p-4 border-t border-border">
            <button 
              onClick={handleLeaveGroup}
              className="w-full flex items-center justify-center p-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="ml-2">Leave Group</span>
            </button>
          </div>
        )}

        {isEditing && (
          <EditGroupInfoModal
            conversationId={conversation.id}
            currentTitle={conversation.title || ''}
            currentDescription={conversation.description}
            onClose={() => setIsEditing(false)}
          />
        )}

        {isAddParticipantModalOpen && (
          <AddParticipantModal
            conversationId={conversation.id}
            onClose={() => setIsAddParticipantModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default GroupInfoPanel;
