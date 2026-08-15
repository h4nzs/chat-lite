# NYX Documentation

Comprehensive documentation for the NYX codebase and application — a zero-knowledge, post-quantum hardened messenger.

> ⚠️ **Maintainer note:** The crypto/protocol documents (`03-security-model.md`, `04-crypto-protocol.md`, `05-message-pipeline.md`, `08-webtransport-sidecar.md`) describe **frozen formats and primitives**. Never change them without an explicit security review.

## Navigation

| Document | Content | Read this if you… |
|---|---|---|
| [01-architecture.md](01-architecture.md) | System overview, monorepo layout, request/data flows, diagrams | Are new to the codebase |
| [02-getting-started.md](02-getting-started.md) | Dev environment setup, daily commands, gotchas | Are setting up a machine |
| [03-security-model.md](03-security-model.md) | Threat model, E2EE guarantees, session/device binding | Touch auth, keys, or storage |
| [04-crypto-protocol.md](04-crypto-protocol.md) | Crypto spec: PQX3DH, ratchets, envelopes, at-rest formats, all 45 worker ops | Touch any crypto code |
| [05-message-pipeline.md](05-message-pipeline.md) | End-to-end send/receive flow, transport framing, Redis bridge | Debug messaging/realtime |
| [06-frontend.md](06-frontend.md) | Web app structure, stores, rendering, i18n, PWA | Work on the React app |
| [07-backend.md](07-backend.md) | Express server: routes, middleware, jobs, Redis keys | Work on the API |
| [08-webtransport-sidecar.md](08-webtransport-sidecar.md) | Rust sidecar, protocol framing, opcodes, deployment | Touch WebTransport |
| [09-database.md](09-database.md) | Prisma schema, indexes, backup, migration | Touch the database |
| [10-deployment-ops.md](10-deployment-ops.md) | CI/CD, VPS runbook, env vars, post-deploy checklist | Deploy or operate prod |
| [11-testing.md](11-testing.md) | Unit tests, E2E, environment limitations | Write or run tests |
| [12-api-reference.md](12-api-reference.md) | Complete REST endpoint catalog | Integrate with the API |
| [13-troubleshooting.md](13-troubleshooting.md) | Known errors and their fixes | Something broke |

## Quick facts

- **Stack:** pnpm monorepo — React 19 + Vite 8 (web), Express 5 + Prisma 7 + Redis (server), Astro (marketing), Rust `wtransport` (transport sidecar).
- **Repo root conventions:** see [AGENTS.md](../AGENTS.md) — it contains hard-earned operational rules (shared package rebuild order, frozen crypto formats, Zod jitless, ESLint status, prod DB layout).
- **E2EE core files (do not split):** `web/src/workers/crypto.worker.ts`, `web/src/lib/crypto-worker-proxy.ts`, `web/src/lib/messagePipeline.ts`.
