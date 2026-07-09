# Aegis Audit Engine

**The permanent memory of the AEGIS ecosystem.**

Every important action performed by every engine is recorded here. The Audit Engine is the single source of truth for platform history — who did what, when, why, and from where.

## Architecture

Clean Architecture (DDD) with strict layer separation:

```
src/
  domain/           # Entities, value objects, enums, repository ports
  application/      # Use cases, ports, error handling
  infrastructure/   # Supabase repository implementations
  interface/        # API route validators
  app/api/v1/       # Next.js API routes (HTTP interface)
  engine.ts         # Composition root — wires everything together
  lib/migrations/   # SQL migrations
```

## Key Design Decisions

- **Immutability**: `audit_events` is append-only. DB-level triggers prevent UPDATE and DELETE. Corrections are new events with a `correctionFor` reference.
- **Correlation IDs**: Every engine preserves the same correlation ID across a transaction's lifecycle. Searching one ID reconstructs the complete journey.
- **Search**: 20+ filter dimensions (user, wallet, engine, category, severity, outcome, IP, country, device, session, date range, etc.)
- **Investigation Mode**: Admin-only feature that auto-gathers events by pivot point (user, wallet, correlation, device, email, phone) and detects anomalies.
- **Export**: JSON, CSV, and PDF (PDF delegates to JSON for MVP) with persisted export records.

## Event Sources

Receives audit events from all AEGIS engines:

Identity · Wallet Vault · Transfer · Payment · Notification · Portfolio · Market · Rewards · Business · Gateway · AI · Admin Console · Future Engines

## Event Categories

Authentication · Security · Wallet · Transfer · Payment · Notification · AI · Business · Portfolio · Rewards · Settings · Administration · Compliance · System · Provider · API · Database · Infrastructure

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/events` | API Key | Create audit event (engine-to-engine) |
| GET | `/api/v1/events` | Bearer JWT | Search audit events with filters |
| GET | `/api/v1/events/:id` | Bearer JWT | Get single event |
| GET | `/api/v1/timeline` | Bearer JWT | Chronological timeline |
| POST | `/api/v1/investigations` | Bearer JWT | Start investigation (admin) |
| GET | `/api/v1/investigations` | Bearer JWT | List investigations |
| GET | `/api/v1/investigations/:id` | Bearer JWT | Get investigation with events |
| POST | `/api/v1/exports` | Bearer JWT | Export audit data |
| GET | `/api/v1/exports` | Bearer JWT | List exports |
| GET | `/api/v1/statistics` | Bearer JWT | Platform statistics |
| GET | `/api/v1/statistics/engines` | Bearer JWT | Engine activity breakdown |
| GET | `/api/v1/recent` | Bearer JWT | Recent events (live feed) |
| GET | `/api/v1/history/users/:userId` | Bearer JWT | User history |
| GET | `/api/v1/history/wallets/:walletId` | Bearer JWT | Wallet history |
| GET | `/api/v1/history/correlations/:correlationId` | Bearer JWT | Correlation lookup (journey reconstruction) |
| GET | `/api/v1/history/admins/:adminId` | Bearer JWT | Admin action history |
| GET | `/api/v1/health` | None | Liveness + DB check |
| GET | `/api/v1/version` | None | Build info |
| GET | `/api/v1/metrics` | None | Prometheus metrics |
| GET | `/api/v1/openapi.json` | None | OpenAPI spec |

## Database Tables

- `audit_events` — Core append-only event records (immutable)
- `audit_investigations` — Admin investigation records
- `audit_exports` — Export job records
- `audit_devices` — Aggregated device info
- `audit_sessions` — Aggregated session info
- `audit_metadata` — Count cache for fast statistics
- `search_indexes` — Full-text search tokens

## Development

```bash
npm install
npm test          # 56 tests
npm run typecheck # Zero type errors
npm run dev       # Local development
```

## Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUDIT_ENGINE_API_KEY=     # For engine-to-engine POST /events auth
```

## License

Proprietary — © CozanetHQ
