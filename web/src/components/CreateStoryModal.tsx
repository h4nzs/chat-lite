  import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import ModalBase from './ui/ModalBase';
import { useStoryStore } from '@store/story';
import { FiImage, FiX, FiEdit3, FiCrop, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useConversationStore } from '@store/conversation';
import { useAuthStore } from '@store/auth';
import StoryPrivacyMenu from './StoryPrivacyMenu';
import { Spinner } from './Spinner';

const ImageEditorModal = lazy(() => import('./ImageEditorModal'));
const AttachmentCropperModal = lazy(() => import('./AttachmentCropperModal'));

export default function CreateStoryModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [privacyMode, setPrivacyMode] = useState<'ALL' | 'EXCLUDE' | 'ONLY'>('ALL');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  
  const [showPaintEditor, setShowPaintEditor] = useState(false);
  const [showCropper, setShowCropper] = useState(false);

  const conversations = useConversationStore(state => state.conversations);
  const me = useAuthStore(state => state.user);
  
  const contacts = useMemo(() => {
    const map = new Map();
    conversations.forEach(c => {
      if (!c.isGroup) {
        const other = c.participants.find(p => p.id !== me?.id);
        if (other) map.set(other.id, other);
      }
    });
    return Array.from(map.values());
  }, [conversations, me]);

  const toggleUser = (id: string) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text && !file) {
      toast.error('Add text or media to your story');
      return;
    }
    await useStoryStore.getState().postStory(file, text, privacyMode, selectedUsers);
    onClose();
  };

  const getSafeUrl = (url: string | null) => {
    if (!url) return undefined;
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    return undefined;
  };
  const safePreviewUrl = getSafeUrl(previewUrl);

  return (
    <>
      <ModalBase isOpen={true} onClose={onClose} title="Create Story">
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {safePreviewUrl ? (
            <div className="relative w-full h-48 rounded-xl overflow-hidden bg-black/20 group">
               {file?.type.startsWith('video/') ? (
                 <video src={safePreviewUrl} className="w-full h-full object-contain" controls />
               ) : (
                 <img src={safePreviewUrl} alt="preview" className="w-full h-full object-contain" />
               )}
               
               <div className="absolute top-2 right-2 flex items-center gap-2 opacity-100 transition-opacity">
                 {file?.type.startsWith('image/') && (
                   <>
                     <button type="button" onClick={() => setShowPaintEditor(true)} className="bg-black/60 hover:bg-accent text-white p-2 rounded-full backdrop-blur-md transition-colors" title="Draw">
                       <FiEdit3 size={14} />
                     </button>
                     <button type="button" onClick={() => setShowCropper(true)} className="bg-black/60 hover:bg-accent text-white p-2 rounded-full backdrop-blur-md transition-colors" title="Crop">
                       <FiCrop size={14} />
                     </button>
                   </>
                 )}
                 <button type="button" onClick={() => { setFile(null); setPreviewUrl(null); }} className="bg-black/60 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-md transition-colors" title="Remove">
                   <FiX size={14} />
                 </button>
               </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-xl hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer">
              <FiImage size={32} className="text-text-secondary mb-2" />
              <span className="text-sm text-text-secondary">Add Media (Optional)</span>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
          )}

          <textarea
            placeholder="What's on your mind? (End-to-End Encrypted)"
            className="w-full p-4 bg-bg-surface border border-white/5 rounded-xl shadow-neu-inner text-text-primary focus:outline-none focus:ring-1 focus:ring-accent resize-none h-24"
            value={text}
            onChange={e => setText(e.target.value)}
          />

          <div className="flex flex-col pt-2">
            <button 
              type="button"
              onClick={() => setShowPrivacySettings(true)}
              className="flex items-center justify-center gap-2 text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-text-secondary transition-colors mb-4 mx-auto backdrop-blur-md border border-white/5 shadow-sm"
            >
              <FiLock size={14} className="text-accent" />
              <span className="font-medium">
                {privacyMode === 'ALL' ? 'Shared with: All Contacts' : 
                 privacyMode === 'EXCLUDE' ? `Excluded: ${selectedUsers.length} contacts` : 
                 `Only sharing with: ${selectedUsers.length} contacts`}
              </span>
            </button>

            <button 
              type="submit" 
              disabled={useStoryStore(state => state.isLoading)}
              className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-[0_0_15px_rgba(var(--accent),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Post Story
            </button>
          </div>
        </form>
        
        {showPaintEditor && file && safePreviewUrl && (
          <Suspense fallback={<div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center backdrop-blur-sm"><Spinner /></div>}>
            <ImageEditorModal 
              file={file} 
              onSave={(f) => { setFile(f); setPreviewUrl(URL.createObjectURL(f)); setShowPaintEditor(false); }} 
              onCancel={() => setShowPaintEditor(false)} 
            />
          </Suspense>
        )}

        {showCropper && file && safePreviewUrl && (
          <Suspense fallback={<div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center backdrop-blur-sm"><Spinner /></div>}>
            <AttachmentCropperModal 
              file={file} 
              url={safePreviewUrl}
              onSave={(f) => { setFile(f); setPreviewUrl(URL.createObjectURL(f)); setShowCropper(false); }} 
              onClose={() => setShowCropper(false)} 
            />
          </Suspense>
        )}      </ModalBase>

      <StoryPrivacyMenu 
        isOpen={showPrivacySettings}
        onClose={() => setShowPrivacySettings(false)}
        privacyMode={privacyMode}
        setPrivacyMode={setPrivacyMode}
        selectedUsers={selectedUsers}
        toggleUser={toggleUser}
        contacts={contacts}
      />
    </>
  );
}
