import { useState } from 'react'
import Alert from './Alert'

export default function AuthForm({ onSubmit, button }: { onSubmit: (v: { a: string; b?: string; c?: string; d?: string; name?: string }) => Promise<void>; button: string }) {
  const [emailOrUsername, setA] = useState('')
  const [password, setB] = useState('')
  const [email, setC] = useState('')
  const [username, setD] = useState('')
  const [name, setE] = useState('')
  const [err, setErr] = useState<string>('')

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setErr('')
        try { 
          await onSubmit({ a: emailOrUsername, b: password, c: email, d: username, name }) 
        }
        catch (ex: any) { setErr(ex?.message || 'Failed') }
      }}
    >
      {err ? <Alert message={err} /> : null}

      {button === 'Sign Up' ? (
        <>
          <input
            aria-label="Name"
            className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
            placeholder="Name"
            value={name}
            onChange={(e) => setE(e.target.value)}
          />
          <input
            aria-label="Email"
            className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
            placeholder="Email"
            value={email}
            onChange={(e) => setC(e.target.value)}
          />
          <input
            aria-label="Username"
            className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
            placeholder="Username"
            value={username}
            onChange={(e) => setD(e.target.value)}
          />
        </>
      ) : (
        <input
          aria-label="Email or Username"
          className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
          placeholder="Email or Username"
          value={emailOrUsername}
          onChange={(e) => setA(e.target.value)}
        />
      )}

      <input
        aria-label="Password"
        minLength={8}
        className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:border-gray-600"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setB(e.target.value)}
      />

      <button
        className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold shadow-md hover:opacity-90 transition"
        aria-label={button}
      >
        {button}
      </button>
    </form>
  )
}