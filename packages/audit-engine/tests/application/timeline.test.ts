import { describe, it, expect, beforeEach } from 'vitest';
import { GetTimelineUseCase } from '../../src/application/use-cases/get-timeline.use-case';
import { CreateAuditEventUseCase } from '../../src/application/use-cases/create-audit-event.use-case';
import { FakeAuditEventRepository } from '../fakes';

describe('GetTimelineUseCase', () => {
  let repo: FakeAuditEventRepository;
  let timeline: GetTimelineUseCase;
  let create: CreateAuditEventUseCase;

  beforeEach(async () => {
    repo = new FakeAuditEventRepository();
    timeline = new GetTimelineUseCase(repo);
    create = new CreateAuditEventUseCase(repo);

    // Simulate a user journey across engines
    await create.execute({ engine: 'IDENTITY', category: 'AUTHENTICATION', eventName: 'USER_LOGIN', correlationId: 'corr_journey_1', userId: 'u1', platform: 'WEB' });
    await create.execute({ engine: 'WALLET_VAULT', category: 'WALLET', eventName: 'WALLET_OPENED', correlationId: 'corr_journey_1', userId: 'u1' });
    await create.execute({ engine: 'TRANSFER', category: 'TRANSFER', eventName: 'TRANSFER_CREATED', correlationId: 'corr_journey_1', userId: 'u1' });
    await create.execute({ engine: 'PAYMENT', category: 'PAYMENT', eventName: 'FEE_CALCULATED', correlationId: 'corr_journey_1', userId: 'u1' });
    await create.execute({ engine: 'WALLET_VAULT', category: 'WALLET', eventName: 'WALLET_SIGNED', correlationId: 'corr_journey_1', userId: 'u1' });
    await create.execute({ engine: 'NOTIFICATION', category: 'NOTIFICATION', eventName: 'NOTIFICATION_DELIVERED', correlationId: 'corr_journey_1', userId: 'u1' });
  });

  it('should reconstruct journey by correlationId in chronological order', async () => {
    const result = await timeline.execute({ correlationId: 'corr_journey_1' });
    expect(result.entries).toHaveLength(6);
    expect(result.entries[0].eventName).toBe('USER_LOGIN');
    expect(result.entries[1].eventName).toBe('WALLET_OPENED');
    expect(result.entries[5].eventName).toBe('NOTIFICATION_DELIVERED');
  });

  it('should build timeline by userId', async () => {
    const result = await timeline.execute({ userId: 'u1' });
    expect(result.entries).toHaveLength(6);
  });

  it('should return empty for non-matching correlationId', async () => {
    const result = await timeline.execute({ correlationId: 'nonexistent' });
    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should include engine, category, and outcome in entries', async () => {
    const result = await timeline.execute({ correlationId: 'corr_journey_1' });
    const entry = result.entries[0];
    expect(entry).toHaveProperty('engine');
    expect(entry).toHaveProperty('category');
    expect(entry).toHaveProperty('outcome');
    expect(entry).toHaveProperty('severity');
    expect(entry).toHaveProperty('correlationId');
  });
});
