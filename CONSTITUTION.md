# AEGIS Platform Constitution

**Version:** 1.0.0  
**Last Updated:** 2026-07-29  
**Authority:** Platform Owner (CozanetHQ)  
**Enforcement:** Every engine, package, and application in the AEGIS platform

---

## Preamble

This Constitution defines the immutable laws governing the AEGIS platform's
architecture, security, and operational integrity. Every contributor — human
or AI — must follow these laws when building, fixing, or modifying any part of
the platform. Violations are not style preferences; they are defects.

---

## Article I: Architecture

### Law 1 — No Business Logic in the Frontend

The frontend (aegis-ui-v2 or any successor) is a presentation layer. It may:
- Render data from API responses
- Send user input to backend APIs
- Handle UI state (loading, error, success)

It may NOT:
- Derive private keys or sign transactions
- Calculate fees, gas, or slippage
- Call blockchain RPCs directly
- Implement any domain logic that belongs to an engine

**Enforcement:** Any logic that touches money, keys, or chain state must live
in an engine. The frontend is a thin client — proxies and renderers only.

### Law 2 — Single Source of Truth per Capability

Each engine owns its domain. No other engine, package, or app may duplicate
that domain's logic.

- Swap logic lives in the Swap Engine
- Transfer logic lives in the Transfer Engine
- Fee calculation lives in the Treasury Engine
- Wallet signing lives in the Wallet Vault Engine
- Identity validation lives in the Identity Engine

**Enforcement:** If you find yourself writing fee logic in the Swap Engine,
you're violating this law. Call the Treasury Engine instead.

### Law 10 — No Duplicate Implementations

No two codebases may implement the same capability. If the Swap Engine has
a fee calculation function, the frontend must not have its own. If the
Transfer Engine has a gas estimation function, the Swap Engine must not
have its own.

**Enforcement:** Before adding a utility, check if another engine already
provides it. If it does, call it via HTTP or the shared SDK — don't copy it.

---

## Article II: Security

### Section 8 — Private Keys Never in the Frontend

Private keys, seed phrases, master seeds, and signing material must never
exist in frontend code, frontend environment variables, or frontend bundles.

**Enforcement:** `AEGIS_WALLET_MASTER_SEED` and similar secrets are backend-only.
The frontend uses the Wallet Vault Engine's HTTP API for signing — it never
touches raw keys.

### Law 21 — Blast Radius Assessment Required

Before changing any user-facing production file, the author must produce a
blast radius assessment that identifies:
1. What files are affected
2. What APIs change (breaking or non-breaking)
3. What user-facing behavior changes
4. What fallback exists if the change fails

**Enforcement:** No high-risk change (touching swap, transfer, wallet, or
identity flows) may be deployed without this assessment and owner approval.

---

## Article III: Compatibility

### Law 13 — No Working Code Deleted Until Replacement Has Parity

Before removing functionality, the replacement must have feature parity with
the old implementation. If the old code handled 10 cases, the new code must
handle all 10 — or explicitly document which are deferred and why.

**Enforcement:** If you remove an endpoint, the new endpoint must accept the
same inputs, produce the same outputs, and handle the same edge cases.

### Law 19 — Every Change Must Preserve Existing Functionality

No change may silently break an existing user-facing behavior. If a response
field was previously returned, it must still be returned (or explicitly
removed with a migration plan).

**Enforcement:** If the old quote response included `feeBps`, the new one must
too — or the removal must be documented, tested, and communicated.

### Existing User Protection Law

No architectural change may degrade the experience of existing users. New
users get new features; existing users keep what works until they opt in.

**Enforcement:** Feature flags, gradual rollouts, or parallel endpoints —
never a breaking cutover.

---

## Article IV: Governance

### Law 22 — All Architectural Changes Require an ADR

Any change that modifies the architecture (adding/removing engines, changing
inter-engine communication, modifying the shared SDK) must be documented in
an Architecture Decision Record (ADR) before implementation.

**Enforcement:** ADRs live in `docs/adr/` and follow the standard template:
Context → Decision → Consequences → Alternatives Considered.

### Section 9c — Owner Approval for High-Risk Changes

Changes to any of the following require explicit owner approval before
deployment:
- Swap execution flow
- Transfer execution flow
- Wallet signing flow
- Fee collection flow
- Identity validation flow

**Enforcement:** The owner is @fassdavid722. No AI agent may deploy changes
to these flows without written confirmation.

---

## Article V: Engine Pattern (Law 23)

### Law 23 — The Standard Engine Pattern Must Be Applied Everywhere

Every engine in the AEGIS platform — whether new or being fixed — must follow
the Standard Engine Pattern. This is not a suggestion; it is the law. When
building a new engine or fixing an existing one, every file, every layer, and
every dependency must conform to this pattern.

#### Layered Architecture (Hexagonal / Clean Architecture)

```
src/
├── domain/                    # Pure business logic — no I/O, no frameworks
│   ├── entities/              # Aggregate roots (Transfer, Swap, etc.)
│   ├── value-objects/         # Immutable, validated primitives
│   ├── enums/                 # State machines, types
│   ├── events/                # Domain events
│   ├── repositories/          # Repository interfaces (ports)
│   └── transfer-state-machine.ts
├── application/               # Use cases — orchestration of domain + ports
│   ├── ports/                 # Port interfaces for external services
│   ├── use-cases/            # One file per use case (UC-XX)
│   └── transfer-error.ts     # Engine-specific error class
├── infrastructure/            # Concrete adapters implementing ports
│   ├── clients/              # HTTP clients to other engines
│   ├── providers/            # Blockchain, RPC, third-party adapters
│   └── repositories/         # Database/persistence implementations
├── app/api/v1/               # Next.js API routes — thin handlers only
└── engine.ts                 # THE single public interface
```

#### Rules

1. **Single Public Interface:** Every engine exposes exactly ONE file that
   API routes may import: `engine.ts`. This is the composition root. API routes
   import only `engine.ts` and the shared SDK — nothing else.

2. **Ports, Not Concrete Classes:** Use cases in `application/` depend only on
   port interfaces (in `application/ports/`), never on concrete implementations.
   The composition root (`engine.ts`) wires concrete adapters into ports.

3. **Domain Layer is Pure:** The `domain/` layer has zero I/O — no HTTP calls,
   no database access, no `fetch`, no `process.env`. It contains only entities,
   value objects, enums, events, and repository interfaces.

4. **Validation with Zod:** All API request bodies are validated with Zod
   schemas in the API route layer, before the use case is called. The use case
   receives typed, validated input.

5. **Error Handling with AegisError:** All errors use `AegisError` from
   `@cozanethq/aegis-shared-sdk`. No custom error classes, no raw `Error`
   throws in use cases. Error codes are engine-scoped (e.g., `SWAP_NO_BNB_WALLET`,
   `TRANSFER_NOT_FOUND`).

6. **Blockchain with Viem:** All blockchain interactions use Viem (or ethers
   for legacy compatibility). No direct RPC calls outside of infrastructure
   providers.

7. **Correlation IDs:** Every use case generates a UUID correlation ID at the
   start of execution. This ID flows through all logs, audit events, and
   cross-engine calls for traceability.

8. **Non-Fatal Fire-and-Forget:** Audit events and notifications are
   `Promise.allSettled` + `void` — they cannot break the user's result. Treasury
   ledger records are `try/catch` — they cannot block the main flow.

9. **BigInt-Safe Serialization:** All JSON responses use a custom replacer that
   converts `bigint` to `string`. Never use `JSON.stringify` without the BigInt
   replacer.

10. **Tests with Vitest:** Every use case has tests. Tests use fake
    implementations of ports (not mocks of concrete classes). Tests cover happy
    path, error cases, and non-fatal failures.

11. **OpenAPI Contract:** Every API route has a corresponding entry in
    `openapi/openapi.json`. The build fails on contract drift.

12. **Fee Recipient Warning:** When using a hardcoded fee recipient fallback
    (because `FEE_RECIPIENT_ADDRESS` env var is not set), log a warning. Never
    silently use the fallback.

13. **Idempotency Warning:** When Redis is not configured for idempotency
    protection, log a warning. Never silently disable safety mechanisms.

#### When Building a New Engine

1. Start with the domain layer — entities, value objects, enums
2. Define ports in `application/ports/`
3. Write use cases in `application/use-cases/`
4. Implement concrete adapters in `infrastructure/`
5. Wire everything in `engine.ts`
6. Write API routes as thin handlers (validate → call engine → return)
7. Add the OpenAPI entry
8. Write tests for every use case
9. Build must pass (`npm run build`)
10. All tests must pass (`npm test`)

#### When Fixing an Existing Engine

1. Read the existing architecture — does it follow the pattern above?
2. If not, refactor to conform — don't patch around the pattern
3. All new code must follow the pattern, even if old code doesn't yet
4. Tests must pass before and after the change
5. No new dependencies on concrete classes in use cases — always use ports
6. Document what was fixed and why in the commit message

---

## Amendment Process

1. The owner (@fassdavid722) proposes an amendment
2. An ADR is created documenting the change (Law 22)
3. The amendment is reviewed for blast radius (Law 21)
4. Existing user impact is assessed (Existing User Protection Law)
5. The owner approves or rejects

---

*This Constitution is the source of truth for the AEGIS platform. When in
doubt, follow the law. When the law is silent, follow the pattern. When the
pattern is silent, ask the owner.*

---

## Article VI: Security Architecture

### Law 24 — Security Headers Required

Every engine must set the security headers listed in Section S6 on all responses via middleware.

### Section S1 — Key Material Security

- Private keys derived via HD derivation from `VAULT_HD_MNEMONIC` (BIP44 paths)
- Envelope encrypted with AES-256-GCM (per-wallet IV, auth tag, key version)
- `KmsPort` interface ready for KMS/HSM swap (current: env-var master key)
- Known gap: `VAULT_HD_MNEMONIC` and `VAULT_MASTER_KEY_HEX` in env vars — MUST move to real KMS/HSM before mainnet custody
- Private keys never returned by any API, never logged
- Zeroization after signing (documented intent — JS strings immutable, true zeroization needs Buffer refactor)

### Section S2 — Authentication Architecture

- Supabase JWT (Bearer token for cross-origin, cookie for same-origin)
- Engine-to-engine: `X-Vault-API-Key` with `crypto.timingSafeEqual` (via shared SDK `requireEngineApiKey`)
- Separate API keys per caller (`WALLET_VAULT_API_KEY` for Identity/Gateway, `WALLET_VAULT_API_KEY_TRANSFER` for Transfer, `WALLET_VAULT_API_KEY_SWAP` for Swap)
- Role hierarchy: user → admin → super_admin (enforced via `requireAdmin`, `requireSuperAdmin`)
- `getClientIp` for IP-based rate limiting

### Section S3 — Rate Limiting

- Upstash Redis sliding window rate limiter
- Per-endpoint limits (generate: 3/min, sign: 10/min, reads: 60/min, admin: 5/min)
- Fail-open on Upstash unavailability (availability over blocking)

### Section S4 — Error Handling & Traceability

- `AegisError` with code, httpStatus, correlationId, timestamp, details
- Correlation IDs via `X-Correlation-Id` header (`getOrCreateCorrelationId` from SDK)
- Every error response includes correlation ID for traceability
- Engine-scoped error codes (`WALLET_NOT_FOUND`, `WALLET_NOT_SIGNABLE`, etc.)

### Section S5 — Data Protection

- RLS enabled on all Supabase tables (service role bypasses for engine-internal calls only)
- No direct client access to engine tables — all access via API routes
- Metadata encryption for sensitive fields (bank details) via AES-256-GCM with scrypt-derived key

### Section S6 — Security Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Section S7 — Audit & Compliance

- State transition audit table (`wallet_states` — append-only)
- KYC tier enforcement (Tier 0-4 with USD limits)
- Transaction risk service (daily spend limits, high-amount flags)
- Compliance service for cross-border transfers

### Section S8 — Engine Boundary Enforcement

- Wallet Vault ONLY signs — never broadcasts (Transfer Engine broadcasts)
- Wallet Vault ONLY stores key material — never exposes it
- Engines communicate via HTTP + API key auth — no cross-imports
- Ownership guard: `signTransaction` verifies `wallet.aegisId === requestingAegisId`

### Section S9 — CI/CD Security

- CODEOWNERS: require review on critical paths
- Aegis Security Guardian: blocks destructive changes to critical files
- Auto-Revert: automatically restores deleted critical files
- CI: builds and tests must pass before merge
- Branch protection on main
