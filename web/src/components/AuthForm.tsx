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
        catch (ex: unknown) { 
          if (ex instanceof Error) {
            setErr(ex.message || 'Failed');
          } else {
            setErr('An unknown error occurred');
          }
        }
      }}
    >
      {err ? <Alert message={err} /> : null}

      {button === 'Sign Up' ? (
        <>
          <input
            aria-label="Name"
            className="w-full p-3 rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Name"
            value={name}
            onChange={(e) => setE(e.target.value)}
          />
          <input
            aria-label="Email"
            className="w-full p-3 rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Email"
            value={email}
            onChange={(e) => setC(e.target.value)}
          />
          <input
            aria-label="Username"
            className="w-full p-3 rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Username"
            value={username}
            onChange={(e) => setD(e.target.value)}
          />
        </>
      ) : (
        <input
          aria-label="Email or Username"
          className="w-full p-3 rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Email or Username"
          value={emailOrUsername}
          onChange={(e) => setA(e.target.value)}
        />
      )}

      <input
        aria-label="Password"
        minLength={8}
        className="w-full p-3 rounded-lg border bg-background border-border focus:outline-none focus:ring-2 focus:ring-accent"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setB(e.target.value)}
      />

      <button
        className="w-full py-3 rounded-lg bg-accent text-accent-foreground font-semibold shadow-md hover:bg-accent/90 transition"
        aria-label={button}
      >
        {button}
      </button>
    </form>
  )
}