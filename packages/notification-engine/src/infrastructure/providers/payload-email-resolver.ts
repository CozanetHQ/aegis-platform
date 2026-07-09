import type { RecipientAddressResolver } from '../../application/ports/channel-provider.port';
import type { Notification } from '../../domain/entities/notification.entity';
import type { Channel } from '../../domain/enums/notification-enums';

/**
 * MVP address resolution: EMAIL is resolved straight from the notification's
 * stored `data` (the original event payload) when the producing engine
 * included an email — Identity Engine's outbox already does this for
 * IDENTITY_ACTIVATED / IDENTITY_CLOSED / IDENTITY_SELF_LOCKED.
 *
 * There is currently no cross-engine "look up this aegisId's email"
 * endpoint to fall back to, so events that don't carry the address in
 * their payload simply can't deliver on EMAIL yet — they fail loudly
 * (recorded as a delivery failure with a clear message), never silently.
 * Flagged as backlog in README "Known gaps": needs an internal Identity
 * Engine contact-lookup route, service-authenticated like the Transfer
 * Engine's existing identity-engine.client.ts pattern.
 */
export class PayloadEmailResolver implements RecipientAddressResolver {
  async resolve(notification: Notification, channel: Channel): Promise<string | null> {
    if (channel !== 'EMAIL') return null;
    const data = notification.toProps().data;
    return typeof data.email === 'string' && data.email.includes('@') ? data.email : null;
  }
}
