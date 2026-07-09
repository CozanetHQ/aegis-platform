# Portfolio ↔ Market Integration — Dedicated Audit & Fix (2026-07)

Follow-up from the Market Engine contract-first audit
(`aegis-market-engine` PR #2), which discovered Portfolio Engine's
`HttpMarketClient` could never successfully fetch a live price from
Market Engine. This PR is the dedicated fix, scoped only to that
integration — no other behavior changed.

## Audit findings — three independent, compounding contract mismatches

### 1. Health endpoint
- **Client checked:** `data.status === 'ok'`
- **Market Engine actually returns:** `status: 'healthy' | 'degraded'`
  (see `aegis-market-engine/src/app/api/v1/health/route.ts`)
- **Effect:** `isAvailable()` was **always `false`**. Every downstream
  price call short-circuited before even attempting a request — this
  alone made the other two bugs unreachable/invisible.

### 2. Route path / query parameters
- **Client called:** `GET /api/v1/prices/{symbol}?chain={chain}`
- **Real, only route:** `GET /api/v1/prices?symbols=A,B,C` — a flat,
  comma-separated query parameter, no path segment, and **no chain
  concept at all**. Market Engine prices (CoinGecko-backed) are
  chain-agnostic: a token symbol has one USD price regardless of which
  chain a given deployment lives on.
- **Effect:** even with a fixed health check, every price request would
  have 404'd against a route that doesn't exist.

### 3. Response envelope and field names
- **Client expected:** `{ data: { symbol, price, currency, timestamp,
  source, stale } }`
- **Market Engine actually returns:** a flat (no `.data` wrapper)
  `{ prices: [{ symbol, priceUsd, change24h, volume24h?, marketCap?,
  high24h?, low24h?, name, updatedAt }], count, timestamp }` — see
  `ok()` in the shared SDK (`Response.json(data)`, no envelope) and
  `get-prices.use-case.ts`'s actual return shape.
- **Effect:** even with the first two fixed, `data?.data` would have
  been `undefined` and the field names wouldn't have matched this
  engine's own `PriceData` interface at all.

**Net result of all three:** Portfolio Engine has never, in production,
successfully retrieved a real price from Market Engine. Every fiat
valuation (`GetPortfolioSummaryUseCase`, `GetAvailableBalanceUseCase`,
`PreviewTransferUseCase`) has been silently computing with `price = 0`
(the `?.price ?? 0` fallback already in `portfolio-use-cases.ts`) —
correct in that it degrades safely rather than crashing, but silently
wrong in that every portfolio fiat value has effectively read as `$0`
worth of market-priced holdings this whole time, with no error surfaced
anywhere.

## Fix
Rewrote `HttpMarketClient` (`src/infrastructure/clients/http-engine-clients.ts`):

- `isAvailable()` now checks `status === 'healthy'`.
- `getPrice()` now calls the real route:
  `GET /api/v1/prices?symbols={SYMBOL}`, ignores its `chain` parameter
  (kept in the method signature for port-interface compatibility with
  existing callers, prefixed `_chain`, documented why it's unused).
- `getPrices()` now issues **one batched HTTP call** for all requested
  symbols (Market Engine's route already supports comma-separated
  `symbols`) instead of one call per token via a per-symbol loop — a
  performance fix as a side effect of using the route correctly, not a
  new feature. The same price is applied to every `{symbol, chain}` pair
  sharing a symbol, since prices are chain-agnostic upstream.
- Added a `toPriceData()` mapper that translates Market Engine's real
  field names (`priceUsd`, `updatedAt`) into this engine's own
  `PriceData` shape (`price`, `currency: 'USD'`, `timestamp`, `source:
  'market-engine'`), and computes `stale` from the entry's age against
  2x Market Engine's own 60s cache TTL (120s) — previously there was no
  staleness signal at all since the field didn't exist upstream.
- Added `AbortSignal.timeout(5000)` to price fetches (the health check
  already had a 3s timeout; the price calls had none — a slow Market
  Engine could have hung portfolio valuation indefinitely).

**Not changed:** call sites in `portfolio-use-cases.ts` (all four
`marketClient.getPrice(...)` calls) — this PR fixes the client's
contract compliance, not the use-cases' calling pattern. Note as tech
debt: three of those four call sites loop `getPrice()` per balance
inside a `for` loop rather than calling the now-properly-batched
`getPrices()` once — a real perf opportunity, but changing use-case
business logic is out of scope for a contract-drift fix and wasn't
asked for here.

## Error handling & timeout behavior (verified)
- All Market Engine calls are already wrapped in `try/catch` returning
  `null`/empty map on any failure (network error, non-2xx, timeout) —
  callers already treat a missing price as "unknown, treat as 0" via
  `?.price ?? 0`, so this fix doesn't change failure-mode behavior, only
  makes the success path actually reachable.
- `isAvailable()`'s 30s cache means a real Market Engine outage is
  re-checked at most every 30s rather than on every single portfolio
  request — unchanged, already reasonable.
- Price fetches now time out at 5s (previously unbounded) so a slow
  Market Engine can no longer stall a whole portfolio computation.

## Regression tests added
`tests/infrastructure/http-market-client.test.ts` (11 tests), built
directly from Market Engine's own real response shapes rather than
idealized ones, so each of the three bugs above has a test that would
have caught it:
- `isAvailable()` accepts `'healthy'`, rejects `'degraded'`, and
  explicitly rejects the OLD `'ok'` value (guards against reverting).
- `getPrice()` hits the real flat query-param route with no chain
  segment, parses the real `{ prices: [...] }` envelope with
  `priceUsd`/`updatedAt`, and doesn't require a `.data` wrapper.
- Staleness is computed correctly from `updatedAt` age.
- `getPrices()` issues exactly one HTTP call for multiple symbols
  (batching) and maps a single price to every chain variant requested.
- Network failures and "unavailable" both degrade to `null`/empty map,
  never throw.

## Verified locally (all actually run)
- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — **55/55 passing** (44 pre-existing + 11 new).
- `node scripts/validate-openapi.mjs` — 20/20 route files matched
  (unrelated to this fix — this engine's contract already had zero
  drift; unaffected by this change since no routes were added/removed).
- `npm run build` (real production `next build`) — compiles, all 20
  routes register correctly.

## Production readiness
This closes the last known cross-engine contract-drift bug from the
migration. Portfolio Engine can now actually price holdings via Market
Engine. Recommend, as a fast follow (not done here): surfacing a
visible signal (log line or metric) when `isAvailable()` is false for
an extended period, since the previous silent `$0`-valuation failure
mode is exactly the kind of drift that went unnoticed for this long —
a monitoring gap, not a code bug.

## This closes out the contract-first migration
All engines in the priority list (Gateway, Identity, Portfolio, Wallet
Vault, Payment, Transfer, Notification, Market, Audit) plus this
dedicated cross-engine integration fix are now complete. See the
platform-wide final migration report for the full picture.
