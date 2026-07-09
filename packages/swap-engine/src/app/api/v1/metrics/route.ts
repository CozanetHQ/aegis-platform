export const dynamic = "force-dynamic";

/**
 * Phase 1 has no persistence (quoting is stateless), so there are no
 * counters to report yet. This will grow real numbers once swap/execute
 * lands and starts recording swap records.
 */
export async function GET() {
  return Response.json({
    service: "aegis-swap-engine",
    metrics: {
      note: "no persisted swap records yet — phase 1 is quoting-only",
    },
    timestamp: new Date().toISOString(),
  });
}
