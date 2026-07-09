/**
 * POST /api/v1/notifications — ingest an event from another engine.
 * Service-to-service only, guarded by X-Engine-API-Key (bilateral secret,
 * one per calling engine — same pattern as Wallet Vault / Transfer engines).
 *
 * GET /api/v1/notifications — list the caller's own notifications.
 * User-facing, guarded by a real Supabase session (requireAuth).
 */
import { requireAuth, requireEngineApiKey, validateBody, ok, err } from '@cozanethq/aegis-shared-sdk';
import { NotificationEngine } from '@/engine';
import { EVENT_TYPES } from '@/domain/enums/notification-enums';
import { z } from 'zod';

const ingestSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(EVENT_TYPES as unknown as [string, ...string[]]),
  recipientAegisId: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  scheduledFor: z.string().datetime().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    requireEngineApiKey(request, 'x-engine-api-key', process.env.NOTIFICATION_ENGINE_API_KEY);
    const input = await validateBody(request, ingestSchema);

    const result = await NotificationEngine().processEvent.execute({
      eventId: input.eventId,
      eventType: input.eventType as (typeof EVENT_TYPES)[number],
      recipientAegisId: input.recipientAegisId,
      payload: input.payload,
      scheduledFor: input.scheduledFor ?? null,
    });

    return ok(result);
  } catch (e) {
    return err(e);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.aegisId) return err(new Error('No Aegis ID on this identity'));

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const cursor = url.searchParams.get('cursor');
    const unreadOnly = url.searchParams.get('unread_only') === 'true';

    const result = await NotificationEngine().listNotifications.execute({
      aegisId: auth.aegisId,
      unreadOnly,
      limit,
      cursor,
    });

    return ok({
      items: result.items.map((n) => n.toProps()),
      nextCursor: result.nextCursor,
    });
  } catch (e) {
    return err(e);
  }
}
