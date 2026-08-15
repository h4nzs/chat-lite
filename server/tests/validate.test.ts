// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeEqualStrings } from '../src/utils/validate.js'

test('string sama → true', () => {
  assert.equal(safeEqualStrings('secret-token-abc', 'secret-token-abc'), true)
})

test('string beda (panjang sama) → false', () => {
  assert.equal(safeEqualStrings('secret-token-abc', 'secret-token-abd'), false)
})

test('panjang beda → false (tidak bocor panjang via perbandingan)', () => {
  assert.equal(safeEqualStrings('short', 'much-longer-token-value'), false)
})

test('null/undefined/non-string → false', () => {
  assert.equal(safeEqualStrings(null, 'x'), false)
  assert.equal(safeEqualStrings('x', undefined), false)
  assert.equal(safeEqualStrings(undefined, undefined), false)
})

test('string kosong sama → true (edge)', () => {
  assert.equal(safeEqualStrings('', ''), true)
})
