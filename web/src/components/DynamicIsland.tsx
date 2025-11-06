import { toAbsoluteUrl } from '@utils/url';
import { useNavigate } from 'react-router-dom';
import { useConversationStore } from '@store/conversation';
import { motion, AnimatePresence } from 'framer-motion';
import useDynamicIslandStore, { Activity, NotificationActivity, UploadActivity } from '@store/dynamicIsland';
import { FiFile, FiX } from 'react-icons/fi';

const NotificationView = ({ activity }: { activity: NotificationActivity }) => {
  const openConversation = useConversationStore(state => state.openConversation);
  const removeActivity = useDynamicIslandStore(state => state.removeActivity);
  const navigate = useNavigate();

  const handleClick = () => {
    if (activity.link) {
      openConversation(activity.link);
      navigate('/');
    }
    removeActivity(activity.id);
  };

  return (
    <div onClick={handleClick} className="relative p-px rounded-full bg-accent-gradient cursor-pointer">
      <div className="bg-bg-surface/80 backdrop-blur-xl rounded-full">
        <div className="p-2 flex items-center gap-3">
          <img 
            src={toAbsoluteUrl(activity.sender?.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${activity.sender?.name}`}
            alt="Sender Avatar"
            className="w-10 h-10 rounded-full bg-bg-primary object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-text-primary truncate">{activity.sender?.name || 'New Message'}</p>
            <p className="text-sm text-text-secondary truncate">{activity.message.substring(activity.message.indexOf(':') + 2)}</p>
          </div>
          <div className="w-10 h-10 flex-shrink-0"></div> {/* Spacer */}
        </div>
      </div>
    </div>
  );
};

const UploadView = ({ activity }: { activity: UploadActivity }) => {
  const removeActivity = useDynamicIslandStore(state => state.removeActivity);

  return (
    <div className="relative p-px rounded-full bg-gray-500">
      <div className="bg-bg-surface/80 backdrop-blur-xl rounded-full">
        <div className="p-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center">
            <FiFile className="text-text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-text-primary truncate">{activity.fileName}</p>
            <div className="flex items-center gap-2">
              <div className="w-full bg-gray-600 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${activity.progress}%` }}></div>
              </div>
              <p className="text-xs text-text-secondary">{Math.round(activity.progress)}%</p>
            </div>
          </div>
          <button onClick={() => removeActivity(activity.id)} className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
            <FiX />
          </button>
        </div>
      </div>
    </div>
  );
};

const DynamicIsland = () => {
  const activities = useDynamicIslandStore(state => state.activities);
  const currentActivity = activities[0]; // We only show the most recent activity

  const renderActivity = (activity: Activity) => {
    switch (activity.type) {
      case 'notification':
        return <NotificationView activity={activity} />;
      case 'upload':
        return <UploadView activity={activity} />;
      default:
        return null;
    }
  }

  return (
    <div className="fixed top-4 left-0 right-0 z-50 pointer-events-none">
      <AnimatePresence>
        {currentActivity && (
          <motion.div
            key={currentActivity.id}
            initial={{ opacity: 0, scale: 0.7, x: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, scale: 0.7, x: "-50%" }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="absolute left-1/2 min-w-[280px] max-w-sm pointer-events-auto shadow-lg"
          >
            {renderActivity(currentActivity)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DynamicIsland;