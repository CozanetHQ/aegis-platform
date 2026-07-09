import type { AuditEventRepository } from '../ports/audit-event-repository.port';

export class GetEngineActivityUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(): Promise<Record<string, number>> {
    return this.repo.countByEngine();
  }
}
