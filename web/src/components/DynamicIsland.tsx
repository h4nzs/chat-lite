import DefaultAvatar from "@/components/ui/DefaultAvatar";
import { useState } from 'react';
import { toAbsoluteUrl } from '@utils/url';
import { useNavigate } from 'react-router-dom';
import { useConversationStore } from '@store/conversation';
import { motion, AnimatePresence } from 'framer-motion';
import useDynamicIslandStore, { Activity, NotificationActivity, UploadActivity, UpsellActivity } from '@store/dynamicIsland';
import { FiFile, FiX, FiMessageSquare, FiUploadCloud, FiStar } from 'react-icons/fi';
import { useUserProfile } from '@hooks/useUserProfile';
import { useTranslation } from 'react-i18next';
import SubscriptionModal from './SubscriptionModal';

const NotificationView = ({ activity }: { activity: NotificationActivity }) => {
  const { t } = useTranslation(['common']);
  const openConversation = useConversationStore(state => state.openConversation);
  const removeActivity = useDynamicIslandStore(state => state.removeActivity);
  const navigate = useNavigate();
  const profile = useUserProfile(activity.sender as { id: string; encryptedProfile?: string | null });

  const handleClick = () => {
    if (activity.link) {
      // Use client-side routing to navigate to the chat directly
      navigate(activity.link);
      // Optional: If openConversation is needed to set internal state
      // const conversationId = activity.link.split('/').pop();
      // if (conversationId) openConversation(conversationId); 
    }
    removeActivity(activity.id);
  };

  return (
    <div onClick={handleClick} className="w-full h-full flex items-center gap-3 px-1 cursor-pointer group">
      <div className="relative">
        {profile.avatarUrl ? (
          <img 
            src={toAbsoluteUrl(profile.avatarUrl)}
            alt={profile.name || t('common:defaults.avatar', 'Avatar')}
            className="w-8 h-8 rounded-full object-cover border border-text-secondary/10"
          />
        ) : (
          <DefaultAvatar name={profile.name || t('common:defaults.user')} id={activity.sender?.id} className="w-8 h-8 border border-text-secondary/10" />
        )}
        <div className="absolute -bottom-1 -right-1 bg-accent rounded-full p-0.5 border border-black">
           <FiMessageSquare size={8} className="text-white" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex justify-between items-baseline">
           <p className="text-[10px] font-bold text-text-primary uppercase tracking-wider">{profile.name || t('common:defaults.user')}</p>
           <span className="text-[8px] text-text-secondary font-mono">{t('common:time.now', 'NOW')}</span>
        </div>
        <p className="text-xs text-text-secondary truncate font-medium group-hover:text-text-primary transition-colors">
          {activity.message.includes(':') 
            ? activity.message.substring(activity.message.indexOf(':') + 2) 
            : activity.message}
        </p>
      </div>
    </div>
  );
};

const UploadView = ({ activity }: { activity: UploadActivity }) => {
  const removeActivity = useDynamicIslandStore(state => state.removeActivity);

  return (
    <div className="w-full h-full flex items-center gap-3 px-1">
      <div className="w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-text-secondary">
        <FiUploadCloud size={14} className="animate-pulse" />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex justify-between items-center">
           <p className="text-[10px] font-bold text-text-primary uppercase tracking-wider truncate max-w-[120px]">{activity.fileName}</p>
           <span className="text-[9px] font-mono text-accent">{Math.round(activity.progress)}%</span>
        </div>
        <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1 overflow-hidden">
          <motion.div 
            className="bg-accent h-full rounded-full shadow-neu-icon" 
            initial={{ width: 0 }}
            animate={{ width: `${activity.progress}%` }}
            transition={{ type: "spring", damping: 20 }}
          />
        </div>
      </div>
      
      <button 
        onClick={(e) => { e.stopPropagation(); removeActivity(activity.id); }}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-black/10 dark:bg-white/10 text-text-secondary hover:text-text-primary transition-all"
      >
        <FiX size={12} />
      </button>
    </div>
  );
};

const UpsellView = ({ activity, onUpgrade }: { activity: UpsellActivity, onUpgrade: () => void }) => {
  const removeActivity = useDynamicIslandStore(state => state.removeActivity);

  return (
    <div className="w-full h-full flex items-center gap-3 px-1">
      <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
        <FiStar size={14} className="animate-pulse" />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer" onClick={() => { removeActivity(activity.id); onUpgrade(); }}>
        <div className="flex justify-between items-baseline">
           <p className="text-[10px] font-bold text-text-primary uppercase tracking-wider">NYX PRO</p>
        </div>
        <p className="text-xs text-yellow-500/80 truncate font-medium hover:text-yellow-500 transition-colors">
          {activity.message}
        </p>
      </div>
      
      <button 
        onClick={(e) => { e.stopPropagation(); removeActivity(activity.id); onUpgrade(); }}
        className="text-[10px] font-bold uppercase tracking-wider bg-yellow-500 text-slate-900 px-2 py-1 rounded"
      >
        Upgrade
      </button>
    </div>
  );
};

const DynamicIsland = () => {
  const activities = useDynamicIslandStore(state => state.activities);
  const currentActivity = activities[0]; 
  const [showProModal, setShowProModal] = useState(false);

  const renderActivity = (activity: Activity) => {
    switch (activity.type) {
      case 'notification': return <NotificationView activity={activity} />;
      case 'upload': return <UploadView activity={activity} />;
      case 'upsell': return <UpsellView activity={activity} onUpgrade={() => setShowProModal(true)} />;
      default: return null;
    }
  }

  return (
    <>
    <div className="fixed top-2 left-0 right-0 z-[100] pointer-events-none flex justify-center">
      <AnimatePresence>
        {currentActivity && (
          <motion.div
            key={currentActivity.id}
            initial={{ height: 0, width: 100, opacity: 0, y: -20 }}
            animate={{ height: 48, width: 'auto', opacity: 1, y: 0, minWidth: 300 }}
            exit={{ height: 0, width: 100, opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="
              relative pointer-events-auto overflow-hidden
              bg-bg-main
              rounded-full px-4
              border border-text-secondary/10 dark:border-white/10
              shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]
              dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.7)]
              flex items-center
            "
          >
            {/* Glossy Reflection */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-black/5 dark:from-white/5 to-transparent pointer-events-none" />
            
            {renderActivity(currentActivity)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {showProModal && <SubscriptionModal onClose={() => setShowProModal(false)} />}
    </>
  );
};

export default DynamicIsland;
