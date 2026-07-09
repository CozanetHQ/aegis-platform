# Notification Engine — Contract-First Migration Audit (2026-07)

Full audit against real route/use-case implementations, as part of the
platform-wide contract-driven Gateway migration. This engine was already
in noticeably better shape than Payment/Transfer — no route contract
drift and no ownership bugs — but the audit still found real issues.

## Findings — fixed

### 1. Two error paths returned the wrong HTTP status (real bug, not just docs)
`mark-read.use-case.ts` threw plain `Error('NOTIFICATION_NOT_FOUND')` /
`Error('FORBIDDEN')`. `@cozanethq/aegis-shared-sdk`'s `err()` only maps
`AegisError` subclasses to their declared `httpStatus` — anything else
falls through to a generic `500`. So `POST /notifications/{id}/read`
was returning **500** for both "no such notification" (should be 404)
and "that's not your notification" (should be 403) — the second one is
an authorization outcome being reported as a server error, which also
makes it indistinguishable from a real failure in logs/monitoring.
Fixed: added `notification-error.ts` (same `AegisError`-subclass shape
as `TransferError`/`PaymentError`) and updated the use-case to throw it
with the correct codes/statuses. Kept the exact same `message` text
(`'NOTIFICATION_NOT_FOUND'` / `'FORBIDDEN'`) so existing tests and any
current caller matching on message text keep working — only the
resulting HTTP status and `code` field change.

### 2. Weaker health check than every other engine
`GET /health` returned a static `{ status: 'ok' }` with no DB check at
all — the only one of five engines where the Gateway could never detect
a DB outage via health. Brought in line with the
Identity/Wallet-Vault/Transfer/Payment pattern (real `SELECT` against
`notifications`, `503` on failure).

### 3. Dead duplicate source tree committed to the repo (`.deploy_copy/`)
A full, byte-identical copy of `src/` was tracked under `.deploy_copy/`
(introduced in the same commit as the branded email templates). Verified
it's referenced by nothing — not the `Dockerfile`, not
`docker-compose.yml`, not any Next.js config (Next only ever builds
`src/app`). This is exactly the kind of artifact "GitHub as sole source
of truth" is meant to prevent: two copies of the same logic that *look*
authoritative, with nothing enforcing they stay in sync. Deleted.

### 4. `docker-compose.yml` had an invalid service name
The service key was literally `@cozanethq/aegis-notification-engine:` —
Compose service names may only contain `[a-zA-Z0-9._-]`, so `@` and `/`
would make `docker-compose up` fail outright. Renamed to
`notification-engine`.

### 5. `.env.example` didn't match what the code reads
Listed `ENGINE_API_KEY` (code reads `NOTIFICATION_ENGINE_API_KEY`) and
`DATABASE_URL` (unused — this engine uses Supabase, not a raw Postgres
URL), and was missing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`IDENTITY_ENGINE_URL`, `IDENTITY_ENGINE_API_KEY`, `RESEND_API_KEY`, and
`NOTIFICATION_FROM_EMAIL` — all of which the code actually reads
(`engine.ts`, `identity-contact-resolver.ts`, `resend-email.provider.ts`).
Corrected to match reality.

## Findings — reported, not changed
- **`.npmrc` env var naming**: this engine reads `${GITHUB_PACKAGES_TOKEN}`
  (matching Identity/Wallet-Vault/Payment). Transfer Engine is the one
  outlier that reads `${GITHUB_TOKEN}` instead — a genuine
  platform-wide inconsistency, flagged there, not something to fix by
  editing four other repos in this PR.
- `/metrics` (no auth) exposes notification counts by status/channel —
  coarser and less sensitive than Payment's total-fees-collected, no
  action recommended beyond the general infra-restriction note already
  made for other engines.
- `DeliverNotificationUseCase` and `template-resolver.ts` also throw
  plain `Error`, but neither is reachable directly from an HTTP route
  boundary with meaningful status-code implications (both are internal,
  called only from `ProcessEventUseCase`, itself triggered by the
  already-correctly-`engineApiKey`-gated ingest route) — left as-is.

## No route contract drift found
Every path/method/security requirement in the previous hand-written
`openapi.json` matched the real route implementations exactly. This is
the only engine so far where the *contract itself* needed no path-level
corrections — only the checked-in/validated infrastructure was missing.

## Verified locally (all actually run)
- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — 34/34 passing (7 test files, including the
  ownership + not-found cases in `mark-read.use-case.test.ts`, unchanged
  pass/fail outcome after the error-type fix).
- `node scripts/validate-openapi.mjs` — 9/9 routes matched.
- `npm run build` (real production `next build`) — compiles, all 10
  routes register correctly.

## Infrastructure added
- `openapi/openapi.json` — canonical, checked-in contract.
- `scripts/validate-openapi.mjs`, wired into `npm run build`.
- `.github/workflows/ci.yml` — this engine had **no CI at all** before
  this PR. Added: install → validate-openapi → typecheck → test → build.

## Production readiness
Ready to merge. The two behavioral fixes (error status codes, health DB
check) are low-risk correctness improvements, not new features; the rest
is dead-code removal and docs/config accuracy.

## Next recommended engine
Market Engine, per the priority order.
