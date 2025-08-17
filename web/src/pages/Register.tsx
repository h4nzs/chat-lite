import { Link, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { useAuthStore } from '../store/auth'

export default function Register() {
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Register</h1>
      <AuthForm
        button="Sign Up"
        onSubmit={async (v) => {
          await register({ email: v.c!, username: v.d!, password: v.b!, name: (v as any).name })
          navigate('/')
        }}
      />
      <p className="mt-3 text-sm">Have an account? <Link to="/login" className="underline">Login</Link></p>
    </div>
  )
}