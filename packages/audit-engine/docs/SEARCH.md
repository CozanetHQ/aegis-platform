# Audit Engine — Search

## Overview

The Audit Engine supports filtering across 20+ dimensions. All search queries return paginated results with total counts.

## Search Endpoint

```
GET /api/v1/events?engine=TRANSFER&severity=HIGH&startDate=2026-07-01T00:00:00Z&limit=50&offset=0
```

## Filter Dimensions

### Identity Filters
- `userId` — AEGIS user ID
- `actorId` — Who triggered the event
- `actorType` — USER, ADMIN, SYSTEM, ENGINE, etc.

### Wallet Filters
- `walletId` — Internal wallet ID
- `walletAddress` — Blockchain address (0x...)

### Network Filters
- `ipAddress` — IP address
- `country` — Country code (NG, US, etc.)
- `deviceId` — Device identifier
- `platform` — WEB, IOS, ANDROID, API, ADMIN_CONSOLE
- `sessionId` — Session ID

### Classification Filters
- `engine` — Source engine (IDENTITY, TRANSFER, etc.)
- `category` — Event category (AUTHENTICATION, SECURITY, etc.)
- `eventName` — Specific event name
- `severity` — INFO, LOW, MEDIUM, HIGH, CRITICAL
- `outcome` — SUCCESS, FAILURE, PARTIAL, PENDING, BLOCKED

### Temporal Filters
- `startDate` — ISO 8601 timestamp (inclusive)
- `endDate` — ISO 8601 timestamp (inclusive)

### Relational Filters
- `correlationId` — Cross-engine trace ID

### Pagination & Sorting
- `limit` — Max 500, default 50
- `offset` — Default 0
- `orderBy` — Default: timestamp
- `orderDir` — asc or desc (default: desc)

## Database Indexing

All filter columns have dedicated B-tree indexes. The `metadata` column has a GIN index for JSONB searches. Composite indexes on `(user_id, timestamp DESC)` and `(wallet_id, timestamp DESC)` optimize the most common query patterns.
