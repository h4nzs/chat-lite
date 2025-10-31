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

export default function App() {
  useEffect(() => {
    const cleanup = useSocketStore.getState().initSocketListeners();
    return cleanup; // Return the cleanup function to be called on unmount
  }, []);
  return (
    <div className="dark">
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/keys" element={<ProtectedRoute><KeyManagementPage /></ProtectedRoute>} /> {/* Add the new route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
