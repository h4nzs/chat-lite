---
slug: security-remediation
status: plan-written-vanguard-pending
intent: clear
pending-action: integrate vanguard findings into .omo/plans/security-remediation.md, then fill TL;DR, then deliver start-or-high-accuracy question
approach: surgical in-repo remediation of SECURITY-ASSESSMENT-2026-08-23.md findings (H2,H1-code,M1,M2,M3,L2-app,I1) + nginx.conf repo hardening (H1-infra/L1 documented as manual ops), 9 todos / 2 waves, tests-after with extracted pure helpers under node:test
---

# Draft: security-remediation

## Components (topology ledger)
<!-- id | outcome | status | evidence -->
- C1 server-csrf-keys | /api/keys behind CSRF + lax at-cookie + 415 guard | planned | app.ts:263 vs 284-312; auth.ts:64-69; keys.ts mutations
- C2 ip-resolution | trust proxy=1 + CF-header-first keying (limiters, non-API limiter, PoW ip fallback, CSRF ip fallback) | planned | app.ts:54; rateLimiter.ts:11-18; auth.ts:691; app.ts:289-293
- C3 cors-deny | callback(null,false), no 500/Sentry feed | planned | app.ts:197-206,387-406
- C4 pow-integrity | userId-first identity, verify throttle Lua, otpLimiter deleted | planned | auth.ts:687-789; rateLimiter.ts:80-97
- C5 app-csp | script-src minus jsdelivr/'unsafe-inline' → sha256 pins | planned | web/nginx.conf:149; dist/index.html inline scripts
- C6 otpk-quota | fail-closed per-(requester,target) daily quota both consuming endpoints | planned | keys.ts:166-266,356-475
- C7 metadata-truth | wellKnown.ts URLs resolvable; mcp endpoint fixed | planned | wellKnown.ts:18-160
- C8 nginx-hardening | real_ip(CF)+XFF overwrite+$remote_addr, exact-match /api-docs (repo file ONLY) | planned | web/nginx.conf both server blocks; deploy.yml:89-198 proof of no auto-sync
- C9 docs-runbook | ops sync steps + assessment status block | planned | docs/10-deployment-ops.md

## Open assumptions (announced defaults)
<!-- assumption | default | rationale | reversible? -->
| H1 fix shape | trust proxy=1 + cf-connecting-ip-first (+nginx real_ip/overwrite in repo conf) | hop-count analysis of appended XFF chain; bare $remote_addr overwrite insufficient without real_ip | yes |
| at-cookie SameSite | lax always (rt untouched) | same-site subdomains keep working; blocks cross-site form CSRF | yes |
| M2 quota | 30/day/pair fail-closed via atomic Lua | matches repo INCR+EXPIRE convention; client replenishes OTPK anyway | yes |
| otpLimiter | delete | zero call sites verified by grep | yes |
| I1 strategy | fix references/urls to truth, remove dead mcp endpoint field | least surface; no invented endpoints | yes |
| test strategy | tests-after + pure-helper node:test units listed explicitly in server package.json | repo convention (AGENTS.md) | yes |

## Findings (cited - path:lines)
All 8 findings independently re-verified this session against source:
- H1: app.ts:54 trust proxy=true; nginx.conf:105,115,237,247 $proxy_add_x_forwarded_for; rateLimiter.ts:11-18 req.ip-first keying ✅
- H2: app.ts:263 mount before CSRF(284-312); auth.ts:66 SameSite=None prod; app.ts:250 urlencoded extended; keys.ts:55-83 overwrite incl device.update; 103-139 upload-otpk; 154-163 delete ✅
- M1: app.ts:204 callback(new Error)→handler 387-406 Sentry+500 ✅
- M2: keys.ts:229-239 consume per fetch no quota; bulk 429-468 ×50 ✅
- M3: auth.ts:702 instId-first; :725 difficulty; :753 halving; rateLimiter.ts:82-97 otpLimiter zero call-sites ✅
- L1: DNS-only (not locally verifiable); CSP exposes rt:33333 (nginx.conf:149) ⚠️ taken on report
- L2: nginx.conf:38 marketing unsafe-inline; :149 app +jsdelivr+wasm ✅ (+helmet app.ts:77 also unsafe-inline — noted, left as-is w/ rationale)
- I1: wellKnown.ts advertises nyx-app.my.id/api-docs (shadowed by location /api → Express 404) and api/ai/mcp GET-404 ✅ root-caused

## Decisions (with rationale)
1. Move keys mount below CSRF rather than in-router protection — one-line semantics, report-recommended, client api.ts already sends csrf-token on mutations.
2. trust proxy=1 not hop-count-2: appended-XFF chain [forged,real,cf-edge] with socket=nginx makes N=1 resolve req.ip=real-client; N=2 would resolve forged.
3. CF-header-first keying as belt-and-braces (direct-origin residual documented).
4. Fail-closed whole-request quota on bulk OTPK (simpler, safer than partial fill).
5. nginx changes stay in-repo; VPS sync = documented manual step (deploy.yml ships no *.conf).
6. helmet CSP untouched (API responses are not HTML documents).

## Scope IN
9 todos as written in .omo/plans/security-remediation.md (H2,H1,M1,M3,L2 wave1+5; M2,nginx,I1,docs wave2)

## Scope OUT (Must NOT have)
Frozen crypto files; packages/shared; prisma schema/db push; dependency changes; lint fixes; push/deploy/VPS/DNS contact; CSP weakening elsewhere; refactors.

## Open questions
None surviving two-filter triage — all resolved by evidence or announced defaults above.

## Approval gate
status: approved-by-user (chose "Draft rencana remediasi penuh" after brief with verdict table + nuances + priorities)
plan: .omo/plans/security-remediation.md scaffolded & filled; Vanguard review bg_8e726671 pending integration
