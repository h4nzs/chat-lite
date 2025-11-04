import { create } from 'zustand';
import useDynamicIslandStore from './dynamicIsland';

export type AppNotification = {
  id: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string; // Optional link to navigate to
  sender?: { id: string; name: string; username: string; avatarUrl?: string | null };
};

type NotificationState = {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
};

const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    const newNotification: AppNotification = {
      id: Date.now().toString(), // Simple unique ID
      timestamp: Date.now(),
      read: false,
      ...notification,
    };
    set(state => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));

    // Integrate with Dynamic Island
    if (newNotification.sender && newNotification.link) {
      useDynamicIslandStore.getState().addActivity({
        type: 'notification',
        sender: newNotification.sender,
        message: newNotification.message,
        link: newNotification.link,
      }, 5000); // Auto-hide after 5 seconds
    }
  },

  markAllAsRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  },
}));

export default useNotificationStore;