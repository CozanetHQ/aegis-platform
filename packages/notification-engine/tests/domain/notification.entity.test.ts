import { describe, it, expect } from 'vitest';
import { Notification } from '../../src/domain/entities/notification.entity';

function makeNotification() {
  return Notification.create({
    id: 'n1',
    recipientAegisId: 'aegis_123',
    category: 'TRANSACTIONS',
    priority: 'NORMAL',
    channel: 'EMAIL',
    title: 'Transfer completed',
    body: 'Your transfer has settled.',
  });
}

describe('Notification entity', () => {
  it('rejects an empty recipient', () => {
    expect(() =>
      Notification.create({
        id: 'n1',
        recipientAegisId: '',
        category: 'SYSTEM',
        priority: 'NORMAL',
        channel: 'IN_APP',
        title: 'x',
        body: 'y',
      })
    ).toThrow();
  });

  it('rejects an empty title', () => {
    expect(() =>
      Notification.create({
        id: 'n1',
        recipientAegisId: 'aegis_123',
        category: 'SYSTEM',
        priority: 'NORMAL',
        channel: 'IN_APP',
        title: '  ',
        body: 'y',
      })
    ).toThrow();
  });

  it('starts QUEUED when not scheduled, PENDING when scheduled', () => {
    const n = makeNotification();
    expect(n.status).toBe('QUEUED');

    const scheduled = Notification.create({
      id: 'n2',
      recipientAegisId: 'aegis_123',
      category: 'SYSTEM',
      priority: 'NORMAL',
      channel: 'IN_APP',
      title: 'x',
      body: 'y',
      scheduledFor: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(scheduled.status).toBe('PENDING');
  });

  it('marks read exactly once, idempotently', () => {
    const n = makeNotification();
    expect(n.isRead).toBe(false);
    n.markRead('2026-01-01T00:00:00.000Z');
    expect(n.isRead).toBe(true);
    const firstReadAt = n.readAt;
    n.markRead('2026-01-02T00:00:00.000Z');
    expect(n.readAt).toBe(firstReadAt);
  });

  it('cannot transition out of a terminal DELIVERED state', () => {
    const n = makeNotification();
    n.markSending();
    n.markDelivered();
    expect(() => n.markSending()).toThrow();
    expect(() => n.recordFailure('boom')).toThrow();
  });

  it('cannot cancel an already-delivered notification', () => {
    const n = makeNotification();
    n.markSending();
    n.markDelivered();
    expect(() => n.cancel()).toThrow();
  });

  it('re-queues on failure while under the retry budget, then goes terminal', () => {
    const n = makeNotification();
    n.markSending();
    for (let i = 0; i < 5; i++) {
      expect(n.canRetry).toBe(true);
      n.recordFailure(`attempt ${i}`);
      if (i < 4) {
        expect(n.status).toBe('QUEUED');
        n.markSending();
      }
    }
    expect(n.status).toBe('FAILED');
    expect(n.canRetry).toBe(false);
  });
});
