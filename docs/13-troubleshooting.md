# 13 — Troubleshooting

Known errors, their root causes, and fixes. Each entry was encountered in production or E2E at least once.

## Server

### `DriverAdapterError: DatabaseNotReachable`
The API cannot reach PostgreSQL (or the hostname doesn't resolve).
- Check `DATABASE_URL`/`DIRECT_URL` in `/root/nyx-app/server/.env` (prod) — remember deploys overwrite it from `/root/nyx-app/.env`.
- `pg_isready` on the VPS; DNS: `getent hosts <dbhost>`.
- After a DB outage, `pm2 restart nyx-api` re-establishes the pool.

### `TlsConnectionError: self-signed certificate`
The client is forcing TLS against local Postgres. `server/src/lib/prisma.ts` appends `sslmode=require` **only for non-local hosts** — if you see this against `127.0.0.1`, that guard regressed. Never add `sslmode=require` for localhost.

### `POST /api/auth/register → 500` (P2003 `RefreshToken_deviceId_fkey`)
Login/register attempted to create a refresh token with an empty/nonexistent `deviceId`. In `auth.ts:issueTokens`, refresh persistence is skipped when `!deviceId` (recovery flow). If this re-appears, check the device find/create logic in the login/recover routes.

### `POST /api/auth/login → 403 Invalid CSRF token`
CSRF state is keyed **per client** via the `x-nyx-installation-id` header. The client must send the exact same value on `/api/csrf-token` and every mutation. Mismatch sources: multiple tabs/browsers before the per-client keying fix, or a stale cached page. Hard reload usually clears it.

### Sweeper errors every minute (`messageSweeper`)
Usually a DB connectivity symptom (see above). If it's a query error, check `Message.expiresAt` index exists (`prisma db push` after schema changes).

## Frontend

### CSP violation: "Missing 'unsafe-eval'" in `schemas-*.js`
Zod 4 JIT (`Function()`) executed — the jitless flag wasn't set before schemas were created. The flag is a **direct mutation** of `globalThis.__zod_globalConfig.jitless` in `packages/shared/src/schemas.ts` and `web/src/zodSetup.ts`. Do not switch to `zod.config()` (tree-shaken in prod — zod has `sideEffects: false`). Never re-add `'unsafe-eval'` to the nginx CSP.

### `i18next::translator: missingKey <lang> <ns> <key>`
A translation key exists in fewer than all four locales (`en/es/id/pt-BR`). Add it to all four files. `load: 'languageOnly'` means en-US resolves to `en` — if you see `failed parsing /locales/en-US/*.json`, the languageOnly option was removed.

### "New Device Detected" modal flashes briefly on the same device
During login, `hasRestoredKeys` is `false` (baseline) until key decryption finishes (~2–4s, Argon2). The `isUnlocking` flag in `store/auth.ts` suppresses the modal during that window, and `Login.tsx` auto-closes it when `hasRestoredKeys` becomes true. If it flashes again, check both guards are intact.

### Login loops back to `/login` or recovery modal re-appears
- `hasRestoredKeys` gates routing (ProtectedRoute). Don't add unconditional `navigate("/chat")` after login.
- The recovery modal re-opens unless dismissed per user (`dismissedRecoveryForUserId` in `Login.tsx`).

### `401 transport-ticket` spam after logout
The reconnect timer must skip when there's no access token (`connection.ts:scheduleReconnect`). If it returns, that guard regressed.

### `🔒 Pesan gagal didekripsi (Kunci kedaluwarsa)` on own messages
Own-message decrypt failures are converted to `waiting_for_key` (retryable) in `messagePipeline.ts` — never rendered as an error bubble. If an *incoming* message from others fails, it's a genuine session desync: check the session-key relay and `session:request_key` repair flow.

### `TextDecoder.decode: Decoding failed` during self-decrypt
The stored message key (`mk`) or the envelope does not match the ciphertext — typically a temp-id → server-id key migration issue after ack, or an old cached bundle. The DR fallback then runs; if it also fails, the message lands in `waiting_for_key`.

### Blank screen / "nf" when serving `dist/` locally
The SPA needs a fallback to `index.html` for unknown routes (nginx `try_files` in prod; a plain static server locally).

## WebTransport / sidecar

### "Opening handshake failed" in the browser
- Sidecar not running (check pm2 `nyx-sidecar` and UDP `:33333`).
- Dev: `VITE_TRANSPORT_CERT_HASH` in `web/.env` doesn't match the sidecar banner hash (the sidecar regenerates its cert periodically).
- Headless Chromium may lack WebTransport entirely — use full Chrome (`--project=chrome`) or a desktop browser.

### No realtime delivery, but REST works
- Sidecar lost its Redis subscription (`Successfully subscribed to nyx:downstream` in its log).
- Node↔sidecar channel names drift: `nyx:upstream:<op>` / `nyx:downstream`.
- The single-active-device check (redisBridge) blocking a second device by design.

## Database / deploy

### Deploy succeeded but new behavior doesn't show
The PWA service worker caches bundles — do a hard reload (twice) or DevTools → Application → Service Workers → Update.

### `prisma db push` refuses to run
Prisma 7's AI guard requires `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` in the environment (or an interactive confirmation). CI and the VPS deploy script set it explicitly for their ephemeral/prod DBs.

### Backup restore
```bash
PASS=$(cat /root/.nyx_db_pass)
pg_restore -h 127.0.0.1 -U nyx -d nyx_app --clean --if-exists /root/backups/nyx_<date>.dump
```
Stop `nyx-api` during restore to avoid writes.
