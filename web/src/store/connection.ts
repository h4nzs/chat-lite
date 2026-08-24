import { create } from 'zustand';
import { authFetch } from '@lib/api';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export interface Device { 
  id: string; 
  isCurrent: boolean; 
  name: string; 
  lastActiveAt: string; 
  createdAt: string; 
}

interface ConnectionState {
  status: ConnectionStatus;
  myDevices: Device[];
  hasFetchedDevices: boolean;
  setStatus: (status: ConnectionStatus) => void;
  fetchMyDevices: (force?: boolean) => Promise<Device[]>;
}

let isFetchingDevices = false;

let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_RECONNECT_DELAY_MS = 30000; // cap 30 detik
const BASE_RECONNECT_DELAY_MS = 1000;

function scheduleReconnect(status: () => ConnectionStatus) {
  if (reconnectTimer || document.visibilityState !== 'visible') return;
  const exponential = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY_MS);
  const jitter = Math.random() * 1000;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    // JANGAN reconnect bila sudah logout — sebelumnya timer terus memanggil
    // transport-ticket dengan token basi (loop 401 tiap ~3 detik di console).
    const { useAuthStore } = await import('./auth');
    if (!useAuthStore.getState().accessToken) return;
    if (document.visibilityState === 'visible' && status() === 'disconnected') {
      const { connectSocket } = await import('@lib/transportClient');
      connectSocket();
    }
  }, exponential + jitter);
}

export function clearReconnectTimer() {
  reconnectAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// scheduleReconnect() no-ops while the document is hidden (it early-returns when
// document.visibilityState !== 'visible'). Without a visibilitychange listener a
// disconnect that happened (or was scheduled) while hidden could leave the app
// disconnected forever until a manual reload. This listener re-arms the reconnect
// exactly once when the tab becomes visible again and we are still disconnected.
let visibilityListenerRegistered = false;

function registerVisibilityListener() {
  if (visibilityListenerRegistered || typeof document === 'undefined') return;
  visibilityListenerRegistered = true;
  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      useConnectionStore.getState().status === 'disconnected'
    ) {
      // scheduleReconnect guards against a duplicate timer (reconnectTimer check),
      // so this is safe to call on every visible transition.
      scheduleReconnect(() => useConnectionStore.getState().status);
    }
  });
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'connecting',
  myDevices: [],
  hasFetchedDevices: false,
  
  setStatus: (status) => {
    set({ status });
    if (status === 'connected') {
      // Koneksi pulih → reset backoff
      reconnectAttempts = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      get().fetchMyDevices(true); // Re-fetch on reconnect
    } else if (status === 'disconnected') {
      reconnectAttempts++;
      scheduleReconnect(() => get().status);
    }
  },

  fetchMyDevices: async (force = false) => {
    const { useAuthStore } = await import('./auth');
    const user = useAuthStore.getState().user;
    
    // GUEST users (Burner Chat) are ephemeral and don't exist in the Device table.
    // They also lack persistent refresh tokens, so this call would trigger an auth loop.
    if (!user || user.role === 'GUEST' || user.id.startsWith('guest_')) return [];

    const { hasFetchedDevices, myDevices } = get();
    if (!force && hasFetchedDevices) return myDevices;
    
    if (isFetchingDevices) {
      // Wait a bit if currently fetching
      await new Promise(r => setTimeout(r, 100));
      return get().myDevices;
    }

    isFetchingDevices = true;
    try {
      const devices = await authFetch<Device[]>('/api/users/me/devices');
      set({ myDevices: devices, hasFetchedDevices: true });
      return devices;
    } catch (e) {
      console.error("Failed to fetch devices:", e);
      return myDevices;
    } finally {
      isFetchingDevices = false;
    }
  }
}));

// Register the visibilitychange listener once at module load so a reconnect is
// re-armed when the tab returns to the foreground after being hidden.
registerVisibilityListener();
