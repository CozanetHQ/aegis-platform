import { describe, it, expect, beforeEach } from 'vitest';
import { DeliverNotificationUseCase } from '../../src/application/use-cases/deliver-notification.use-case';
import { Notification } from '../../src/domain/entities/notification.entity';
import { InMemoryNotificationRepository, FakeChannelProvider, FakeAddressResolver } from '../fakes';

function makeNotification(overrides: Partial<Parameters<typeof Notification.create>[0]> = {}) {
  return Notification.create({
    id: 'n1',
    recipientAegisId: 'aegis_123',
    category: 'TRANSACTIONS',
    priority: 'NORMAL',
    channel: 'EMAIL',
    title: 'Hello',
    body: 'World',
    ...overrides,
  });
}

describe('DeliverNotificationUseCase', () => {
  let notifications: InMemoryNotificationRepository;

  beforeEach(() => {
    notifications = new InMemoryNotificationRepository();
  });

  it('delivers IN_APP without needing a provider — persistence is the delivery', async () => {
    const n = makeNotification({ channel: 'IN_APP' });
    await notifications.save(n);
    const useCase = new DeliverNotificationUseCase(notifications, {}, new FakeAddressResolver());
    await useCase.execute(n.id);
    expect((await notifications.findById(n.id))!.status).toBe('DELIVERED');
  });

  it('delivers EMAIL via the configured provider on success', async () => {
    const n = makeNotification();
    await notifications.save(n);
    const provider = new FakeChannelProvider('EMAIL', true, { result: 'SUCCESS' });
    const useCase = new DeliverNotificationUseCase(notifications, { EMAIL: provider }, new FakeAddressResolver('a@b.com'));
    await useCase.execute(n.id);
    expect((await notifications.findById(n.id))!.status).toBe('DELIVERED');
    expect(provider.delivered[0].address).toBe('a@b.com');
  });

  it('fails honestly when no provider is configured for the channel', async () => {
    const n = makeNotification();
    await notifications.save(n);
    const useCase = new DeliverNotificationUseCase(notifications, {}, new FakeAddressResolver('a@b.com'));
    await useCase.execute(n.id);
    const after = await notifications.findById(n.id);
    // Single attempt still under retry budget -> re-queued, not silently dropped.
    expect(after!.status).toBe('QUEUED');
    expect(after!.retryCount).toBe(1);
  });

  it('fails honestly when no address can be resolved', async () => {
    const n = makeNotification();
    await notifications.save(n);
    const provider = new FakeChannelProvider('EMAIL');
    const useCase = new DeliverNotificationUseCase(notifications, { EMAIL: provider }, new FakeAddressResolver(null));
    await useCase.execute(n.id);
    expect(provider.delivered).toHaveLength(0);
    expect((await notifications.findById(n.id))!.retryCount).toBe(1);
  });

  it('re-queues on provider failure and eventually goes terminal after exhausting retries', async () => {
    const n = makeNotification();
    await notifications.save(n);
    const provider = new FakeChannelProvider('EMAIL', true, { result: 'FAILURE', error: 'boom' });
    const useCase = new DeliverNotificationUseCase(notifications, { EMAIL: provider }, new FakeAddressResolver('a@b.com'));

    for (let i = 0; i < 5; i++) {
      await useCase.execute(n.id);
    }
    expect((await notifications.findById(n.id))!.status).toBe('FAILED');
  });

  it('throws for an unknown notification id', async () => {
    const useCase = new DeliverNotificationUseCase(notifications, {}, new FakeAddressResolver());
    await expect(useCase.execute('does-not-exist')).rejects.toThrow();
  });
});
