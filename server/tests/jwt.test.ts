// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signAccessToken, signTransportTicket, verifyJwt, newJti, refreshExpiryDate } from '../src/utils/jwt.js'

test('sign + verify access token roundtrip', () => {
  const token = signAccessToken({ id: 'user-1', role: 'USER', deviceId: 'dev-1', jti: 'jti-1' })
  const payload = verifyJwt(token)
  assert.ok(payload && typeof payload === 'object')
  assert.equal((payload as Record<string, unknown>).id, 'user-1')
  assert.equal((payload as Record<string, unknown>).deviceId, 'dev-1')
  assert.equal((payload as Record<string, unknown>).jti, 'jti-1')
})

test('token expired ditolak (verifyJwt → null)', () => {
  const expired = signAccessToken({ id: 'u' }, { expiresIn: '-1s' })
  assert.equal(verifyJwt(expired), null)
})

test('token asal-asalan ditolak', () => {
  assert.equal(verifyJwt('not-a-real-token'), null)
})

test('transport ticket short-lived & bisa diverifikasi', () => {
  const ticket = signTransportTicket({ id: 'u1', deviceId: 'd1' })
  const payload = verifyJwt(ticket)
  assert.ok(payload && typeof payload === 'object')
  assert.equal((payload as Record<string, unknown>).deviceId, 'd1')
})

test('newJti unik', () => {
  assert.notEqual(newJti(), newJti())
})

test('refreshExpiryDate ~30 hari ke depan', () => {
  const now = Date.now()
  const exp = refreshExpiryDate().getTime()
  const days = (exp - now) / (1000 * 60 * 60 * 24)
  assert.ok(days > 29.9 && days <= 30.1)
})
