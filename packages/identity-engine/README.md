# aegis-identity-engine

Owns identity lifecycle for the Aegis platform: AEGIS ID issuance, account
state (registration → active → locked/suspended/closed/deleted), user
profiles, wallet-mapping records (written by Wallet Vault, read here), and
the identity audit trail.

Part of the Aegis microservice architecture — see
[`aegis-architecture`](https://github.com/CozanetHQ/aegis-architecture) for
the full system design, ownership rules, and deployment order. This engine
is **Wave 1, #2** in the deployment order (depends only on
`aegis-shared-sdk`; the Gateway and other engines depend on it).

## Architecture

Clean Architecture / DDD, per the platform-wide certification checklist:

- `src/domain/` — pure TypeScript, zero I/O. `identity-state-machine.ts`
  (the lifecycle transition matrix) and `aegis-id-generator.ts`
  (cryptographically random `AEG-XXXXXXXX` ID generation) live here, fully
  unit-tested.
- `src/application/identity-use-cases.ts` — orchestrates domain + ports.
- `src/infrastructure/` — Supabase repository, rate limiter (Upstash), and
  the Wallet Vault HTTP client (with a local in-memory fallback for dev).
- `src/app/api/v1/` — thin Next.js route handlers. Parse → call a use case
  → respond via the shared `ok()`/`err()` helpers.
- `src/engine.ts` — the composition root and **only** file other engines
  should import from (currently consumed internally; exposed for future
  in-process use, though cross-engine calls go over HTTP per the
  architecture's no-cross-engine-imports rule).

## API surface (`/api/v1/...`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/identity/signup` | public | Create Supabase Auth user + identity record, auto-confirmed |
| POST | `/identity/register` | public | Create identity skeleton after external Supabase Auth signUp() |
| POST | `/identity/login` | public | Authenticate, return session + identity card |
| POST | `/identity/refresh` | public | Exchange refresh token for new access token |
| POST | `/identity/verify-email` | user | `PENDING_REGISTRATION` → `EMAIL_VERIFIED` |
| POST | `/identity/onboard` | user | Save profile, generate wallets, → `ACTIVE` |
| GET/PATCH/DELETE | `/identity/me` | user | Own identity card / update profile / self-close |
| POST | `/identity/me/lock` | user | Self-lock (suspected compromise) |
| POST | `/identity/me/unlock` | user | Self-unlock |
| GET | `/identity/:aegis_id` | public | Compact public identity card (no email/internal id) |
| GET | `/identity/internal/:aegis_id` | engine (`X-Identity-API-Key`) | Full lookup for Transfer/Payment/Business/AI engines |
| POST | `/identity/admin/lock` \| `/suspend` \| `/unlock` \| `/reactivate` | admin | Admin-driven state transitions |
| GET | `/identity/admin/:aegis_id/audit` | admin | Full state-transition audit trail |
| POST | `/identity/admin/outbox` | cron (`CRON_SECRET`) | Drains `identity_event_outbox` → dispatches notification events |
| GET | `/health` \| `/version` \| `/metrics` \| `/openapi.json` | public | Standard engine endpoints (certification Rule 4) |

> Note: several route doc-comments still say `/api/v2/...` from an earlier
> planned rename that was never applied to the actual paths — the real,
> deployed paths are all `/api/v1/...` as listed above. Cosmetic only, not
> a functional issue.

## Identity lifecycle

`PENDING_REGISTRATION → EMAIL_VERIFIED → ACTIVE ⇄ {SUSPENDED, LOCKED, CLOSED} → DELETED`

Every transition is validated against a single matrix in
`identity-state-machine.ts` before any DB write — see that file for the
full permitted-actor table. Notably: users can self-lock/unlock, closed
accounts can self-reactivate within a grace window, and only
`SUPER_ADMIN` can hard-delete.

## Environment variables

See `.env.example`. Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `WALLET_VAULT_URL` + `WALLET_VAULT_API_KEY`
(falls back to an in-memory local client if unset — dev/test only, never
use in production), `IDENTITY_ENGINE_API_KEY` (inbound key other engines
use to call `/identity/internal/:aegis_id`), `UPSTASH_REDIS_REST_URL` +
`UPSTASH_REDIS_REST_TOKEN` (rate limiting), `GITHUB_PACKAGES_TOKEN`
(installs the private `@cozanethq/aegis-shared-sdk` package in CI/Vercel).

## Testing

```bash
npm test
```

51 tests total, no mocking framework needed:
- Domain layer (`identity-state-machine`, `aegis-id-generator`) — 26 tests
  against pure functions.
- Application layer (`identity-use-cases`) — 25 tests against in-memory
  fake implementations of `IdentityRepository`, `WalletVaultPort`, and
  `RateLimiterPort` (all defined in the test file). Covers the full
  identity lifecycle: registration, rate limiting, duplicate-email guard,
  email verification (incl. idempotency), onboarding (incl. username
  collision and wallet-vault-failure rollback), profile updates, self-lock/
  unlock/close, admin transitions, and recipient resolution.

## Known gaps vs. the certification checklist

- [x] Use-case tests with fake repositories
- [x] `export const dynamic = "force-dynamic"` on all route files
- [x] Migrations are idempotent (`IF NOT EXISTS` / `DO $$ ... EXCEPTION`)
- [ ] `docs/README.md` with engine-specific design decisions (nice-to-have,
      not blocking — the sections above cover the substance)
- [ ] Template/resolver tests — n/a, this engine has no template-rendering
      logic (that lives in Notification Engine)

All mandatory items are now satisfied. Recommend updating this engine's
status in `ownership.md` from "exists" to "certified."
