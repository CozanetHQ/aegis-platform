# Audit Engine — Architecture

## Overview

The Audit Engine follows the AEGIS Constitution's Clean Architecture (DDD) pattern. Every layer depends only on the layer beneath it — never sideways, never upward.

## Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Interface Layer                       │
│  Next.js API Routes (app/api/v1/*)                       │
│  Validates input → calls use cases → returns JSON        │
└──────────────────────┬──────────────────────────────────┘
                       │ depends on
┌──────────────────────▼──────────────────────────────────┐
│                   Application Layer                      │
│  Use Cases (create, search, timeline, investigate, ...)  │
│  Contains business logic — no DB or HTTP details         │
└──────────────────────┬──────────────────────────────────┘
                       │ depends on
┌──────────────────────▼──────────────────────────────────┐
│                    Domain Layer                          │
│  Entities, Value Objects, Enums, Repository Ports        │
│ Pure business rules — no external dependencies           │
└──────────────────────┬──────────────────────────────────┘
                       │ implemented by
┌──────────────────────▼──────────────────────────────────┐
│                 Infrastructure Layer                     │
│  Supabase Repositories (concrete implementations)        │
│  Maps domain entities ↔ database rows                    │
└─────────────────────────────────────────────────────────┘
```

## Composition Root

`src/engine.ts` is the single wiring point. It:
1. Creates a shared Supabase client
2. Instantiates repository implementations
3. Constructs use cases with their repository dependencies
4. Memoizes the entire graph per Lambda instance

Route handlers call `AuditEngine()` to get the pre-wired use cases.

## Immutability Enforcement

Immutability is enforced at THREE levels:

1. **Domain**: `AuditEvent` has no mutating methods. All fields are `readonly`.
2. **Application**: No update/delete use case exists. Corrections are new events.
3. **Database**: `BEFORE UPDATE` and `BEFORE DELETE` triggers on `audit_events` raise exceptions. `REVOKE UPDATE, DELETE` on all roles.

## Correlation ID Flow

```
User initiates transfer
  → Transfer Engine creates event (corr_abc)
    → Payment Engine calculates fee (corr_abc)
      → Wallet Vault signs (corr_abc)
        → Notification sends (corr_abc)
          → Audit Engine stores all (corr_abc)

Search corr_abc → Complete journey reconstructed chronologically
```

## Investigation Pipeline

1. Admin provides pivot point (user ID, wallet address, correlation ID, device ID, email, phone)
2. Use case queries all matching events across engines
3. Anomaly detection runs:
   - Multiple IP addresses (>3 distinct)
   - Failure bursts (>5 failed events)
   - Critical severity events
   - Cross-engine activity (>3 engines involved)
4. Investigation record persisted with event IDs + anomalies
5. Admin can view complete investigation with all event details

## Search Architecture

The search system supports 20+ filter dimensions:
- Identity: userId, actorId, actorType
- Wallet: walletId, walletAddress
- Network: ipAddress, country, deviceId, platform, sessionId
- Classification: engine, category, eventName, severity, outcome
- Temporal: startDate, endDate
- Relational: correlationId
- Pagination: limit (max 500), offset
- Sorting: orderBy + orderDir

All filters map to indexed columns in `audit_events`. A GIN index on `metadata` enables JSONB containment searches.
