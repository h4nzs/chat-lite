// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { describe, it, expect } from 'vitest'
import { formatTime, formatDate } from '../date'

describe('formatTime', () => {
  it('string kosong → string kosong', () => {
    expect(formatTime('')).toBe('')
  })
  it('ISO string → format HH:MM lokal', () => {
    const out = formatTime('2026-08-15T14:30:00.000Z')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
    expect(out).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatDate', () => {
  it('string kosong → string kosong', () => {
    expect(formatDate('')).toBe('')
  })
  it('ISO string → tanggal lokal', () => {
    const out = formatDate('2026-08-15T00:00:00.000Z')
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })
})
