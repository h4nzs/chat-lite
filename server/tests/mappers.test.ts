// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toRawServerMessage, type PrismaMessageInput } from '../src/utils/mappers.js'

const baseMsg: PrismaMessageInput = {
  id: 'msg-1',
  conversationId: 'conv-1',
  senderId: 'user-1',
  content: 'ciphertext-blob-encoded',
  createdAt: '2026-08-15T00:00:00.000Z'
}

test('toRawServerMessage mempertahankan content', () => {
  const out = toRawServerMessage(baseMsg)
  assert.equal(out.content, 'ciphertext-blob-encoded')
})

test('TD-13 REGRESSION: field ciphertext (duplikat content) TIDAK boleh dikirim lagi', () => {
  const out = toRawServerMessage(baseMsg) as Record<string, unknown>
  assert.equal('ciphertext' in out, false)
})

test('type SYSTEM & USER dipetakan; nilai lain jatuh ke USER', () => {
  assert.equal(toRawServerMessage({ ...baseMsg, type: 'SYSTEM' }).type, 'SYSTEM')
  assert.equal(toRawServerMessage({ ...baseMsg, type: 'USER' }).type, 'USER')
  assert.equal(toRawServerMessage({ ...baseMsg, type: 'ANEH' }).type, 'USER')
})

test('senderId null → string kosong', () => {
  const out = toRawServerMessage({ ...baseMsg, senderId: null })
  assert.equal(out.senderId, '')
})

test('expiresAt Date dikonversi ISO string', () => {
  const out = toRawServerMessage({ ...baseMsg, expiresAt: new Date('2026-09-01T00:00:00Z') })
  assert.equal(out.expiresAt, '2026-09-01T00:00:00.000Z')
})
