export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health — liveness + DB connectivity check.
 * No auth required — used by uptime monitors / load balancers / Gateway.
 *
 * Previously returned a static { status: 'ok' } with no DB check at all —
 * the only engine of five that didn't verify connectivity, so the Gateway
 * could never detect a DB outage here. Brought in line with the
 * Identity/Wallet-Vault/Transfer/Payment pattern.
 */
import { createServiceClient } from "@cozanethq/aegis-shared-sdk";

export async function GET() {
  const startedAt = Date.now();
  let dbOk = false;
  let dbError: string | undefined;

  try {
    const db = createServiceClient();
    const { error } = await db.from("notifications").select("id", { head: true, count: "exact" }).limit(1);
    dbOk = !error;
    if (error) dbError = error.message;
  } catch (e) {
    dbError = e instanceof Error ? e.message : "unknown error";
  }

  const healthy = dbOk;
  return Response.json(
    {
      status: healthy ? "healthy" : "degraded",
      engine: "notification-engine",
      checks: { database: { ok: dbOk, ...(dbError ? { error: dbError } : {}) } },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
