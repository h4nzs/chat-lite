import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks follow the pattern in socketSync.test.ts, extended to capture the
// transportClient 'connect' handler so we can exercise the offline-sync poll
// and its one-shot delayed retry (FIX 2).

const loadMessagesForConversation = vi.fn()
const processOfflineQueue = vi.fn()
let conversations: unknown[] = []

const connectHandlers: Array<() => void> = []
const transportClientOn = vi.fn((event: string, cb: () => void) => {
  if (event === 'connect') connectHandlers.push(cb)
})

vi.mock('../transportClient', () => ({
  transportClient: { on: transportClientOn, sendEvent: vi.fn() },
  emitSessionKeyRequest: vi.fn(),
}))
vi.mock('@store/message', () => ({
  useMessageStore: { getState: () => ({ loadMessagesForConversation, processOfflineQueue }) },
}))
vi.mock('@store/conversation', () => ({
  useConversationStore: { getState: () => ({ conversations }), subscribe: () => () => {} },
}))
vi.mock('@store/auth', () => ({ useAuthStore: { getState: () => ({}) } }))
vi.mock('@store/connection', () => ({
  useConnectionStore: { getState: () => ({ setStatus: vi.fn() }) },
}))
vi.mock('@store/presence', () => ({ usePresenceStore: { getState: () => ({}) } }))

beforeEach(() => {
  // Fresh module instance per test so the isInitialized guard resets.
  vi.resetModules()
  loadMessagesForConversation.mockReset()
  processOfflineQueue.mockReset()
  conversations = []
  connectHandlers.length = 0
  vi.useFakeTimers()
})

async function loadModule() {
  const mod = await import('../socketListeners')
  mod.resetSocketSyncForTests()
  return mod
}

describe('socketListeners offline sync retry (FIX 2)', () => {
  it('schedules a single delayed retry after 8 failed polls, then syncs when conversations arrive', async () => {
    const socketListeners = await loadModule()
    socketListeners.initSocketListeners()
    connectHandlers.forEach((h) => h())

    // 8×500ms polling windows all find an empty conversation list → no sync yet.
    await vi.advanceTimersByTimeAsync(300 + 8 * 500) // 4300ms
    expect(loadMessagesForConversation).not.toHaveBeenCalled()

    // Conversations arrive; the 15s one-shot retry should now perform the sync.
    conversations = [{ id: 'c1', isGroup: false }]
    await vi.advanceTimersByTimeAsync(15000)
    expect(loadMessagesForConversation).toHaveBeenCalledWith('c1')
  })

  it('does not loop infinitely after the single delayed retry also fails', async () => {
    const socketListeners = await loadModule()
    socketListeners.initSocketListeners()
    connectHandlers.forEach((h) => h())

    // Exhaust normal polling (schedules the 15s retry).
    await vi.advanceTimersByTimeAsync(300 + 8 * 500) // 4300ms
    // The one-shot retry fires with still-empty conversations → must NOT reschedule.
    await vi.advanceTimersByTimeAsync(15000) // 19300ms
    expect(loadMessagesForConversation).not.toHaveBeenCalled()

    // Even after a long wait, no further sync attempt (no infinite loop).
    await vi.advanceTimersByTimeAsync(60000)
    expect(loadMessagesForConversation).not.toHaveBeenCalled()
  })

  it('supersedes the pending retry when a real sync starts first', async () => {
    const socketListeners = await loadModule()
    socketListeners.initSocketListeners()
    connectHandlers.forEach((h) => h())

    // Exhaust polling → schedules 15s retry.
    await vi.advanceTimersByTimeAsync(300 + 8 * 500) // 4300ms
    expect(loadMessagesForConversation).not.toHaveBeenCalled()

    // A real sync starts (e.g. via the Zustand subscription) before the retry fires.
    conversations = [{ id: 'c2', isGroup: false }]
    await socketListeners.doSyncMessages()
    expect(loadMessagesForConversation).toHaveBeenCalledWith('c2')

    // The pending retry must be cleared, so advancing 15s does nothing further.
    await vi.advanceTimersByTimeAsync(15000)
    expect(loadMessagesForConversation).toHaveBeenCalledTimes(1)
  })
})
