# 10 — Deployment & Operations

## 10.1 Topology (prod)

| Component | Where | Notes |
|---|---|---|
| Web app | `https://app.nyx-app.my.id` | Static build in `/var/www/nyx-web` (nginx) |
| API | `https://api.nyx-app.my.id` → `localhost:4000` | pm2 `nyx-api` (cluster) |
| WebTransport | `https://rt.nyx-app.my.id:33333` | pm2 `nyx-sidecar` (Rust) |
| Marketing | `https://nyx-app.my.id` | `/var/www/nyx-marketing` |
| DB | `127.0.0.1:5432/nyx_app` (user `nyx`) | Local PostgreSQL 17 on the VPS |
| Redis | `127.0.0.1:6379` | pub/sub bridge + caches |
| Storage | Cloudflare R2 | Encrypted blobs |

VPS: Debian 13, **1 core / 1GB RAM / 2GB swap**, `vm.swappiness=10`, PostgreSQL tuned for low memory. Keep this in mind before adding workers/queues.

## 10.2 CI (`.github/workflows/ci.yml`)

On PR and push to `main`:

| Job | Content |
|---|---|
| `build` | frozen-lockfile install → prisma generate → `pnpm run build` |
| `unit` | `pnpm run test` (22 server + 29 web tests) |
| `lint` | non-blocking (`continue-on-error`) — typescript-eslint ≠ TS 7 |
| `audit` | `pnpm audit --prod` |
| `e2e` | Postgres+Redis services, `prisma db push` (consent env), Playwright chromium — transport specs auto-skip |
| `e2e-chrome` | Full Chrome via apt + Rust sidecar built & started; cert hash parsed into `VITE_TRANSPORT_CERT_HASH`; runs `--project=chrome` (WebTransport active) |

## 10.3 Deploy pipeline (`deploy.yml`)

Push to `main` triggers:

1. Install (frozen lockfile) → assert secrets → build shared → web → marketing → server (incl. `prisma generate`) → Rust sidecar (`cargo build --release`).
2. Package: workspace files + builds + sidecar binary → `nyx-deploy.zip`.
3. SCP to VPS (`root@…`) → unzip to `/root/nyx-app` (overwrite).
4. On VPS: `pnpm install --frozen-lockfile` → **copy `/root/nyx-app/.env` → `server/.env`** (prod secrets live only on the VPS) → `prisma generate` → `prisma db push` (consent env, `|| true`) → deploy web/marketing to `/var/www/…` → reload nginx → pm2 restart `nyx-api` + `nyx-sidecar` → `pm2 save`.

> ⚠ Any change to `.env` on the VPS will be **overwritten from `/root/nyx-app/.env`** on the next deploy. Edit the root file, not `server/.env`.

## 10.4 VPS runbook (SSH)

```bash
ssh -i <key> root@<VPS>

pm2 list                                # nyx-api (cluster), nyx-sidecar (fork)
pm2 logs nyx-api --lines 100 --nostream # API logs
pm2 restart nyx-api                     # restart after .env change
systemctl status postgresql redis-server
pg_isready && redis-cli ping
free -m                                 # RAM pressure watch
ls /root/backups/                       # nightly pg_dumps
```

## 10.5 Post-deploy checklist

1. `curl https://api.nyx-app.my.id/health` → `{"status":"ok bang"}`.
2. `pm2 logs nyx-api` — no `DatabaseNotReachable` / `TlsConnectionError`; sweeper started.
3. Open the app with a **hard reload** (service worker update) — check console for `missingKey` or CSP violations.
4. Register + send a message between two accounts.
5. Confirm no `unsafe-eval` CSP errors (Zod jitless must be intact).

## 10.6 Environment variables (full table)

### Server (`/root/nyx-app/.env`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | `postgres://nyx:<pw>@127.0.0.1:5432/nyx_app` |
| `REDIS_URL` | `redis://127.0.0.1:6379` |
| `JWT_SECRET` | Token signing (≥32 chars) |
| `CSRF_SECRET` | CSRF state secret (falls back to JWT_SECRET) |
| `CHAT_SECRET` | Admin cleanup key |
| `APP_URL` / `CORS_ORIGIN` | Public API origin / allowed origins |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile verify |
| `VAPID_SUBJECT/PUBLIC_KEY/PRIVATE_KEY` | Web Push |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME/PUBLIC_DOMAIN` | Cloudflare R2 |
| `CF_ACCOUNT_ID/CF_TURN_KEY_ID/CF_TURN_API_TOKEN` | Cloudflare TURN (WebRTC) |
| `GEMINI_API_KEY` | Smart reply |
| `SENTRY_DSN/AUTH_TOKEN/ORG/PROJECT/PROFILING` | Error tracking |
| `SUPABASE_URL/SUPABASE_SERVICE_KEY` | (legacy, optional) |
| `NOWPAYMENTS_API_KEY/IPN_SECRET`, `TRIPAY_API_KEY/MERCHANT_CODE/PRIVATE_KEY` | Payments |
| `DISCORD_REPORT_WEBHOOK_URL` | Abuse reports |
| `RESEND_API_KEY` | Email (optional) |
| `TRANSPORT_PORT` | Sidecar port (33333) |
| `NODE_ENV` | production |

### Web (`web/.env` → build-time `VITE_*`)

`VITE_API_URL`, `VITE_TRANSPORT_URL`, `VITE_TRANSPORT_CERT_HASH` (dev pinning), `VITE_TURNSTILE_SITE_KEY`, `VITE_SENTRY_DSN`, `VITE_VAPID_PUBLIC_KEY`, `INDEXNOW_API_KEY`.

## 10.7 Secrets policy

- `.env` files are gitignored; `.env.example` (root) and `server/.env.example` are the templates.
- GitHub Actions secrets: `VPS_HOST/PORT/USER/PASSWORD`, `VITE_*`, `SENTRY_*`, `INDEXNOW_API_KEY`, `CI_DATABASE_URL` (optional).
- Do not commit: DB passwords (VPS: `/root/.nyx_db_pass`), VAPID private keys, R2 secret keys, sidecar private keys (`*.der`).

## 10.8 Rollback

1. `git revert <bad commit>` → push → deploy reruns.
2. DB has no automatic migration rollback — restore the latest nightly dump if a destructive `db push` shipped (downtime + `pg_restore`).
