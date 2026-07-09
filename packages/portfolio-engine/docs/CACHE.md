# Cache Strategy

## Overview

The Portfolio Engine uses intelligent caching to avoid redundant calls to source engines. Cache TTL is 30 seconds by default.

## Cache Keys

- `portfolio:{userId}:summary` — Dashboard summary
- `portfolio:{userId}:wallets` — All wallet summaries
- `portfolio:{userId}:wallet:{walletId}` — Single wallet
- `portfolio:{userId}:balance:{walletId|all}` — Balance data

## Invalidation Triggers

Cache is automatically invalidated when events are received from:

| Event Source | Reason |
|-------------|--------|
| Transfer Engine | `transfer_completed` |
| Payment Engine | `payment_completed` |
| Wallet Vault Engine | `wallet_updated` |
| Rewards Engine | `reward_received` |
| Market Engine | `market_prices_updated` |
| Manual | `manual` |

## Implementation

Currently uses `InMemoryCache` — a simple in-process cache with TTL and pattern-based invalidation.

For production, replace with Redis (same `CachePort` interface):
- Survives process restarts
- Shared across instances
- Built-in TTL support

## Observability

Cache metrics are exposed at `/api/v1/metrics`:
- Cache size (number of entries)
- Hit rate (0-1)
- Miss rate (0-1)
- Recent invalidations (last 20)

Admin cache status at `/api/v1/admin/cache-status` provides the same data with more detail.
