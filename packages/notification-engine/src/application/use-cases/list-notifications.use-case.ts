import type { NotificationRepository, ListNotificationsResult } from '../ports/notification-repository.port';

export class ListNotificationsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(input: { aegisId: string; unreadOnly?: boolean; limit?: number; cursor?: string | null }): Promise<ListNotificationsResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    return this.notifications.list({
      aegisId: input.aegisId,
      unreadOnly: input.unreadOnly ?? false,
      limit,
      cursor: input.cursor ?? null,
    });
  }
}

export class GetUnreadCountUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(aegisId: string): Promise<number> {
    return this.notifications.countUnread(aegisId);
  }
}
