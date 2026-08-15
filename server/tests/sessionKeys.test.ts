// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { relaySessionKeys, type PrismaTransactionClient } from '../src/utils/sessionKeys.js'

function makeFakeDb() {
  const calls: { data: Array<Record<string, unknown>> }[] = []
  const fake = {
    sessionKey: {
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        calls.push(args)
        return { count: args.data.length }
      }
    }
  }
  return { fake: fake as unknown as PrismaTransactionClient, calls }
}

test('relaySessionKeys memetakan payload blind relay ke record DB', async () => {
  const { fake, calls } = makeFakeDb()
  const encryptedKey = Buffer.from('session-key-bytes').toString('base64url')
  const initCipher = Buffer.from('init-cipher-bytes').toString('base64url')

  const result = await relaySessionKeys('conv-1', 'sess-1', [
    { deviceId: 'dev-1', encryptedKey, isInitiator: true, initiatorCiphertexts: initCipher },
    { deviceId: 'dev-2', encryptedKey }
  ], fake)

  assert.deepEqual(result, { sessionId: 'sess-1' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].data.length, 2)

  const r1 = calls[0].data[0]
  assert.equal(r1.conversationId, 'conv-1')
  assert.equal(r1.sessionId, 'sess-1')
  assert.equal(r1.deviceId, 'dev-1')
  assert.deepEqual(r1.encryptedKey, Buffer.from('session-key-bytes'))
  assert.deepEqual(r1.initiatorCiphertexts, Buffer.from('init-cipher-bytes'))
  assert.equal(r1.isInitiator, true)

  const r2 = calls[0].data[1]
  assert.equal(r2.isInitiator, false)
  assert.equal(r2.initiatorCiphertexts, null)
})

test('relaySessionKeys menolak daftar kosong', async () => {
  const { fake } = makeFakeDb()
  await assert.rejects(() => relaySessionKeys('conv-1', 'sess-1', [], fake))
})
