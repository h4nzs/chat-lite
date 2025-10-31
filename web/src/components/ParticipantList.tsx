import { useAuthStore } from "@store/auth";
import { Participant } from "@store/conversation";
import { toAbsoluteUrl } from "@utils/url";
import { useState } from "react";
import { api } from '@lib/api';
import toast from 'react-hot-toast';
import useModalStore from '@store/modal';

const ParticipantActions = ({ conversationId, participant, amIAdmin }: { conversationId: string, participant: Participant, amIAdmin: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();
  const showConfirmation = useModalStore(state => state.showConfirmation);

  if (!amIAdmin || user?.id === participant.id) {
    return null;
  }

  const handleRoleChange = async (newRole: "ADMIN" | "MEMBER") => {
    setIsOpen(false);
    try {
      await api(`/api/conversations/${conversationId}/participants/${participant.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      toast.success(`${participant.name} is now ${newRole.toLowerCase()}.`);
    } catch (error: any) {
      toast.error(`Failed to change role: ${error.message || 'Unknown error'}`);
    }
  };

  const handleRemove = () => {
    setIsOpen(false);
    showConfirmation(
      'Remove Participant',
      `Are you sure you want to remove ${participant.name} from the group?`,
      async () => {
        try {
          await api(`/api/conversations/${conversationId}/participants/${participant.id}`, {
            method: 'DELETE',
          });
          toast.success(`${participant.name} removed from group.`);
        } catch (error: any) {
          toast.error(`Failed to remove participant: ${error.message || 'Unknown error'}`);
        }
      }
    );
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-text-secondary hover:text-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-primary rounded-md shadow-lg z-10">
          <ul className="py-1">
            {participant.role === 'MEMBER' ? (
              <li><button onClick={() => handleRoleChange('ADMIN')} className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface">Make Admin</button></li>
            ) : (
              <li><button onClick={() => handleRoleChange('MEMBER')} className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface">Dismiss as Admin</button></li>
            )}
            <li><button onClick={handleRemove} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface">Remove from Group</button></li>
          </ul>
        </div>
      )}
    </div>
  );
};

const ParticipantList = ({ conversationId, participants, amIAdmin }: { conversationId: string, participants: Participant[], amIAdmin: boolean }) => {
  return (
    <ul className="space-y-2">
      {participants.map(p => (
        <li key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-primary">
          <div className="flex items-center gap-3">
            <img 
              src={toAbsoluteUrl(p.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${p.name}`}
              alt={p.name}
              className="w-10 h-10 rounded-full object-cover bg-gray-700"
            />
            <div>
              <p className="font-semibold text-white">{p.name}</p>
              {p.role === 'ADMIN' && <p className="text-xs text-accent">Admin</p>}
            </div>
          </div>
          <ParticipantActions conversationId={conversationId} participant={p} amIAdmin={amIAdmin} />
        </li>
      ))}
    </ul>
  );
};

export default ParticipantList;
