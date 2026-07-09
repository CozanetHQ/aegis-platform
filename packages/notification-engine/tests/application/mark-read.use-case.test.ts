import { describe, it, expect, beforeEach } from 'vitest';
import { MarkNotificationReadUseCase, MarkAllNotificationsReadUseCase } from '../../src/application/use-cases/mark-read.use-case';
import { Notification } from '../../src/domain/entities/notification.entity';
import { InMemoryNotificationRepository } from '../fakes';

describe('Mark-read use-cases', () => {
  let repo: InMemoryNotificationRepository;

  beforeEach(() => {
    repo = new InMemoryNotificationRepository();
  });

  it('marks a single notification read for its owner', async () => {
    const n = Notification.create({
      id: 'n1', recipientAegisId: 'aegis_1', category: 'SYSTEM', priority: 'NORMAL',
      channel: 'IN_APP', title: 'x', body: 'y',
    });
    await repo.save(n);
    const useCase = new MarkNotificationReadUseCase(repo);
    await useCase.execute({ notificationId: 'n1', requesterAegisId: 'aegis_1' });
    expect((await repo.findById('n1'))!.isRead).toBe(true);
  });

  it('refuses to mark another user\'s notification read', async () => {
    const n = Notification.create({
      id: 'n1', recipientAegisId: 'aegis_1', category: 'SYSTEM', priority: 'NORMAL',
      channel: 'IN_APP', title: 'x', body: 'y',
    });
    await repo.save(n);
    const useCase = new MarkNotificationReadUseCase(repo);
    await expect(useCase.execute({ notificationId: 'n1', requesterAegisId: 'aegis_2' })).rejects.toThrow('FORBIDDEN');
  });

  it('throws for an unknown notification id', async () => {
    const useCase = new MarkNotificationReadUseCase(repo);
    await expect(useCase.execute({ notificationId: 'nope', requesterAegisId: 'aegis_1' })).rejects.toThrow('NOTIFICATION_NOT_FOUND');
  });

  it('marks all of a recipient\'s unread notifications read, and only theirs', async () => {
    for (const id of ['n1', 'n2']) {
      await repo.save(Notification.create({ id, recipientAegisId: 'aegis_1', category: 'SYSTEM', priority: 'NORMAL', channel: 'IN_APP', title: 'x', body: 'y' }));
    }
    await repo.save(Notification.create({ id: 'n3', recipientAegisId: 'aegis_2', category: 'SYSTEM', priority: 'NORMAL', channel: 'IN_APP', title: 'x', body: 'y' }));

    const useCase = new MarkAllNotificationsReadUseCase(repo);
    const result = await useCase.execute('aegis_1');
    expect(result.updated).toBe(2);
    expect((await repo.findById('n3'))!.isRead).toBe(false);
  });
});
