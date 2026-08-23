import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cfAwareClientIp } from '../src/utils/clientIp.js';

// Fake request minimal — helper hanya butuh { headers, ip }.
const mkReq = (headers: Record<string, unknown>, ip?: string) =>
  ({ headers, ip }) as unknown as Parameters<typeof cfAwareClientIp>[0];

test('cfAwareClientIp: CF-Connecting-IP menang atas req.ip', () => {
  const req = mkReq({ 'cf-connecting-ip': '1.2.3.4' }, '5.6.7.8');
  assert.equal(cfAwareClientIp(req), '1.2.3.4');
});

test('cfAwareClientIp: fallback ke req.ip saat header tidak ada', () => {
  const req = mkReq({}, '10.0.0.7');
  assert.equal(cfAwareClientIp(req), '10.0.0.7');
});

test('cfAwareClientIp: "unknown" ketika keduanya absen', () => {
  const req = mkReq({});
  assert.equal(cfAwareClientIp(req), 'unknown');
});

test('cfAwareClientIp: header kosong/whitespace diabaikan', () => {
  assert.equal(cfAwareClientIp(mkReq({ 'cf-connecting-ip': '' }, '10.0.0.7')), '10.0.0.7');
  assert.equal(cfAwareClientIp(mkReq({ 'cf-connecting-ip': '   ' }, '10.0.0.7')), '10.0.0.7');
});

test('cfAwareClientIp: header bertipe array diabaikan (bukan string tunggal)', () => {
  const req = mkReq({ 'cf-connecting-ip': ['1.1.1.1', '2.2.2.2'] }, '10.0.0.7');
  assert.equal(cfAwareClientIp(req), '10.0.0.7');
});

test('cfAwareClientIp: req.ip literal "unknown" diperlakukan sebagai absen', () => {
  const req = mkReq({}, 'unknown');
  assert.equal(cfAwareClientIp(req), 'unknown');
});
