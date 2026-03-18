# NYX Chat - Project Context Guide

## Project Overview

**NYX** is a zero-knowledge, end-to-end encrypted (E2EE) messaging application built on the Signal Protocol. It operates under a "Trust No One" (TNO) architecture where the server is mathematically incapable of reading messages or knowing user identities.

### Core Principles
- **No PII Storage**: No phone numbers, emails, IP addresses, or plaintext usernames stored
- **Blind Indexing**: Usernames hashed client-side with Argon2id; server only sees random hashes
- **Ghost Profiles**: Profile data encrypted locally with symmetric keys shared only via Double Ratchet
- **Local-First**: Chat history stored exclusively in IndexedDB; no cloud sync of plaintext data

## Architecture

### Tech Stack (2026)

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind CSS v4, Zustand v5 |
| **Backend** | Node.js, Express, Socket.IO v4 |
| **Database** | PostgreSQL via Prisma ORM v7 |
| **Cache** | Redis (Socket.IO adapter, rate limiting) |
| **Crypto** | libsodium-wrappers (v0.8.x - pinned for compatibility) |
| **Package Manager** | pnpm (monorepo workspace) |

### Cryptography Implementation
- **Key Exchange**: X3DH (Extended Triple Diffie-Hellman)
- **Message Encryption**: Double Ratchet Algorithm (PFS + PCS)
- **Cipher**: XChaCha20-Poly1305 via libsodium
- **Hashing**: SHA-256, Argon2id
- **KDF**: HKDF
- **Signatures**: Ed25519
- **WebAuthn**: FIDO2/Biometric authentication for VIP trust tier

### Project Structure
```
nyx-chat/
├── web/                    # React frontend (PWA)
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── store/          # Zustand state
│   │   ├── services/       # API/Socket clients
│   │   ├── workers/        # Crypto Web Worker
│   │   ├── lib/            # Low-level utilities
│   │   └── utils/          # Helper functions
│   ├── sw.ts               # Service Worker (injectManifest)
│   └── vite.config.ts
├── server/
│   ├── src/
│   │   ├── routes/         # Express routes
│   │   ├── socket/         # Socket.IO handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, rate limiting
│   │   ├── jobs/           # Cron (message sweeper)
│   │   └── lib/            # Crypto utilities
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── ecosystem.config.js # PM2 cluster config
└── scripts/                # Workspace scripts
```

## Building and Running

### Prerequisites
- Node.js 20+
- pnpm
- PostgreSQL 15+
- Redis

### Installation
```bash
git clone https://github.com/h4nzs/nyx-chat.git
cd nyx-chat
pnpm install
```

### Environment Setup (server/.env)
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/nyx_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="<min-32-char-random-string>"
CLIENT_URL="http://localhost"
CORS_ORIGIN="http://localhost:5173"
```

### Development
```bash
# Initialize database
cd server && npx prisma db push

# Run frontend (port 5173)
cd web && pnpm dev

# Run backend (port 4000)
cd server && pnpm dev
```

### Production Build
```bash
# Build all packages
pnpm build

# Preview (frontend)
cd web && pnpm preview

# Start server
cd server && pnpm start
```

### Docker Deployment
```bash
docker-compose up -d
```

## Testing
```bash
# Run all tests
pnpm test

# Frontend tests (Vitest + jsdom)
cd web && pnpm test

# Backend tests
cd server && pnpm test
```

## Linting
```bash
pnpm lint  # ESLint v10 (Flat Config)
```

## Key Development Constraints

### ⚠️ CRITICAL RULES
1. **DO NOT update `libsodium-wrappers`** - Cryptographic backward compatibility is the highest priority. The package is pinned at v0.8.x.
2. **Use `pnpm` only** - No npm/yarn. Do not commit `package-lock.json` or `yarn.lock`.
3. **Zustand selectors** - Always use `useShallow` when returning objects from selectors to prevent infinite render loops.
4. **ESLint compliance** - Code must pass `pnpm run lint` with zero warnings (except unused-var).

### State Management (Zustand v5)
```typescript
// CORRECT
const { data } = useStore(useShallow(state => ({ data: state.data })));

// WRONG - triggers infinite re-renders
const { data } = useStore(state => ({ data: state.data }));
```

### Path Aliases (web/)
```typescript
import Component from '@/components/Component';
import useStore from '@/store/store';
import { api } from '@/services/api';
```

## Database Schema Highlights

### Core Models
- **User**: Stores `usernameHash` (Argon2id), `encryptedProfile`, `publicKey`, `signingKey`
- **Conversation**: Supports 1:1 and group chats
- **Message**: E2EE content with optional `expiresAt` for disappearing messages
- **SessionKey**: Stores Double Ratchet session state per conversation
- **PreKeyBundle**: X3DH pre-key material for asynchronous key exchange
- **Authenticator**: WebAuthn credentials for passwordless auth

### Key Indexes
- `Message(conversationId, createdAt DESC)` - Fast chat history loading
- `User(createdAt)` - User discovery
- `Story(expiresAt)` - Auto-deletion scheduling

## Security Features

### Trust-Tier System (Anti-Spam)
1. **Sandbox Mode** (default): Rate-limited, restricted features
2. **VIP Status**: Unlocked via WebAuthn or cryptographic puzzles

### Zero-Inbound Deployment
- Production uses Cloudflare Tunnels
- No inbound firewall ports except SSH
- Traffic routed to localhost:3000 (PWA) and localhost:4000 (API)

### Data Ownership (NYX Vault)
- Export encrypted `.nyxvault` files containing keys/metadata
- Device-to-device migration via E2EE WebSocket tunnel (server as blind relay)

## Deployment Notes

### PM2 Zero-Downtime (Production)
Server uses PM2 cluster mode with `ecosystem.config.js`:
```bash
pm2 reload ecosystem.config.js --update-env
```

### Version Management
```bash
pnpm version patch  # Auto-updates README.md, package.json files
```

## Contributing

- **CLA Required**: Contributors must sign the Contributor License Agreement via @cla-assistant bot on first PR
- **Atomic Commits**: Use Conventional Commits (`feat:`, `fix:`, `chore:`)
- **PR Template**: Follow provided templates

## License

**AGPL-3.0** - Network use (SaaS) requires open-sourcing your entire project. Commercial licenses available for closed-source deployments.

## Common Pitfalls

| Issue | Solution |
|-------|----------|
| libsodium not loading | Exclude from Vite `optimizeDeps` |
| Zustand infinite renders | Wrap selectors with `useShallow` |
| PWA cache size errors | `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` |
| PM2 wrong release path | Use `fs.realpathSync()` in ecosystem config |
