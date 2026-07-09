import type {
  Channel,
  NotificationCategory,
  NotificationStatus,
  Priority,
} from '../enums/notification-enums';

const MAX_RETRIES = 5;

export interface NotificationProps {
  id: string;
  recipientAegisId: string;
  category: NotificationCategory;
  priority: Priority;
  channel: Channel;
  title: string;
  body: string;
  /** Arbitrary structured data the UI can use for deep-linking, e.g. { transferRef } */
  data: Record<string, unknown>;
  status: NotificationStatus;
  readAt: string | null;
  scheduledFor: string | null;
  sourceEventId: string | null;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A single notification instance for a single recipient on a single channel.
 * One inbound event can fan out into several Notification rows (e.g. one
 * IN_APP + one EMAIL) — each is tracked, delivered, and retried independently.
 *
 * Retry policy is intentionally simple for now: up to MAX_RETRIES immediate
 * re-attempts (the caller decides pacing — see DeliverNotificationUseCase),
 * then a terminal FAILED. True exponential backoff + a separate DLQ table
 * is flagged as backlog (see README "Known gaps") — this gets you real
 * resilience today without that infra.
 */
export class Notification {
  private constructor(private props: NotificationProps) {}

  static create(input: {
    recipientAegisId: string;
    category: NotificationCategory;
    priority: Priority;
    channel: Channel;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    scheduledFor?: string | null;
    sourceEventId?: string | null;
    id: string;
    now?: string;
  }): Notification {
    if (!input.recipientAegisId.trim()) {
      throw new Error('Notification requires a recipientAegisId');
    }
    if (!input.title.trim()) {
      throw new Error('Notification requires a non-empty title');
    }
    const now = input.now ?? new Date().toISOString();
    return new Notification({
      id: input.id,
      recipientAegisId: input.recipientAegisId,
      category: input.category,
      priority: input.priority,
      channel: input.channel,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      status: input.scheduledFor ? 'PENDING' : 'QUEUED',
      readAt: null,
      scheduledFor: input.scheduledFor ?? null,
      sourceEventId: input.sourceEventId ?? null,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static hydrate(props: NotificationProps): Notification {
    return new Notification(props);
  }

  toProps(): NotificationProps {
    return { ...this.props };
  }

  get id() {
    return this.props.id;
  }
  get recipientAegisId() {
    return this.props.recipientAegisId;
  }
  get channel() {
    return this.props.channel;
  }
  get category() {
    return this.props.category;
  }
  get status() {
    return this.props.status;
  }
  get readAt() {
    return this.props.readAt;
  }
  get isRead() {
    return this.props.readAt !== null;
  }
  get retryCount() {
    return this.props.retryCount;
  }
  get canRetry() {
    return this.props.retryCount < MAX_RETRIES;
  }

  markQueued(now = new Date().toISOString()) {
    this.transitionTo('QUEUED', now);
  }

  markSending(now = new Date().toISOString()) {
    this.transitionTo('SENDING', now);
  }

  markDelivered(now = new Date().toISOString()) {
    this.transitionTo('DELIVERED', now);
  }

  /** Records a failed attempt. Re-queues for another try if under the retry
   * budget, otherwise transitions to terminal FAILED. */
  recordFailure(error: string, now = new Date().toISOString()) {
    this.props.retryCount += 1;
    this.props.lastError = error;
    if (this.canRetry) {
      this.transitionTo('QUEUED', now);
    } else {
      this.transitionTo('FAILED', now);
    }
  }

  cancel(now = new Date().toISOString()) {
    if (this.props.status === 'DELIVERED') {
      throw new Error('Cannot cancel a notification that has already been delivered');
    }
    this.transitionTo('CANCELLED', now);
  }

  markRead(now = new Date().toISOString()) {
    if (this.props.readAt) return;
    this.props.readAt = now;
    this.props.updatedAt = now;
  }

  private transitionTo(next: NotificationStatus, now: string) {
    const terminal: NotificationStatus[] = ['DELIVERED', 'CANCELLED'];
    if (terminal.includes(this.props.status)) {
      throw new Error(
        `Cannot transition notification ${this.props.id} from terminal state ${this.props.status} to ${next}`
      );
    }
    this.props.status = next;
    this.props.updatedAt = now;
  }
}
