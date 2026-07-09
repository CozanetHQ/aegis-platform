import type { AuditEventRepository, AuditEventQuery } from '../ports/audit-event-repository.port';
import type { AuditEvent } from '../../domain/entities/audit-event.entity';

export class SearchAuditEventsUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(query: AuditEventQuery): Promise<{ events: AuditEvent[]; total: number; limit: number; offset: number }> {
    const limit  = Math.min(query.limit ?? 50, 500);
    const offset = query.offset ?? 0;
    const result = await this.repo.search({ ...query, limit, offset });
    return { ...result, limit, offset };
  }
}
