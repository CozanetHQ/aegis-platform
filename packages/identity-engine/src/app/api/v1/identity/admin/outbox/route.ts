/**
 * POST /api/v2/identity/admin/outbox
 *
 * Outbox processor — consumes pending identity_event_outbox rows.
 * Called by a Vercel Cron job (vercel.json) every minute.
 * Protected by CRON_SECRET (same secret used by existing cron jobs).
 *
 * Events dispatched:
 *   IDENTITY_ACTIVATED       → send welcome email
 *   IDENTITY_EMAIL_VERIFIED  → (no-op for now; reserved for onboarding nudge)
 *   IDENTITY_CLOSED          → send account-closure confirmation email
 *   IDENTITY_SELF_LOCKED     → send security alert email
 *   ADMIN_ACTION             → log to audit service (no email)
 *   PROFILE_UPDATED          → (no-op; reserved for sync hooks)
 *
 * Batch size: 50 events per invocation (safe for Vercel function timeout).
 * Retry: up to 5 attempts before the event is considered dead.
 */
export const dynamic = "force-dynamic";

import { createServiceClient } from "@cozanethq/aegis-shared-sdk";
import { ok, err }             from "@cozanethq/aegis-shared-sdk";

const BATCH_SIZE  = 50;
const MAX_RETRIES = 5;

export async function POST(request: Request) {
  // Validate cron secret
  const cronSecret = request.headers.get("x-cron-secret")
    ?? new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = createServiceClient();

    // Fetch a batch of unprocessed, non-dead events
    const { data: events, error } = await db
      .from("identity_event_outbox")
      .select("*")
      .is("processed_at", null)
      .lt("retry_count", MAX_RETRIES)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!events || events.length === 0) {
      return ok({ processed: 0, skipped: 0, failed: 0 });
    }

    let processed = 0;
    let failed    = 0;

    for (const event of events) {
      try {
        await dispatchEvent(event);
        // Mark processed
        await db
          .from("identity_event_outbox")
          .update({ processed_at: new Date().toISOString(), processed_by: "outbox-processor-v1" })
          .eq("id", event.id);
        processed++;
      } catch (dispatchErr: any) {
        // Increment retry count + record last error
        await db
          .from("identity_event_outbox")
          .update({
            retry_count: (event.retry_count ?? 0) + 1,
            last_error:  String(dispatchErr?.message ?? dispatchErr).slice(0, 500),
          })
          .eq("id", event.id);
        console.error("[OutboxProcessor] Dispatch failed", {
          eventId:   event.id,
          eventType: event.event_type,
          retries:   (event.retry_count ?? 0) + 1,
          error:     dispatchErr?.message,
        });
        failed++;
      }
    }

    return ok({ processed, failed, total: events.length });
  } catch (e) {
    return err(e);
  }
}

/**
 * Dispatch a single outbox event to the appropriate handler.
 * Add cases here as new engines are built.
 */
async function dispatchEvent(event: Record<string, any>): Promise<void> {
  const { event_type, payload, identity_id } = event;

  switch (event_type) {
    case "IDENTITY_ACTIVATED": {
      // TODO Phase 2: call Notification Engine → send welcome email
      // await NotificationEngine.sendWelcomeEmail(payload.aegisId, payload.email);
      console.log("[Outbox] IDENTITY_ACTIVATED — welcome email queued (placeholder)", {
        aegisId: payload?.aegisId,
      });
      break;
    }

    case "IDENTITY_EMAIL_VERIFIED": {
      // Placeholder: can trigger onboarding nudge email after N minutes
      console.log("[Outbox] IDENTITY_EMAIL_VERIFIED — no action yet", {
        aegisId: payload?.aegisId,
      });
      break;
    }

    case "IDENTITY_CLOSED": {
      // TODO Phase 2: send account-closure confirmation email
      console.log("[Outbox] IDENTITY_CLOSED — closure email queued (placeholder)", {
        aegisId: payload?.aegisId,
        reason:  payload?.reason,
      });
      break;
    }

    case "IDENTITY_SELF_LOCKED": {
      // Security alert email — HIGH priority
      // TODO Phase 2: call Notification Engine with priority flag
      console.log("[Outbox] IDENTITY_SELF_LOCKED — security alert email queued (placeholder)", {
        aegisId: payload?.aegisId,
      });
      break;
    }

    case "IDENTITY_SELF_UNLOCKED": {
      console.log("[Outbox] IDENTITY_SELF_UNLOCKED — logged", {
        aegisId: payload?.aegisId,
      });
      break;
    }

    case "ADMIN_ACTION": {
      // Append to external audit/compliance log (Datadog, Sentry, etc.)
      console.log("[Outbox] ADMIN_ACTION — audit logged", {
        aegisId:     payload?.aegisId,
        adminAuthId: payload?.adminAuthId,
        action:      payload?.action,
        reason:      payload?.reason,
      });
      break;
    }

    case "PROFILE_UPDATED": {
      // Placeholder: sync to search index / CRM
      break;
    }

    default:
      console.warn("[Outbox] Unknown event type — skipping", { event_type, identity_id });
  }
}
