import type { AuditExport, CreateExportInput } from '../entities/audit-export.entity';

export interface ExportRepository {
  create(input: CreateExportInput): Promise<AuditExport>;
  getById(id: string): Promise<AuditExport | null>;
  list(limit: number, offset: number): Promise<{ exports: AuditExport[]; total: number }>;
  update(exp: AuditExport): Promise<AuditExport>;
}
