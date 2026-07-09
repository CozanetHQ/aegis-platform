import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessEventUseCase } from '../../src/application/use-cases/process-event.use-case';
import { DeliverNotificationUseCase } from '../../src/application/use-cases/deliver-notification.use-case';
import {
  InMemoryNotificationRepository,
  InMemoryPreferenceRepository,
  FakeChannelProvider,
  FakeAddressResolver,
} from '../fakes';
import { NotificationPreference } from '../../src/domain/entities/notification-preference.entity';

describe('ProcessEventUseCase', () => {
  let notifications: InMemoryNotificationRepository;
  let preferences: InMemoryPreferenceRepository;
  let emailProvider: FakeChannelProvider;
  let deliver: DeliverNotificationUseCase;
  let useCase: ProcessEventUseCase;

  beforeEach(() => {
    notifications = new InMemoryNotificationRepository();
    preferences = new InMemoryPreferenceRepository();
    emailProvider = new FakeChannelProvider('EMAIL');
    deliver = new DeliverNotificationUseCase(
      notifications,
      { EMAIL: emailProvider },
      new FakeAddressResolver('user@example.com')
    );
    useCase = new ProcessEventUseCase(notifications, preferences, deliver);
  });

  it('fans out to every implemented channel enabled for the category, and delivers immediately', async () => {
    const result = await useCase.execute({
      eventId: 'evt_1',
      eventType: 'TransferCompleted',
      recipientAegisId: 'aegis_123',
      payload: { transferRef: 'TRF-1', email: 'user@example.com' },
    });

    // Defaults enable TRANSACTIONS on IN_APP + EMAIL.
    expect(result.created).toHaveLength(2);
    expect(result.created.map((c) => c.channel).sort()).toEqual(['EMAIL', 'IN_APP']);
    expect(result.skippedByPreference).toHaveLength(0);

    const saved = [...notifications.rows.values()];
    expect(saved.every((n) => n.status === 'DELIVERED')).toBe(true);
    expect(emailProvider.delivered).toHaveLength(1);
  });

  it('creates a default preference row for a first-time recipient', async () => {
    expect(await preferences.findByAegisId('aegis_new')).toBeNull();
    await useCase.execute({
      eventId: 'evt_2',
      eventType: 'AiInsightReady',
      recipientAegisId: 'aegis_new',
      payload: {},
    });
    expect(await preferences.findByAegisId('aegis_new')).not.toBeNull();
  });

  it('skips channels the recipient has opted out of', async () => {
    const pref = NotificationPreference.createDefault('aegis_123');
    pref.set('TRANSACTIONS', 'EMAIL', false);
    await preferences.save(pref);

    const result = await useCase.execute({
      eventId: 'evt_3',
      eventType: 'TransferCompleted',
      recipientAegisId: 'aegis_123',
      payload: {},
    });

    expect(result.created.map((c) => c.channel)).toEqual(['IN_APP']);
    expect(result.skippedByPreference).toEqual(['EMAIL']);
  });

  it('does not attempt delivery for scheduled notifications', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const result = await useCase.execute({
      eventId: 'evt_4',
      eventType: 'PriceAlertTriggered',
      recipientAegisId: 'aegis_123',
      payload: { symbol: 'BTC', targetPrice: '100000' },
      scheduledFor: future,
    });

    const saved = result.created.map((c) => notifications.rows.get(c.notificationId)!);
    expect(saved.every((n) => n.status === 'PENDING')).toBe(true);
  });
});
