import { Link, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { useAuthStore } from '../store/auth'

export default function Register() {
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" 
         style={{ backgroundImage: "url('/bg.jpg')" }}>
      {/* Overlay blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative z-10 bg-white/10 dark:bg-gray-800/40 backdrop-blur-md rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-white">Create Account</h1>
        <AuthForm
          button="Sign Up"
          onSubmit={async (v) => {
            await register({
              email: v.c!,
              username: v.d!,
              password: v.b!,
              name: (v as any).name
            })
            navigate('/')
          }}
        />
        <div className="mt-4 text-center text-sm text-white/90">
          <p>
            Have an account? <Link to="/login" className="font-semibold">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}