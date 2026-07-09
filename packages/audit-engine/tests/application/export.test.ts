import { describe, it, expect, beforeEach } from 'vitest';
import { ExportAuditDataUseCase } from '../../src/application/use-cases/export-audit-data.use-case';
import { CreateAuditEventUseCase } from '../../src/application/use-cases/create-audit-event.use-case';
import { FakeAuditEventRepository, FakeExportRepository } from '../fakes';

describe('ExportAuditDataUseCase', () => {
  let eventRepo: FakeAuditEventRepository;
  let exportRepo: FakeExportRepository;
  let useCase: ExportAuditDataUseCase;
  let create: CreateAuditEventUseCase;

  beforeEach(async () => {
    eventRepo = new FakeAuditEventRepository();
    exportRepo = new FakeExportRepository();
    useCase = new ExportAuditDataUseCase(exportRepo, eventRepo);
    create = new CreateAuditEventUseCase(eventRepo);

    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'LOGIN', correlationId: 'c1', userId: 'u1' });
    await create.execute({ engine: 'TRANSFER', category: 'TRANSFER', eventName: 'TRANSFER_CREATED', correlationId: 'c2', userId: 'u2' });
  });

  it('should export as JSON', async () => {
    const result = await useCase.execute({
      requestedBy: 'admin_1',
      format: 'JSON',
      filters: {},
    });
    expect(result.exportRecord.status).toBe('COMPLETED');
    expect(result.exportRecord.totalEvents).toBe(2);
    expect(result.contentType).toBe('application/json');
    const parsed = JSON.parse(result.content);
    expect(parsed).toHaveLength(2);
  });

  it('should export as CSV', async () => {
    const result = await useCase.execute({
      requestedBy: 'admin_1',
      format: 'CSV',
      filters: {},
    });
    expect(result.contentType).toBe('text/csv');
    expect(result.content).toContain('eventId');
    expect(result.content).toContain('timestamp');
    expect(result.content.split('\n').length).toBe(3); // header + 2 rows
  });

  it('should throw on missing requestedBy', async () => {
    await expect(useCase.execute({
      requestedBy: '',
      format: 'JSON',
      filters: {},
    })).rejects.toThrow();
  });
});
