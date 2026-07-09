import { describe, it, expect, beforeEach } from 'vitest';
import { GetStatisticsUseCase } from '../../src/application/use-cases/get-statistics.use-case';
import { CreateAuditEventUseCase } from '../../src/application/use-cases/create-audit-event.use-case';
import { FakeAuditEventRepository } from '../fakes';

describe('GetStatisticsUseCase', () => {
  let repo: FakeAuditEventRepository;
  let stats: GetStatisticsUseCase;
  let create: CreateAuditEventUseCase;

  beforeEach(async () => {
    repo = new FakeAuditEventRepository();
    stats = new GetStatisticsUseCase(repo);
    create = new CreateAuditEventUseCase(repo);

    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'LOGIN', correlationId: 'c1', severity: 'INFO', country: 'NG', outcome: 'SUCCESS' });
    await create.execute({ engine: 'TRANSFER', category: 'TRANSFER', eventName: 'TRANSFER', correlationId: 'c2', severity: 'HIGH', country: 'US', outcome: 'FAILURE' });
    await create.execute({ engine: 'IDENTITY', category: 'SECURITY', eventName: 'ALERT', correlationId: 'c3', severity: 'CRITICAL', country: 'NG', outcome: 'SUCCESS' });
  });

  it('should return total event count', async () => {
    const result = await stats.execute();
    expect(result.totalEvents).toBe(3);
  });

  it('should return events in last 24h', async () => {
    const result = await stats.execute();
    expect(result.eventsLast24h).toBe(3);
  });

  it('should group by engine', async () => {
    const result = await stats.execute();
    expect(result.byEngine.IDENTITY).toBe(2);
    expect(result.byEngine.TRANSFER).toBe(1);
  });

  it('should group by severity', async () => {
    const result = await stats.execute();
    expect(result.bySeverity.INFO).toBe(1);
    expect(result.bySeverity.HIGH).toBe(1);
    expect(result.bySeverity.CRITICAL).toBe(1);
  });

  it('should group by country', async () => {
    const result = await stats.execute();
    expect(result.byCountry.NG).toBe(2);
    expect(result.byCountry.US).toBe(1);
  });

  it('should group by outcome', async () => {
    const result = await stats.execute();
    expect(result.byOutcome.SUCCESS).toBe(2);
    expect(result.byOutcome.FAILURE).toBe(1);
  });
});
