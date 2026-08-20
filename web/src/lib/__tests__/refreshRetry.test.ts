import { describe, it, expect, vi } from 'vitest'
import { refreshWithRetry } from '../refreshRetry'

describe('refreshWithRetry', () => {
  it('success pada percobaan pertama → hanya 1 panggilan', async () => {
    const fn = vi.fn().mockResolvedValue({ accessToken: 'tok-1' })
    const res = await refreshWithRetry(fn, 3, 1)
    expect(res?.accessToken).toBe('tok-1')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('gagal transien 2× lalu sukses → retry sampai berhasil (regresi: jangan logout)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network hiccup'))
      .mockRejectedValueOnce(new Error('concurrent rotation'))
      .mockResolvedValueOnce({ accessToken: 'tok-ok' })

    const res = await refreshWithRetry(fn, 3, 1)
    expect(res?.accessToken).toBe('tok-ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('gagal terus → null setelah attempts kali', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('401'))
    const res = await refreshWithRetry(fn, 3, 1)
    expect(res).toBeNull()
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('respons tanpa accessToken dianggap gagal dan di-retry', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ accessToken: 'tok-2' })
    const res = await refreshWithRetry(fn, 3, 1)
    expect(res?.accessToken).toBe('tok-2')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})