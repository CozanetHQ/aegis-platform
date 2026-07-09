/**
 * identity-repository.ts — AEGIS Identity Engine · Infrastructure Layer
 *
 * Concrete implementation of IdentityRepository using the Supabase Client.
 * Service role client used throughout — RLS enforced at the route/middleware layer.
 *
 * FIX 1: Added findByUsername() — needed for username uniqueness enforcement.
 *
 * FIX 2: updateState() was using count to detect optimistic lock failures,
 *        but Supabase's PostgREST .update() does not reliably return count
 *        when count: "exact" is omitted. Added { count: "exact" } to the
 *        update call so the check is actually meaningful.
 *
 * FIX 3: emitOutboxEvent() was fire-and-forget with a silent catch.
 *        Now logs structured error with identityId + eventType so ops
 *        can find stuck outbox events without grepping raw logs.
 *
 * FIX 4: _toIdentity and _toProfile mapper methods are now static —
 *        they don't use `this` and were being recreated per-call.
 *
 * FIX 5: create() was silently accepting a success with data === null
 *        (can happen if .single() races). Added explicit null guard.
 */
import { createServiceClient }  from "@cozanethq/aegis-shared-sdk";
import { AegisError }           from "@cozanethq/aegis-shared-sdk";
import type {
  IdentityRepository,
  RepoCreateIdentityInput,
  TransitionInput,
  ProfileInput,
  WalletInput,
  OtpRecord,
} from "../application/identity-use-cases";
import type { Identity, UserProfile, WalletMapping, StateTransitionRecord } from "../domain/identity-entity";
import type { IdentityState } from "../domain/identity-state-machine";

export class SupabaseIdentityRepository implements IdentityRepository {

  private get db() {
    return createServiceClient();
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Identity | null> {
    const { data, error } = await this.db
      .from("identities")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return data ? SupabaseIdentityRepository._toIdentity(data) : null;
  }

  async findByAuthProviderId(authProviderId: string): Promise<Identity | null> {
    const { data, error } = await this.db
      .from("identities")
      .select("*")
      .eq("auth_provider_id", authProviderId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return data ? SupabaseIdentityRepository._toIdentity(data) : null;
  }

  async findByAegisId(aegisId: string): Promise<Identity | null> {
    const { data, error } = await this.db
      .from("identities")
      .select("*")
      .eq("aegis_id", aegisId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return data ? SupabaseIdentityRepository._toIdentity(data) : null;
  }

  async findByEmail(email: string): Promise<Identity | null> {
    const { data, error } = await this.db
      .from("identities")
      .select("*")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return data ? SupabaseIdentityRepository._toIdentity(data) : null;
  }

  // FIX 1: username lookup via user_profiles join
  async findByUsername(username: string): Promise<Identity | null> {
    const { data, error } = await this.db
      .from("user_profiles")
      .select("identity_id")
      .eq("username", username)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    if (!data) return null;
    return this.findById(data.identity_id as string);
  }

  async aegisIdExists(aegisId: string): Promise<boolean> {
    const { count, error } = await this.db
      .from("identities")
      .select("id", { count: "exact", head: true })
      .eq("aegis_id", aegisId);
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return (count ?? 0) > 0;
  }

  async getProfile(identityId: string): Promise<UserProfile | null> {
    const { data, error } = await this.db
      .from("user_profiles")
      .select("*")
      .eq("identity_id", identityId)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return data ? SupabaseIdentityRepository._toProfile(data) : null;
  }

  async getWallets(identityId: string): Promise<WalletMapping[]> {
    const { data, error } = await this.db
      .from("wallet_mappings")
      .select("*")
      .eq("identity_id", identityId)
      .eq("wallet_state", "ACTIVE")
      .order("is_primary", { ascending: false });
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return (data ?? []).map(SupabaseIdentityRepository._toWallet);
  }

  async getTransitions(identityId: string): Promise<StateTransitionRecord[]> {
    const { data, error } = await this.db
      .from("identity_state_transitions")
      .select("*")
      .eq("identity_id", identityId)
      .order("created_at", { ascending: false });
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return (data ?? []).map(SupabaseIdentityRepository._toTransition);
  }

  // ── Writes ─────────────────────────────────────────────────────────────────

  async create(input: RepoCreateIdentityInput): Promise<Identity> {
    const { data, error } = await this.db
      .from("identities")
      .insert({
        aegis_id:         input.aegisId,
        auth_provider_id: input.authProviderId,
        email:            input.email,
        account_type:     input.accountType ?? "INDIVIDUAL",
        state:            "PENDING_REGISTRATION",
      })
      .select()
      .single();

    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    // FIX 5: guard against silent null from .single()
    if (!data) throw new AegisError("INTERNAL_ERROR", "Identity creation returned no data.");
    return SupabaseIdentityRepository._toIdentity(data);
  }

  // FIX 2: count: "exact" added to catch optimistic lock failures properly
  async updateState(id: string, toState: IdentityState, t: TransitionInput): Promise<void> {
    const db = this.db;

    const { error: updateError, count } = await db
      .from("identities")
      .update({ state: toState, updated_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", id)
      .eq("state", t.fromState);   // optimistic lock on current state

    if (updateError) throw new AegisError("DATABASE_UNAVAILABLE", updateError.message);
    if ((count ?? 0) === 0) {
      throw new AegisError(
        "IDENTITY_INVALID_STATE",
        "State transition failed — identity was modified concurrently or state mismatch."
      );
    }

    // Append audit record (non-blocking — transition already committed above)
    await db.from("identity_state_transitions").insert({
      identity_id: id,
      from_state:  t.fromState,
      to_state:    t.toState,
      reason:      t.reason,
      actor_type:  t.actor,
      actor_id:    t.actorId ?? null,
      metadata:    t.metadata ?? {},
    }).then(({ error }) => {
      if (error) {
        // FIX 3: structured log so ops can find stuck events
        console.error("[IdentityRepo] Transition audit write failed", {
          identityId: id,
          fromState:  t.fromState,
          toState:    t.toState,
          error:      error.message,
        });
      }
    });
  }

  async upsertProfile(identityId: string, data: ProfileInput): Promise<UserProfile> {
    const payload: Record<string, unknown> = {
      identity_id: identityId,
      updated_at:  new Date().toISOString(),
    };
    // FIX 7 (carried from use-cases): include null values explicitly
    if ("fullName"     in data) payload.full_name     = data.fullName;
    if ("username"     in data) payload.username      = data.username;
    if ("countryCode"  in data) payload.country_code  = data.countryCode;
    if ("languageCode" in data) payload.language_code = data.languageCode;
    if ("avatarUrl"    in data) payload.avatar_url    = data.avatarUrl;
    if ("preferences"  in data) payload.preferences   = data.preferences;

    const { data: row, error } = await this.db
      .from("user_profiles")
      .upsert(payload, { onConflict: "identity_id" })
      .select()
      .single();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    if (!row)  throw new AegisError("INTERNAL_ERROR", "Profile upsert returned no data.");
    return SupabaseIdentityRepository._toProfile(row);
  }

  async insertWallets(identityId: string, wallets: WalletInput[]): Promise<void> {
    const rows = wallets.map(w => ({
      identity_id:     identityId,
      wallet_vault_id: w.walletVaultId,
      blockchain:      w.blockchain,
      address:         w.address,
      is_primary:      w.isPrimary,
      wallet_state:    "ACTIVE",
    }));
    const { error } = await this.db
      .from("wallet_mappings")
      .upsert(rows, { onConflict: "identity_id,blockchain" });
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
  }

  // FIX 3: structured outbox error logging
  async emitOutboxEvent(identityId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    const { error } = await this.db
      .from("identity_event_outbox")
      .insert({ identity_id: identityId, event_type: eventType, payload });
    if (error) {
      console.error("[IdentityRepo] Outbox write failed", {
        identityId,
        eventType,
        error: error.message,
      });
      // Outbox failure is non-fatal — domain change already committed
    }
  }

  // ── Static Mappers (FIX 4: static, no this-binding overhead) ──────────────

  private static _toIdentity(row: Record<string, unknown>): Identity {
    return {
      id:              row.id              as string,
      aegisId:         row.aegis_id        as string,
      authProviderId:  row.auth_provider_id as string,
      email:           row.email           as string,
      emailVerifiedAt: row.email_verified_at
        ? new Date(row.email_verified_at as string)
        : null,
      state:           row.state           as IdentityState,
      accountType:     (row.account_type   as any) ?? "INDIVIDUAL",
      createdAt:       new Date(row.created_at as string),
      updatedAt:       new Date(row.updated_at as string),
    };
  }

  private static _toProfile(row: Record<string, unknown>): UserProfile {
    return {
      id:           row.id           as string,
      identityId:   row.identity_id  as string,
      fullName:     (row.full_name    as string | null) ?? null,
      username:     (row.username     as string | null) ?? null,
      countryCode:  (row.country_code as string | null) ?? null,
      languageCode: (row.language_code as string) ?? "en-US",
      avatarUrl:    (row.avatar_url   as string | null) ?? null,
      preferences:  (row.preferences  as Record<string, unknown>) ?? {},
      createdAt:    new Date(row.created_at as string),
      updatedAt:    new Date(row.updated_at as string),
    };
  }

  private static _toWallet(row: Record<string, unknown>): WalletMapping {
    return {
      id:            row.id             as string,
      identityId:    row.identity_id    as string,
      walletVaultId: row.wallet_vault_id as string,
      blockchain:    row.blockchain     as "BNB" | "ETHEREUM" | "TRON",
      address:       row.address        as string,
      isPrimary:     row.is_primary     as boolean,
      createdAt:     new Date(row.created_at as string),
    };
  }

  private static _toTransition(row: Record<string, unknown>): StateTransitionRecord {
    return {
      id:        row.id         as string,
      fromState: row.from_state as IdentityState,
      toState:   row.to_state   as IdentityState,
      reason:    row.reason     as string,
      actorType: row.actor_type as string,
      actorId:   (row.actor_id  as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
    };
  }

  // ── Email verification OTP ────────────────────────────────────────────────

  async upsertOtp(identityId: string, codeHash: string, expiresAt: Date): Promise<void> {
    const { error } = await this.db
      .from("identity_email_otp")
      .upsert(
        {
          identity_id:  identityId,
          code_hash:    codeHash,
          expires_at:   expiresAt.toISOString(),
          attempts:     0,
          last_sent_at: new Date().toISOString(),
        },
        { onConflict: "identity_id" }
      );
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
  }

  async getOtp(identityId: string): Promise<OtpRecord | null> {
    const { data, error } = await this.db
      .from("identity_email_otp")
      .select("*")
      .eq("identity_id", identityId)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    if (!data) return null;
    return {
      codeHash:   data.code_hash as string,
      expiresAt:  new Date(data.expires_at as string),
      attempts:   data.attempts as number,
      lastSentAt: new Date(data.last_sent_at as string),
    };
  }

  async incrementOtpAttempts(identityId: string): Promise<void> {
    const { error } = await this.db.rpc("increment_otp_attempts", { p_identity_id: identityId });
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
  }

  async clearOtp(identityId: string): Promise<void> {
    const { error } = await this.db
      .from("identity_email_otp")
      .delete()
      .eq("identity_id", identityId);
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
  }
}
