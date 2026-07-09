export const dynamic = "force-dynamic";

export async function GET() {
  const lines: string[] = [];

  lines.push("# HELP audit_engine_uptime_seconds Process uptime in seconds");
  lines.push("# TYPE audit_engine_uptime_seconds gauge");
  lines.push(`audit_engine_uptime_seconds ${process.uptime()}`);

  try {
    const { AuditEngine } = await import("@/engine");
    const engine = AuditEngine();

    const total = await engine.eventRepo.count();
    const last24h = await engine.eventRepo.countLast24h();
    const byEngine = await engine.eventRepo.countByEngine();
    const bySeverity = await engine.eventRepo.countBySeverity();
    const byOutcome = await engine.eventRepo.countByOutcome();

    lines.push("# HELP audit_events_total Total audit events stored");
    lines.push("# TYPE audit_events_total gauge");
    lines.push(`audit_events_total ${total}`);

    lines.push("# HELP audit_events_last_24h Events in the last 24 hours");
    lines.push("# TYPE audit_events_last_24h gauge");
    lines.push(`audit_events_last_24h ${last24h}`);

    lines.push("# HELP audit_events_by_engine Events grouped by source engine");
    lines.push("# TYPE audit_events_by_engine gauge");
    for (const [eng, count] of Object.entries(byEngine)) {
      lines.push(`audit_events_by_engine{engine="${eng}"} ${count}`);
    }

    lines.push("# HELP audit_events_by_severity Events grouped by severity");
    lines.push("# TYPE audit_events_by_severity gauge");
    for (const [sev, count] of Object.entries(bySeverity)) {
      lines.push(`audit_events_by_severity{severity="${sev}"} ${count}`);
    }

    lines.push("# HELP audit_events_by_outcome Events grouped by outcome");
    lines.push("# TYPE audit_events_by_outcome gauge");
    for (const [outcome, count] of Object.entries(byOutcome)) {
      lines.push(`audit_events_by_outcome{outcome="${outcome}"} ${count}`);
    }
  } catch (err) {
    lines.push("# Metrics collection error — engine may be starting up");
  }

  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
