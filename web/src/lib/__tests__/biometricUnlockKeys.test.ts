import { describe, it, expect, vi } from 'vitest'
import { unlockFromRecoveryPhrase } from '../biometricUnlockKeys'
import type { RetrievedKeys } from '../crypto-worker-proxy'

const fakeKeys = { masterSeed: new Uint8Array(32) } as RetrievedKeys

function makeDeps(overrides: Record<string, unknown> = {}) {
  const restoreFromPhrase = vi.fn().mockResolvedValue({ encryptedPrivateKeys: 'enc-bundle' })
  const retrievePrivateKeys = vi.fn().mockResolvedValue({ success: true, keys: fakeKeys })
  const setDecryptedKeys = vi.fn().mockResolvedValue(undefined)
  return {
    restoreFromPhrase,
    retrievePrivateKeys,
    setDecryptedKeys,
    randomPassword: () => 'test-session-pass',
    ...overrides,
  }
}

describe('unlockFromRecoveryPhrase (biometric → RAM only)', () => {
  it('mendekripsi bundle dari phrase lalu set kunci di RAM — TANPA menulis ke IndexedDB', async () => {
    const deps = makeDeps()
    const ok = await unlockFromRecoveryPhrase('phrase-words', deps)

    expect(ok).toBe(true)
    expect(deps.restoreFromPhrase).toHaveBeenCalledWith('phrase-words', 'test-session-pass')
    expect(deps.retrievePrivateKeys).toHaveBeenCalledWith('enc-bundle', 'test-session-pass')
    expect(deps.setDecryptedKeys).toHaveBeenCalledWith(fakeKeys)

    // KONTRAK: tidak ada dependensi penyimpanan IDB (saveEncryptedKeys /
    // saveDeviceAutoUnlockKey) — jika fungsionalitas itu dibutuhkan ulang, ia
    // harus dimasukkan sebagai dep eksplisit; kontrak helper ini hanya 3 aksi.
    const depsKeys = Object.keys(deps)
    expect(depsKeys).not.toContain('saveEncryptedKeys')
    expect(depsKeys).not.toContain('saveDeviceAutoUnlockKey')
  })

  it('dekripsi gagal → false, tanpa set kunci', async () => {
    const deps = makeDeps({ retrievePrivateKeys: vi.fn().mockResolvedValue({ success: false }) })
    const ok = await unlockFromRecoveryPhrase('phrase-words', deps)
    expect(ok).toBe(false)
    expect(deps.setDecryptedKeys).not.toHaveBeenCalled()
  })
})