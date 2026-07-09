# @cozanethq/aegis-notification-engine

Single source of truth for all outbound notifications across the Aegis
ecosystem — email, in-app, push, SMS, webhook. Other engines only publish
events; this engine decides whether/how/when/where to notify.

## Architecture

Clean Architecture, same shape as the other engines:

- `src/domain` — `Notification`, `NotificationPreference` entities, enums
  (Channel, Priority, Status, Category, EventType). No I/O.
- `src/application` — use-cases (`ProcessEvent`, `DeliverNotification`,
  `ListNotifications`, mark-read, preferences) + ports (repository/provider
  interfaces) + the event→copy template resolver.
- `src/infrastructure` — Supabase-backed repositories, the Resend email
  provider, and the payload-based address resolver.
- `src/app/api/v1` — Next.js route handlers. Thin: parse, call a use-case,
  respond. Auth via `@cozanethq/aegis-shared-sdk` (`requireAuth` for
  user-facing routes, `requireEngineApiKey` for the event-ingest route).
- `src/engine.ts` — composition root. Route handlers only ever import
  `NotificationEngine()` from here.

## API

- `POST /api/v1/notifications` — event ingest, service-to-service only.
  Header: `X-Engine-API-Key` (bilateral secret per calling engine, same
  pattern as Wallet Vault / Transfer). Body: `{ eventId, eventType,
  recipientAegisId, payload, scheduledFor? }`.
- `GET /api/v1/notifications` — list the caller's own notifications
  (Supabase session). Query: `limit`, `cursor`, `unread_only`.
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`
- `GET /api/v1/preferences/me`
- `PUT /api/v1/preferences/me` — body: partial `{ [category]: { [channel]: boolean } }`
- `GET /api/v1/health`

## Environment

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NOTIFICATION_ENGINE_API_KEY=      # secret other engines send as X-Engine-API-Key
RESEND_API_KEY=                   # same Resend account already wired into Supabase's Auth SMTP
NOTIFICATION_FROM_EMAIL=          # e.g. "AEGIS <notifications@aegis.build>"
```

Own Supabase project (own DB, own migrations under `src/lib/migrations`) —
run `001_notification_engine.sql` against it before first deploy.

## Known gaps (flagged deliberately, not hidden)

- **Address resolution is payload-only.** EMAIL delivery only works when the
  triggering event's payload already includes `email` — e.g. Identity
  Engine's outbox event for `IDENTITY_ACTIVATED` carries `payload.email`
  today. There's no cross-engine "look up this aegisId's email" endpoint yet
  to fall back to for events that don't carry it. Needs an internal Identity
  Engine contact-lookup route, service-authenticated the same way Transfer
  Engine's `identity-engine.client.ts` already calls Identity Engine.
- **Templates are hardcoded in code** (`src/application/template-resolver.ts`),
  not the DB-backed, admin-editable `NotificationTemplate` entity the full
  spec calls for. Swapping this file for a DB lookup later won't change any
  use-case signature.
- **PUSH / SMS / WEBHOOK have no provider yet.** The `ChannelProvider`
  interface and domain enums recognize them; `IMPLEMENTED_CHANNELS` in
  `notification-enums.ts` only lists `IN_APP` and `EMAIL`. Attempts on other
  channels fail honestly (`PROVIDER_NOT_CONFIGURED`), never silently.
- **Retry is a simple counter, not real exponential backoff.** Up to 5
  re-attempts (see `Notification.recordFailure`), then terminal `FAILED`.
  No dedicated DLQ table, no attempt-history log — `retry_count` /
  `last_error` capture only the latest attempt. A worker/cron needs to be
  wired to call `findDeliverable()` + `DeliverNotificationUseCase` on a
  schedule to actually retry queued notifications (nothing does that yet —
  today, delivery is attempted once, synchronously, right after ingest).
- **No dedup on duplicate event ingestion.** If the same `eventId` is POSTed
  twice, it fans out twice. No unique constraint enforces this yet (removed
  one candidate index because it would've made the outbox processor's retry
  logic hard-fail instead of no-op — needs a real `ON CONFLICT DO NOTHING`
  strategy, not just a naive unique index).
- **No broadcast/campaign support**, no delivery-attempt history table, no
  admin API — all in the original spec, out of scope for this first pass.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```
