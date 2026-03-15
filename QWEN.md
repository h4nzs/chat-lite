# NYX Chat - Project Context

## Project Overview

**NYX** is a zero-knowledge, end-to-end encrypted (E2EE) messaging application built with a "Trust No One" (TNO) architecture. It operates without requiring any Personally Identifiable Information (PII) such as phone numbers, email addresses, or real names. The project implements the Signal Protocol (X3DH + Double Ratchet) entirely in the browser using WebAssembly.

### Core Philosophy
- **Pure Anonymity**: No PII storage; usernames are blind-indexed client-side using Argon2id
- **Zero-Knowledge Architecture**: Server cannot read messages or user profiles (all encrypted client-side)
- **Local-First Sovereignty**: Chat history stored exclusively in IndexedDB; never synced to cloud in plaintext

## Architecture

### Tech Stack (2026)

**Frontend (`/web`)**
- React 19 + Vite 7 (TypeScript)
- Zustand v5 (state management with persist middleware)
- Tailwind CSS v4 (Lightning CSS engine)
- Crypto Engine: `libsodium-wrappers` v0.8.2 (Web Worker isolation)
- IndexedDB: `idb-keyval`, `dexie` for "The Shadow Vault"
- Real-time: Socket.IO client v4.8+
- PWA: Workbox-based service worker with injectManifest strategy

**Backend (`/server`)**
- Node.js + Express v5
- PostgreSQL via Prisma ORM v7 (`@prisma/adapter-pg`)
- Redis: Rate limiting, Socket.IO adapter, ephemeral state
- Socket.IO v4.8+ with Redis adapter for clustering
- Object Storage: Cloudflare R2 (encrypted blobs only)
- Auth: JWT + WebAuthn (FIDO2/Passkeys)

### Key Security Features

1. **Cryptography** (Web Worker isolated)
   - XChaCha20-Poly1305 for message encryption
   - X3DH for asynchronous key exchange
   - Double Ratchet for Perfect Forward Secrecy (PFS) + Post-Compromise Security (PCS)
   - HKDF for key derivation, Ed25519 for signatures

2. **Trust-Tier System** (Anti-Spam without PII)
   - Sandbox Mode (default): Rate-limited, restricted features
   - VIP Status: Unlocked via WebAuthn or Proof-of-Work puzzles

3. **Ghost Profiles**: User profiles encrypted with symmetric `ProfileKey`, shared only via Double Ratchet header

4. **Device Migration**: E2EE WebSocket tunnel for transferring history between devices via QR code

## Project Structure

```
nyx-chat/
├── web/                    # Frontend React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API/Socket services
│   │   ├── store/          # Zustand stores
│   │   ├── workers/        # Crypto Web Worker
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helper functions
│   ├── public/             # Static assets
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/                 # Backend Express application
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── middleware/     # Auth, rate limiting, CORS
│   │   ├── jobs/           # Cron jobs (message sweeper)
│   │   ├── lib/            # Crypto, database utilities
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helper functions
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.ts         # Seed data
│   ├── tests/              # Test files
│   └── package.json
├── scripts/                # Build/deployment scripts
├── docker-compose.yml      # Local development stack
└── package.json            # Root workspace config
```

## Building and Running

### Prerequisites
- Node.js 20+
- pnpm (package manager)
- PostgreSQL 15+
- Redis

### Installation

```bash
git clone https://github.com/h4nzs/nyx-chat.git
cd nyx-chat
pnpm install
```

### Environment Setup

Create `server/.env`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/nyx_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="super-long-random-string-min-32-chars"
CLIENT_URL="http://localhost:5173"
CORS_ORIGIN="http://localhost:5173"
```

### Database Setup

```bash
cd server
npx prisma db push
pnpm run seed  # Optional: seed initial data
```

### Development

```bash
# Root (runs both web and server if configured)
pnpm dev

# Or run individually
cd web && pnpm dev      # Frontend on http://localhost:5173
cd server && pnpm dev   # Backend on http://localhost:4000
```

### Building

```bash
# Build all packages
pnpm run build

# Build individually
cd web && pnpm build
cd server && pnpm build
```

### Testing

```bash
pnpm test
```

### Linting

```bash
pnpm lint
```

### Docker Deployment

```bash
docker-compose up -d
```

## Development Conventions

### Strict Rules

1. **Crypto Immutability**: DO NOT update `libsodium-wrappers` or its type definitions. Cryptographic backward compatibility is the highest priority.

2. **Package Manager**: Use `pnpm` exclusively. Never commit `package-lock.json` or `yarn.lock`.

3. **State Management**: When using Zustand selectors, always wrap with `useShallow` to prevent infinite render loops.

4. **Code Quality**: ESLint v10 (Flat Config) must pass with zero warnings before PR.

### Testing Practices

- Frontend: Vitest + React Testing Library (jsdom environment)
- Backend: TypeScript + native test runner
- E2E testing: Needed for crypto worker and real-time synchronization

### Commit Style

Use Conventional Commits:
- `feat: add markdown support`
- `fix: decrypt worker memory leak`
- `chore: update dependencies`

### Key Architectural Boundaries

- **Web Worker Isolation**: All crypto operations run in `crypto.worker.ts` to avoid blocking the main UI thread
- **IndexedDB for Keys**: Cryptographic keys stored in IndexedDB (`keychain-db-${userId}`), NOT localStorage
- **Memory Hygiene**: Sensitive data (keys, seeds) must be wiped with `sodium.memzero()` after use
- **Tombstone Pattern**: Local message deletion uses soft-delete (`isDeletedLocal: true`) to prevent re-fetch resurrection

## Key Files Reference

| File | Purpose |
|------|---------|
| `web/src/workers/crypto.worker.ts` | Web Worker for all cryptographic operations |
| `web/src/store/` | Zustand state management (auth, chat, keys) |
| `server/src/app.ts` | Express application setup |
| `server/src/socket.ts` | Socket.IO configuration |
| `server/prisma/schema.prisma` | Database schema (users, messages, conversations) |
| `web/src/lib/` | Core utilities (encryption helpers, API clients) |

## Deployment Architecture

### Production (Zero-Inbound Policy)
- All traffic routed through Cloudflare Tunnels
- No inbound firewall ports (except SSH)
- Frontend: localhost:3000 (Nginx reverse proxy)
- Backend: localhost:4000

### PM2 Cluster Mode (Zero-Downtime)
- Uses `ecosystem.config.js` with `exec_mode: cluster`
- Rolling restart ensures no dropped connections
- Requires `process.send('ready')` signal in server startup

## License

**AGPL-3.0**: Network use (SaaS) requires open-sourcing your entire project. Commercial licenses available for closed-source deployments (see `COMMERCIAL.md`).

## Contributing

- Requires signing CLA (automated via @cla-assistant on PR)
- Check `CONTRIBUTING.md` for detailed guidelines
- Use PR templates provided
