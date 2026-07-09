import type { Notification } from '../../domain/entities/notification.entity';

export interface ListNotificationsFilter {
  aegisId: string;
  unreadOnly?: boolean;
  limit: number;
  cursor?: string | null;
}

export interface ListNotificationsResult {
  items: Notification[];
  nextCursor: string | null;
}

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  list(filter: ListNotificationsFilter): Promise<ListNotificationsResult>;
  countUnread(aegisId: string): Promise<number>;
  markAllRead(aegisId: string, now: string): Promise<number>;
  /** Notifications due for delivery — PENDING with scheduledFor <= now, or QUEUED. */
  findDeliverable(limit: number, now: string): Promise<Notification[]>;
}
