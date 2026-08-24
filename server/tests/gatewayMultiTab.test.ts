import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerSocketInRegistry,
  collectTargets,
  removeSocketFromRegistry,
  type SocketRegistry,
} from '../src/realtime/gateway.js';

// Fake socket: cukup { id, emit spy } — helper registry hanya menyimpan
// referensi dan mengiterasinya, tidak memanggil API socket.io nyata.
function makeFakeSocket(id: string) {
  const emitted: Record<string, unknown[]> = {};
  return {
    id,
    emit: (event: string, ...args: unknown[]) => {
      (emitted[event] ||= []).push(args);
      return true;
    },
    emitted,
  };
}

function newRegistry(): SocketRegistry {
  return new Map();
}

test('registerSocketInRegistry: dua tab dengan key sama tidak saling menimpa', () => {
  const registry = newRegistry();
  const tabA = makeFakeSocket('A') as unknown as Parameters<typeof registerSocketInRegistry>[2];
  const tabB = makeFakeSocket('B') as unknown as Parameters<typeof registerSocketInRegistry>[2];

  registerSocketInRegistry(registry, 'u1:d1', tabA);
  registerSocketInRegistry(registry, 'u1:d1', tabB);

  // Kontrak multi-socket: collectTargets harus mengembalikan KEDUA socket.
  const targets = collectTargets(registry, 'u1', 'd1');
  assert.equal(targets.length, 2, 'kedua tab harus ada di registry (tidak ada yang ter-evict)');
  assert.ok(targets.includes(tabA), 'tab A masih terdaftar');
  assert.ok(targets.includes(tabB), 'tab B terdaftar');
});

test('collectTargets: targeting device_id persis menjangkau kedua tab (bukti tidak ada starvation)', () => {
  const registry = newRegistry();
  const tabA = makeFakeSocket('A') as unknown as Parameters<typeof registerSocketInRegistry>[2];
  const tabB = makeFakeSocket('B') as unknown as Parameters<typeof registerSocketInRegistry>[2];
  registerSocketInRegistry(registry, 'u1:d1', tabA);
  registerSocketInRegistry(registry, 'u1:d1', tabB);

  const targets = collectTargets(registry, 'u1', 'd1');
  for (const sock of targets) {
    (sock as unknown as ReturnType<typeof makeFakeSocket>).emit('message:new', { id: 'm1' });
  }
  // Kedua tab menerima downstream — tidak ada yang kelaparan.
  assert.equal((tabA as unknown as ReturnType<typeof makeFakeSocket>).emitted['message:new']?.length, 1);
  assert.equal((tabB as unknown as ReturnType<typeof makeFakeSocket>).emitted['message:new']?.length, 1);
});

test('collectTargets: broadcast user-prefix mengembalikan semua socket dari semua device', () => {
  const registry = newRegistry();
  const d1a = makeFakeSocket('d1a') as unknown as Parameters<typeof registerSocketInRegistry>[2];
  const d1b = makeFakeSocket('d1b') as unknown as Parameters<typeof registerSocketInRegistry>[2];
  const d2a = makeFakeSocket('d2a') as unknown as Parameters<typeof registerSocketInRegistry>[2];
  const other = makeFakeSocket('other') as unknown as Parameters<typeof registerSocketInRegistry>[2];

  registerSocketInRegistry(registry, 'u1:d1', d1a);
  registerSocketInRegistry(registry, 'u1:d1', d1b);
  registerSocketInRegistry(registry, 'u1:d2', d2a);
  registerSocketInRegistry(registry, 'u2:d9', other);

  const targets = collectTargets(registry, 'u1');
  assert.equal(targets.length, 3, 'semua socket device u1 (d1 x2 + d2 x1)');
  assert.ok(targets.includes(d1a) && targets.includes(d1b) && targets.includes(d2a));
  assert.ok(!targets.includes(other), 'socket user lain tidak ikut');
});

test('removeSocketFromRegistry: menghapus hanya socket tersebut dan membersihkan set kosong', () => {
  const registry = newRegistry();
  const tabA = makeFakeSocket('A') as unknown as Parameters<typeof registerSocketInRegistry>[2];
  const tabB = makeFakeSocket('B') as unknown as Parameters<typeof registerSocketInRegistry>[2];
  registerSocketInRegistry(registry, 'u1:d1', tabA);
  registerSocketInRegistry(registry, 'u1:d1', tabB);

  removeSocketFromRegistry(registry, 'u1:d1', tabA);
  let targets = collectTargets(registry, 'u1', 'd1');
  assert.equal(targets.length, 1, 'setelah hapus A, hanya B yang tersisa');
  assert.ok(targets.includes(tabB));

  removeSocketFromRegistry(registry, 'u1:d1', tabB);
  targets = collectTargets(registry, 'u1', 'd1');
  assert.equal(targets.length, 0, 'set kosong harus dibersihkan');
  assert.equal(registry.size, 0, 'key harus dihapus dari Map saat set kosong');
});
