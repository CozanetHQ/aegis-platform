import { describe, it, expect, beforeEach } from 'vitest';
import { CreateAuditEventUseCase } from '../../src/application/use-cases/create-audit-event.use-case';
import { FakeAuditEventRepository } from '../fakes';
import { AuditError } from '../../src/application/audit-error';

describe('CreateAuditEventUseCase', () => {
  let repo: FakeAuditEventRepository;
  let useCase: CreateAuditEventUseCase;

  beforeEach(() => {
    repo = new FakeAuditEventRepository();
    useCase = new CreateAuditEventUseCase(repo);
  });

  it('should create an event successfully', async () => {
    const event = await useCase.execute({
      engine: 'IDENTITY',
      category: 'AUTHENTICATION',
      eventName: 'USER_LOGIN',
      correlationId: 'corr_123',
    });
    expect(event.eventId).toMatch(/^aev_/);
    expect(event.eventName).toBe('USER_LOGIN');
  });

  it('should throw on missing engine', async () => {
    await expect(useCase.execute({
      engine: '',
      category: 'AUTHENTICATION',
      eventName: 'USER_LOGIN',
      correlationId: 'corr_123',
    })).rejects.toThrow(AuditError);
  });

  it('should throw on missing correlationId', async () => {
    await expect(useCase.execute({
      engine: 'IDENTITY',
      category: 'AUTHENTICATION',
      eventName: 'USER_LOGIN',
      correlationId: '',
    })).rejects.toThrow(AuditError);
  });
});
