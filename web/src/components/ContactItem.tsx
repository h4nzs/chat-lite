import { useEffect } from 'react';
import { useProfileStore } from '@store/profile';
import type { StoryContact } from './StoryPrivacyMenu';

interface ContactItemProps {
  contact: StoryContact;
  isSelected: boolean;
  onToggle: () => void;
}

export const ContactItem = ({ contact, isSelected, onToggle }: ContactItemProps) => {
  const profile = useProfileStore(state => {
    const cacheKey = contact.encryptedProfile ? `${contact.id}_${contact.encryptedProfile.substring(0, 32)}` : contact.id;
    return state.profiles[cacheKey];
  });

  useEffect(() => {
     if (!profile && contact.encryptedProfile) {
        useProfileStore.getState().decryptAndCache(contact.id, contact.encryptedProfile);
     }
  }, [contact.id, contact.encryptedProfile, profile]);

  const name = profile?.name || contact.username || 'Unknown User';
  const avatarUrl = profile?.avatarUrl || contact.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}`;

  return (
    <label className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
      <div className="flex items-center gap-3">
        <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full border border-white/10 group-hover:border-accent/50 transition-colors object-cover" />
        <span className="text-sm font-medium text-text-primary">{name}</span>
      </div>
      <input 
        type="checkbox" 
        checked={isSelected}
        onChange={onToggle}
        className="accent-accent rounded w-5 h-5 cursor-pointer"
      />
    </label>
  );
};
