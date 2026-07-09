export const dynamic = "force-dynamic";

/**
 * GET /api/v1/metrics — Prometheus-format operational metrics (Rule 4).
 * No auth required (standard for metrics scrape endpoints).
 */
import { createServiceClient } from "@cozanethq/aegis-shared-sdk";

export async function GET() {
  const db = createServiceClient();
  const lines: string[] = [];

  lines.push("# HELP notification_engine_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE notification_engine_uptime_seconds gauge");
  lines.push(`notification_engine_uptime_seconds ${process.uptime()}`);

  try {
    const { data, error } = await db.from("notifications").select("status,channel");
    if (!error && data) {
      const byStatus: Record<string, number> = {};
      const byChannel: Record<string, number> = {};
      for (const row of data as { status: string; channel: string }[]) {
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
        byChannel[row.channel] = (byChannel[row.channel] ?? 0) + 1;
      }
      lines.push("# HELP notification_notifications_total Total notifications by status");
      lines.push("# TYPE notification_notifications_total gauge");
      for (const [status, count] of Object.entries(byStatus)) {
        lines.push(`notification_notifications_total{status="${status}"} ${count}`);
      }
      lines.push("# HELP notification_notifications_by_channel_total Total notifications by channel");
      lines.push("# TYPE notification_notifications_by_channel_total gauge");
      for (const [channel, count] of Object.entries(byChannel)) {
        lines.push(`notification_notifications_by_channel_total{channel="${channel}"} ${count}`);
      }
    }
  } catch {
    lines.push("# notification_notifications_total unavailable (database error)");
  }

  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
