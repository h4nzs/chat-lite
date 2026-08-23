# security-remediation - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** <fill last - deliverables in human terms, 1-2 sentences>

**Why this approach:** <fill last - the one or two load-bearing decisions and why>

**What it will NOT do:** <fill last - 1-3 plain lines mirroring Must NOT have>

**Effort:** <Quick | Short | Medium | Large | XL>
**Risk:** <Low | Medium | High> - <one-line driver>
**Decisions to sanity-check:** <fill last - the few choices worth a human glance>

Your next move: <fill - e.g. approve, or run a high-accuracy review>. Full execution detail follows below.

---

> TL;DR (machine): <1 line - effort, risk, deliverables>

## Scope
### Must have
- Remediate findings H2, H1(code-side), M1, M2, M3, L2(app-host CSP), I1 from `SECURITY-ASSESSMENT-2026-08-23.md` entirely inside this repo.
- H1/L1 infra halves (Cloudflare real_ip ranges, rt. tunneling, VPS nginx sync) reduced to precise, copy-pasteable runbook steps in docs (execution is human/ops, never the worker).
- All changes verified by: `npx tsc --noEmit` per touched package, `pnpm -r --if-present run test`, targeted builds, new node:test units for extracted pure helpers.
- Atomic commits, one per finding, on a dedicated branch.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- NEVER touch `web/src/workers/crypto.worker.ts`, `web/src/lib/crypto-worker-proxy.ts`, `web/src/lib/messagePipeline.ts`, `web/src/utils/crypto.ts` (maintainer-frozen E2EE core).
- NEVER edit `packages/shared/**` (avoids dist rebuild cascade; no finding requires it).
- NEVER edit `server/prisma/schema.prisma` or run `prisma db push` (no schema change is needed; M2 quota is Redis-only).
- NO dependency add/upgrade/downgrade (libsodium-wrappers & zod are frozen by repo policy). NO ESLint fixes (toolchain broken repo-wide by design; CI lint is continue-on-error).
- Do NOT weaken any CSP directive elsewhere; `'wasm-unsafe-eval'` must remain (libsodium WASM). Never introduce `'unsafe-eval'`.
- Do NOT push, deploy, ssh, or contact production/DNS/Cloudflare. `web/nginx.conf` is edited in-repo ONLY (deploy.yml does NOT ship it — verified: no cp of *.conf in .github/workflows/deploy.yml; ops sync is a documented manual step).
- No refactors beyond surgical fixes; preserve ESM `.js` import specifiers in server code; preserve Zod-jitless and Lua INCR+EXPIRE atomicity patterns (reuse `redisClient.eval(...)` style seen in routes/conversations.ts sandbox counter and routes/auth.ts pow challenge).

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: **tests-after** (repo convention: server unit tests = `node:test` via tsx with fakes, files listed explicitly in `server/package.json` "test" script — NEW test files MUST be appended to that list; web vitest colocated `__tests__/`, untouched here). Pure helpers extracted for testability (PoW identity resolver, OTPK quota key/threshold gate, cf-aware IP picker). Middleware/config/route-order changes are covered by typecheck + build + existing suites + local curl scenarios where Postgres/Redis are available (docker-compose.yml services); if local infra is down, record the skipped live-check honestly in the evidence file instead of faking it.
- Global gates after each wave: `pnpm --filter @nyx/shared run build` (cheap guard), `npx tsc --noEmit` in `server/` and `web/`, `pnpm -r --if-present run test`.
- Evidence: .omop/evidence/task-<N>-security-remediation.<ext>

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

- **Wave 1 (parallel):** Tasks 1-5 — H2 CSRF mount/cookie/content-type, H1 IP-resolution, M1 CORS deny, M3 PoW identity+throttle+dead-limiter, L2 CSP hardening (investigation-first). All touch different files except tasks 1&3 both touch `server/src/app.ts` — if executed concurrently, task 3 owns app.ts CORS block only; sequence those two edits or run serially.
- **Wave 2:** Tasks 6-9 — M2 OTPK quotas (keys.ts), nginx.conf consolidated edits (real_ip/XFF overwrite + /api-docs exact-match), I1 metadata truthing (wellKnown.ts + auth.md body; depends on task 8), docs/runbook + assessment status notes (depends on task 8). Within the wave: 6 parallel; then 8; then 7 & 9 in parallel.
- Executor works on branch `security/remediation-assessment-2026-08-23`.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 (H2) | — | 10(F-wave) | 2,4,5 |
| 2 (H1 code) | — | 10 | 1(after its app.ts edit),3,4,5 |
| 3 (M1) | after task 1's app.ts edit (same file) | 10 | 2,4,5 |
| 4 (M3) | — | 10 | 1,2,3,5 |
| 5 (L2 CSP) | — | 10 | 1,2,3,4 |
| 6 (M2 quota) | — | 10 | 8 |
| 7 (I1 metadata) | 8 (nginx routing makes /api-docs resolvable) | 10 | 9 |
| 8 (nginx.conf) | — | 7,9 | 6 |
| 9 (docs/runbook) | 8 | 10 | 7 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. H2 — CSRF-protect `/api/keys` + `at`-cookie Lax + JSON-only mutations
  What to do / Must NOT do: (a) In `server/src/app.ts`: DELETE the early mount at line ~263 (`app.use("/api/keys", keysRouter);` with its "Routes publik" comment) and re-add it AFTER the CSRF middleware block (after the `doubleCsrfProtection` middleware ending line ~312, e.g. next to the other routers around line ~364). Update the comment: keys routes are authenticated AND CSRF-protected; GETs stay CSRF-exempt via `ignoredMethods`. (b) In `server/src/routes/auth.ts` `setAuthCookies` (lines 64-69): give the short-lived `at` cookie `sameSite:'lax'` in ALL envs; keep `rt` as-is (`'none'` in prod). Add a code comment WHY: app/api/marketing are same-site subdomains of nyx-app.my.id so Lax keeps every first-party flow working while blocking cross-site form posts. Do NOT change `rt`, cookie domains, or names. (c) In `server/src/routes/keys.ts`: add a tiny router-level guard BEFORE the POST/DELETE handlers that returns `415 {error:'Content-Type must be application/json'}` when `req.method !== 'GET' && !String(req.headers['content-type']).includes('application/json')` — defense-in-depth vs urlencoded simple-request CSRF (report H2 §Remediation bullet 3). Must NOT do: do not touch any crypto logic, do not change Zod schemas, do not alter CSRF secret/session-identifier behavior.
  Parallelization: Wave 1 | Blocked by: — | Blocks: F-wave
  References (executor has NO interview context - be exhaustive): SECURITY-ASSESSMENT-2026-08-23.md §H2 (attack chain + remediation); server/src/app.ts:250-320 (urlencoded parser line 250, generalLimiter 253, early keys mount 263, doubleCsrf setup 284-305, protection middleware 307-312, csrf-token route 314); server/src/routes/auth.ts:64-69 (cookie options); server/src/routes/keys.ts:21-163 (prekey-bundle upsert overwriting identity/PQ/signing keys incl. tx.device.update lines 76-83; upload-otpk ≤100; DELETE /otpk); web/src/lib/api.ts already attaches `csrf-token` header on mutations via getCsrfToken() — client compatibility is expected but VERIFY by reading api.ts request path before finishing.
  Acceptance criteria (agent-executable): `grep -n 'api/keys' server/src/app.ts` shows exactly one mount located BELOW the `doubleCsrfProtection` app.use block line number; `grep -n "sameSite" server/src/routes/auth.ts` shows `at` uses lax and `rt` unchanged; `cd server && npx tsc --noEmit` exits 0.
  QA scenarios (name the exact tool + invocation): happy — if local Postgres+Redis are up (docker-compose.yml), start `pnpm --filter nyx-server dev`, register-free check: `curl -i -X POST http://localhost:4000/api/auth/burner` still yields `403 {"error":"Invalid CSRF token"}` AND a POST to `/api/keys/prekey-bundle` without csrf header now also yields 403 EBADCSRFTOKEN (evidence .omop/evidence/task1-curl.txt); failure-path — `curl -i http://localhost:4000/api/keys/count-otpk` unauthenticated still 401 (CSRF layer must not leak semantics), recorded same file. If infra is down, write the skipped-check note to evidence instead.
  Commit: Y | fix(server): enforce CSRF + JSON content-type on /api/keys, lax at-cookie
- [ ] 2. H1 — IP resolution hardening (trust proxy + CF-header-first keying)
  What to do / Must NOT do: (a) `server/src/app.ts` line 54: replace `app.set('trust proxy', true)` with `app.set('trust proxy', 1)` + comment: rightmost XFF entry is the Cloudflare edge added by nginx's `$proxy_add_x_forwarded_for`; trusting exactly 1 hop makes `req.ip` resolve to the CF-appended real client entry instead of the attacker-controlled leftmost value. Note residual risk in comment: direct-to-origin hits bypassing CF would shift trust one hop (unreachable in prod: inbound firewall allows only SSH; documented for ops in task 9). (b) New exported pure helper in `server/src/middleware/rateLimiter.ts`: `export function cfAwareClientIp(req: Request): string` returning `cf-connecting-ip` (if non-empty string) else `req.ip` (if not 'unknown') else `'unknown'`; refactor `secureKeyGenerator` to use it FIRST (replacing the current req.ip-first order at lines 11-18). Keep `ipKeyGenerator` formatting and all limiter definitions otherwise untouched. (c) Use the same helper for the prod non-API limiter in app.ts (~lines 224-235): add `keyGenerator: (req) => ipKeyGenerator(cfAwareClientIp(req))` (import both from rateLimiter.js). (d) `server/src/routes/auth.ts` PoW challenge (~line 691): `const ip = cfAwareClientIp(req)`-equivalent (import helper) so the `ip` fallback can't be forged either. (e) `server/src/app.ts` CSRF `getSessionIdentifier` fallback (~line 292): prefer cf-connecting-ip before `req.ip` for the `ip:` branch. (f) Sweep `grep -rn "req\.ip" server/src` and list remaining sites in the evidence file with keep/change rationale (issueTokens IP-hash may stay — cosmetic telemetry). Must NOT do: no new deps; don't change limiter windows/max values; don't touch Redis store wiring.
  Parallelization: Wave 1 | Blocked by: — | Blocks: F-wave
  References: SECURITY-ASSESSMENT-2026-08-23.md §H1 (proof + remediation; NOTE its bare "$remote_addr overwrite" suggestion is INSUFFICIENT alone — nginx sees CF edge as remote_addr; correct chain is express-side trust=1 + CF-header-first, plus optional nginx real_ip handled in task 8); server/src/app.ts:54,224-235,289-293; server/src/middleware/rateLimiter.ts:11-18 (secureKeyGenerator),27-42,46-61,65-78; server/src/routes/auth.ts:691-707 (PoW identifier chain); Express/proxy-addr trust-proxy count semantics.
  Acceptance criteria: `grep -n "trust proxy" server/src/app.ts` → `1`; rateLimiter exports cfAwareClientIp and secureKeyGenerator consumes it; auth.ts pow + app.ts CSRF fallback use it; `cd server && npx tsc --noEmit` exit 0; NEW unit test file exists and passes (see QA).
  QA scenarios: happy+failure — create `server/tests/ipKey.test.ts` (node:test, no DB/Redis): assert cfAwareClientIp picks cf-connecting-ip when present, falls back to req.ip when header missing, returns 'unknown' otherwise (fake minimal req objects); APPEND the filename to the explicit test list in `server/package.json` "test" script; run `pnpm --filter nyx-server test` → all green; save output to .omop/evidence/task2-test.txt.
  Commit: Y | fix(server): pin trust proxy hop and key IP controls on CF-Connecting-IP
- [ ] 3. M1 — CORS deny without exception/500
  What to do / Must NOT do: `server/src/app.ts` cors origin callback (lines 197-206): replace `callback(new Error('Not allowed by CORS'))` with `callback(null, false)` keeping the console.warn line. Result: disallowed origins get a normal response WITHOUT ACAO headers (browser blocks reads) instead of a thrown error reaching the generic handler (line 387-406 → Sentry.captureException + 500). Must NOT do: do not change the allowlist contents, credentials flag, or allowed headers.
  Parallelization: Wave 1 | Blocked by: task 1's app.ts edit (same file — apply after) | Blocks: F-wave
  References: SECURITY-ASSESSMENT-2026-08-23.md §M1; server/src/app.ts:197-218 (cors config),387-406 (generic handler proving 500+Sentry path).
  Acceptance criteria: grep shows `callback(null, false)` and no `callback(new Error` inside the cors origin fn; tsc clean.
  QA scenarios: happy — with dev server running: `curl -sS -D - -o /dev/null -H 'Origin: https://evil.example' http://localhost:4000/health` → HTTP 200 and NO access-control-allow-origin header; failure/regression — `-H 'Origin: https://app.nyx-app.my.id'` still echoes ACAO (isAllowedOrigin list includes it, app.ts:169); record both to .omop/evidence/task3-curl.txt (skip-with-note if server can't run).
  Commit: Y | fix(server): reject CORS origins without throwing (no 500/Sentry noise)
- [ ] 4. M3 — PoW identity priority + verify throttle + remove dead otpLimiter
  What to do / Must NOT do: (a) Extract pure helper `server/src/utils/powIdentity.ts`: `resolvePowIdentity({userId, instId, fingerprint, ip})` returning `{primaryId, prefix}` with order userId → instId → fingerprint → ip and prefixes 'pow:user'/'pow:inst'/'pow:fp'/'pow:ip'. (b) Use it in `server/src/routes/auth.ts` /pow/challenge (lines ~687-733 replacing lines 700-707); userId always exists (requireAuth) so difficulty scaling can no longer be reset by rotating `x-nyx-installation-id`. (c) Add per-user verify throttle in /pow/verify (before Argon2 work): atomic Lua INCR+EXPIRE (300s-window style used elsewhere; choose windowMs=3600000 max=30, key `rl:powverify:<userId>`) via `redisClient.eval` mirroring the existing Lua snippet pattern (auth.ts:710-716 / conversations sandbox counter); exceed → `throw new ApiError(429,'Too many verification attempts')`. (d) Delete the unused `otpLimiter` export block `server/src/middleware/rateLimiter.ts:80-97`; `grep -rn otpLimiter server/src` afterwards must return zero matches. Must NOT do: don't change difficulty math (4..8, halving at :753), Argon2 params, or challenge TTL — frozen protocol contract with frontend minePoW.
  Parallelization: Wave 1 | Blocked by: — | Blocks: F-wave
  References: SECURITY-ASSESSMENT-2026-08-23.md §M3 (incl. dead-limiter proof); server/src/routes/auth.ts:687-789 (challenge+verify full flow); server/src/middleware/rateLimiter.ts:80-97; repo Lua atomicity precedent server/src/routes/conversations.ts sandbox:newchat counter; AGENTS.md testing rules (unit tests need no PG/Redis; explicit file listing).
  Acceptance criteria: grep confirms primaryId order starts with userId source; otpLimiter gone repo-wide; new unit tests pass; package.json test list updated; tsc clean.
  QA scenarios: happy+failure — new `server/tests/powIdentity.test.ts` (node:test): precedence matrix (all present → user wins; only ip → pow:ip; empty strings treated falsy) + quota-key format assertion if extracted; add to server/package.json test list; `pnpm --filter nyx-server test` green → .omop/evidence/task4-test.txt.
  Commit: Y | fix(server): anchor PoW identity to userId, throttle verify, drop dead otpLimiter
- [ ] 5. L2 — App-host CSP hardening (jsdelivr out of script-src, inline→hash)
  What to do / Must NOT do: Investigation FIRST, then minimal edits. (a) `grep -rn "jsdelivr" web/ --include=*.{ts,tsx,html,json}` + inspect built output after `pnpm --filter nyx-web run build`: determine whether ANY script is fetched from cdn.jsdelivr.net (expectation: none — Vite bundles everything; jsdelivr likely only appears in img-src contexts). (b) In `web/nginx.conf` `$app_csp` (line 149): REMOVE `https://cdn.jsdelivr.net` from script-src if (and only if) investigation proves no script loads from it; KEEP it in img-src/media-src entries where actually used. (c) Eliminate `'unsafe-inline'` from script-src: identify every inline `<script>` in the BUILT `web/dist/index.html` (Vite emits module scripts as external files; PWA uses external registerSW.js via injectRegister 'script-defer'; there may be a small theme/locale bootstrap inline). For each inline script: compute SHA-256 (`openssl dgst -sha256 -binary <file | openssl base64`) and replace `'unsafe-inline'` with `'sha256-<hash>'` entries in $app_csp. If inline content varies between builds, prefer extracting it into a static `/assets` file loaded via `<script src>` instead of hash-churn. (d) Mirror NOTHING into helmet CSP in server/src/app.ts unless a served HTML page breaks — API responses are not HTML documents; leave helmet as-is and note why in evidence. Must NOT do: never weaken/remove `'wasm-unsafe-eval'` (libsodium WASM requirement), never add `'unsafe-eval'`, don't touch marketing host CSP ($marketing_csp line 38 — Turnstile inline needs are separate; out of scope this task), don't change worker-src blob:.
  Parallelization: Wave 1 | Blocked by: — | Blocks: F-wave
  References: SECURITY-ASSESSMENT-2026-08-23.md §L2; web/nginx.conf:131-227 (app server block, $app_csp line 149, security-header locations 168-227); web/vite.config.ts (VitePWA injectManifest/registerType autoUpdate/injectRegister script-defer); AGENTS.md CSP/zod-jitless constraint ("don't add unsafe-eval back").
  Acceptance criteria: built dist has zero inline <script> without a matching sha256- entry (scripted check comparing dist/index.html against $app_csp hashes); grep proves no script-src jsdelivr remains; `pnpm --filter nyx-web run build` succeeds.
  QA scenarios: happy — serve `web/dist` locally (`pnpm --filter nyx-web exec vite preview --port 4173`), open http://localhost:4173/login with playwright chromium, wait network-idle, capture console: ZERO CSP violation messages; screenshot + console dump → .omop/evidence/task5-preview.png/.txt. failure — deliberately break one hash in a scratch copy and confirm the console DOES report a blocked script (proves the check works), then restore; record result in same evidence dir.
  Commit: Y | fix(web): tighten app CSP — drop jsdelivr scripts, hash-pin inline bootstrap
- [ ] 6. M2 — OTPK depletion quota per (requester, target)
  What to do / Must NOT do: In `server/src/routes/keys.ts`: (a) add helper `otpkQuotaKey(requesterId,targetId)` → `otpkq:<requesterId>:<targetId>` and constant `OTPK_FETCH_DAILY_MAX = 30`; (b) add async guard `consumeOtpkQuota(requesterId, targetIds: string[])` that, for EACH target, runs the atomic Lua INCR+EXPIRE (86400s TTL) exactly like the existing patterns (auth.ts:710-716 / conversations sandbox), and if ANY counter exceeds OTPK_FETCH_DAILY_MAX throws `new ApiError(429,'Pre-key bundle quota exceeded for one or more users')` WITHOUT consuming any OTPK; (c) call it in `GET /prekey-bundle/:userId` (before the $queryRaw consumption at lines ~229-239, requester = req.user.id) and in `POST /prekey-bundles` (line ~356, before the per-template consumption loop at 429-468, validating ALL userIds up-front so the whole request fails closed). Must NOT do: don't change the SQL consumption query itself, don't touch bundle payload shapes/caching keys (`cache:keys:bundle:*`), no new DB tables/indexes.
  Parallelization: Wave 2 | Blocked by: — | Blocks: F-wave | Parallel with 5(done-by-then),8
  References: SECURITY-ASSESSMENT-2026-08-23.md §M2 (single + bulk consumption proof); server/src/routes/keys.ts:166-266 (GET consume path),356-475 (bulk consume loop),102-139 (upload/replenish context showing client-side recovery exists); Lua precedents server/src/routes/auth.ts:710-716 and server/src/routes/conversations.ts sandbox:newchat.
  Acceptance criteria: both consuming endpoints call the guard before ANY $queryRaw; quota key/threshold exported constants; `cd server && npx tsc --noEmit` exit 0; unit test passes (below).
  QA scenarios: happy+failure — extend or add `server/tests/ipKey.test.ts`-style pure tests in a new `server/tests/otpkQuota.test.ts`: key format, threshold constant exported, and gate logic against an injected fake counter fn (map of counts) proving fail-closed when any pair exceeds and pass-through otherwise; append filename to server/package.json "test" list; run suite → green; output → .omop/evidence/task6-test.txt.
  Commit: Y | fix(server): per-pair daily quota on OTPK-consuming bundle fetches
- [ ] 7. I1 — Agent-discovery metadata truthing
  What to do / Must NOT do: In `server/src/routes/wellKnown.ts`: (a) keep advertised `https://nyx-app.my.id/api-docs` ONLY because task 8 makes it resolvable (root cause found: nginx `location /api` prefix-shadows the marketing Astro page `/api-docs`, so Express answered 404 "Cannot GET"); if task 8 was not applied, switch all api-docs hrefs to the marketing file route that exists in `marketing/dist` instead. (b) MCP server-card (~lines 145-160): the advertised `endpoint: "https://api.nyx-app.my.id/api/ai/mcp"` returns GET 404 (ai.ts only has POST /smart-reply) — REMOVE the endpoint field or repoint to a truthful existing surface; add comment that WebMCP lives CLIENT-side (`web/src/main.tsx` navigator.modelContext tools). (c) Grep the auth.md handler body for relative `/health` claims and fix to absolute `https://api.nyx-app.my.id/health`. Verify every remaining advertised href by matching it against actual routes (server route inventory in SECURITY-ASSESSMENT-2026-08-23.md §7 + marketing/dist listing). Must NOT do: don't invent new endpoints, don't modify isitagentready.com external SKILL.md URLs, don't change nginx (task 8 owns it).
  Parallelization: Wave 2 (after task 8) | Blocked by: 8 | Blocks: F-wave | Parallel with 9
  References: SECURITY-ASSESSMENT-2026-08-23.md §I1 table + §3 methodology note about Link-header discovery; server/src/routes/wellKnown.ts:18-57 (href blocks),86,106,138 (service_documentation),145-160 (mcp card),254-278 (skills index); web/nginx.conf:97-107 (location /api proxy shadowing),43-50 (marketing try_files); AGENTS.md i18n/docs conventions N/A here.
  Acceptance criteria: scripted check: every URL string in wellKnown.ts either (i) matches an Express-mounted route prefix or (ii) corresponds to a file present in `marketing/dist/` after build (`ls marketing/dist/api-docs*` non-empty post-build); mcp endpoint field removed/fixed; tsc clean.
  QA scenarios: happy — build marketing (`pnpm --filter nyx-marketing run build`) then run the acceptance script, save mapping table URL→evidence to .omop/evidence/task7-links.txt; failure — intentionally assert ONE stale URL (e.g. old mcp endpoint) fails the script before fixing, show red→green in evidence.
  Commit: Y | fix(server): align agent-discovery metadata with real endpoints
- [ ] 8. H1/L1 infra half — nginx.conf hardening + origin-shadow fix (repo source-of-truth)
  What to do / Must NOT do: All edits confined to repo file `web/nginx.conf` (deploy.yml does NOT ship it — verified cp list .github/workflows/deploy.yml:89-111,159-198; VPS sync is documented in task 9 as MANUAL ops). (a) At top of http context add Cloudflare real_ip restoration: include-comment block with `set_real_ip_from <each CF IP range from https://www.cloudflare.com/ips/>` + `real_ip_header CF-Connecting-IP;` + `real_ip_recursive on;` (placeholder ranges inline as comments with the fetch URL — worker MUST paste current ranges from the official list into comments and mark them VERIFY-at-sync-time since they rotate). (b) In BOTH `/api` proxy locations (lines ~98-107 and ~230-239) AND `/.well-known` locations (~110-117,242-249): change `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` → `proxy_set_header X-Forwarded-For $remote_addr;` (after real_ip, $remote_addr = true client; single clean entry pairs with express trust proxy=1 from task 2). (c) Add BEFORE the `/api` location in the MARKETING server block: `location = /api-docs { try_files /api-docs.html =404; }` (+ `location = /api-docs/` variant) so the Astro page stops being swallowed by the /api prefix (unblocks task 7). (d) L1 note-as-comment near rt. references: recommend CF-tunnel/Spectrum fronting for the sidecar host; NO config attempt (needs CF dashboard, human). Must NOT do: do not touch listen ports/roots/gzip/TLS; do not add headers beyond scope; do not edit any other vhost behavior; never assume this file auto-deploys.
  Parallelization: Wave 2 | Blocked by: — | Blocks: 7,9 | Parallel with 6
  References: SECURITY-ASSESSMENT-2026-08-23.md §H1 remediation (why bare overwrite needs real_ip first), §L1; web/nginx.conf full (both server blocks); .github/workflows/deploy.yml:190-198 (dist copies + reload-only proof); docs/10-deployment-ops.md (existing ops doc to extend in task 9).
  Acceptance criteria: `nginx -t -c web/nginx.conf` style syntax check via `docker run --rm -v $PWD/web/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t` (or local nginx binary if present) exits 0; grep shows both XFF lines use $remote_addr; exact-match /api-docs location present above /api proxy in marketing block.
  QA scenarios: happy — syntax check output → .omop/evidence/task8-nginxt.txt; failure — temporarily introduce a deliberate brace error in a scratch copy, confirm checker FAILS (proves checker ran), restore.
  Commit: Y | chore(infra): nginx real_ip/XFF normalization + unshadow /api-docs (manual sync required)
- [ ] 9. Docs & runbook — remediation record + manual ops steps
  What to do / Must NOT do: (a) Extend `docs/10-deployment-ops.md` with a dated "Security hardening sync" section: step-by-step MANUAL nginx sync (scp web/nginx.conf → VPS path used by its nginx include, `nginx -t`, `systemctl reload nginx`), prerequisite to fetch CURRENT Cloudflare IP ranges for set_real_ip_from, post-sync verification curls (forged-XFF bucket sameness via RateLimit headers on /api/csrf-token; Origin evil.example → non-500; POST /api/keys/prekey-bundle sans csrf → 403), and the L1 checklist (CF tunnel/Spectrum for rt.nyx-app.my.id, remove origin A-record exposure) marked as human/dashboard actions. (b) Prepend a short status block to `SECURITY-ASSESSMENT-2026-08-23.md`: findings H2/H1(code)/M1/M3/L2(app)/I1/M2 addressed by plan `.omo/plans/security-remediation.md` commits <hashes filled by executor>; L1 + nginx sync remain ops actions. (c) Cross-check AGENTS.md: add nothing unless a NEW standing rule emerged (default: none). Must NOT do: no marketing-site content changes, no README rewrites, no version bumps.
  Parallelization: Wave 2 (after task 8) | Blocked by: 8 | Blocks: F-wave | Parallel with 7
  References: docs/10-deployment-ops.md structure; deploy.yml env-overwrite gotchas already documented there; SECURITY-ASSESSMENT-2026-08-23.md header table; README ops note style (R2 lifecycle bullet) as tone reference.
  Acceptance criteria: docs section renders (markdown lint by eye), contains copy-pasteable commands with real paths; assessment file has status block referencing plan path; no other files touched.
  QA scenarios: happy — `git diff --stat` limited to the two files; links/paths in new section spot-checked to exist (grep the referenced file paths); failure — verify each curl command in the doc is syntactically valid by dry-running the harmless ones locally (-o /dev/null against a non-listening port is fine to prove flag correctness) → .omop/evidence/task9-diff.txt.
  Commit: Y | docs(ops): security-hardening sync runbook + assessment status

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy
- Branch: `security/remediation-assessment-2026-08-23` off current default branch. NEVER push; deployment to prod happens later by the owner via push-to-main → deploy.yml.
- One commit per todo (9 commits), messages given per-todo above (`type(scope): summary`, imperative, matching existing `git log` style — executor checks `git log --oneline -10` first).
- Each commit self-contained: code + its test + evidence references in body when applicable. Before each commit: `git status` clean of unrelated files; never stage `.omo/**` artifacts or `/tmp` outputs.
- Final wave may add at most one docs-fix commit if F1-F4 surface nits.

## Success criteria
1. All 8 assessment findings have an in-repo resolution OR an explicit documented ops action (L1 + nginx sync): H2 mount+cookie+415 guard; H1 trust-proxy=1 + CF-header-first keying everywhere IP matters (+ nginx normalization); M1 no-error CORS deny; M2 fail-closed per-pair OTPK quota on both consuming endpoints; M3 userId-first PoW identity + verify throttle + otpLimiter deleted; L2 app CSP without script-src jsdelivr/'unsafe-inline' (hash-pinned); I1 every advertised URL resolvable.
2. Gates green: shared build, `tsc --noEmit` server+web, full unit suites, NEW node:test files listed and passing (ipKey, powIdentity, otpkQuota).
3. CSP QA shows zero violations in built-app preview; nginx syntax check passes.
4. Evidence complete under .omop/evidence/task-{1..9}-security-remediation.* with honest skip-notes for any live check blocked by missing local infra.
5. Guardrails respected: zero diffs inside frozen crypto files, packages/shared, prisma schema, dependencies; no push/deploy performed.
