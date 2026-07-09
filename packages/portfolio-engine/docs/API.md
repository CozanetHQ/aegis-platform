# API Reference

## Standard Endpoints

### GET /api/v1/health
Returns engine health status and cache statistics.

### GET /api/v1/version
Returns service name, version, and build info.

### GET /api/v1/metrics
Returns cache hit rate, miss rate, size, and recent invalidations.

### GET /api/v1/openapi.json
Returns OpenAPI 3.0.3 specification.

## Business Endpoints

### GET /api/v1/summary
**Headers**: `X-User-Id` (required)
Returns complete dashboard summary: portfolio value, assets, wallets, chains, top holdings, recent transactions, allocations, performance, net worth.

### GET /api/v1/history?range=24h
**Headers**: `X-User-Id` (required)
**Query**: `range` — one of: `1h`, `24h`, `7d`, `30d`, `90d`, `1y`, `all`
Returns historical portfolio data points for charting.

### GET /api/v1/wallets/{walletId}
**Headers**: `X-User-Id` (required)
Returns single wallet summary with holdings, fiat value, and health.

### GET /api/v1/allocation/assets
**Headers**: `X-User-Id` (required)
Returns allocation breakdown by token/asset.

### GET /api/v1/allocation/chains
**Headers**: `X-User-Id` (required)
Returns allocation breakdown by blockchain.

### GET /api/v1/allocation/wallets
**Headers**: `X-User-Id` (required)
Returns all wallet summaries with portfolio percentages.

### GET /api/v1/performance?range=24h
**Headers**: `X-User-Id` (required)
Returns P/L and change metrics for the specified time range.

### GET /api/v1/available-balance?walletId=...
**Headers**: `X-User-Id` (required)
Returns available, pending, locked, reserved, and total balances.

### POST /api/v1/transfer-preview
**Body**: `{ walletId, amount, token, chain }`
Returns balance impact preview for a potential transfer.

### POST /api/v1/payment-preview
**Headers**: `X-User-Id` (required)
**Body**: `{ amount, fee, discount }`
Returns affordability check and balance impact for a potential payment.

### POST /api/v1/snapshot
**Headers**: `X-User-Id` (required)
**Body**: `{ totalValue, availableValue, pendingValue, lockedValue, reservedValue, walletCount, chainCount, topHoldings, netWorth }`
Creates an immutable portfolio snapshot.

## Admin Endpoints

All admin endpoints require `X-Portfolio-API-Key` header.

### GET /api/v1/admin/statistics
System-wide portfolio statistics.

### GET /api/v1/admin/top-assets
Top assets across all users.

### GET /api/v1/admin/top-chains
Top chains by total value.

### GET /api/v1/admin/cache-status
Cache size, hit/miss rates, recent invalidations.

### GET /api/v1/admin/snapshot-status
Snapshot job status and interval info.
