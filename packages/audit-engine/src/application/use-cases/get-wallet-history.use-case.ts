import type { AuditEventRepository } from '../ports/audit-event-repository.port';
import type { AuditEvent } from '../../domain/entities/audit-event.entity';

export class GetWalletHistoryUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(walletId: string, limit: number, offset: number): Promise<{ events: AuditEvent[]; total: number }> {
    return this.repo.getByWalletId(walletId, Math.min(limit, 500), offset);
  }
}
