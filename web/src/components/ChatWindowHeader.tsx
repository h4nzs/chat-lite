import { useAuthStore } from "@store/auth";
import { usePresenceStore } from "@store/presence";
import { useModalStore } from "@store/modal";
import { useShallow } from 'zustand/react/shallow';
import { useVerificationStore } from '@store/verification';
import { useSettingsStore } from '@store/settings';
import { useUserProfile } from '@hooks/useUserProfile';
import { toAbsoluteUrl } from "@utils/url";
import clsx from "clsx";
import { FiShield, FiMoreHorizontal, FiArrowLeft, FiInfo, FiUsers, FiPhone, FiVideo } from 'react-icons/fi';
import { startCall } from '@lib/webrtc';
import SearchMessages from './SearchMessages';
import type { Conversation } from "@store/conversation";

export default function ChatWindowHeader({ 
  conversation, 
  onBack, 
  onInfoToggle, 
  onMenuClick 
}: { 
  conversation: Conversation; 
  onBack: () => void; 
  onInfoToggle: () => void; 
  onMenuClick: () => void; 
}) {
  const user = useAuthStore((s) => s.user);
  const meId = user?.id;
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const { openProfileModal, openChatInfoModal } = useModalStore(useShallow(s => ({ openProfileModal: s.openProfileModal, openChatInfoModal: s.openChatInfoModal })));
  const { verifiedStatus } = useVerificationStore();
  const privacyCloak = useSettingsStore(s => s.privacyCloak);
  
  const cloakClass = privacyCloak ? "blur-[6px] opacity-70 group-hover:blur-none group-hover:opacity-100 group-active:blur-none group-active:opacity-100 transition-all duration-300 select-none" : "";

  const peerUser = !conversation.isGroup ? conversation.participants?.find((p) => p.id !== meId) : null;
  const peerProfile = useUserProfile(peerUser as any);
  const title = conversation.isGroup ? conversation.title : peerProfile.name;
  const avatarUrl = conversation.isGroup ? conversation.avatarUrl : peerProfile.avatarUrl;
  const isOnline = peerUser ? onlineUsers.has(peerUser.id) : false;
  const isConvVerified = verifiedStatus[conversation.id] || false;

  const handleHeaderClick = () => {
    if (peerUser) {
      openProfileModal(peerUser.id);
    } else {
      onInfoToggle();
    }
  };

  const getStatus = () => {
    if (conversation.isGroup) {
      return `${conversation.participants.length} members`;
    }
    return isOnline ? "Online" : "Offline";
  };

  const handleVoiceCall = () => {
    if (peerUser) {
      startCall(peerUser.id, false, user);
    }
  };

  const handleVideoCall = () => {
    if (peerUser) {
      startCall(peerUser.id, true, user);
    }
  };

  return (
    <div className="
      flex items-center justify-between px-4 py-3 z-30
      bg-bg-main
      border-b border-white/10
      shadow-[0_1px_0_rgba(255,255,255,0.05)] dark:shadow-[0_1px_0_rgba(0,0,0,0.2)]
      relative
    ">
      <div className="flex items-center gap-4">
        {/* Mobile Back Button */}
        <button 
          onClick={onMenuClick} 
          aria-label="Menu" 
          className="md:hidden p-3 text-text-secondary active:scale-95 transition-transform"
        >
          <FiMoreHorizontal size={24} />
        </button>
        <button 
          onClick={onBack} 
          aria-label="Back" 
          className="hidden md:block p-3 text-text-secondary hover:text-accent active:scale-95 transition-transform"
        >
          <FiArrowLeft size={20} />
        </button>

        {/* Identity Plate */}
        <button 
          onClick={handleHeaderClick} 
          className="group flex items-center gap-3 p-1 pr-4 rounded-xl transition-all"
        >
          <div className="relative">
             <div className="w-10 h-10 rounded-full shadow-neu-pressed dark:shadow-neu-pressed-dark border-2 border-bg-main p-0.5">
                <img
                  src={toAbsoluteUrl(avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${title}`}
                  alt="ID"
                  className={clsx("w-full h-full rounded-full object-cover", cloakClass)}
                />
             </div>
             {isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-bg-surface shadow-sm"></div>}
          </div>
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className={clsx("font-bold text-text-primary text-sm group-hover:text-accent transition-colors", cloakClass)}>{title}</p>
              {isConvVerified && <FiShield className="text-accent w-3 h-3" />}
            </div>
            <p className="text-xs text-text-secondary opacity-70">
              {getStatus()}
            </p>
          </div>
        </button>
      </div>

      {/* Action Module */}
      <div className="flex items-center gap-2 md:gap-3">
        {!conversation.isGroup && (
          <>
            <button 
              onClick={handleVoiceCall} 
              className="flex items-center justify-center w-9 h-9 rounded-full bg-bg-main text-text-secondary shadow-neu-flat dark:shadow-neu-flat-dark hover:text-accent active:shadow-neu-pressed dark:active:shadow-neu-pressed-dark transition-all duration-200"
            >
              <FiPhone size={16} />
            </button>
            <button 
              onClick={handleVideoCall} 
              className="flex items-center justify-center w-9 h-9 rounded-full bg-bg-main text-text-secondary shadow-neu-flat dark:shadow-neu-flat-dark hover:text-accent active:shadow-neu-pressed dark:active:shadow-neu-pressed-dark transition-all duration-200"
            >
              <FiVideo size={16} />
            </button>
          </>
        )}
        <SearchMessages conversationId={conversation.id} />
        <button 
          onClick={openChatInfoModal} 
          className="
            flex items-center justify-center w-9 h-9 rounded-full 
            bg-bg-main text-text-secondary
            shadow-neu-flat dark:shadow-neu-flat-dark hover:text-accent
            active:shadow-neu-pressed dark:active:shadow-neu-pressed-dark transition-all duration-200
          "
        >
          {conversation.isGroup ? <FiUsers size={18} /> : <FiInfo size={18} />}
        </button>
      </div>
    </div>
  );
}
