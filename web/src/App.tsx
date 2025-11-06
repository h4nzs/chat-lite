import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Restore from './pages/Restore';
import Chat from './pages/Chat';
import SettingsPage from './pages/SettingsPage';
import KeyManagementPage from './pages/KeyManagementPage';
import SessionManagerPage from './pages/SessionManagerPage';
import LinkDevicePage from './pages/LinkDevicePage';
import DeviceScannerPage from './pages/DeviceScannerPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/auth';
import { useEffect, useCallback } from 'react';
import ConfirmModal from './components/ConfirmModal';
import UserInfoModal from './components/UserInfoModal';
import PasswordPromptModal from './components/PasswordPromptModal';
import ChatInfoModal from './components/ChatInfoModal';
import DynamicIsland from './components/DynamicIsland';
import ConnectionStatusBanner from './components/ConnectionStatusBanner';
import { useThemeStore } from './store/theme';
import { getSocket } from './lib/socket';
import { useGlobalShortcut } from './hooks/useGlobalShortcut';
import { useCommandPaletteStore } from './store/commandPalette';
import CommandPalette from './components/CommandPalette';
import { FiLogOut, FiSettings } from 'react-icons/fi';

const AppContent = () => {
  const { theme, accent } = useThemeStore();
  const { bootstrap, logout, user } = useAuthStore();
  const openCommandPalette = useCommandPaletteStore(s => s.open);
  const { addCommands, removeCommands } = useCommandPaletteStore(s => ({
    addCommands: s.addCommands,
    removeCommands: s.removeCommands,
  }));
  const navigate = useNavigate();

  const settingsAction = useCallback(() => navigate('/settings'), [navigate]);
  const logoutAction = useCallback(() => logout(), [logout]);

  useGlobalShortcut(['Control', 'k'], openCommandPalette);
  useGlobalShortcut(['Meta', 'k'], openCommandPalette); // For macOS

  useEffect(() => {
    const commands = [
      {
        id: 'settings',
        name: 'Settings',
        action: settingsAction,
        icon: <FiSettings />,
        section: 'Navigation',
        keywords: 'preferences options configuration',
      },
      {
        id: 'logout',
        name: 'Logout',
        action: logoutAction,
        icon: <FiLogOut />,
        section: 'General',
        keywords: 'sign out exit leave',
      },
    ];
    addCommands(commands);
    return () => removeCommands(commands.map(c => c.id));
  }, [addCommands, removeCommands, settingsAction, logoutAction]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (user) {
      const socket = getSocket();
      socket.on('force_logout', (data) => {
        console.log(`Received force_logout for session: ${data.jti}. Logging out.`);
        logout();
      });
      return () => socket.off('force_logout');
    }
  }, [user, logout]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.dataset.accent = accent;
  }, [theme, accent]);

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
      <ConnectionStatusBanner />
      <CommandPalette />
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
    </>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
