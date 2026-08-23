import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OTPK_FETCH_DAILY_MAX,
  OTPK_QUOTA_TTL_SECONDS,
  otpkQuotaKey,
  makeOtpkQuotaGate
} from '../src/utils/otpkQuota.js';

test('format kunci kuota OTPK adalah otpkq:<requester>:<target>', () => {
  assert.equal(otpkQuotaKey('user-1', 'user-2'), 'otpkq:user-1:user-2');
});

test('batas harian dan TTL ter-ekspor dengan nilai yang benar', () => {
  assert.equal(OTPK_FETCH_DAILY_MAX, 30);
  assert.equal(OTPK_QUOTA_TTL_SECONDS, 86400);
});

test('gate lolos saat semua pasangan masih di bawah batas', async () => {
  const counts = new Map<string, number>();
  const gate = makeOtpkQuotaGate(async (key) => (counts.get(key) ?? 0) + 1);

  await assert.doesNotReject(() => gate('req', ['a', 'b']));
  await assert.doesNotReject(() => gate('req', ['a'])); // pair sama, hitungan ke-2
});

test('gate gagal-tutup saat ada pasangan melebihi batas harian', async () => {
  const counts = new Map<string, number>();
  counts.set(otpkQuotaKey('req', 'a'), OTPK_FETCH_DAILY_MAX); // stok hitungan habis
  const gate = makeOtpkQuotaGate(async (key) => (counts.get(key) ?? 0) + 1);

  await assert.rejects(() => gate('req', ['a']), /quota exceeded/i);
});

test('pasangan lain tidak ikut terblokir saat satu pasangan over-quota', async () => {
  const counts = new Map<string, number>();
  counts.set(otpkQuotaKey('req', 'a'), OTPK_FETCH_DAILY_MAX);
  const gate = makeOtpkQuotaGate(async (key) => (counts.get(key) ?? 0) + 1);

  await assert.rejects(() => gate('req', ['a', 'b']));
  await assert.doesNotReject(() => gate('req', ['b']));
});

test('NaN dari Redis bersifat fail-open (infra error tidak memblokir)', async () => {
  const gate = makeOtpkQuotaGate(async () => Number.NaN);
  await assert.doesNotReject(() => gate('req', ['a']));
});
