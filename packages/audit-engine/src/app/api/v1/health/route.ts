export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { AuditEngine } = await import("@/engine");
    const engine = AuditEngine();
    const start = Date.now();

    // Check DB connectivity
    const { error } = await engine.db.from('audit_events').select('event_id').limit(1).maybeSingle();
    const dbOk = !error;

    return Response.json({
      status: dbOk ? "healthy" : "degraded",
      engine: "audit-engine",
      checks: { database: { ok: dbOk, error: error?.message ?? null } },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({
      status: "unhealthy",
      engine: "audit-engine",
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
