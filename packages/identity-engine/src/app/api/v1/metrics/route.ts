export const dynamic = "force-dynamic";

/**
 * GET /api/v1/metrics — Prometheus-format operational metrics (Rule 4).
 * No auth required (standard for metrics scrape endpoints — put behind
 * network-level access control at the infra layer, not app auth).
 */
import { createServiceClient } from "@cozanethq/aegis-shared-sdk";

export async function GET() {
  const db = createServiceClient();
  const lines: string[] = [];

  lines.push("# HELP identity_engine_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE identity_engine_uptime_seconds gauge");
  lines.push(`identity_engine_uptime_seconds ${process.uptime()}`);

  try {
    const { data, error } = await db.from("identities").select("state");
    if (!error && data) {
      const counts: Record<string, number> = {};
      for (const row of data as { state: string }[]) {
        counts[row.state] = (counts[row.state] ?? 0) + 1;
      }
      lines.push("# HELP identity_identities_total Total identities by state");
      lines.push("# TYPE identity_identities_total gauge");
      for (const [state, count] of Object.entries(counts)) {
        lines.push(`identity_identities_total{state="${state}"} ${count}`);
      }
    }
  } catch {
    lines.push("# identity_identities_total unavailable (database error)");
  }

  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
