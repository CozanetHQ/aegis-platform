import type { AuditInvestigation, CreateInvestigationInput } from '../entities/audit-investigation.entity';

export interface InvestigationRepository {
  create(input: CreateInvestigationInput): Promise<AuditInvestigation>;
  getById(id: string): Promise<AuditInvestigation | null>;
  list(limit: number, offset: number): Promise<{ investigations: AuditInvestigation[]; total: number }>;
  update(inv: AuditInvestigation): Promise<AuditInvestigation>;
}
