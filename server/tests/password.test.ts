// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword } from '../src/utils/password.js'

test('hash + verify roundtrip berhasil', async () => {
  const hash = await hashPassword('CorrectHorseBatteryStaple123!')
  assert.equal(typeof hash, 'string')
  assert.equal(await verifyPassword('CorrectHorseBatteryStaple123!', hash), true)
})

test('password salah ditolak', async () => {
  const hash = await hashPassword('RightPass123!')
  assert.equal(await verifyPassword('WrongPass123!', hash), false)
})

test('salt unik — hash password sama tidak identik', async () => {
  const h1 = await hashPassword('SamePassword123')
  const h2 = await hashPassword('SamePassword123')
  assert.notEqual(h1, h2)
})

test('verify hash korup tidak throw', async () => {
  assert.equal(await verifyPassword('whatever', 'bukan-hash-argon2'), false)
})
