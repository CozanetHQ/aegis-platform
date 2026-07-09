import { v4 as uuidv4 } from 'uuid';
import { Notification } from '../../domain/entities/notification.entity';
import { IMPLEMENTED_CHANNELS, type Channel, type EventType } from '../../domain/enums/notification-enums';
import type { NotificationRepository } from '../ports/notification-repository.port';
import type { PreferenceRepository } from '../ports/preference-repository.port';
import { NotificationPreference } from '../../domain/entities/notification-preference.entity';
import { resolveTemplate } from '../template-resolver';
import type { DeliverNotificationUseCase, DeliveryOutcomeSummary } from './deliver-notification.use-case';

export interface ProcessEventInput {
  eventId: string;
  eventType: EventType;
  recipientAegisId: string;
  payload: Record<string, unknown>;
  scheduledFor?: string | null;
}

export interface ProcessEventResult {
  created: { notificationId: string; channel: Channel }[];
  skippedByPreference: Channel[];
  // Real per-channel delivery outcome for channels that attempted delivery
  // synchronously this request (i.e. not scheduledFor). Callers that need
  // to know whether delivery genuinely succeeded (e.g. OTP sends, where a
  // silent failure would strand a user who can never verify) should read
  // this instead of assuming `created` means "sent".
  deliveryResults: DeliveryOutcomeSummary[];
}

/**
 * The single entry point every other engine's events flow through. Decides
 * category/priority/copy (via the template resolver), fans out to every
 * channel the recipient has opted into for that category, persists one
 * Notification row per channel, then attempts immediate delivery unless the
 * notification is scheduled for later.
 */
export class ProcessEventUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly preferences: PreferenceRepository,
    private readonly deliver: DeliverNotificationUseCase
  ) {}

  async execute(input: ProcessEventInput): Promise<ProcessEventResult> {
    const template = resolveTemplate(input.eventType, input.payload);

    let pref = await this.preferences.findByAegisId(input.recipientAegisId);
    if (!pref) {
      pref = NotificationPreference.createDefault(input.recipientAegisId);
      await this.preferences.save(pref);
    }

    const created: { notificationId: string; channel: Channel }[] = [];
    const skippedByPreference: Channel[] = [];
    const deliveryResults: DeliveryOutcomeSummary[] = [];

    for (const channel of IMPLEMENTED_CHANNELS) {
      if (!pref.isEnabled(template.category, channel)) {
        skippedByPreference.push(channel);
        continue;
      }

      const notification = Notification.create({
        id: uuidv4(),
        recipientAegisId: input.recipientAegisId,
        category: template.category,
        priority: template.priority,
        channel,
        title: template.title,
        body: template.body,
        data: input.payload,
        scheduledFor: input.scheduledFor ?? null,
        sourceEventId: input.eventId,
      });

      await this.notifications.save(notification);
      created.push({ notificationId: notification.id, channel });

      if (!input.scheduledFor) {
        const outcome = await this.deliver.execute(notification.id);
        deliveryResults.push(outcome);
      }
    }

    return { created, skippedByPreference, deliveryResults };
  }
}
