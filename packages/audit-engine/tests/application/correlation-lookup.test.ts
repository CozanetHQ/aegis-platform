import { describe, it, expect, beforeEach } from 'vitest';
import { GetCorrelationLookupUseCase } from '../../src/application/use-cases/get-correlation-lookup.use-case';
import { CreateAuditEventUseCase } from '../../src/application/use-cases/create-audit-event.use-case';
import { FakeAuditEventRepository } from '../fakes';

describe('GetCorrelationLookupUseCase', () => {
  let repo: FakeAuditEventRepository;
  let lookup: GetCorrelationLookupUseCase;
  let create: CreateAuditEventUseCase;

  beforeEach(async () => {
    repo = new FakeAuditEventRepository();
    lookup = new GetCorrelationLookupUseCase(repo);
    create = new CreateAuditEventUseCase(repo);

    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'LOGIN', correlationId: 'corr_abc', userId: 'u1' });
    await create.execute({ engine: 'TRANSFER', category: 'TRANSFER', eventName: 'TRANSFER_CREATED', correlationId: 'corr_abc', userId: 'u1' });
    await create.execute({ engine: 'TRANSFER', category: 'TRANSFER', eventName: 'TRANSFER_EXECUTED', correlationId: 'corr_abc', userId: 'u1' });
  });

  it('should return all events for a correlationId', async () => {
    const result = await lookup.execute('corr_abc');
    expect(result.events).toHaveLength(3);
  });

  it('should build a journey with step numbers', async () => {
    const result = await lookup.execute('corr_abc');
    expect(result.journey).toHaveLength(3);
    expect(result.journey[0]).toHaveProperty('step', 1);
    expect(result.journey[1]).toHaveProperty('step', 2);
    expect(result.journey[2]).toHaveProperty('step', 3);
  });

  it('should return empty for non-matching correlationId', async () => {
    const result = await lookup.execute('nonexistent');
    expect(result.events).toHaveLength(0);
    expect(result.journey).toHaveLength(0);
  });
});
