import { describe, it, expect, beforeEach } from 'vitest';
import { SearchAuditEventsUseCase } from '../../src/application/use-cases/search-audit-events.use-case';
import { CreateAuditEventUseCase } from '../../src/application/use-cases/create-audit-event.use-case';
import { FakeAuditEventRepository } from '../fakes';

describe('SearchAuditEventsUseCase', () => {
  let repo: FakeAuditEventRepository;
  let search: SearchAuditEventsUseCase;
  let create: CreateAuditEventUseCase;

  beforeEach(async () => {
    repo = new FakeAuditEventRepository();
    search = new SearchAuditEventsUseCase(repo);
    create = new CreateAuditEventUseCase(repo);

    // Seed test data
    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'USER_LOGIN', correlationId: 'c1', userId: 'u1', severity: 'INFO' });
    await create.execute({ engine: 'TRANSFER', category: 'TRANSFER', eventName: 'TRANSFER_CREATED', correlationId: 'c2', userId: 'u1', severity: 'LOW' });
    await create.execute({ engine: 'WALLET_VAULT', category: 'WALLET', eventName: 'WALLET_FROZEN', correlationId: 'c3', userId: 'u2', severity: 'CRITICAL' });
    await create.execute({ engine: 'IDENTITY', category: 'SECURITY', eventName: 'FAILED_LOGIN', correlationId: 'c4', userId: 'u3', severity: 'HIGH', outcome: 'FAILURE' });
  });

  it('should return all events with default pagination', async () => {
    const result = await search.execute({});
    expect(result.events).toHaveLength(4);
    expect(result.total).toBe(4);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('should filter by engine', async () => {
    const result = await search.execute({ engine: 'IDENTITY' });
    expect(result.events).toHaveLength(2);
    expect(result.events.every(e => e.engine === 'IDENTITY')).toBe(true);
  });

  it('should filter by severity', async () => {
    const result = await search.execute({ severity: 'CRITICAL' });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventName).toBe('WALLET_FROZEN');
  });

  it('should filter by userId', async () => {
    const result = await search.execute({ userId: 'u1' });
    expect(result.events).toHaveLength(2);
  });

  it('should filter by outcome', async () => {
    const result = await search.execute({ outcome: 'FAILURE' });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventName).toBe('FAILED_LOGIN');
  });

  it('should respect limit', async () => {
    const result = await search.execute({ limit: 2 });
    expect(result.events).toHaveLength(2);
    expect(result.total).toBe(4);
  });

  it('should cap limit at 500', async () => {
    const result = await search.execute({ limit: 10000 });
    expect(result.limit).toBe(500);
  });
});
