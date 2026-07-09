// @cozanethq/aegis-notification-engine — composition root.
// Wires domain/application use-cases to concrete Supabase + Resend
// infrastructure. Route handlers import from here, never construct
// use-cases themselves.
import { createClient } from '@supabase/supabase-js';
import { SupabaseNotificationRepository } from './infrastructure/repositories/supabase-notification.repository';
import { SupabasePreferenceRepository } from './infrastructure/repositories/supabase-preference.repository';
import { ResendEmailProvider } from './infrastructure/providers/resend-email.provider';
import { IdentityContactResolver } from './infrastructure/providers/identity-contact-resolver';
import { ProcessEventUseCase } from './application/use-cases/process-event.use-case';
import { DeliverNotificationUseCase } from './application/use-cases/deliver-notification.use-case';
import { ListNotificationsUseCase, GetUnreadCountUseCase } from './application/use-cases/list-notifications.use-case';
import { MarkNotificationReadUseCase, MarkAllNotificationsReadUseCase } from './application/use-cases/mark-read.use-case';
import { GetPreferencesUseCase, UpdatePreferencesUseCase } from './application/use-cases/preferences.use-case';
import type { Channel } from './domain/enums/notification-enums';
import type { ChannelProvider } from './application/ports/channel-provider.port';

function buildSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

let cached: ReturnType<typeof build> | null = null;

function build() {
  const db = buildSupabase();
  const notificationRepo = new SupabaseNotificationRepository(db);
  const preferenceRepo = new SupabasePreferenceRepository(db);

  // Uses IdentityContactResolver — resolves email via Identity Engine's
  // internal lookup endpoint (GET /api/v1/identity/internal/:aegis_id).
  // Falls back to payload-carried email first for backward compatibility.
  const addressResolver = new IdentityContactResolver();

  const providers: Partial<Record<Channel, ChannelProvider>> = {
    EMAIL: new ResendEmailProvider(),
  };

  const deliverNotification = new DeliverNotificationUseCase(notificationRepo, providers, addressResolver);

  return {
    db,
    processEvent: new ProcessEventUseCase(notificationRepo, preferenceRepo, deliverNotification),
    deliverNotification,
    listNotifications: new ListNotificationsUseCase(notificationRepo),
    getUnreadCount: new GetUnreadCountUseCase(notificationRepo),
    markRead: new MarkNotificationReadUseCase(notificationRepo),
    markAllRead: new MarkAllNotificationsReadUseCase(notificationRepo),
    getPreferences: new GetPreferencesUseCase(preferenceRepo),
    updatePreferences: new UpdatePreferencesUseCase(preferenceRepo),
    notificationRepo,
  };
}

/** Lazily built + memoized so route handlers share one Supabase client per lambda instance. */
export function NotificationEngine() {
  if (!cached) cached = build();
  return cached;
}
