import { describe, it, expect, beforeEach } from 'vitest';
import { StartInvestigationUseCase } from '../../src/application/use-cases/start-investigation.use-case';
import { CreateAuditEventUseCase } from '../../src/application/use-cases/create-audit-event.use-case';
import { FakeAuditEventRepository, FakeInvestigationRepository } from '../fakes';

describe('StartInvestigationUseCase', () => {
  let eventRepo: FakeAuditEventRepository;
  let invRepo: FakeInvestigationRepository;
  let useCase: StartInvestigationUseCase;
  let create: CreateAuditEventUseCase;

  beforeEach(async () => {
    eventRepo = new FakeAuditEventRepository();
    invRepo = new FakeInvestigationRepository();
    useCase = new StartInvestigationUseCase(invRepo, eventRepo);
    create = new CreateAuditEventUseCase(eventRepo);

    // Seed events for investigation
    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'LOGIN', correlationId: 'c1', userId: 'u1', ipAddress: '1.1.1.1', severity: 'INFO' });
    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'LOGIN', correlationId: 'c2', userId: 'u1', ipAddress: '2.2.2.2', severity: 'INFO' });
    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'LOGIN', correlationId: 'c3', userId: 'u1', ipAddress: '3.3.3.3', severity: 'INFO' });
    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'LOGIN', correlationId: 'c4', userId: 'u1', ipAddress: '4.4.4.4', severity: 'INFO' });
    await create.execute({ engine: 'IDENTITY', category: 'SECURITY', eventName: 'FAILED_LOGIN', correlationId: 'c5', userId: 'u1', severity: 'CRITICAL', outcome: 'FAILURE' });
  });

  it('should create investigation for a user', async () => {
    const result = await useCase.execute({
      initiatedBy: 'admin_1',
      pivotType: 'USER_ID',
      pivotValue: 'u1',
    });
    expect(result.investigation.status).toBe('IN_PROGRESS');
    expect(result.eventCount).toBe(5);
  });

  it('should detect multiple IP addresses anomaly', async () => {
    const result = await useCase.execute({
      initiatedBy: 'admin_1',
      pivotType: 'USER_ID',
      pivotValue: 'u1',
    });
    const ipAnomaly = result.anomalies.find(a => a.type === 'MULTIPLE_IP_ADDRESSES');
    expect(ipAnomaly).toBeDefined();
  });

  it('should detect critical events anomaly', async () => {
    const result = await useCase.execute({
      initiatedBy: 'admin_1',
      pivotType: 'USER_ID',
      pivotValue: 'u1',
    });
    const criticalAnomaly = result.anomalies.find(a => a.type === 'CRITICAL_EVENTS');
    expect(criticalAnomaly).toBeDefined();
  });

  it('should detect failure burst anomaly', async () => {
    // Add more failures
    for (let i = 0; i < 5; i++) {
      await create.execute({ engine: 'IDENTITY', category: 'SECURITY', eventName: 'FAILED_LOGIN', correlationId: `fail_${i}`, userId: 'u1', severity: 'HIGH', outcome: 'FAILURE' });
    }
    const result = await useCase.execute({
      initiatedBy: 'admin_1',
      pivotType: 'USER_ID',
      pivotValue: 'u1',
    });
    const failureAnomaly = result.anomalies.find(a => a.type === 'FAILURE_BURST');
    expect(failureAnomaly).toBeDefined();
  });

  it('should throw on missing initiatedBy', async () => {
    await expect(useCase.execute({
      initiatedBy: '',
      pivotType: 'USER_ID',
      pivotValue: 'u1',
    })).rejects.toThrow();
  });
});
