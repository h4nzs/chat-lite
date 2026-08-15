// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeHtml, sanitizeErrorLog } from '../sanitize'

describe('sanitizeText', () => {
  it('membuang semua tag HTML', () => {
    expect(sanitizeText('<script>alert(1)</script>hello')).not.toContain('<script>')
    expect(sanitizeText('<b>bold</b> text')).not.toContain('<b>')
  })
  it('null/undefined → string kosong', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(undefined)).toBe('')
  })
  it('non-string dikonversi', () => {
    expect(sanitizeText(123)).toBe('123')
  })
})

describe('sanitizeHtml alias', () => {
  it('sama dengan sanitizeText', () => {
    expect(sanitizeHtml('<i>x</i>')).toBe(sanitizeText('<i>x</i>'))
  })
})

describe('sanitizeErrorLog (anti kebocoran secret)', () => {
  it('meredaksi objek JSON', () => {
    const out = sanitizeErrorLog('gagal {"ciphertext":"rahasia-panjang"}')
    expect(out).not.toContain('rahasia-panjang')
    expect(out).toContain('[REDACTED_OBJECT]')
  })
  it('meredaksi string base64/hex panjang', () => {
    const b64 = 'a'.repeat(64)
    const out = sanitizeErrorLog(`kunci: ${b64}`)
    expect(out).not.toContain(b64)
    expect(out).toContain('[REDACTED_KEY_OR_B64]')
  })
  it('memotong output > 200 karakter', () => {
    // Pakai teks dengan spasi agar tidak ikut ter-redaksi regex base64
    const out = sanitizeErrorLog('ab '.repeat(200))
    expect(out.length).toBeLessThanOrEqual(215) // 200 + '... [TRUNCATED]'
    expect(out).toContain('[TRUNCATED]')
  })
  it('error kosong → Unknown Error', () => {
    expect(sanitizeErrorLog(null)).toBe('Unknown Error')
  })
})
