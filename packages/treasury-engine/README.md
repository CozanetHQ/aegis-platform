# aegis-treasury-engine

AEGIS Treasury Engine — treasury wallets, fee calculation/collection, gas
sponsorship, treasury ledger. Owns all treasury business logic.

## Status (2026-07-08)

**Phase 1 minimal implementation** — real logic, not placeholders, for:
- `POST /api/v1/treasury/calculate-fee` — bps-based fee calculation
- `POST /api/v1/treasury/sponsor-gas` — checks a user wallet's native BNB
  balance and sends a top-up from the treasury hot wallet if below threshold,
  enforcing a rolling 24h per-identity cap
- `POST /api/v1/treasury/record-transaction` — ledger entry for a confirmed swap's fee
- `GET /api/v1/treasury/ledger` — read ledger entries

See `../aegis-architecture/PRODUCTION_BLOCKERS.md` for what is **not** yet
safe about this for real mainnet funds (in-memory storage, no rate-limit
beyond the basic daily cap, no KMS/HSM, no security audit, not deployed).

## Network configuration

`BSC_CHAIN_ID` + `BSC_RPC_URLS` select the network — default is mainnet
(56) per the Phase 1 target, but set `BSC_CHAIN_ID=97` and testnet RPC URLs
to run against BSC Testnet with zero code changes.

## Tests

`npm test` runs domain + use-case tests against fakes (no network, no real
keys needed). See `../aegis-swap-engine/docs/TESTNET_SMOKE_TEST.md` for the
real on-chain smoke test covering the signing/broadcast/confirm leg.
