import { useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { FiSettings, FiLogOut, FiEye, FiEyeOff } from 'react-icons/fi';
import NotificationBell from './NotificationBell';
import ShareProfileModal from './ShareProfileModal';
import { useAuthStore } from '@store/auth';
import { useModalStore } from '@store/modal';
import { useSettingsStore } from '@store/settings';
import { useUserProfile } from '@hooks/useUserProfile';
import { useShallow } from 'zustand/react/shallow';
import { toAbsoluteUrl } from '@utils/url';

export default memo(function UserProfile() {
  const { user, logout } = useAuthStore(useShallow(state => ({ user: state.user, logout: state.logout })));
  const { showConfirm: confirmLogout } = useModalStore(useShallow(state => ({ showConfirm: state.showConfirm })));
  const { privacyCloak, setPrivacyCloak } = useSettingsStore(useShallow(s => ({ privacyCloak: s.privacyCloak, setPrivacyCloak: s.setPrivacyCloak })));
  const profile = useUserProfile(user);

  const [showShareModal, setShowShareModal] = useState(false);

  const handleLogout = useCallback(() => {
    confirmLogout(
      "Confirm Logout",
      "Are you sure you want to end your session?",
      logout
    );
  }, [logout, confirmLogout]);

  const handleLockVault = useCallback(() => {
    // Clear decoy state and force reload to trigger the lock screen
    sessionStorage.removeItem('nyx_decoy_mode');
    window.location.reload();
  }, []);

  if (!user) return null;

  return (
    <>
      <div className="flex items-center justify-between px-6 py-6 bg-bg-main z-10">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer group" onClick={() => setShowShareModal(true)}>
          <div className="relative flex-shrink-0">
            <img 
              src={toAbsoluteUrl(profile.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${profile.name}`} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full object-cover shadow-neu-flat dark:shadow-neu-flat-dark border-2 border-bg-main group-hover:border-accent transition-colors" 
            />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-bg-surface"></div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors">{profile.name}</p>
            {user.isVerified && <span className="text-[10px] text-accent font-bold tracking-wider">VERIFIED</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <NotificationBell />
          {/* PRIVACY CLOAK BUTTON */}
          <button
            onClick={() => setPrivacyCloak(!privacyCloak)}
            className={clsx(
              "p-2.5 rounded-xl transition-all shadow-neumorphic-concave focus:outline-none",
              privacyCloak ? "text-accent bg-white/5" : "text-text-secondary hover:text-accent hover:bg-white/5"
            )}
            title="Toggle Privacy Cloak"
          >
            {privacyCloak ? <FiEyeOff size={18} /> : <FiEye size={18} />}
          </button>
          <Link 
            to="/settings" 
            aria-label="Settings" 
            className="btn-flat p-2 rounded-full text-text-secondary hover:text-text-primary transition-all"
          >
            <FiSettings size={20} />
          </Link>
          <button 
            onClick={handleLogout} 
            aria-label="Logout" 
            className="btn-flat p-2 rounded-full text-text-secondary hover:text-red-500 transition-all"
          >
            <FiLogOut size={20} />
          </button>
        </div>
      </div>
      {showShareModal && <ShareProfileModal onClose={() => setShowShareModal(false)} />}
    </>
  );
});
