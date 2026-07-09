# Audit Engine — Contract-First Migration Audit (2026-07)

Full audit against real route/use-case/repository implementations, as
part of the platform-wide contract-driven Gateway migration.

## 🔴 CRITICAL — complete authentication bypass on every user-facing route (fixed)
Every GET/POST route in this engine except `POST /events` (which
correctly uses an API-key check) had this exact pattern:

```ts
const auth = request.headers.get("authorization");
if (!auth?.startsWith("Bearer ")) { return 401; }
```

This **never verifies the token** — it only checks that the header
begins with the seven characters `"Bearer "`. `Authorization: Bearer x`
satisfies it. There was no JWT signature verification, no expiry check,
no role check, and (for the search/timeline/export endpoints) **no
scoping to the caller's own data at all** — the query params
(`userId`, `walletId`, `actorId`, ...) were passed straight to the
repository with no ownership check.

Net effect: anyone who could reach this engine — and per
`aegis-gateway`'s `proxy.ts`, the Gateway forwards the `Authorization`
header through verbatim after doing its own real check, so this was
only ever "secure" if the engine could never be reached directly —
could read or export **any user's or admin's complete audit trail**:
IP addresses, device IDs, session IDs, wallet activity, admin actions
(logins, permission changes, treasury wallet changes...), and start
investigations, using nothing but a fake bearer string. This is
precisely the data this engine's own `docs/SECURITY.md` and code
comments (`// POST — Start investigation (admin only)`) say must be
admin-only — the intent was correct, the enforcement never existed.

This also violates this project's own shared-SDK contract: the SDK's
`requireAuth()`/`requireAdmin()` doc comment states *"Every engine calls
this independently — zero-trust between engines"* — and Transfer Engine
and Payment Engine already do call it. Audit Engine was the one engine
that hand-rolled its own (broken) check instead of using the shared,
independently-Supabase-verified helper.

### Fix
Replaced the hand-rolled check on all 12 affected route handlers with
the shared SDK's `requireAdmin()` (which calls `requireAuth()` — real
`supabase.auth.getUser(token)` verification — then checks
`role === 'admin' || 'super_admin'`), matching the admin-only intent
already stated in this engine's own docs and code comments:

- `GET /events` (search — cross-user/cross-wallet/cross-admin)
- `GET /events/{id}`
- `GET /history/admins/{adminId}`
- `GET /history/correlations/{correlationId}`
- `GET /history/wallets/{walletId}`
- `POST /investigations`, `GET /investigations`
- `GET /investigations/{id}`
- `GET /recent`
- `GET /statistics`, `GET /statistics/engines`
- `GET /timeline`
- `POST /exports`, `GET /exports` (the single most sensitive endpoint —
  a full bulk data export; flagged in-code as a candidate for
  `requireSuperAdmin()` instead, as a follow-up policy decision, not
  made unilaterally here)

One route got a different, more permissive fix rather than admin-only,
because it has a legitimate self-service use case:
- **`GET /history/users/{userId}`** — now uses `requireAuth()` (a real
  session is still required) plus an explicit check that
  `auth.userId === userId` **or** the caller is admin/super_admin. A
  user should reasonably be able to see their own login/action history;
  they should not be able to see anyone else's by changing the URL.

`POST /events` (engine-to-engine ingestion) was left as-is — its
`X-Audit-API-Key` check against `AUDIT_ENGINE_API_KEY` is a correctly
implemented shared-secret check for machine-to-machine calls, not a
user-auth path.

### Regression guard added
`tests/security/route-auth.test.ts` — a static test that reads each
route file's source and asserts it calls `requireAdmin()` /
`requireAuth()` and no longer contains the old
`startsWith("Bearer ...")` pattern. Deliberately static rather than a
live HTTP + mocked-Supabase-JWT test, to keep it fast and dependency-free
while still failing loudly if anyone reverts to the hand-rolled check —
which is exactly the failure mode that caused this bug in the first
place (one engine quietly diverging from the shared-SDK convention every
other engine follows).

## No secret leaks found
`.npmrc` in this engine already correctly used
`${GITHUB_PACKAGES_TOKEN}` — unlike the leaks fixed in
`aegis-portfolio-engine` and `aegis-market-engine` during this same
migration. No other hardcoded credentials found in source.

## Contract drift: none in routes, but the security intent was undocumented
The previous hand-written `openapi/openapi.json` route already declared
`bearerAuth` on every user-facing route (so on paper the contract wasn't
"wrong"), but it never distinguished "any authenticated user" from
"admin only" — an ambiguity that mirrors the code's own failure to
enforce a role at all. The canonical contract now checked into
`openapi/openapi.json` adds an `x-required-role` field per path
(`admin`, `self-or-admin`, or omitted for public/engine-to-engine),
matching what's actually enforced after this fix.

## Infrastructure added (this engine had tests and docs, but no CI and no canonical checked-in contract)
- `openapi/openapi.json` — canonical, checked-in version of the
  previously inline spec, now with `x-required-role` annotations.
- `scripts/validate-openapi.mjs`, wired into `npm run build` — this
  engine already had 17 route files with zero drift against the
  existing inline spec, so this is a forward-looking guard, not a fix
  for existing drift.
- `.github/workflows/ci.yml` — this engine had none at all; its
  existing 56 tests had never actually run in CI.

## Verified locally (all actually run)
- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — **70/70 passing** (56 pre-existing + 14 new
  regression-guard tests in `tests/security/route-auth.test.ts`).
- `node scripts/validate-openapi.mjs` — 17/17 route files matched.
- `npm run build` (real production `next build`) — compiles, all 17
  routes register correctly.

## Production readiness
This was the most severe finding across the whole migration — a
complete authentication bypass on the engine that stores the platform's
own admin/security audit trail. It's fixed and covered by a regression
test today. Recommend, as a fast follow, deciding whether
`POST /exports` should require `super_admin` specifically given its
blast radius (a single call can dump the entire audit log), and
whether `GET /history/wallets/{walletId}` should eventually support
self-service access for a wallet's owner (would need an ownership
lookup against Wallet Vault — a product decision, not made here).

## Next recommended step
This was the last engine in the priority list (Payment → Transfer →
Notification → Market → Audit). Recommended next: the dedicated fix PR
for `aegis-portfolio-engine`'s broken `HttpMarketClient` (found while
auditing Market Engine — wrong health-check field, wrong route shape,
wrong response envelope, meaning Portfolio Engine has never
successfully fetched a live price from Market Engine).
