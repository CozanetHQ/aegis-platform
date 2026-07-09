# AEGIS Portfolio Engine

The financial read model of the AEGIS ecosystem. Answers one question: **"What is the user's current financial position?"**

## Overview

The Portfolio Engine does NOT hold funds, sign transactions, broadcast transactions, execute payments, or calculate payment fees. It is a read-only aggregation layer that consumes data from other engines and presents a unified financial view.

## Architecture

Clean Architecture (DDD) — Domain, Application, Infrastructure, Interface layers.

## Data Sources

- Wallet Vault Engine — wallet addresses and balances
- Transfer Engine — transaction history and pending transfers
- Payment Engine — payment previews and impact
- Market Engine — token prices (never fetches prices itself)
- Rewards Engine — reward balances (future)
- Business Engine — business balances (future)

## Endpoints

All endpoints at `/api/v1/`:
- `GET /health` — Health check
- `GET /version` — Version info
- `GET /metrics` — Engine metrics
- `GET /openapi.json` — OpenAPI spec
- `GET /summary` — Portfolio dashboard summary
- `GET /history?range=24h` — Portfolio history for charting
- `GET /wallets/{walletId}` — Single wallet summary
- `GET /allocation/assets` — Asset allocation
- `GET /allocation/chains` — Chain allocation
- `GET /allocation/wallets` — Wallet allocation
- `GET /performance?range=24h` — Performance metrics
- `GET /available-balance?walletId=...` — Available balance
- `POST /transfer-preview` — Preview transfer impact
- `POST /payment-preview` — Preview payment impact
- `POST /snapshot` — Create portfolio snapshot
- `GET /admin/*` — Admin endpoints (API key required)

## Build & Test

```bash
npm install
npm run typecheck
npm test
npm run build
```
