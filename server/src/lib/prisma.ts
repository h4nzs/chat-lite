import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in the environment variables.');
}

const env = process.env.NODE_ENV || 'development';

// Build final connection string with SSL encoded as URL parameter.
// This avoids passing a JavaScript Object (`ssl`) in the Pool config,
// which crashes pg-protocol's startup serialization (Buffer.byteLength
// throws on Object values in Node v24 when used with @prisma/adapter-pg).
//
// Untuk database REMOTE (mis. Aiven), kita tambahkan sslmode=require (TLS tanpa
// verifikasi cert). Untuk database LOKAL (localhost/127.0.0.1) JANGAN dipaksa
// TLS — PostgreSQL lokal pakai cert self-signed (snakeoil Debian) sehingga
// sslmode=require akan gagal dengan TlsConnectionError.
let finalUrl = connectionString;
const isLocalDb = /(^|@)(localhost|127\.0\.0\.1)(:|$|\/)/i.test(connectionString);
if (env !== 'development' && env !== 'test' && !isLocalDb) {
  finalUrl += `${connectionString.includes('?') ? '&' : '?'}sslmode=require`;
}

const pool = new Pool({ connectionString: finalUrl });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: env === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;