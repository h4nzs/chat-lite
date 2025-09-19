import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Chat from './pages/Chat'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/auth'
import { Toaster } from 'react-hot-toast'

export default function App() {
  const theme = useAuthStore((s) => s.theme)
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: theme === 'dark' ? '#333' : '#fff',
            color: theme === 'dark' ? '#fff' : '#333',
          },
        }}
      />
      {/* --- FIX: kunci tinggi + cegah scroll global --- */}
      <div className="h-[100dvh] overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <BrowserRouter>
          {/* gunakan flex-col agar header fixed di atas, content isi penuh */}
          <div className="flex flex-col h-full">
            <header className="shrink-0 p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <Link to="/" className="font-semibold text-lg">Chat-Lite</Link>
              <ThemeToggle />
            </header>
            {/* --- FIX: wrapper isi agar scroll hanya terjadi di dalam halaman Chat --- */}
            <div className="flex-1 min-h-0">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Chat />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const theme = useAuthStore((s) => s.theme)
  const setTheme = useAuthStore((s) => s.setTheme)
  return (
    <button
      aria-label="Toggle theme"
      className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 text-sm"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}