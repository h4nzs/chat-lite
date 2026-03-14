import { FiUsers, FiX } from 'react-icons/fi';
import { ContactItem } from './ContactItem';

interface StoryPrivacyMenuProps {
  isOpen: boolean;
  onClose: () => void;
  privacyMode: 'ALL' | 'EXCLUDE' | 'ONLY';
  setPrivacyMode: (mode: 'ALL' | 'EXCLUDE' | 'ONLY') => void;
  selectedUsers: string[];
  toggleUser: (id: string) => void;
  contacts: any[]; // The derived contacts array
}

export default function StoryPrivacyMenu({ 
  isOpen, 
  onClose, 
  privacyMode, 
  setPrivacyMode, 
  selectedUsers, 
  toggleUser, 
  contacts 
}: StoryPrivacyMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-bg-main w-full max-w-sm rounded-3xl border border-white/10 flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20">
          <div className="flex items-center gap-2">
            <FiUsers className="text-accent" size={20} />
            <h3 className="font-bold text-text-primary text-lg">Story Privacy</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-white p-1 bg-white/5 rounded-full transition-colors">
            <FiX size={18} />
          </button>
        </div>
        
        <div className="p-2 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-3 space-y-4">
            <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
              <span className="text-text-primary font-medium">All Contacts</span>
              <input type="radio" name="privacy" checked={privacyMode === 'ALL'} onChange={() => setPrivacyMode('ALL')} className="accent-accent w-5 h-5" />
            </label>
            <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
              <span className="text-text-primary font-medium">My Contacts Except...</span>
              <input type="radio" name="privacy" checked={privacyMode === 'EXCLUDE'} onChange={() => setPrivacyMode('EXCLUDE')} className="accent-accent w-5 h-5" />
            </label>
            <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
              <span className="text-text-primary font-medium">Only Share With...</span>
              <input type="radio" name="privacy" checked={privacyMode === 'ONLY'} onChange={() => setPrivacyMode('ONLY')} className="accent-accent w-5 h-5" />
            </label>
          </div>

          {privacyMode !== 'ALL' && (
            <div className="mt-2 border-t border-white/5 pt-4 px-3">
              <p className="text-[11px] font-bold text-text-secondary mb-3 uppercase tracking-wider px-2">Select Contacts</p>
              <div className="space-y-1">
                {contacts.map((contact: any) => (
                  <ContactItem 
                    key={contact.id} 
                    contact={contact} 
                    isSelected={selectedUsers.includes(contact.id)} 
                    onToggle={() => toggleUser(contact.id)} 
                  />
                ))}
                {contacts.length === 0 ? <p className="text-xs text-text-secondary text-center py-6">No active contacts found.</p> : null}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/40">
          <button onClick={onClose} className="w-full bg-accent text-white py-3.5 rounded-2xl font-bold shadow-neu-pressed hover:scale-[1.02] active:scale-95 transition-all">
            Save Privacy Settings
          </button>
        </div>
      </div>
    </div>
  );
}
