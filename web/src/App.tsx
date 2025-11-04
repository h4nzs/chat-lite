import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Restore from './pages/Restore';
import Chat from './pages/Chat';
import SettingsPage from './pages/SettingsPage';
import KeyManagementPage from './pages/KeyManagementPage';
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

export default function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    // This is now the single entry point for app initialization.
    // It ensures the user is authenticated before any other actions.
    useAuthStore.getState().bootstrap();
  }, []);

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
          <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/keys" element={<ProtectedRoute><KeyManagementPage /></ProtectedRoute>} />
          <Route path="/profile/:userId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
