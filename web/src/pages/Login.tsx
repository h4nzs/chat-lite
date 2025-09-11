import { Link, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { useAuthStore } from '../store/auth'

export default function Login() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" 
         style={{ backgroundImage: "url('/bg.jpg')" }}>
      {/* Overlay blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative z-10 bg-white/10 dark:bg-gray-800/40 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-white">Welcome Back</h1>
        <AuthForm
          button="Login"
          onSubmit={async ({ a, b }) => {
            await login(a!, b!)
            navigate('/')
          }}
        />
        <div className="mt-4 text-center text-sm text-white/90">
          <p>
            Forgot your password? <Link to="/reset" className="underline">Reset</Link>
          </p>
          <p className="mt-2">
            New here? <Link to="/register" className="font-semibold">Create Account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}