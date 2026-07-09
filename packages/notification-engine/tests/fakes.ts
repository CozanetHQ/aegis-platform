import type { Notification } from '../src/domain/entities/notification.entity';
import type {
  NotificationRepository,
  ListNotificationsFilter,
  ListNotificationsResult,
} from '../src/application/ports/notification-repository.port';
import type { PreferenceRepository } from '../src/application/ports/preference-repository.port';
import type { NotificationPreference } from '../src/domain/entities/notification-preference.entity';
import type { ChannelProvider, DeliveryOutcome, RecipientAddressResolver } from '../src/application/ports/channel-provider.port';
import type { Channel } from '../src/domain/enums/notification-enums';

export class InMemoryNotificationRepository implements NotificationRepository {
  public rows = new Map<string, Notification>();

  async save(notification: Notification): Promise<void> {
    this.rows.set(notification.id, notification);
  }

  async findById(id: string): Promise<Notification | null> {
    return this.rows.get(id) ?? null;
  }

  async list(filter: ListNotificationsFilter): Promise<ListNotificationsResult> {
    let items = [...this.rows.values()]
      .filter((n) => n.recipientAegisId === filter.aegisId)
      .sort((a, b) => b.toProps().createdAt.localeCompare(a.toProps().createdAt));
    if (filter.unreadOnly) items = items.filter((n) => !n.isRead);
    return { items: items.slice(0, filter.limit), nextCursor: null };
  }

  async countUnread(aegisId: string): Promise<number> {
    return [...this.rows.values()].filter((n) => n.recipientAegisId === aegisId && !n.isRead).length;
  }

  async markAllRead(aegisId: string, now: string): Promise<number> {
    let count = 0;
    for (const n of this.rows.values()) {
      if (n.recipientAegisId === aegisId && !n.isRead) {
        n.markRead(now);
        count++;
      }
    }
    return count;
  }

  async findDeliverable(limit: number): Promise<Notification[]> {
    return [...this.rows.values()].filter((n) => n.status === 'QUEUED' || n.status === 'PENDING').slice(0, limit);
  }
}

export class InMemoryPreferenceRepository implements PreferenceRepository {
  public rows = new Map<string, NotificationPreference>();

  async findByAegisId(aegisId: string): Promise<NotificationPreference | null> {
    return this.rows.get(aegisId) ?? null;
  }

  async save(preference: NotificationPreference): Promise<void> {
    this.rows.set(preference.aegisId, preference);
  }
}

export class FakeChannelProvider implements ChannelProvider {
  public delivered: { notification: Notification; address: string | null }[] = [];
  constructor(
    public readonly channel: Channel,
    public isConfigured = true,
    private readonly outcome: DeliveryOutcome = { result: 'SUCCESS' }
  ) {}

  async deliver(notification: Notification, address: string | null): Promise<DeliveryOutcome> {
    this.delivered.push({ notification, address });
    return this.outcome;
  }
}

export class FakeAddressResolver implements RecipientAddressResolver {
  constructor(private readonly address: string | null = 'user@example.com') {}
  async resolve(): Promise<string | null> {
    return this.address;
  }
}
