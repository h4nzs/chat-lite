import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
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
import LandingPage from './pages/LandingPage';
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
import { syncSessionKeys } from './utils/sessionSync';
import { useConversationStore } from './store/conversation';

let isSyncing = false;

// New component to handle root navigation
const Home = () => {
  const { conversations, loading } = useConversationStore(state => ({
    conversations: state.conversations,
    loading: state.loading,
  }));

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        {/* You can replace this with a proper Spinner component */}
        <p>Loading conversations...</p>
      </div>
    );
  }

  if (conversations.length > 0) {
    return <Navigate to={`/chat/${conversations[0].id}`} replace />;
  }

  // If there are no conversations, render the Chat page in a welcome/empty state
  return <Chat />;
};

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

  // --- NEW: Trigger key sync after user is loaded and UI is ready ---
  useEffect(() => {
    const sync = async () => {
      if (user && sessionStorage.getItem('keys_synced') !== 'true' && !isSyncing) {
        try {
          isSyncing = true;
          await syncSessionKeys();
          sessionStorage.setItem('keys_synced', 'true');
        } catch (error) {
          console.error("An error occurred during key synchronization:", error);
          // The toast in syncSessionKeys should handle user feedback
        } finally {
          isSyncing = false;
        }
      }
    };
    sync();
  }, [user]);
  // --- END NEW ---

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
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 5000,
          className: 'glass-toast',
          style: {
            background: 'hsl(var(--bg-surface) / 0.8)',
            color: 'hsl(var(--text-primary))',
            border: '1px solid hsl(var(--border))',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: 'hsl(var(--accent))',
              secondary: 'hsl(var(--accent-foreground))',
            },
          },
          error: {
            iconTheme: {
              primary: 'hsl(var(--destructive))',
              secondary: 'hsl(var(--destructive-foreground))',
            },
          },
        }}
      />
      <CommandPalette />
      <ConfirmModal />
      <UserInfoModal />
      <PasswordPromptModal />
      <ChatInfoModal />
      <DynamicIsland />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/restore" element={<Restore />} />
        <Route path="/link-device" element={<LinkDevicePage />} />
        <Route path="/chat" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/chat/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
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
