import type { NotificationRepository } from '../ports/notification-repository.port';
import { NotificationError } from '../notification-error';

export class MarkNotificationReadUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(input: { notificationId: string; requesterAegisId: string }): Promise<void> {
    const notification = await this.notifications.findById(input.notificationId);
    if (!notification) {
      throw new NotificationError('NOTIFICATION_NOT_FOUND', 'NOTIFICATION_NOT_FOUND'); // message text kept exact — tests + possibly other callers match on it
    }
    if (notification.recipientAegisId !== input.requesterAegisId) {
      throw new NotificationError('NOTIFICATION_FORBIDDEN', 'FORBIDDEN'); // message text kept exact — tests + possibly other callers match on it
    }
    notification.markRead();
    await this.notifications.save(notification);
  }
}

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(aegisId: string): Promise<{ updated: number }> {
    const updated = await this.notifications.markAllRead(aegisId, new Date().toISOString());
    return { updated };
  }
}
