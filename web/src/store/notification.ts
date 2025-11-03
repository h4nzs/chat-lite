import { create } from 'zustand';

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
  activePopup: AppNotification | null;
  addNotification: (notification: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => void;
  showPopup: (notification: AppNotification) => void;
  hidePopup: () => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  removeNotificationsForConversation: (conversationId: string) => void;
};

let popupTimeout: NodeJS.Timeout;

const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  activePopup: null,

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
    get().showPopup(newNotification);
  },

  showPopup: (notification) => {
    if (popupTimeout) {
      clearTimeout(popupTimeout);
    }
    set({ activePopup: notification });
    popupTimeout = setTimeout(() => {
      get().hidePopup();
    }, 5000); // Hide after 5 seconds
  },

  hidePopup: () => {
    set({ activePopup: null });
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

  removeNotificationsForConversation: (conversationId: string) => {
    set(state => {
      if (state.activePopup?.link === conversationId) {
        return { activePopup: null };
      }
      return {};
    });
  },
}));

export default useNotificationStore;
