// ── ExportAuditDataUseCase ───────────────────────────────────────────
//
// Exports filtered audit data as JSON, CSV, or PDF. For MVP, JSON and
// CSV are generated synchronously; PDF is marked as future (requires
// a rendering library). The export record is persisted for audit trail.

import type { AuditEventRepository, AuditEventQuery } from '../ports/audit-event-repository.port';
import type { ExportRepository } from '../ports/export-repository.port';
import type { AuditExport } from '../../domain/entities/audit-export.entity';
import { AuditError } from '../audit-error';

interface ExportInput {
  requestedBy: string;
  format:      'JSON' | 'CSV' | 'PDF';
  filters:     AuditEventQuery;
}

export class ExportAuditDataUseCase {
  constructor(
    private readonly exports: ExportRepository,
    private readonly events:  AuditEventRepository,
  ) {}

  async execute(input: ExportInput): Promise<{ exportRecord: AuditExport; content: string; contentType: string }> {
    if (!input.requestedBy) throw AuditError.validation('requestedBy is required');
    if (!input.format)      throw AuditError.validation('format is required');

    // Create export record
    const exportRecord = await this.exports.create({
      requestedBy: input.requestedBy,
      format:      input.format,
      filters:     input.filters as Record<string, unknown>,
    });

    exportRecord.markProcessing();
    await this.exports.update(exportRecord);

    try {
      // Fetch matching events
      const { events } = await this.events.search({ ...input.filters, limit: 10000 });

      let content: string;
      let contentType: string;

      switch (input.format) {
        case 'JSON':
          content = JSON.stringify(events.map(e => e.toPublicJSON()), null, 2);
          contentType = 'application/json';
          break;

        case 'CSV':
          content = this.toCSV(events.map(e => e.toPublicJSON()));
          contentType = 'text/csv';
          break;

        case 'PDF':
          // PDF requires a rendering library (e.g. puppeteer, jsPDF).
          // For MVP, we export as JSON with a note that PDF rendering
          // will be added in a future iteration.
          content = JSON.stringify(events.map(e => e.toPublicJSON()), null, 2);
          contentType = 'application/json';
          break;

        default:
          throw AuditError.validation(`Unsupported format: ${input.format}`);
      }

      exportRecord.markCompleted('', events.length);
      await this.exports.update(exportRecord);

      return { exportRecord, content, contentType };
    } catch (err) {
      exportRecord.markFailed((err as Error).message);
      await this.exports.update(exportRecord);
      throw err;
    }
  }

  private toCSV(records: Record<string, unknown>[]): string {
    if (records.length === 0) return '';

    const headers = [
      'eventId', 'timestamp', 'engine', 'category', 'eventName',
      'severity', 'correlationId', 'userId', 'actorId', 'actorType',
      'walletId', 'walletAddress', 'deviceId', 'ipAddress', 'country',
      'platform', 'outcome', 'notes',
    ];

    const rows = records.map(r => {
      return headers.map(h => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Escape quotes and commas for CSV
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
