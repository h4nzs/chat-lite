// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePowIdentity } from '../src/utils/powIdentity.js'

test('prioritas userId di depan (tidak bisa dipalsukan klien)', () => {
  const id = resolvePowIdentity({ userId: 'u1', instId: 'inst-rotated', fingerprint: 'fp', ip: '1.2.3.4' })
  assert.deepEqual(id, { primaryId: 'u1', prefix: 'pow:user' })
})

test('fallback instId saat userId kosong', () => {
  const id = resolvePowIdentity({ userId: undefined, instId: 'inst-1', fingerprint: 'fp', ip: '1.2.3.4' })
  assert.deepEqual(id, { primaryId: 'inst-1', prefix: 'pow:inst' })
})

test('fallback fingerprint lalu ip', () => {
  assert.deepEqual(
    resolvePowIdentity({ fingerprint: 'fp', ip: '1.2.3.4' }),
    { primaryId: 'fp', prefix: 'pow:fp' }
  )
  assert.deepEqual(
    resolvePowIdentity({ ip: '1.2.3.4' }),
    { primaryId: '1.2.3.4', prefix: 'pow:ip' }
  )
})

test('header bertipe array (bentuk express req.headers) → nilai valid pertama', () => {
  assert.deepEqual(
    resolvePowIdentity({ instId: ['', 'inst-a'] }),
    { primaryId: 'inst-a', prefix: 'pow:inst' }
  )
  assert.deepEqual(
    resolvePowIdentity({ fingerprint: ['fp-x'] }),
    { primaryId: 'fp-x', prefix: 'pow:fp' }
  )
})

test('semua identitas kosong → null (route melempar 400)', () => {
  assert.equal(resolvePowIdentity({}), null)
  assert.equal(resolvePowIdentity({ userId: '', instId: [], fingerprint: [], ip: '' }), null)
})
