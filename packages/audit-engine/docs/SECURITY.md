# Audit Engine — Security

## Immutability

Audit records are immutable at three levels:

1. **Domain Level**: `AuditEvent` entity has no mutating methods. All fields are `readonly` in the constructor.
2. **Application Level**: No update or delete use case exists. Corrections are new events with a `correctionFor` reference.
3. **Database Level**: `BEFORE UPDATE` and `BEFORE DELETE` triggers raise exceptions. `REVOKE UPDATE, DELETE` from `anon` and `authenticated` roles.

## Authentication

### Engine-to-Engine
POST `/api/v1/events` requires `X-Audit-API-Key` header matching the `AUDIT_ENGINE_API_KEY` environment variable. This prevents unauthorized event injection.

### User/Admin Queries
All GET endpoints require `Authorization: Bearer <JWT>` header. JWT validation is handled by the API gateway or Supabase Auth.

## What Must Be Audited

Per the specification, every administrative action must be recorded:
- Admin login/logout
- Permission changes
- Role assignments
- API key rotations
- Provider configuration changes
- Treasury wallet changes
- Engine deployments
- Feature flag changes
- User suspensions/reactivations

## IP & Device Tracking

The Audit Engine automatically captures:
- IP address from `X-Forwarded-For` header
- Country from `X-Vercel-IP-Country` header
- Platform from `X-Aegis-Platform` header

These can also be explicitly provided in the event payload.

## Data Retention

Audit events are permanent. There is no TTL, no archival, and no deletion path. This is by design — the Audit Engine is the permanent memory of AEGIS.
