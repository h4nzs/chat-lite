import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock seluruh store yang diimpor socketListeners agar modul dapat dimuat
// tanpa mengeksekusi kode produksi yang berat (transportClient, auth, dll).
const loadMessagesForConversation = vi.fn()
const processOfflineQueue = vi.fn()

let conversations: unknown[] = []

vi.mock('@store/message', () => ({
  useMessageStore: {
    getState: () => ({ loadMessagesForConversation, processOfflineQueue }),
  },
}))

vi.mock('@store/conversation', () => ({
  useConversationStore: {
    getState: () => ({ conversations }),
    subscribe: () => () => {},
  },
}))

vi.mock('@store/auth', () => ({
  useAuthStore: { getState: vi.fn() },
}))

vi.mock('@store/connection', () => ({
  useConnectionStore: { getState: () => ({ setStatus: vi.fn() }) },
}))

vi.mock('@store/presence', () => ({
  usePresenceStore: { getState: () => ({}) },
}))

import * as socketListeners from '../socketListeners'

beforeEach(() => {
  loadMessagesForConversation.mockReset()
  processOfflineQueue.mockReset()
  socketListeners.resetSocketSyncForTests()
  conversations = []
})

describe('doSyncMessages (reconnect offline sync)', () => {
  it('memanggil loadMessagesForConversation untuk SEMUA non-burner conversation — termasuk grup tanpa decryptedMetadata (regresi: pesan grup tidak muncul setelah reconnect)', async () => {
    conversations = [
      { id: 'g1', isGroup: true, encryptedMetadata: 'enc', decryptedMetadata: undefined },
      { id: 'c1', isGroup: false },
      { id: 'burner_x', isGroup: false },
    ]

    await socketListeners.doSyncMessages()

    expect(loadMessagesForConversation).toHaveBeenCalledWith('g1')
    expect(loadMessagesForConversation).toHaveBeenCalledWith('c1')
    // Burner di-skip
    expect(loadMessagesForConversation).not.toHaveBeenCalledWith('burner_x')
    expect(processOfflineQueue).toHaveBeenCalledTimes(1)
  })

  it('tidak memanggil apa pun bila tidak ada conversation (poll tetap bisa dijalankan lagi)', async () => {
    conversations = []
    await socketListeners.doSyncMessages()
    expect(loadMessagesForConversation).not.toHaveBeenCalled()
  })
})