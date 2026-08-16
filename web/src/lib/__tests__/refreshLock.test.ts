import { describe, it, expect } from 'vitest'
import { runExclusive } from '../refreshLock'

// jsdom tidak punya navigator.locks → test ini menutupi jalur fallback localStorage.
describe('runExclusive (localStorage fallback)', () => {
  it('menserialkan tugas yang dipanggil bersamaan (tidak pernah overlap)', async () => {
    let active = 0
    let maxActive = 0
    const task = async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 40))
      active--
    }

    await Promise.all([runExclusive(task), runExclusive(task), runExclusive(task)])

    expect(maxActive).toBe(1)
  })

  it('melepas kunci setelah selesai sehingga tugas berikutnya bisa masuk', async () => {
    const order: string[] = []

    await runExclusive(async () => {
      order.push('first')
      await new Promise((r) => setTimeout(r, 20))
    })
    await runExclusive(async () => {
      order.push('second')
    })

    expect(order).toEqual(['first', 'second'])
    expect(localStorage.getItem('nyx_refresh_lock')).toBeNull()
  })
})