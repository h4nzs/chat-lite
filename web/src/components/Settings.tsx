import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@store/auth';
import { toast } from 'react-hot-toast';
import { Spinner } from './Spinner';
import { toAbsoluteUrl } from '@utils/url';
import { requestPushPermission } from '@hooks/usePushNotifications';
import { useThemeStore } from '@store/theme';

export default function Settings() {
  const {
    user,
    updateProfile,
    updateAvatar,
    sendReadReceipts: initialReadReceipts,
    setReadReceipts,
  } = useAuthStore(state => ({
    user: state.user,
    updateProfile: state.updateProfile,
    updateAvatar: state.updateAvatar,
    sendReadReceipts: state.sendReadReceipts,
    setReadReceipts: state.setReadReceipts,
  }));
  const { theme, toggleTheme } = useThemeStore();

  // Local state for all editable fields
  const [name, setName] = useState(user?.name || '');
  const [description, setDescription] = useState(user?.description || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.avatarUrl ? toAbsoluteUrl(user.avatarUrl) : null);
  const [showEmail, setShowEmail] = useState(user?.showEmailToOthers || false);
  const [readReceipts, setReadReceiptsState] = useState(initialReadReceipts);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setDescription(user.description || '');
      setPreviewUrl(user.avatarUrl ? toAbsoluteUrl(user.avatarUrl) : null);
      setShowEmail(user.showEmailToOthers || false);
      setReadReceiptsState(initialReadReceipts);
    }
  }, [user, initialReadReceipts]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubscribePush = async () => {
    try {
      await requestPushPermission();
      toast.success('Push notifications enabled!');
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);
      toast.error(error.message || 'Failed to enable push notifications.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const promises = [];
      const dataToUpdate: { name?: string; description?: string; showEmailToOthers?: boolean } = {};

      if (avatarFile) {
        promises.push(updateAvatar(avatarFile));
      }
      if (name !== user?.name) {
        dataToUpdate.name = name;
      }
      if (description !== user?.description) {
        dataToUpdate.description = description;
      }
      if (showEmail !== user?.showEmailToOthers) {
        dataToUpdate.showEmailToOthers = showEmail;
      }

      if (Object.keys(dataToUpdate).length > 0) {
        promises.push(updateProfile(dataToUpdate));
      }

      if (readReceipts !== initialReadReceipts) {
        // This is a local setting, so we just call its setter
        setReadReceipts(readReceipts);
      }

      if (promises.length === 0 && readReceipts === initialReadReceipts) {
        toast('No changes to save.');
        return;
      }

      await Promise.all(promises);
      toast.success('Settings saved successfully!');

    } catch (error: any) {
      const errorMsg = error.details ? JSON.parse(error.details).error : error.message;
      toast.error(`Update failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 bg-bg-surface text-text-primary rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-text-primary mb-6 border-b border-border pb-4">Profile Settings</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <img 
              src={previewUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`}
              alt="Avatar Preview"
              className="w-24 h-24 rounded-full bg-bg-primary object-cover border-2 border-border"
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-accent-gradient text-white p-1.5 rounded-full hover:opacity-90 transition-opacity"
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
            <h2 className="text-2xl font-semibold text-text-primary">{user.name}</h2>
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
            className="w-full p-3 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-color"
          />
        </div>

        {/* Description Input */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-2">About Me</label>
          <textarea 
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={200}
            className="w-full p-3 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-color"
            placeholder="Tell everyone a little about yourself..."
          />
          <p className="text-xs text-text-secondary mt-1 text-right">{description.length} / 200</p>
        </div>

        {/* Email (Read-only) */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">Email Address</label>
          <input 
            type="email"
            id="email"
            value={user.email}
            readOnly
            className="w-full p-3 bg-secondary border border-border rounded-lg text-text-secondary cursor-not-allowed"
          />
        </div>

        {/* Appearance Settings */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-lg font-semibold text-text-primary">Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">Theme</p>
              <p className="text-sm text-text-secondary">Switch between light and dark mode.</p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-color focus:ring-offset-2 focus:ring-offset-bg-surface ${theme === 'dark' ? 'bg-accent-gradient' : 'bg-gray-300'}`}
              role="switch"
              aria-checked={theme === 'dark'}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>

        {/* Security Settings */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-lg font-semibold text-text-primary">Security</h3>
          <Link to="/settings/keys" className="flex items-center justify-between p-4 rounded-lg bg-bg-primary hover:bg-secondary transition-colors w-full text-left">
            <div>
              <p className="font-medium text-text-primary">Encryption Keys</p>
              <p className="text-sm text-text-secondary">Manage your end-to-end encryption keys.</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-lg font-semibold text-text-primary">Privacy</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">Send Read Receipts</p>
              <p className="text-sm text-text-secondary">Let others know you have read their messages.</p>
            </div>
            <button
              type="button"
              onClick={() => setReadReceiptsState(!readReceipts)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-color focus:ring-offset-2 focus:ring-offset-bg-surface ${readReceipts ? 'bg-accent-gradient' : 'bg-gray-300'}`}
              role="switch"
              aria-checked={readReceipts}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${readReceipts ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* Show Email Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">Show Email Address</p>
              <p className="text-sm text-text-secondary">Allow other users to see your email address on your profile.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEmail(!showEmail)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-color focus:ring-offset-2 focus:ring-offset-bg-surface ${showEmail ? 'bg-accent-gradient' : 'bg-gray-300'}`}
              role="switch"
              aria-checked={showEmail}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showEmail ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text-primary">Push Notifications</p>
              <p className="text-sm text-text-secondary">Receive notifications for new messages.</p>
            </div>
            <button
              type="button"
              onClick={handleSubscribePush}
              className="px-4 py-2 rounded-md bg-accent-gradient text-white hover:opacity-90 transition-opacity"
            >
              Enable Push Notifications
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-border">
          <button 
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center px-6 py-2.5 bg-accent-gradient text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
