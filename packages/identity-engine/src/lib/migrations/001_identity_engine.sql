-- ==============================================================================
-- AEGIS — Identity Engine Schema
-- Migration 001 — reconstructed for the dedicated aegis-identity-engine database
-- (previously applied ad hoc against the shared monorepo project; this is the
--  first committed migration file now that Identity Engine owns its own DB)
-- PostgreSQL 17 + Supabase Compatible. Idempotent throughout.
-- ==============================================================================

create extension if not exists "pgcrypto";

-- ── Shared trigger fn — used by every table with updated_at ────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Enums ──────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.identity_state as enum (
    'PENDING_REGISTRATION', 'EMAIL_VERIFIED', 'ACTIVE',
    'SUSPENDED', 'LOCKED', 'CLOSED', 'DELETED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_account_type as enum (
    'INDIVIDUAL', 'BUSINESS', 'ORGANIZATION', 'DEVELOPER', 'MERCHANT', 'SUBSCRIPTION', 'AI_ASSISTANT'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_actor_type as enum ('SYSTEM', 'USER', 'ADMIN', 'SUPER_ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_blockchain as enum ('ETHEREUM', 'BNB', 'TRON');
exception when duplicate_object then null; end $$;

-- ── TABLE: identities ────────────────────────────────────────────────────────

create table if not exists public.identities (
  id                uuid primary key default gen_random_uuid(),
  aegis_id          text not null unique
                      constraint identities_aegis_id_fmt check (aegis_id ~ '^AEG-[A-Z2-9]{8}$'),
  auth_provider_id  uuid not null unique,
  email             text not null unique,
  email_verified_at timestamptz,
  state             public.identity_state not null default 'PENDING_REGISTRATION',
  account_type      public.identity_account_type not null default 'INDIVIDUAL',
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_identities_aegis_id  on public.identities(aegis_id) where deleted_at is null;
create index if not exists idx_identities_auth_id   on public.identities(auth_provider_id) where deleted_at is null;
create index if not exists idx_identities_email     on public.identities(email) where deleted_at is null;
create index if not exists idx_identities_state      on public.identities(state);

create trigger identities_updated_at
  before update on public.identities
  for each row execute function public.handle_updated_at();

-- ── TABLE: user_profiles ─────────────────────────────────────────────────────

create table if not exists public.user_profiles (
  id            uuid primary key default gen_random_uuid(),
  identity_id   uuid not null unique references public.identities(id) on delete cascade,
  full_name     text,
  username      text unique constraint user_profiles_username_fmt check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  country_code  text constraint user_profiles_country_fmt check (country_code ~ '^[A-Z]{2}$'),
  language_code text not null default 'en-US',
  avatar_url    text,
  preferences   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.user_profiles(username) where username is not null;

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();

-- ── TABLE: wallet_mappings ───────────────────────────────────────────────────
-- Soft ref to Wallet Vault Engine's wallets.vault_id — no FK across engine DBs.

create table if not exists public.wallet_mappings (
  id              uuid primary key default gen_random_uuid(),
  identity_id     uuid not null references public.identities(id) on delete cascade,
  wallet_vault_id uuid not null,
  blockchain      public.identity_blockchain not null,
  address         text not null,
  is_primary      boolean not null default false,
  wallet_state    text not null default 'ACTIVE',
  created_at      timestamptz not null default now(),

  constraint wallet_mappings_identity_blockchain_uniq unique (identity_id, blockchain)
);

create index if not exists idx_wallet_mappings_identity on public.wallet_mappings(identity_id) where wallet_state = 'ACTIVE';

-- ── TABLE: identity_state_transitions (audit trail) ─────────────────────────

create table if not exists public.identity_state_transitions (
  id           uuid primary key default gen_random_uuid(),
  identity_id  uuid not null references public.identities(id) on delete cascade,
  from_state   public.identity_state not null,
  to_state     public.identity_state not null,
  reason       text not null,
  actor_type   public.identity_actor_type not null,
  actor_id     uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_identity_transitions_identity on public.identity_state_transitions(identity_id, created_at desc);

-- ── TABLE: identity_event_outbox ─────────────────────────────────────────────

create table if not exists public.identity_event_outbox (
  id           uuid primary key default gen_random_uuid(),
  identity_id  uuid not null references public.identities(id) on delete cascade,
  event_type   text not null,
  payload      jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processed_by text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_identity_outbox_unprocessed
  on public.identity_event_outbox(created_at) where processed_at is null;

-- ── RLS ────────────────────────────────────────────────────────────────────────

alter table public.identities                  enable row level security;
alter table public.user_profiles                enable row level security;
alter table public.wallet_mappings              enable row level security;
alter table public.identity_state_transitions   enable row level security;
alter table public.identity_event_outbox        enable row level security;

drop policy if exists identities_owner_read on public.identities;
create policy identities_owner_read on public.identities for select to authenticated
  using (auth_provider_id = auth.uid());

drop policy if exists profiles_owner_read on public.user_profiles;
create policy profiles_owner_read on public.user_profiles for select to authenticated
  using (identity_id in (select id from public.identities where auth_provider_id = auth.uid()));

drop policy if exists wallet_mappings_owner_read on public.wallet_mappings;
create policy wallet_mappings_owner_read on public.wallet_mappings for select to authenticated
  using (identity_id in (select id from public.identities where auth_provider_id = auth.uid()));

-- Service role bypasses RLS automatically — used by all engine-internal operations.
