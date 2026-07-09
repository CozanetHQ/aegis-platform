import type { Channel, NotificationCategory } from '../enums/notification-enums';
import { NON_SUPPRESSIBLE_CATEGORIES } from '../enums/notification-enums';

export type PreferenceMatrix = Record<NotificationCategory, Record<Channel, boolean>>;

export interface NotificationPreferenceProps {
  aegisId: string;
  matrix: PreferenceMatrix;
  updatedAt: string;
}

const DEFAULT_ENABLED: Partial<Record<NotificationCategory, Channel[]>> = {
  SECURITY: ['IN_APP', 'EMAIL', 'PUSH'],
  TRANSACTIONS: ['IN_APP', 'EMAIL', 'PUSH'],
  AI_INSIGHTS: ['IN_APP'],
  BILLS: ['IN_APP', 'EMAIL'],
  PRICE_ALERTS: ['IN_APP', 'PUSH'],
  PROMOTIONS: ['IN_APP'],
  NEWS: ['IN_APP'],
  MARKETING: [],
  SYSTEM: ['IN_APP', 'EMAIL'],
};

/**
 * A user's per-category, per-channel opt-in matrix. SECURITY notifications
 * can never be fully silenced — attempting to disable every channel for a
 * non-suppressible category is rejected rather than silently ignored, so a
 * caller finds out immediately instead of discovering it during an incident.
 */
export class NotificationPreference {
  private constructor(private props: NotificationPreferenceProps) {}

  static createDefault(aegisId: string, now = new Date().toISOString()): NotificationPreference {
    const matrix = {} as PreferenceMatrix;
    const categories: NotificationCategory[] = [
      'SECURITY', 'TRANSACTIONS', 'AI_INSIGHTS', 'BILLS', 'PRICE_ALERTS',
      'PROMOTIONS', 'NEWS', 'MARKETING', 'SYSTEM',
    ];
    const channels: Channel[] = ['IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WEBHOOK'];
    for (const category of categories) {
      matrix[category] = {} as Record<Channel, boolean>;
      for (const channel of channels) {
        matrix[category][channel] = (DEFAULT_ENABLED[category] ?? []).includes(channel);
      }
    }
    return new NotificationPreference({ aegisId, matrix, updatedAt: now });
  }

  static hydrate(props: NotificationPreferenceProps): NotificationPreference {
    return new NotificationPreference(props);
  }

  toProps(): NotificationPreferenceProps {
    return { ...this.props, matrix: { ...this.props.matrix } };
  }

  get aegisId() {
    return this.props.aegisId;
  }

  isEnabled(category: NotificationCategory, channel: Channel): boolean {
    return this.props.matrix[category]?.[channel] ?? false;
  }

  set(category: NotificationCategory, channel: Channel, enabled: boolean, now = new Date().toISOString()) {
    const next = { ...this.props.matrix[category], [channel]: enabled };
    if (
      NON_SUPPRESSIBLE_CATEGORIES.includes(category) &&
      !Object.values(next).some(Boolean)
    ) {
      throw new Error(`${category} notifications cannot be fully disabled — at least one channel must stay on`);
    }
    this.props.matrix = { ...this.props.matrix, [category]: next };
    this.props.updatedAt = now;
  }

  applyPartialUpdate(update: Partial<Record<NotificationCategory, Partial<Record<Channel, boolean>>>>, now = new Date().toISOString()) {
    for (const [category, channels] of Object.entries(update) as [NotificationCategory, Partial<Record<Channel, boolean>>][]) {
      for (const [channel, enabled] of Object.entries(channels) as [Channel, boolean][]) {
        this.set(category, channel, enabled, now);
      }
    }
  }
}
