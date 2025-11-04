import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@store/auth';
import { toast } from 'react-hot-toast';
import { Spinner } from './Spinner';
import { toAbsoluteUrl } from '@utils/url';
import { requestPushPermission } from '@hooks/usePushNotifications';
import { useThemeStore } from '@store/theme';
import { FiChevronRight, FiEdit2 } from 'react-icons/fi';

// Reusable component for a single setting row
const SettingsRow = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between py-4">
    <div>
      <p className="font-medium text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary">{description}</p>
    </div>
    <div>{children}</div>
  </div>
);

// Reusable component for a settings card
const SettingsCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-bg-surface rounded-xl shadow-soft divide-y divide-border">{children}</div>
);

// Toggle Switch Component
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${checked ? 'bg-accent-gradient' : 'bg-gray-300 dark:bg-gray-600'}`}
    role="switch"
    aria-checked={checked}
  >
    <span
      aria-hidden="true"
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
    />
  </button>
);

export default function Settings() {
  const { user, updateProfile, updateAvatar, sendReadReceipts, setReadReceipts } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [name, setName] = useState(user?.name || '');
  const [description, setDescription] = useState(user?.description || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.avatarUrl ? toAbsoluteUrl(user.avatarUrl) : null);
  const [showEmail, setShowEmail] = useState(user?.showEmailToOthers || false);
  const [readReceipts, setReadReceiptsState] = useState(sendReadReceipts);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setDescription(user.description || '');
      setPreviewUrl(user.avatarUrl ? toAbsoluteUrl(user.avatarUrl) : null);
      setShowEmail(user.showEmailToOthers || false);
      setReadReceiptsState(sendReadReceipts);
    }
  }, [user, sendReadReceipts]);

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

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const promises = [];
      if (avatarFile) {
        promises.push(updateAvatar(avatarFile));
      }
      if (name !== user?.name || description !== user?.description) {
        promises.push(updateProfile({ name, description }));
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
  
  const handlePrivacySubmit = async () => {
    const toastId = toast.loading('Saving privacy settings...');
    try {
      await updateProfile({ showEmailToOthers: showEmail });
      setReadReceipts(readReceipts);
      toast.success('Privacy settings saved!', { id: toastId });
    } catch (error) {
      toast.error('Failed to save privacy settings.', { id: toastId });
    }
  };

  if (!user) return <div className="flex justify-center items-center h-full"><Spinner /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Card */}
      <form onSubmit={handleProfileSubmit}>
        <SettingsCard>
          <div className="p-6 flex items-center gap-6">
            <div className="relative">
              <img 
                src={previewUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${user.name}`}
                alt="Avatar Preview"
                className="w-24 h-24 rounded-full bg-bg-primary object-cover border-2 border-border"
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-accent-gradient text-white p-2 rounded-full hover:opacity-90 transition-opacity"
                aria-label="Change avatar"
              >
                <FiEdit2 size={16} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" className="hidden" />
            </div>
            <div className="flex-1 space-y-2">
               <input 
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 text-xl font-bold bg-transparent border-b border-transparent focus:border-border focus:outline-none transition-colors"
              />
              <textarea 
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={150}
                className="w-full p-2 text-sm bg-transparent border-b border-transparent focus:border-border focus:outline-none transition-colors resize-none"
                placeholder="About me..."
              />
            </div>
          </div>
          <div className="bg-bg-primary/50 p-4 flex justify-end">
            <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-lg bg-accent-gradient text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center">
              {isLoading && <Spinner size="sm" className="mr-2" />} 
              {isLoading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </SettingsCard>
      </form>

      {/* Appearance Card */}
      <SettingsCard>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Appearance</h3>
          <SettingsRow title="Theme" description="Switch between light and dark mode.">
            <ToggleSwitch checked={theme === 'dark'} onChange={toggleTheme} />
          </SettingsRow>
        </div>
      </SettingsCard>

      {/* Privacy & Security Card */}
      <SettingsCard>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Privacy & Security</h3>
          <SettingsRow title="Send Read Receipts" description="Let others know you have read their messages.">
            <ToggleSwitch checked={readReceipts} onChange={() => setReadReceiptsState(!readReceipts)} />
          </SettingsRow>
          <SettingsRow title="Show Email Address" description="Allow others to see your email on your profile.">
            <ToggleSwitch checked={showEmail} onChange={() => setShowEmail(!showEmail)} />
          </SettingsRow>
          <Link to="/settings/keys" className="block w-full text-left">
            <SettingsRow title="Encryption Keys" description="Manage your end-to-end encryption keys.">
              <FiChevronRight size={20} className="text-text-secondary" />
            </SettingsRow>
          </Link>
          <Link to="/settings/sessions" className="block w-full text-left">
            <SettingsRow title="Active Sessions" description="View and manage where your account is logged in.">
              <FiChevronRight size={20} className="text-text-secondary" />
            </SettingsRow>
          </Link>
        </div>
        <div className="bg-bg-primary/50 p-4 flex justify-end">
            <button onClick={handlePrivacySubmit} className="px-4 py-2 rounded-lg bg-accent-gradient text-white font-semibold hover:opacity-90 disabled:opacity-50 flex items-center">
              Save Privacy Settings
            </button>
          </div>
      </SettingsCard>
      
      {/* Notifications Card */}
      <SettingsCard>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Notifications</h3>
          <SettingsRow title="Push Notifications" description="Receive notifications for new messages on this device.">
            <button onClick={handleSubscribePush} className="px-3 py-1.5 text-sm rounded-lg bg-accent-gradient text-white font-semibold hover:opacity-90">
              Enable
            </button>
          </SettingsRow>
        </div>
      </SettingsCard>

    </div>
  );
}