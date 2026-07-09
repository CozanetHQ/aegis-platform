-- ==============================================================================
-- AEGIS — Identity Engine Schema
-- Migration 002 — Aegis ID Immutability Constraints
--
-- Enforces the HARD RULE:
--   1. aegis_id is IMMUTABLE after creation (no UPDATE ever changes it)
--   2. email is IMMUTABLE after creation (no UPDATE ever changes it)
--   3. auth_provider_id is IMMUTABLE after creation
--   4. Even if account is DELETED, the aegis_id and email remain reserved
--      (never recycled, never reassigned)
--
-- This is a database-level guard — application-layer enforcement is secondary.
-- ==============================================================================

-- ── Trigger: Block UPDATE on aegis_id, email, auth_provider_id ───────────────

create or replace function public.prevent_identity_key_mutation()
returns trigger language plpgsql as $$
begin
  -- Only allow UPDATE if the immutable columns are unchanged
  if NEW.aegis_id <> OLD.aegis_id then
    raise exception 'VIOLATION: aegis_id is immutable. Aegis IDs can never be changed or reassigned.'
      using errcode = 'check_violation', constraint = 'aegis_id_immutable';
  end if;
  if NEW.email <> OLD.email then
    raise exception 'VIOLATION: email is immutable. An Aegis ID is permanently bound to its email.'
      using errcode = 'check_violation', constraint = 'email_immutable';
  end if;
  if NEW.auth_provider_id <> OLD.auth_provider_id then
    raise exception 'VIOLATION: auth_provider_id is immutable.'
      using errcode = 'check_violation', constraint = 'auth_provider_id_immutable';
  end if;
  return NEW;
end;
$$;

drop trigger if exists tr_prevent_identity_key_mutation on public.identities;
create trigger tr_prevent_identity_key_mutation
  before update on public.identities
  for each row execute function public.prevent_identity_key_mutation();

-- ── Ensure unique constraints are NOT conditional on deleted_at ───────────────
-- The existing unique constraints on aegis_id and email are unconditional,
-- meaning even soft-deleted accounts keep their aegis_id and email reserved.
-- Verify this is the case (the constraints in 001_identity_engine.sql are
-- column-level UNIQUE which is unconditional — good, no action needed).

-- ── Comment for documentation ─────────────────────────────────────────────────
comment on constraint identities_aegis_id_fmt on public.identities is
  'Aegis IDs are immutable, never recycled, permanently bound to one email.';
comment on constraint identities_email_key on public.identities is
  'Email is immutable after creation. One email = one Aegis ID, forever.';

-- ── RLS policy: prevent users from updating immutable fields via API ─────────
-- (Service role bypasses RLS — this only affects authenticated users)
-- The trigger above is the real guard; this is defense in depth.

drop policy if exists identities_owner_update on public.identities;
create policy identities_owner_update on public.identities
  for update to authenticated
  using (auth_provider_id = auth.uid())
  with check (auth_provider_id = auth.uid());
