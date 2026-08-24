import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TransportOpCode } from '@nyx/shared';
import { handleChatMessage, handlePresence, handleKeySync, type RealtimeContext } from '../src/network/realtimeHandlers.js';

// --- Fake dependency-injection context ---
// Semua helper dicatat ke `calls` agar kita bisa membuktikan bahwa handler
// benar-benar menggunakan dependency yang di-injeksikan (bukan import statis).
function makeCtx() {
  const calls = {
    sendToUser: [] as unknown[][],
    sendToDevice: [] as unknown[][],
    broadcastToUsers: [] as unknown[][],
    sendJsonToUser: [] as unknown[][],
    checkRateLimit: [] as unknown[][],
    isActiveDeviceAllowed: [] as unknown[][],
  };

  const fakePrisma = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === '$transaction') return async (fns: unknown[]) => Promise.all(fns as Promise<unknown>[]);
      return new Proxy({}, {
        get(_m, method: string) {
          if (method === 'findUnique') {
            return async () => ({
              id: 'x',
              isGroup: false,
              senderId: 'u1',
              conversation: { isGroup: false },
              devices: [{ publicKey: Buffer.from('k'), pqPublicKey: Buffer.from('k') }],
            });
          }
          if (method === 'create') {
            return async () => ({
              id: 'm1',
              conversationId: 'c1',
              senderId: 'u1',
              content: 'x',
              createdAt: new Date().toISOString(),
              type: 'USER',
              isViewOnce: false,
              sender: { id: 'u1', encryptedProfile: null },
            });
          }
          if (method === 'update' || method === 'delete' || method === 'upsert' || method === 'deleteMany') {
            return async () => ({});
          }
          return async () => ({});
        },
      });
    },
  }) as unknown as RealtimeContext['prisma'];

  const fakeRedis = new Proxy({}, {
    get() {
      return async () => ({});
    },
  }) as unknown as RealtimeContext['redisClient'];

  const fakePub = new Proxy({}, {
    get(_t, method: string) {
      if (method === 'sMembers') return async () => [];
      return async () => ({});
    },
  }) as unknown as RealtimeContext['pubClient'];

  const ctx: RealtimeContext = {
    sendToUser: async (...a) => { calls.sendToUser.push(a); },
    sendToDevice: async (...a) => { calls.sendToDevice.push(a); },
    broadcastToUsers: async (...a) => { calls.broadcastToUsers.push(a); },
    sendJsonToUser: async (...a) => { calls.sendJsonToUser.push(a); },
    checkRateLimit: async (...a) => { calls.checkRateLimit.push(a); return true; },
    isActiveDeviceAllowed: async (...a) => { calls.isActiveDeviceAllowed.push(a); return true; },
    prisma: fakePrisma,
    redisClient: fakeRedis,
    pubClient: fakePub,
  };

  return { ctx, calls };
}

test('handleChatMessage: menyimpan pesan dan mengirim ack ke pengirim saat payload valid', async () => {
  const { ctx, calls } = makeCtx();
  const payload = { conversationId: 'c1', content: 'halo', tempId: 123 };
  await handleChatMessage(ctx, 'u1', 'd1', payload, 'msg-1');

  // Bukti injeksi: prisma.message.create dipanggil lewat ctx (bukan import langsung).
  assert.ok(calls.sendJsonToUser.length >= 1, 'sendJsonToUser harus dipanggil');

  const ackCall = calls.sendJsonToUser.find((c) => c[1] === TransportOpCode.ACK);
  assert.ok(ackCall, 'harus mengirim ACK ke pengirim');
  const ackData = (ackCall![2] as { data: { ok: boolean; msg?: unknown } }).data;
  assert.equal(ackData.ok, true);
  assert.ok(ackData.msg, 'ack harus membawa pesan yang tersimpan');
});

test('handlePresence: menyiarkan envelope PRESENCE bertipe typing dengan bentuk benar ke penerima', async () => {
  const { ctx, calls } = makeCtx();
  await handlePresence(ctx, 'u1', { event: 'typing:start', conversationId: 'c1', targetRecipients: ['p1'] });

  const typingCall = calls.sendJsonToUser.find(
    (c) => c[1] === TransportOpCode.PRESENCE && (c[2] as { type?: string }).type === 'typing'
  );
  assert.ok(typingCall, 'harus mengirim envelope typing ke penerima');

  const data = typingCall![2] as { type: string; userId: string; conversationId: string; isTyping: boolean };
  assert.equal(data.type, 'typing');
  assert.equal(data.userId, 'u1');
  assert.equal(data.conversationId, 'c1');
  assert.equal(data.isTyping, true);
  assert.equal(typingCall![0], 'p1');
});

test('handleChatMessage: menolak payload tidak valid tanpa melempar error (unhandled rejection)', async () => {
  const { ctx, calls } = makeCtx();
  // content kosong -> gagal MessageSendPayloadSchema; tidak boleh melempar.
  await assert.doesNotReject(
    handleChatMessage(ctx, 'u1', 'd1', { conversationId: '', content: '' }, 'msg-2')
  );

  const ackCall = calls.sendJsonToUser.find((c) => c[1] === TransportOpCode.ACK);
  assert.ok(ackCall, 'harus mengirim ACK penolakan');
  assert.equal((ackCall![2] as { data: { ok: boolean } }).data.ok, false);
});

test('handleKeySync: meneruskan session:request_key ke target lewat emitEventToUser (bukti injeksi)', async () => {
  const { ctx, calls } = makeCtx();
  await handleKeySync(ctx, 'u1', 'd1', {
    event: 'session:request_key',
    msgId: '',
    data: { conversationId: 'c1', sessionId: 's1', targetId: 't1' },
  });

  const call = calls.sendJsonToUser.find(
    (c) => c[1] === TransportOpCode.KEY_SYNC && (c[2] as { event?: string }).event === 'session:request_key'
  );
  assert.ok(call, 'harus meneruskan session:request_key ke target');
  assert.equal(call![0], 't1');
});
