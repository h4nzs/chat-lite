import type { Request } from 'express';

/**
 * IP klien yang tahan pemalsuan pada topologi Cloudflare (proxy maupun tunnel).
 *
 * Melalui edge Cloudflare, header `CF-Connecting-IP` SELALU ditimpa oleh CF
 * dengan IP klien asli sehingga tidak bisa dipalsukan. Sebaliknya
 * `X-Forwarded-For` membawa entri yang dikendalikan penyerang di posisi depan,
 * dan `req.ip` (hasil trust proxy) bisa jatuh ke entri palsu itu ketika trafik
 * tidak melewati lapisan nginx yang menormalkan XFF (mis. jalur tunnel langsung
 * ke Express). Karena itu keying rate-limit / PoW / CSRF wajib memilih
 * CF-Connecting-IP lebih dulu; `req.ip` hanya fallback.
 */
export function cfAwareClientIp(req: Pick<Request, 'headers' | 'ip'>): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim() !== '') return cfIp;
  if (req.ip && req.ip !== 'unknown') return req.ip;
  return 'unknown';
}
