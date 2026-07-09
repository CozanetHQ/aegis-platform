import type { InvestigationRepository } from '../ports/investigation-repository.port';
import type { AuditInvestigation } from '../../domain/entities/audit-investigation.entity';

export class ListInvestigationsUseCase {
  constructor(private readonly repo: InvestigationRepository) {}

  async execute(limit: number, offset: number): Promise<{ investigations: AuditInvestigation[]; total: number }> {
    return this.repo.list(Math.min(limit, 100), offset);
  }
}
