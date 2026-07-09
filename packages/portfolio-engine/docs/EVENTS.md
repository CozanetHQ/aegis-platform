# Events

## Consumed Events

The Portfolio Engine listens for events from source engines to trigger cache invalidation and snapshot creation.

| Source Engine | Event | Action |
|--------------|-------|--------|
| Wallet Vault | `wallet.updated` | Invalidate wallet cache |
| Transfer Engine | `transfer.completed` | Invalidate balance + summary cache |
| Payment Engine | `payment.completed` | Invalidate balance + summary cache |
| Rewards Engine | `reward.received` | Invalidate balance cache |
| Market Engine | `market.prices.updated` | Invalidate all portfolio caches |
| Business Engine | `business.balance.updated` | Invalidate summary cache |

## Published Events

When the portfolio changes, the Portfolio Engine publishes events for other engines to consume.

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `portfolio.updated` | Summary recalculated | AI Engine, Notification Engine |
| `snapshot.created` | New snapshot saved | Audit Engine |
| `performance.updated` | Performance recalculated | AI Engine |
| `allocation.changed` | Allocation shifts detected | Notification Engine |

## Integration Pattern

Events flow through the AEGIS event outbox pattern:
1. Source engine completes an operation
2. Source engine writes to its event outbox
3. The Portfolio Engine receives the event (via webhook or polling)
4. Portfolio Engine invalidates relevant cache entries
5. Next API request triggers a fresh aggregation from source engines
6. Portfolio Engine publishes its own events

## Cache Invalidation Flow

```
Transfer Completed → InvalidateCacheUseCase
  → invalidatePattern("portfolio:{userId}:*")
  → Next request fetches fresh data from source engines
  → New summary cached
  → portfolio.updated event published
```
