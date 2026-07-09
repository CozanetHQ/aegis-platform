import { IMPLEMENTED_CHANNELS, type Channel } from '../../domain/enums/notification-enums';
import type { NotificationRepository } from '../ports/notification-repository.port';
import type { ChannelProvider, RecipientAddressResolver } from '../ports/channel-provider.port';

export interface DeliveryOutcomeSummary {
  channel: Channel;
  delivered: boolean;
  error?: string;
}

/**
 * Delivers a single notification through its channel's provider. Providers
 * for channels outside IMPLEMENTED_CHANNELS (PUSH/SMS/WEBHOOK today) don't
 * exist yet — this fails the attempt honestly (PROVIDER_NOT_CONFIGURED)
 * rather than pretending to send.
 *
 * Returns a summary of what actually happened so synchronous callers (e.g.
 * an OTP send that needs to tell the user "we couldn't email you" instead
 * of silently succeeding) can inspect the real delivery result instead of
 * just trusting that the notification row was created.
 */
export class DeliverNotificationUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly providers: Partial<Record<Channel, ChannelProvider>>,
    private readonly addressResolver: RecipientAddressResolver
  ) {}

  async execute(notificationId: string): Promise<DeliveryOutcomeSummary> {
    const notification = await this.notifications.findById(notificationId);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    if (notification.channel === 'IN_APP') {
      // IN_APP delivery IS persistence — the row existing in the DB is the
      // delivery. No external provider call needed.
      notification.markDelivered();
      await this.notifications.save(notification);
      return { channel: notification.channel, delivered: true };
    }

    const provider = this.providers[notification.channel];
    notification.markSending();
    await this.notifications.save(notification);

    if (!provider || !provider.isConfigured || !IMPLEMENTED_CHANNELS.includes(notification.channel)) {
      const error = `No configured provider for channel ${notification.channel}`;
      notification.recordFailure(error);
      await this.notifications.save(notification);
      return { channel: notification.channel, delivered: false, error };
    }

    const address = await this.addressResolver.resolve(notification, notification.channel);
    if (!address) {
      const error = `Could not resolve a delivery address for channel ${notification.channel}`;
      notification.recordFailure(error);
      await this.notifications.save(notification);
      return { channel: notification.channel, delivered: false, error };
    }

    try {
      const outcome = await provider.deliver(notification, address);
      if (outcome.result === 'SUCCESS') {
        notification.markDelivered();
        await this.notifications.save(notification);
        return { channel: notification.channel, delivered: true };
      }
      const error = outcome.error ?? outcome.result;
      notification.recordFailure(error);
      await this.notifications.save(notification);
      return { channel: notification.channel, delivered: false, error };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      notification.recordFailure(error);
      await this.notifications.save(notification);
      return { channel: notification.channel, delivered: false, error };
    }
  }
}
