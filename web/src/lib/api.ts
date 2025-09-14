const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers, credentials: 'include' })
  let data: any = null
  try { data = await res.json() } catch { /* ignore */ }
  if (!res.ok) {
    const msg = data?.error || data?.message || 'Request failed'
    throw new Error(msg)
  }
  return data as T
}

export function handleApiError(e: unknown): string {
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}