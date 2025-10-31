import * as Popover from '@radix-ui/react-popover';
import { FiBell } from 'react-icons/fi';
import useNotificationStore from '@store/notification';
import NotificationPopover from './NotificationPopover';
import { useEffect } from 'react';

const NotificationBell = () => {
  const { unreadCount, markAllAsRead } = useNotificationStore(state => ({
    unreadCount: state.unreadCount,
    markAllAsRead: state.markAllAsRead,
  }));

  const handleOpenChange = (open: boolean) => {
    // When the popover is opened, mark all notifications as read.
    if (open && unreadCount > 0) {
      // Delay slightly to avoid marking as read before the user sees the unread count.
      setTimeout(() => {
        markAllAsRead();
      }, 1000);
    }
  };

  return (
    <Popover.Root onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button className="relative p-2 rounded-full hover:bg-gray-700 text-text-secondary hover:text-white transition-colors">
          <FiBell />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={10} align="end" className="z-50">
          <NotificationPopover />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default NotificationBell;
