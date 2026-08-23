---
slug: security-assessment-remediation
status: drafting
intent: unclear
review_required: true
plan_path: .omo/plans/security-assessment-remediation.md
plan_sha256: null
review_round_id: null
pending-action: write and review .omo/plans/security-assessment-remediation.md
review:
  momus:
    status: pending
    workspace_root: null
    runtime_home: null
    target: .omo/plans/security-assessment-remediation.md
    round_id: null
    plan_sha256: null
    launch_id: null
    session: null
    result: null
  independent:
    status: pending
    workspace_root: null
    runtime_home: null
    target: .omo/plans/security-assessment-remediation.md
    round_id: null
    plan_sha256: null
    launch_id: null
    session: null
    result: null
approach: Remediasi penuh 8 temuan SECURITY-ASSESSMENT-2026-08-23 yang dapat dikerjakan di dalam repo (H2 urutan mount CSRF, H1 trust-proxy/XFF, M1 CORS deny-path, M2 kuota OTPK per-pasangan, M3 prioritas identitas PoW + wiring otpLimiter, L2 pengerasan CSP, I1 rekonsiliasi metadata discovery), ditambah unit test untuk helper murni yang terekstrak dan pembaruan docs; item infra-murni (L1 DNS/tunnel, alert Sentry) didokumentasikan sebagai checklist ops, tidak dieksekusi dari repo.
---

# Draft: security-assessment-remediation

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

| id | outcome | status | evidence |
|---|---|---|---|
| C1 | `/api/keys/*` berada DI BELAKANG layer double-CSRF (+ guard content-type JSON pada rute mutasi kunci) | active | server/src/app.ts:263 vs 307-312; app.ts:246-250 (urlencoded extended); server/src/routes/auth.ts:64-69 (SameSite=None prod) |
| C2 | `req.ip` = IP klien nyata (XFF ditimpa dari `CF-Connecting-IP`, `trust proxy` = 1 hop) | active | server/src/app.ts:54; web/nginx.conf:105,115,237,247; server/src/middleware/rateLimiter.ts:11-18 |
| C3 | Origin yang ditolak CORS → respons normal tanpa Error/Sentry (bukan 500) | active | server/src/app.ts:197-206 (callback throw), 387-406 (captureException→500) |
| C4 | Konsumsi OTPK dibatasi kuota per `(requesterId,targetId)` atomik Redis + limiter kasar di endpoint konsumsi | active | server/src/routes/keys.ts:226-242 (konsumsi tunggal), 429-468 (bulk ≤50); auth.ts:709-716 pola Lua INCR+EXPIRE |
| C5 | Rate-state PoW dikunci ke `userId` (prioritas diurungkan) + throttle verify per user; `otpLimiter` dialokasikan/dipakai | active | server/src/routes/auth.ts:700-707 (primaryId), 725 (difficulty), 753 (halving), 764-772 (Argon2id 16MB); rateLimiter.ts:80-97 (otpLimiter tanpa call site — grep repo: hanya definisi + docs) |
| C6 | CSP kedua host diperketat: jsdelivr dihapus, `'unsafe-inline'` script-src diganti hash inline-script hasil build | active | web/nginx.conf:38 ($marketing_csp), :149 ($app_csp); grep jsdelivr di web/src = 0 hit; server/src/app.ts:94 (helmet imgSrc jsdelivr) |
| C7 | Metadata agent-discovery konsisten dengan rute yang benar-benar ada (Link header, auth.md ×2, linkset/openid/MCP-card) | active | web/nginx.conf:41,152 (`</health>` rel=status); server/src/routes/wellKnown.ts:12-100 (service-doc → /api-docs); marketing/public/auth.md; web/public/auth.md; marketing/src/pages/api-docs.astro ADA di repo |
| C8 | Checklist ops untuk temuan di luar jangkauan repo (L1 DNS rt.→CF tunnel/Spectrum; dedupe/alert Sentry) tertulis di docs | active (docs saja) | SECURITY-ASSESSMENT-2026-08-23.md §M1, §L1 |
| C9 | Unit test agent-executable untuk helper murni baru (CORS deny, ekstraksi IP, prioritas identitas PoW, cek kuota OTPK) terdaftar di test runner | active | server/package.json:20 (`tsx --test tests/…` — daftar eksplisit, file baru WAJIB didaftarkan); tests tanpa Postgres/Redis |

## Open assumptions (announced defaults)
<!-- Intent is UNCLEAR: research resolves ambiguity, defaults are adopted (not asked), and each is surfaced in the plan's human TL;DR for veto. -->
<!-- assumption | adopted default | rationale | reversible? -->

| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| Outcome yang diminta | Rencanakan remediasi lengkap semua temuan yang bisa dikerjakan di repo, bukan sekadar komentar atas laporan | Pengguna membagikan laporan ke planner; nilai maksimal adalah rencana perbaikan terverifikasi-kode; veto mudah di gate | Ya |
| Mekanisme H1 | Timpa XFF di nginx dengan `$http_cf_connecting_ip` + `app.set('trust proxy', 1)`; BUKAN real_ip module/ranges CF | CF menimpa CF-Connecting-IP di edge (nilai tak bisa dipalsukan melewatinya); tanpa maintenance daftar IP; port origin terfilter sehingga jalur non-CF dapat diterima | Ya (config) |
| Cookie `at`/`rt` SameSite=None | TIDAK diubah sekarang (rekomendasi "consider Lax" di laporan ditunda) | Akar masalah H2 adalah urutan mount; mengubah flag cookie autentik memperluas blast radius ke alur login/recovery; manfaat marginal setelah C1+C4 | Ya |
| Kuota M2 | 20 konsumsi OTPK / pasangan (requester,target) / 24 jam; over-quota → bundle TANPA otpk (degradasi anggun, bukan error); otpLimiter dipasang sebagai backstop IP dengan ambang dinaikkan 5→60/15 menit | Legit fan-out grup (bulk ≤50) tetap aman; loop habiskan-stok jadi sangat mahal; pola Lua INCR+EXPIRE atomik sesuai aturan AGENTS | Ya (konstanta satu tempat) |
| Throttle M3 verify | 10 kali `/pow/verify` / user / jam → 429 | Setiap percobaan membakar Argon2id 16MB server-side di VPS 1-core; 10/jam cukup untuk verifikasi sah | Ya |
| L2 strategi | Hapus jsdelivr (script-src & img-src + entri helmet); ganti `'unsafe-inline'` script-src dengan SHA-256 hash inline-script hasil build; jika build ternyata tanpa inline script → langsung hapus `'unsafe-inline'`; `'wasm-unsafe-eval'` TETAP (WASM crypto) | jsdelivr tak terpakai di source; hash-based adalah praktik terbaik; prosedur deterministik dengan verifikasi stabilitas hash 2x build | Ya |
| I1 arah | Repoint semua iklan ke URL yang benar-benar ada (verifikasi output build marketing untuk /api-docs; `/health` → absolut api host; MCP → /.well-known/mcp/server-card.json), JANGAN membuat endpoint baru | "Jangan iklankan yang tidak ada" lebih murah & aman daripada menambah permukaan | Ya |
| Urutan eksekusi | Ikut matriks prioritas laporan §8 (H2 → H1 → M1 → M2 → M3 → L2 → I1), digabung per wave paralel yang aman | Prioritas risiko produk sudah disepakati dalam laporan | Ya |

## Findings (cited - path:lines)

Semua diverifikasi langsung ke kode sumber saat ini (bukan hanya klaim laporan):

- **H1 (HIGH, live-verified)**: `server/src/app.ts:54` `app.set('trust proxy', true)`; `web/nginx.conf:105` & `:237` `$proxy_add_x_forwarded_for` (append); `:115`,`:247` sama untuk `/.well-known`; `server/src/middleware/rateLimiter.ts:11-18` keyGenerator memakai `req.ip` (fallback `cf-connecting-ip` juga spoofable langsung ke origin). Semua limiter (general 300/15m, auth 20/jam, upload 20/jam, cap non-API 1000, fallback PoW) kunci pada nilai ini.
- **H2 (HIGH, struktural)**: `server/src/app.ts:263` mount `/api/keys` SEBELUM middleware CSRF (`:284-312`); parser urlencoded extended global `:250`; cookie `SameSite=None` prod `server/src/routes/auth.ts:64-69`. Rute terdampak: `routes/keys.ts:21-100` (timpa identity/prekey + deleteMany OTPK lama), `:103-139` (upload-otpk), `:154-163` (delete OTPK). **Fakta penyeimbang**: `web/src/lib/api.ts:90-98` klien SELALU melampirkan header `CSRF-Token` utk POST/PUT/PATCH/DELETE dan `:112-114` clear cache saat 403-CSRF → memindahkan mount TIDAK merusak SPA.
- **M1 (MED, live)**: `server/src/app.ts:197-206` callback CORS melempar `new Error('Not allowed by CORS')` → generic handler `:387-406` `Sentry.captureException` + 500.
- **M2 (MED)**: `server/src/routes/keys.ts:229-239` DELETE..RETURNING konsumsi OTPK atomik per panggilan `GET /prekey-bundle/:userId`; `:437-447` varian bulk `POST /prekey-bundles` ≤50 user; tidak ada kuota per-(requester,target) di mana pun.
- **M3 (MED)**: `server/src/routes/auth.ts:700-707` `primaryId = instId || fingerprint || ip || userId` (instId = header attacker-controlled `x-nyx-installation-id`); `:725` difficulty `min(4+count,8)`; `:753` targetPrefix setengah difficulty; `:764-772` Argon2id 16MB server-side per verify. `rateLimiter.ts:82-97` `otpLimiter` diekspor tapi 0 call site (grep repo-wide).
- **L1 (LOW)**: infra murni — A record `rt.nyx-app.my.id` → origin; CSP mengekspos port 33333 (`web/nginx.conf:149`) tapi itu kebutuhan WebTransport (tidak boleh dihapus).
- **L2 (LOW, live)**: `web/nginx.conf:38` marketing CSP `script-src 'self' 'unsafe-inline' …`; `:149` app CSP + `cdn.jsdelivr.net`; jsdelivr TIDAK dipakai di `web/src` (grep 0 hit; hanya muncul di nginx.conf dan helmet imgSrc `app.ts:94`).
- **I1 (INFO, live)**: `nginx.conf:41`/`:152` mengiklankan `</health>; rel="status"` di host marketing (tidak dilayani nginx); `server/src/routes/wellKnown.ts:18,27,…,86` service-doc → `https://nyx-app.my.id/api-docs` padahal live 404 (padahal halaman `marketing/src/pages/api-docs.astro` + `[lang]/api-docs.astro` ADA di repo — indikasi drift build/deploy atau path); MCP card mengiklankan `GET /api/ai/mcp` yang 404.
- **Konvensi test**: `server/package.json:20` — `tsx --test tests/password.test.ts …` daftar file EKSPLISIT; test unit tidak boleh butuh Postgres/Redis (AGENTS.md).

## Decisions (with rationale)

1. **C1/H2**: pindahkan `app.use("/api/keys", keysRouter)` ke bawah blok CSRF (setelah baris 312, sebelum `/api/csrf-token`? — letak tepat: bersama rute lain di bagian `=== ROUTES ===`); TAMBAHAN defense-in-depth: guard `Content-Type: application/json` (403/415) pada `POST /prekey-bundle` & `POST /upload-otpk` untuk mematikan vektor simple-request urlencoded meski kelalaian mount terulang. Klien sudah kompatibel (lihat Findings).
2. **C2/H1**: nginx timpa (bukan append): `proxy_set_header X-Forwarded-For $http_cf_connecting_ip;` di 4 lokasi proxy (2 server × /api + /.well-known); Express `app.set('trust proxy', 1)`; biarkan fallback `cf-connecting-ip` di rateLimiter (jadi tidak relevan); dokumentasikan asumsi "wajib di belakang CF" di `docs/10-deployment-ops.md`.
3. **C3/M1**: `callback(null, false)` + pertahankan `console.warn`; tambah tag/dedupe Sentry hanya sebagai catatan ops (kode tetap minimal).
4. **C4/M2**: helper kuota Redis atomik (Lua INCR+EXPIRE, pola `auth.ts:709-716`) `otpkquota:{requester}:{target}` TTL 24j, max 20; dipanggil SEBELUM konsumsi di kedua endpoint; over-quota → balas bundle tanpa `oneTimePreKey` (konsisten dg perilaku stok-habis, tanpa error bubble); pasang `otpLimiter` (naikkan max 5→60/15m) di `GET /prekey-bundle/:userId` & `POST /prekey-bundles`.
5. **C5/M3**: urungkan prioritas → `userId || instId || fingerprint || ip` + prefix `pow:user` lebih dulu; tambah counter `pow:verify:{userId}` (Lua, TTL 1 jam, max 10 → 429); `otpLimiter` dialokasikan sesuai D4 (bukan dihapus).
6. **C6/L2**: prosedur hash-CSP deterministik (build → ekstrak inline script → sha256-base64 → tulis ke `$app_csp`/`$marketing_csp` → rebuild 2x utk cek stabilitas); hapus jsdelivr dari nginx + helmet imgSrc.
7. **C7/I1**: rekonsiliasi 4 sumber (Link header nginx ×2, auth.md ×2, wellKnown.ts) ke URL terverifikasi build; verifikasi kenapa /api-docs 404 live (cek output `astro build`: `dist/api-docs/index.html` vs `.html` dan kecocokan `try_files`).
8. **C8**: checklist ops L1+Sentry ditulis ke docs (tanpa otomasi infra).

## Scope IN

- Server: app.ts (mount order, trust proxy, CORS callback, guard content-type), keys.ts (kuota + limiter), auth.ts (PoW prioritas + verify throttle), rateLimiter.ts (ambang otpLimiter), wellKnown.ts (repoint URL).
- Infra-as-code: web/nginx.conf (XFF overwrite ×4, CSP kedua host, Link header ×2).
- Frontend/docs statis: marketing/public/auth.md, web/public/auth.md.
- Helmet CSP app.ts (hapus jsdelivr imgSrc).
- Test unit baru (helper murni) + pendaftaran di package.json test list; typecheck `tsc --noEmit` per paket; build penuh; e2e chromium reguler (registrasi→onboarding mengunggah prekey = validasi integrasi C1 end-to-end).
- Docs: catatan H1 (asumsi CF), checklist ops L1/Sentry, catatan remediasi.

## Scope OUT (Must NOT have)

- TIDAK mengubah file/apapun di area kripto beku: crypto.worker.ts, crypto-worker-proxy.ts, primitives/padding/format (ENC1:, xchacha envelope, ENCRYPT_DATA Array.from, 8KB padding) — aturan AGENTS.md.
- TIDAK mengubah flag SameSite cookie `at`/`rt`.
- TIDAK menyentuh WebTransport sidecar/Rust (`server/transport-sidecar/**`) maupun protokol opcode.
- TIDAK mengaudit/mengubah webhook subscriptions (di luar laporan §6.4).
- TIDAK melakukan perubahan infra live (DNS, Cloudflare, pm2, VPS) dari repo ini — hanya dokumentasi.
- TIDAK memperbaiki ESLint (broken repo-wide by design; verifikasi via tsc + build).
- TIDAK membuat endpoint baru (I1 diselesaikan dengan repoint, bukan implementasi `/api/ai/mcp`).
- TIDAK menghapus `'wasm-unsafe-eval'` dari CSP.

## Open questions

(none — UNCLEAR path; semua fork diselesaikan sebagai default yang diumumkan di Open assumptions; user bisa veto mana pun di approval gate.)

## Approval gate

status: awaiting-approval
approach: lihat frontmatter `approach` + Decisions D1–D8.
next workflow action: setelah okay → regenerate plan skeleton (scaffold tanpa --draft-only) → Metis gap analysis → APPEND todos per wave → isi TL;DR terakhir → dual high-accuracy review (momus + oracle) → serahkan dengan ringkasan handoff; eksekusi TIDAK pernah dimulai oleh planner.
