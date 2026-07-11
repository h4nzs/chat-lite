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
// For non-local environments, we add sslmode=require (TLS without cert
// verification). Production deployments that need verify-full should
// configure SSL directly in the DATABASE_URL (e.g., 
// ?sslmode=verify-full) and trust the CA cert at the OS level.
let finalUrl = connectionString;
if (env !== 'development' && env !== 'test') {
  finalUrl += `${connectionString.includes('?') ? '&' : '?'}sslmode=require`;
}

const pool = new Pool({ connectionString: finalUrl });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: env === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;