// ── GetTimelineUseCase ───────────────────────────────────────────────
//
// Constructs a chronological timeline of events for a user, correlation,
// wallet, or session. Events are sorted by timestamp ascending so the
// caller can reconstruct the complete journey.

import type { AuditEventRepository, AuditEventQuery } from '../ports/audit-event-repository.port';
import type { AuditEvent } from '../../domain/entities/audit-event.entity';

export interface TimelineEntry {
  timestamp:    string;
  engine:       string;
  category:     string;
  eventName:    string;
  severity:     string;
  outcome:      string;
  correlationId:string;
  userId:       string | null;
  walletId:     string | null;
  metadata:     Record<string, unknown>;
}

export class GetTimelineUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(pivot: {
    userId?:        string;
    correlationId?: string;
    walletId?:      string;
    walletAddress?: string;
    sessionId?:     string;
    limit?:         number;
  }): Promise<{ entries: TimelineEntry[]; total: number }> {

    const query: AuditEventQuery = {
      limit:  Math.min(pivot.limit ?? 100, 500),
      offset: 0,
      orderBy: 'timestamp',
      orderDir: 'asc',
    };

    if (pivot.userId)        query.userId = pivot.userId;
    if (pivot.correlationId) query.correlationId = pivot.correlationId;
    if (pivot.walletId)      query.walletId = pivot.walletId;
    if (pivot.walletAddress) query.walletAddress = pivot.walletAddress;
    if (pivot.sessionId)     query.sessionId = pivot.sessionId;

    const { events, total } = await this.repo.search(query);

    const entries: TimelineEntry[] = events.map(e => ({
      timestamp:    e.timestamp,
      engine:       e.engine,
      category:     e.category,
      eventName:    e.eventName,
      severity:     e.severity,
      outcome:      e.outcome,
      correlationId:e.correlationId,
      userId:       e.userId,
      walletId:     e.walletId,
      metadata:     e.metadata,
    }));

    return { entries, total };
  }
}
