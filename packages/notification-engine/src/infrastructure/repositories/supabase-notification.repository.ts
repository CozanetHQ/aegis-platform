import type { SupabaseClient } from '@supabase/supabase-js';
import { Notification, type NotificationProps } from '../../domain/entities/notification.entity';
import type {
  NotificationRepository,
  ListNotificationsFilter,
  ListNotificationsResult,
} from '../../application/ports/notification-repository.port';

interface Row {
  id: string;
  recipient_aegis_id: string;
  category: string;
  priority: string;
  channel: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: string;
  read_at: string | null;
  scheduled_for: string | null;
  source_event_id: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function toProps(row: Row): NotificationProps {
  return {
    id: row.id,
    recipientAegisId: row.recipient_aegis_id,
    category: row.category as NotificationProps['category'],
    priority: row.priority as NotificationProps['priority'],
    channel: row.channel as NotificationProps['channel'],
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    status: row.status as NotificationProps['status'],
    readAt: row.read_at,
    scheduledFor: row.scheduled_for,
    sourceEventId: row.source_event_id,
    retryCount: row.retry_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(props: NotificationProps): Omit<Row, 'created_at'> & { created_at?: string } {
  return {
    id: props.id,
    recipient_aegis_id: props.recipientAegisId,
    category: props.category,
    priority: props.priority,
    channel: props.channel,
    title: props.title,
    body: props.body,
    data: props.data,
    status: props.status,
    read_at: props.readAt,
    scheduled_for: props.scheduledFor,
    source_event_id: props.sourceEventId,
    retry_count: props.retryCount,
    last_error: props.lastError,
    created_at: props.createdAt,
    updated_at: props.updatedAt,
  };
}

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(notification: Notification): Promise<void> {
    const row = toRow(notification.toProps());
    const { error } = await this.db.from('notifications').upsert(row, { onConflict: 'id' });
    if (error) throw new Error(`SupabaseNotificationRepository.save: ${error.message}`);
  }

  async findById(id: string): Promise<Notification | null> {
    const { data, error } = await this.db.from('notifications').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`SupabaseNotificationRepository.findById: ${error.message}`);
    if (!data) return null;
    return Notification.hydrate(toProps(data as Row));
  }

  async list(filter: ListNotificationsFilter): Promise<ListNotificationsResult> {
    let query = this.db
      .from('notifications')
      .select('*')
      .eq('recipient_aegis_id', filter.aegisId)
      .order('created_at', { ascending: false })
      .limit(filter.limit + 1);

    if (filter.unreadOnly) query = query.is('read_at', null);
    if (filter.cursor) query = query.lt('created_at', filter.cursor);

    const { data, error } = await query;
    if (error) throw new Error(`SupabaseNotificationRepository.list: ${error.message}`);

    const rows = (data ?? []) as Row[];
    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;

    return {
      items: page.map((r) => Notification.hydrate(toProps(r))),
      nextCursor: hasMore ? page[page.length - 1].created_at : null,
    };
  }

  async countUnread(aegisId: string): Promise<number> {
    const { count, error } = await this.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_aegis_id', aegisId)
      .is('read_at', null);
    if (error) throw new Error(`SupabaseNotificationRepository.countUnread: ${error.message}`);
    return count ?? 0;
  }

  async markAllRead(aegisId: string, now: string): Promise<number> {
    const { data, error } = await this.db
      .from('notifications')
      .update({ read_at: now, updated_at: now })
      .eq('recipient_aegis_id', aegisId)
      .is('read_at', null)
      .select('id');
    if (error) throw new Error(`SupabaseNotificationRepository.markAllRead: ${error.message}`);
    return (data ?? []).length;
  }

  async findDeliverable(limit: number, now: string): Promise<Notification[]> {
    const { data, error } = await this.db
      .from('notifications')
      .select('*')
      .in('status', ['PENDING', 'QUEUED'])
      .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
      .order('priority', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`SupabaseNotificationRepository.findDeliverable: ${error.message}`);
    return ((data ?? []) as Row[]).map((r) => Notification.hydrate(toProps(r)));
  }
}
