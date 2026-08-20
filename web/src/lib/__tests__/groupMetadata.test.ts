import { describe, it, expect, vi } from 'vitest'
import { resolveGroupMetadata, type ResolveGroupMetadataDeps } from '../groupMetadata'

type MockFn = ReturnType<typeof vi.fn>

function makeDeps(overrides: { decrypt?: MockFn; save?: MockFn; cacheParticipants?: MockFn } = {}) {
  const decrypt: MockFn = vi.fn()
  const save: MockFn = vi.fn()
  const cacheParticipants: MockFn = vi.fn()
  return { decrypt, save, cacheParticipants, ...overrides }
}

function withDeps(deps: ReturnType<typeof makeDeps>): ResolveGroupMetadataDeps {
  return deps as unknown as ResolveGroupMetadataDeps
}

describe('resolveGroupMetadata', () => {
  it('pakai cache bila decryptedMetadata sudah ada (tidak pernah dekripsi ulang)', async () => {
    const deps = makeDeps()
    const res = await resolveGroupMetadata(
      { id: 'g1', isGroup: true, encryptedMetadata: 'enc', decryptedMetadata: { title: 'Team' } },
      withDeps(deps)
    )
    expect(res).toEqual({ title: 'Team' })
    expect(deps.decrypt).not.toHaveBeenCalled()
    expect(deps.save).not.toHaveBeenCalled()
  })

  it('mendekripsi lalu MEMPERSIST hasilnya (regresi "Unknown Group" setelah reload)', async () => {
    const deps = makeDeps({
      decrypt: vi.fn().mockResolvedValue({ title: 'Team', participants: ['a', 'b'] }),
    })
    const res = await resolveGroupMetadata(
      { id: 'g1', isGroup: true, encryptedMetadata: 'enc' },
      withDeps(deps)
    )
    expect(res).toEqual({ title: 'Team', participants: ['a', 'b'] })
    expect(deps.decrypt).toHaveBeenCalledWith('enc', 'g1')
    expect(deps.cacheParticipants).toHaveBeenCalledWith('g1', ['a', 'b'])
    // Inti regresi: hasil dekripsi disimpan dengan decryptedMetadata terpasang.
    expect(deps.save).toHaveBeenCalledTimes(1)
    const saved = deps.save.mock.calls[0]?.[0]
    expect(saved).toMatchObject({ id: 'g1', encryptedMetadata: 'enc', decryptedMetadata: { title: 'Team', participants: ['a', 'b'] } })
  })

  it('non-grup → tanpa metadata, tanpa dekripsi', async () => {
    const deps = makeDeps()
    const res = await resolveGroupMetadata({ id: 'c1', isGroup: false, encryptedMetadata: 'enc' }, withDeps(deps))
    expect(res).toBeUndefined()
    expect(deps.decrypt).not.toHaveBeenCalled()
    expect(deps.save).not.toHaveBeenCalled()
  })

  it('dekripsi gagal (throw) → undefined, tanpa persist', async () => {
    const deps = makeDeps({ decrypt: vi.fn().mockRejectedValue(new Error('ratchet advanced')) })
    const res = await resolveGroupMetadata({ id: 'g1', isGroup: true, encryptedMetadata: 'enc' }, withDeps(deps))
    expect(res).toBeUndefined()
    expect(deps.save).not.toHaveBeenCalled()
  })
})