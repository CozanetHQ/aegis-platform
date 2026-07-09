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

  lines.push("# HELP wallet_vault_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE wallet_vault_uptime_seconds gauge");
  lines.push(`wallet_vault_uptime_seconds ${process.uptime()}`);

  try {
    const { data, error } = await db.from("wallets").select("state");
    if (!error && data) {
      const counts: Record<string, number> = { ACTIVE: 0, FROZEN: 0, DEPRECATED: 0 };
      for (const row of data as { state: string }[]) {
        counts[row.state] = (counts[row.state] ?? 0) + 1;
      }
      lines.push("# HELP wallet_vault_wallets_total Total wallets by state");
      lines.push("# TYPE wallet_vault_wallets_total gauge");
      for (const [state, count] of Object.entries(counts)) {
        lines.push(`wallet_vault_wallets_total{state="${state}"} ${count}`);
      }
    }
  } catch {
    // metrics endpoint must never 500 the scrape — degrade gracefully
    lines.push("# wallet_vault_wallets_total unavailable (database error)");
  }

  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
