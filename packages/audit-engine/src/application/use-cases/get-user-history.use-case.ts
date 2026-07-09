import type { AuditEventRepository } from '../ports/audit-event-repository.port';
import type { AuditEvent } from '../../domain/entities/audit-event.entity';

export class GetUserHistoryUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(userId: string, limit: number, offset: number): Promise<{ events: AuditEvent[]; total: number }> {
    return this.repo.getByUserId(userId, Math.min(limit, 500), offset);
  }
}
