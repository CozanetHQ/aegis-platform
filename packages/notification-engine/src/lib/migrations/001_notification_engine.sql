-- ==============================================================================
-- AEGIS — Notification Engine Schema
-- Migration 001 — dedicated aegis-notification-engine database.
-- PostgreSQL 17 + Supabase Compatible. Idempotent throughout.
-- ==============================================================================

create extension if not exists "pgcrypto";

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Enums ──────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.notification_channel as enum ('IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WEBHOOK');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_priority as enum ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_status as enum ('PENDING', 'QUEUED', 'SENDING', 'DELIVERED', 'FAILED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_category as enum (
    'SECURITY', 'TRANSACTIONS', 'AI_INSIGHTS', 'BILLS', 'PRICE_ALERTS',
    'PROMOTIONS', 'NEWS', 'MARKETING', 'SYSTEM'
  );
exception when duplicate_object then null; end $$;

-- ── notifications ────────────────────────────────────────────────────────────
-- One row per (event x recipient x channel) fan-out. This is both the queue
-- and the permanent delivery log — there is no separate delivery_attempts
-- table yet (see README "Known gaps"): retry_count/last_error capture the
-- latest attempt only, not full history.

create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_aegis_id  text not null,
  category            public.notification_category not null,
  priority            public.notification_priority not null default 'NORMAL',
  channel             public.notification_channel not null,
  title               text not null,
  body                text not null default '',
  data                jsonb not null default '{}'::jsonb,
  status              public.notification_status not null default 'QUEUED',
  read_at             timestamptz,
  scheduled_for       timestamptz,
  source_event_id     text,
  retry_count         integer not null default 0,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created
  on public.notifications (recipient_aegis_id, created_at desc);

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_aegis_id)
  where read_at is null;

create index if not exists idx_notifications_deliverable
  on public.notifications (status, scheduled_for)
  where status in ('PENDING', 'QUEUED');

drop trigger if exists trg_notifications_updated_at on public.notifications;
create trigger trg_notifications_updated_at
  before update on public.notifications
  for each row execute function public.handle_updated_at();

-- ── notification_preferences ────────────────────────────────────────────────
-- One row per aegis_id. matrix is { [category]: { [channel]: boolean } } —
-- kept as jsonb rather than a normalized table since it's read/written as a
-- whole document from the app side (see NotificationPreference entity).

create table if not exists public.notification_preferences (
  aegis_id    text primary key,
  matrix      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.handle_updated_at();

-- ── Row-Level Security ───────────────────────────────────────────────────────
-- All access from this engine's API routes goes through the service-role
-- client (requireAuth/requireEngineApiKey enforce authorization at the
-- application layer), so RLS here is defense-in-depth, not the primary gate.

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

do $$ begin
  create policy service_role_all_notifications on public.notifications
    for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy service_role_all_notification_preferences on public.notification_preferences
    for all using (true) with check (true);
exception when duplicate_object then null; end $$;
