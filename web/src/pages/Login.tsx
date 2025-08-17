import { Link, useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { useAuthStore } from '../store/auth'

export default function Login() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Login</h1>
      <AuthForm
        button="Sign In"
        onSubmit={async ({ a, b }) => {
          await login(a!, b!)
          navigate('/')
        }}
      />
      <p className="mt-3 text-sm">No account? <Link to="/register" className="underline">Register</Link></p>
    </div>
  )
}