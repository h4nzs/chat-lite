import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useAuthStore } from '@store/auth';
import { toast } from 'react-hot-toast';
import { Spinner } from './Spinner';
import { toAbsoluteUrl } from '@utils/url';

export default function Settings() {
  const { user, updateProfile, updateAvatar, sendReadReceipts, toggleReadReceipts } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.avatarUrl ? toAbsoluteUrl(user.avatarUrl) : null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Efek untuk sinkronisasi state lokal dengan state global
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPreviewUrl(user.avatarUrl ? toAbsoluteUrl(user.avatarUrl) : null);
    }
  }, [user]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const promises = [];
      if (avatarFile) {
        promises.push(updateAvatar(avatarFile));
      }
      if (name !== user?.name) {
        promises.push(updateProfile({ name }));
      }

      if (promises.length === 0) {
        toast('No changes to save.');
        return;
      }

      await Promise.all(promises);
      toast.success('Profile updated successfully!');

    } catch (error: any) {
      const errorMsg = error.details ? JSON.parse(error.details).error : error.message;
      toast.error(`Update failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 bg-surface text-text-primary rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-white mb-6 border-b border-gray-700 pb-4">Profile Settings</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <img 
              src={toAbsoluteUrl(previewUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`}
              alt="Avatar Preview"
              className="w-24 h-24 rounded-full bg-gray-700 object-cover border-2 border-gray-600"
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-accent text-white p-1.5 rounded-full hover:bg-accent-hover transition-colors"
              aria-label="Change avatar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9z"/><path d="M16 16l-4-4-4 4"/><path d="M12 12v9"/></svg>
            </button>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/gif"
              className="hidden"
            />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">{user.name}</h2>
            <p className="text-sm text-text-secondary">@{user.username}</p>
          </div>
        </div>

        {/* Name Input */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">Display Name</label>
          <input 
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 bg-primary border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Email (Read-only) */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">Email Address</label>
          <input 
            type="email"
            id="email"
            value={user.email}
            readOnly
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-text-secondary cursor-not-allowed"
          />
        </div>

        {/* Privacy Settings */}
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <h3 className="text-lg font-semibold text-white">Privacy</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">Send Read Receipts</p>
              <p className="text-sm text-text-secondary">Let others know you have read their messages.</p>
            </div>
            <button
              type="button"
              onClick={toggleReadReceipts}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface ${sendReadReceipts ? 'bg-accent' : 'bg-gray-600'}`}
              role="switch"
              aria-checked={sendReadReceipts}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${sendReadReceipts ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-gray-700">
          <button 
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center px-6 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
