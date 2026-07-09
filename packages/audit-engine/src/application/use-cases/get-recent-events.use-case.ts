import type { AuditEventRepository } from '../ports/audit-event-repository.port';
import type { AuditEvent } from '../../domain/entities/audit-event.entity';

export class GetRecentEventsUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(limit: number): Promise<AuditEvent[]> {
    return this.repo.getRecent(Math.min(limit, 200));
  }
}
