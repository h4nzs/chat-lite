import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Chat from './pages/Chat'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/auth'

export default function App() {
  const theme = useAuthStore((s) => s.theme)
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <BrowserRouter>
          <header className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <Link to="/" className="font-semibold">Chat‑Lite</Link>
            <ThemeToggle />
          </header>
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
      className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}