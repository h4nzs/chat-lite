import { create } from 'zustand';

export type AppNotification = {
  id: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string; // Optional link to navigate to
};

type NotificationState = {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
};

const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    set(state => {
      const newNotification: AppNotification = {
        id: Date.now().toString(), // Simple unique ID
        timestamp: Date.now(),
        read: false,
        ...notification,
      };
      return {
        notifications: [newNotification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    });
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
