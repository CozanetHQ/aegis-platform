import type { Notification } from '../../domain/entities/notification.entity';
import type { Channel, DeliveryResult } from '../../domain/enums/notification-enums';

export interface DeliveryOutcome {
  result: DeliveryResult;
  providerRef?: string | null;
  error?: string | null;
}

/**
 * A channel provider knows how to deliver ONE channel and nothing else.
 * Never hardcode a vendor call inside a use-case — go through this interface
 * so swapping/adding providers (e.g. Email: Resend today, something else
 * later) never touches application logic.
 */
export interface ChannelProvider {
  readonly channel: Channel;
  readonly isConfigured: boolean;
  deliver(notification: Notification, recipientAddress: string | null): Promise<DeliveryOutcome>;
}

/**
 * Resolves the delivery address for a channel (email address, device token,
 * phone, webhook URL) from a persisted Notification — the notification's
 * `data` field is the original event payload, so e.g. Identity Engine's
 * IDENTITY_ACTIVATED event (which already carries payload.email) resolves
 * with zero extra network calls. See PayloadEmailResolver's doc comment for
 * the current limitation on events that don't carry an address.
 */
export interface RecipientAddressResolver {
  resolve(notification: Notification, channel: Channel): Promise<string | null>;
}
