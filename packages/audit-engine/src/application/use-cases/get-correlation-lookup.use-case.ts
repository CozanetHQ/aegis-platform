import type { AuditEventRepository } from '../ports/audit-event-repository.port';
import type { AuditEvent } from '../../domain/entities/audit-event.entity';

export class GetCorrelationLookupUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(correlationId: string): Promise<{ events: AuditEvent[]; journey: Array<Record<string, unknown>> }> {
    const events = await this.repo.getByCorrelationId(correlationId);

    // Reconstruct the journey — chronological order with engine transitions
    const journey = events.map((e, i) => ({
      step:      i + 1,
      timestamp: e.timestamp,
      engine:    e.engine,
      eventName: e.eventName,
      outcome:   e.outcome,
      severity:  e.severity,
    }));

    return { events, journey };
  }
}
