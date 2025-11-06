import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Restore from './pages/Restore';
import Chat from './pages/Chat';
import SettingsPage from './pages/SettingsPage';
import KeyManagementPage from './pages/KeyManagementPage';
import SessionManagerPage from './pages/SessionManagerPage';
import LinkDevicePage from './pages/LinkDevicePage';
import DeviceScannerPage from './pages/DeviceScannerPage';
import ProfilePage from './pages/ProfilePage'; // Import ProfilePage
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { useSocketStore } from './store/socket';
import { useAuthStore } from './store/auth'; // Add this import
import { useEffect } from 'react';
import ConfirmModal from './components/ConfirmModal';
import UserInfoModal from './components/UserInfoModal'; // Import UserInfoModal
import PasswordPromptModal from './components/PasswordPromptModal';
import ChatInfoModal from './components/ChatInfoModal';
import DynamicIsland from './components/DynamicIsland';
import ConnectionStatusBanner from './components/ConnectionStatusBanner'; // Import ConnectionStatusBanner
import { useThemeStore } from './store/theme';
import { getSocket } from './lib/socket';
import { useGlobalShortcut } from './hooks/useGlobalShortcut';

export default function App() {
  const { theme } = useThemeStore();
  const { bootstrap, logout, user } = useAuthStore();

  const focusSearch = () => {
    const searchInput = document.getElementById('global-search-input');
    searchInput?.focus();
  };

  useGlobalShortcut(['Control', 'k'], focusSearch);
  useGlobalShortcut(['Meta', 'k'], focusSearch); // For macOS

  useEffect(() => {
    // This is now the single entry point for app initialization.
    // It ensures the user is authenticated before any other actions.
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (user) {
      const socket = getSocket();
      socket.on('force_logout', (data) => {
        // Optional: Check if the logged-out session matches the current one if needed
        // For now, any force_logout for the user will trigger a logout
        console.log(`Received force_logout for session: ${data.jti}. Logging out.`);
        logout();
      });

      return () => {
        socket.off('force_logout');
      };
    }
  }, [user, logout]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
      <ConnectionStatusBanner /> {/* Add ConnectionStatusBanner here */}
      <BrowserRouter>
        <ConfirmModal />
        <UserInfoModal />
        <PasswordPromptModal />
        <ChatInfoModal />
        <DynamicIsland />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/restore" element={<Restore />} />
          <Route path="/link-device" element={<LinkDevicePage />} />
          <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/keys" element={<ProtectedRoute><KeyManagementPage /></ProtectedRoute>} />
          <Route path="/settings/sessions" element={<ProtectedRoute><SessionManagerPage /></ProtectedRoute>} />
          <Route path="/settings/link-device" element={<ProtectedRoute><DeviceScannerPage /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
