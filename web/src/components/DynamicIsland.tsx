import useNotificationStore from '@store/notification';
import { useEffect } from 'react';
import { toAbsoluteUrl } from '@utils/url';
import { useNavigate } from 'react-router-dom';
import { useConversationStore } from '@store/conversation';
import { motion, AnimatePresence } from 'framer-motion';

const islandVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: -20, // Slight upward movement to feel less static
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
  },
};

const DynamicIsland = () => {
  const { activePopup, hidePopup } = useNotificationStore(state => ({
    activePopup: state.activePopup,
    hidePopup: state.hidePopup,
  }));
  const openConversation = useConversationStore(state => state.openConversation);
  const navigate = useNavigate();

  const handleClick = () => {
    if (activePopup?.link) {
      openConversation(activePopup.link);
      navigate('/');
    }
    hidePopup();
  };

  return (
    <AnimatePresence>
      {activePopup && (
        <motion.div
          layout
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={islandVariants}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md mx-auto"
          onClick={handleClick}
        >
          <div className="relative p-px rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
            <div className="bg-surface/80 backdrop-blur-xl rounded-full">
              <div className="p-2 flex items-center gap-3">
                <img 
                  src={toAbsoluteUrl(activePopup.sender?.avatarUrl) || `https://api.dicebear.com/8.x/initials/svg?seed=${activePopup.sender?.name}`}
                  alt="Sender Avatar"
                  className="w-10 h-10 rounded-full bg-primary object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{activePopup.sender?.name || 'New Message'}</p>
                  <p className="text-sm text-text-secondary truncate">{activePopup.message.substring(activePopup.message.indexOf(':') + 2)}</p>
                </div>
                <div className="w-10 h-10 flex-shrink-0"></div> {/* Spacer */}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DynamicIsland;
