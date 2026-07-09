-- ==============================================================================
-- AEGIS — Identity Engine Schema
-- Migration 003 — Email Verification OTP
--
-- One-time codes for the PENDING_REGISTRATION → EMAIL_VERIFIED transition.
-- One row per identity (upserted on every resend). Codes are never stored in
-- plaintext — only a keyed SHA-256 hash (see domain/otp-generator.ts).
-- PostgreSQL 17 + Supabase Compatible. Idempotent throughout.
-- ==============================================================================

create table if not exists public.identity_email_otp (
  identity_id   uuid primary key references public.identities(id) on delete cascade,
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      int not null default 0,
  last_sent_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists tr_identity_email_otp_updated_at on public.identity_email_otp;
create trigger tr_identity_email_otp_updated_at
  before update on public.identity_email_otp
  for each row execute function public.handle_updated_at();

-- ── Atomic attempt counter ──────────────────────────────────────────────────
-- Avoids a read-modify-write race if a client somehow fires two verify
-- attempts concurrently (e.g. double-submit) — increments happen in a single
-- statement instead of the app reading attempts then writing attempts+1.

create or replace function public.increment_otp_attempts(p_identity_id uuid)
returns void language sql as $$
  update public.identity_email_otp
  set attempts = attempts + 1
  where identity_id = p_identity_id;
$$;
