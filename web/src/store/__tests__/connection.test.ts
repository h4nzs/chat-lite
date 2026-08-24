import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock transportClient.connectSocket (dynamically imported by scheduleReconnect)
// and the auth store (dynamically imported for the accessToken check).
const connectSocket = vi.fn()

// Mutable auth state so individual tests can simulate "no active session".
const authState: { accessToken: string | null; user: { id: string } | null } = {
  accessToken: 'tok',
  user: { id: 'u1' },
}

vi.mock('@lib/transportClient', () => ({ connectSocket }))
vi.mock('@lib/api', () => ({ authFetch: vi.fn() }))
vi.mock('@store/auth', () => ({
  useAuthStore: { getState: () => authState },
}))

import { useConnectionStore, clearReconnectTimer } from '../connection'

const setVisibility = (state: string) =>
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })

beforeEach(() => {
  vi.useFakeTimers()
  connectSocket.mockReset()
  authState.accessToken = 'tok'
  authState.user = { id: 'u1' }
  setVisibility('visible')
  clearReconnectTimer()
  useConnectionStore.setState({ status: 'connected' })
  // Deterministic backoff (jitter mocked to 0).
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('connection scheduleReconnect + visibilitychange (FIX 1)', () => {
  it('re-arms reconnect when the tab becomes visible after a hidden disconnect', async () => {
    // Disconnect while hidden → scheduleReconnect no-ops (no timer set).
    setVisibility('hidden')
    useConnectionStore.getState().setStatus('disconnected')
    expect(connectSocket).not.toHaveBeenCalled()

    // Tab becomes visible → the registered listener must schedule a reconnect.
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    // Backoff for attempt #1 = 1000 * 2^1 = 2000ms (jitter = 0).
    await vi.advanceTimersByTimeAsync(2000)
    expect(connectSocket).toHaveBeenCalledTimes(1)
  })

  it('does not double-schedule when a reconnect timer is already pending', async () => {
    // Disconnect while visible → timer scheduled immediately.
    setVisibility('visible')
    useConnectionStore.getState().setStatus('disconnected')

    // Another visible transition must NOT add a second timer.
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(2000)
    expect(connectSocket).toHaveBeenCalledTimes(1)
  })

  it('ignores visibilitychange when status is connected', () => {
    setVisibility('visible')
    useConnectionStore.setState({ status: 'connected' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(connectSocket).not.toHaveBeenCalled()
  })

  it('does not reconnect when there is no active session (accessToken missing)', async () => {
    authState.accessToken = null
    authState.user = null

    setVisibility('hidden')
    useConnectionStore.getState().setStatus('disconnected')
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    await vi.advanceTimersByTimeAsync(2000)
    expect(connectSocket).not.toHaveBeenCalled()
  })
})
