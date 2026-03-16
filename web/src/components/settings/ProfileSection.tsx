// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useAuthStore } from '@store/auth';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'react-hot-toast';
import { toAbsoluteUrl } from '@utils/url';
import { FiEdit2, FiLock } from 'react-icons/fi';
import { ControlModule } from './SettingsUI';
import { updateUserProfile } from '@services/settings.service';
import { useUserProfile } from '@hooks/useUserProfile';
import ImageCropperModal from '../ImageCropperModal';

interface ProfileSectionProps {
  showUpgradeModal: () => void;
}

export default function ProfileSection({ showUpgradeModal }: ProfileSectionProps) {
  const { user, updateProfile, updateAvatar, setUser } = useAuthStore(useShallow(s => ({
    user: s.user,
    updateProfile: s.updateProfile,
    updateAvatar: s.updateAvatar,
    setUser: s.setUser
  })));

  const profile = useUserProfile(user);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarCropTarget, setAvatarCropTarget] = useState<{ url: string; file: File } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile && profile.name !== 'Encrypted User' && profile.name !== 'Unknown') {
      setName(profile.name || '');
      setDescription(profile.description || '');
      setPreviewUrl(profile.avatarUrl ? toAbsoluteUrl(profile.avatarUrl) || null : null);
    }
  }, [profile]);

  // Cleanup avatar crop target URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (avatarCropTarget?.url) {
        URL.revokeObjectURL(avatarCropTarget.url);
      }
    };
  }, [avatarCropTarget]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarCropTarget({ url: URL.createObjectURL(file), file });
      // Reset input to allow re-selecting same file
      e.target.value = '';
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let currentAvatarUrl = profile?.avatarUrl;

      if (avatarFile) {
        currentAvatarUrl = await updateAvatar(avatarFile);
      }

      await updateUserProfile(user!.id, name, description, currentAvatarUrl || null);

      toast.success('Identity Updated');
    } catch (error: unknown) {
      const errorMsg = (error as { details?: string; message: string }).details
        ? JSON.parse((error as { details: string }).details).error
        : (error as Error).message;
      toast.error(`Update failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="col-span-1 md:col-span-12 lg:col-span-8">
        <form onSubmit={handleProfileSubmit} className="h-full">
          <ControlModule title="Identity Module" className="h-full relative group">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Avatar Slot - Concave Recess */}
              <div className="relative flex-shrink-0">
                <div className="
                  w-40 h-40 rounded-full
                  shadow-neu-pressed-light dark:shadow-neu-pressed-dark
                  flex items-center justify-center
                  bg-bg-main p-2
                ">
                  <img
                    src={previewUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.id || 'anonymous')}`}
                    alt="ID"
                    className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="
                    absolute bottom-2 right-2 p-3 rounded-full
                    bg-accent text-white
                    shadow-lg hover:scale-110 transition-transform
                  "
                >
                  <FiEdit2 size={18} />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>

              {/* Info Fields */}
              <div className="flex-1 w-full space-y-6">
                {/* ID (Read Only) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary pl-2">ANONYMOUS ID</label>
                    {user.isVerified ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                        <FiLock size={10} /> Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={showUpgradeModal}
                        className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-yellow-500/20 transition-colors animate-pulse"
                      >
                        <FiLock size={10} /> Sandboxed (Upgrade)
                      </button>
                    )}
                  </div>
                  <div className="w-full bg-black/5 dark:bg-white/5 text-sm font-mono text-text-primary p-4 rounded-xl flex items-center border border-transparent">
                    <span className="text-accent mr-1">#</span>{user.id}
                    <FiLock className="ml-auto text-text-secondary opacity-50" size={12} />
                  </div>
                  {!user.isVerified && (
                    <p className="text-[10px] text-text-secondary pl-2">
                      Limited access. Verify to unlock Groups and higher limits.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary pl-2">Display Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="
                      w-full bg-transparent text-xl font-bold tracking-tight text-text-primary
                      p-4 rounded-xl outline-none transition-all
                      shadow-neu-pressed-light dark:shadow-neu-pressed-dark
                      focus:ring-2 focus:ring-accent/50
                    "
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary pl-2">Bio-Data</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    maxLength={150}
                    className="
                      w-full bg-transparent text-sm font-mono text-text-secondary
                      p-4 rounded-xl outline-none resize-none transition-all
                      shadow-neu-pressed-light dark:shadow-neu-pressed-dark
                      focus:ring-2 focus:ring-accent/50
                    "
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="
                  px-8 py-3 rounded-xl font-bold uppercase tracking-wider text-sm
                  text-accent bg-bg-main
                  shadow-neu-flat-light dark:shadow-neu-flat-dark
                  active:shadow-neu-pressed-light dark:active:shadow-neu-pressed-dark
                  hover:text-white hover:bg-accent transition-all
                "
              >
                {isLoading ? 'Processing...' : 'Save Identity'}
              </button>
            </div>
          </ControlModule>
        </form>
      </div>

      {avatarCropTarget && (
        <ImageCropperModal
          file={avatarCropTarget.file}
          url={avatarCropTarget.url}
          aspect={1} // Force square for avatars
          onClose={() => setAvatarCropTarget(null)}
          onSave={(croppedFile) => {
            setAvatarFile(croppedFile);
            setPreviewUrl(URL.createObjectURL(croppedFile));
            setAvatarCropTarget(null);
          }}
        />
      )}
    </>
  );
}
