import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import SettingsPage from './pages/SettingsPage';
import KeyManagementPage from './pages/KeyManagementPage';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import { useSocketStore } from './store/socket';
import { useEffect } from 'react';
import ConfirmModal from './components/ConfirmModal';
import DynamicIsland from './components/DynamicIsland';
import { useThemeStore } from './store/theme';

export default function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    const cleanup = useSocketStore.getState().initSocketListeners();
    return cleanup; // Return the cleanup function to be called on unmount
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
            background: '#333',
            color: '#fff',
          },
        }}
      />
      <ConfirmModal />
      <BrowserRouter>
        <DynamicIsland />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/keys" element={<ProtectedRoute><KeyManagementPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
