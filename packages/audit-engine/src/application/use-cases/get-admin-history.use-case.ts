import type { AuditEventRepository } from '../ports/audit-event-repository.port';
import type { AuditEvent } from '../../domain/entities/audit-event.entity';

export class GetAdminHistoryUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(adminId: string, limit: number, offset: number): Promise<{ events: AuditEvent[]; total: number }> {
    return this.repo.getAdminHistory(adminId, Math.min(limit, 500), offset);
  }
}
