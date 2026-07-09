import type { ExportRepository } from '../ports/export-repository.port';
import type { AuditExport } from '../../domain/entities/audit-export.entity';

export class ListExportsUseCase {
  constructor(private readonly repo: ExportRepository) {}

  async execute(limit: number, offset: number): Promise<{ exports: AuditExport[]; total: number }> {
    return this.repo.list(Math.min(limit, 100), offset);
  }
}
