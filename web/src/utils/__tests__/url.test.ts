// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { describe, it, expect } from 'vitest'
import { toAbsoluteUrl, urlBase64ToUint8Array } from '../url'

describe('toAbsoluteUrl', () => {
  it('path kosong → undefined', () => {
    expect(toAbsoluteUrl(null)).toBeUndefined()
    expect(toAbsoluteUrl(undefined)).toBeUndefined()
    expect(toAbsoluteUrl('')).toBeUndefined()
  })
  it('URL absolut & blob dilewatkan apa adanya', () => {
    expect(toAbsoluteUrl('https://x.example/y')).toBe('https://x.example/y')
    expect(toAbsoluteUrl('blob:abc123')).toBe('blob:abc123')
  })
  it('path relatif server dilewatkan (diproxy nginx)', () => {
    expect(toAbsoluteUrl('/uploads/avatars/a.png')).toBe('/uploads/avatars/a.png')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decode base64url (tanpa padding) ke bytes benar', () => {
    // btoa('hello') = 'aGVsbG8=' → base64url tanpa padding 'aGVsbG8'
    const bytes = urlBase64ToUint8Array('aGVsbG8')
    expect(new TextDecoder().decode(bytes)).toBe('hello')
  })
  it('menangani padding yang sudah ada', () => {
    const bytes = urlBase64ToUint8Array('aGVsbG8=')
    expect(new TextDecoder().decode(bytes)).toBe('hello')
  })
  it('menangani karakter - dan _', () => {
    // base64url dari [0xfb,0xff] = '+/8=' → '-_8'
    const bytes = urlBase64ToUint8Array('-_8')
    expect(bytes).toEqual(new Uint8Array([0xfb, 0xff]))
  })
})
