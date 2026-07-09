/**
 * identity-use-cases.ts — AEGIS Identity Engine · Application Layer
 *
 * All Identity Engine business logic lives here.
 * Depends only on ports (interfaces) — never on concrete implementations.
 * Pure TypeScript — no Supabase, no HTTP, no Next.js imports.
 *
 * ── FIXES ──────────────────────────────────────────────────────────────────
 * FIX 1: createIdentity now generates the AegisID internally (was an input).
 *        Routes were passing aegisId in from outside — that's a domain concern,
 *        not a caller concern. Callers now only pass authProviderId + email.
 *
 * FIX 2: Rate limiting was wired to IdentityUseCases constructor but never
 *        called in createIdentity. Now called with proper key + limits.
 *
 * FIX 3: verifyEmail now idempotent — if state is already EMAIL_VERIFIED
 *        or ACTIVE, it returns success instead of throwing. Allows retries.
 *
 * FIX 4: resolveRecipient previously returned null for non-ACTIVE identities
 *        silently. Now returns a typed rejection reason so callers can
 *        surface "account suspended" vs "not found" to the user.
 *
 * FIX 5: completeOnboarding had no rollback on wallet insert failure.
 *        Now rolls back vault wallets on DB insert error.
 *
 * FIX 6: _adminTransition loaded the admin identity unnecessarily for
 *        every admin action — 2 DB roundtrips minimum. Fixed: only load
 *        admin identity when needed for actorId in the transition record.
 *        Admin authId is stored directly when no identity record needed.
 *
 * FIX 7: updateProfile no longer silently drops fields that are undefined —
 *        callers can now explicitly set a field to null to clear it.
 *
 * FIX 8: username uniqueness not enforced before upsert. Added checkUsername.
 *        Without this, two users could race to claim the same username.
 *
 * FIX 9: closeAccount (user self-close) use case was missing entirely.
 *        Added as UC-13.
 *
 * FIX 10: selfLock / selfUnlock added as UC-14/15 — users can freeze and
 *         unfreeze their own account (e.g. suspected compromise).
 * ──────────────────────────────────────────────────────────────────────────
 */
import { IdentityStateMachine, type ActorType, type IdentityState } from "../domain/identity-state-machine";
import { AegisIdGenerator }                                          from "../domain/aegis-id-generator";
import { OtpGenerator }                                               from "../domain/otp-generator";
import type {
  Identity,
  UserProfile,
  WalletMapping,
  IdentityCard,
  PublicIdentityCard,
  StateTransitionRecord,
  AccountType,
} from "../domain/identity-entity";
import { AegisError } from "@cozanethq/aegis-shared-sdk";

// ── Ports ─────────────────────────────────────────────────────────────────────

export interface IdentityRepository {
  findById(id: string): Promise<Identity | null>;
  findByAuthProviderId(authProviderId: string): Promise<Identity | null>;
  findByAegisId(aegisId: string): Promise<Identity | null>;
  findByEmail(email: string): Promise<Identity | null>;
  findByUsername(username: string): Promise<Identity | null>;   // FIX 8
  aegisIdExists(aegisId: string): Promise<boolean>;
  create(data: RepoCreateIdentityInput): Promise<Identity>;
  updateState(id: string, toState: IdentityState, transition: TransitionInput): Promise<void>;
  getProfile(identityId: string): Promise<UserProfile | null>;
  upsertProfile(identityId: string, data: ProfileInput): Promise<UserProfile>;
  getWallets(identityId: string): Promise<WalletMapping[]>;
  insertWallets(identityId: string, wallets: WalletInput[]): Promise<void>;
  getTransitions(identityId: string): Promise<StateTransitionRecord[]>;
  emitOutboxEvent(identityId: string, eventType: string, payload: Record<string, unknown>): Promise<void>;

  // ── Email verification OTP (UC-02 support) ────────────────────────────────
  upsertOtp(identityId: string, codeHash: string, expiresAt: Date): Promise<void>;
  getOtp(identityId: string): Promise<OtpRecord | null>;
  incrementOtpAttempts(identityId: string): Promise<void>;
  clearOtp(identityId: string): Promise<void>;
}

export interface OtpRecord {
  codeHash:   string;
  expiresAt:  Date;
  attempts:   number;
  lastSentAt: Date;
}

export interface NotificationPort {
  sendOtpEmail(params: { aegisId: string; code: string; eventId: string }): Promise<{ delivered: boolean; error?: string }>;
}

export interface WalletVaultPort {
  generateWallets(identityId: string): Promise<WalletVaultResult>;
  rollbackWallets(identityId: string): Promise<void>;
}

export interface RateLimiterPort {
  check(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }>;
}

// ── Input / Output types ───────────────────────────────────────────────────────

export interface CreateIdentityInput {
  authProviderId: string;
  email:          string;
  accountType?:   AccountType;
  ipAddress?:     string;
}

/**
 * Repository-level create input — includes the pre-generated aegisId.
 * NOTE: added during repo-per-engine migration — the interface previously
 * reused CreateIdentityInput (the public use-case input, which has no
 * aegisId since it's generated inside createIdentity()), which didn't
 * match the object actually passed to repo.create(). Runtime worked fine
 * (JS doesn't enforce this), but strict tsc correctly flagged the mismatch.
 */
export interface RepoCreateIdentityInput {
  aegisId:        string;
  authProviderId: string;
  email:          string;
  accountType:    AccountType;
}

export interface TransitionInput {
  fromState: IdentityState;
  toState:   IdentityState;
  actor:     ActorType;
  actorId?:  string;
  reason:    string;
  metadata?: Record<string, unknown>;
}

export interface ProfileInput {
  fullName?:     string | null;
  username?:     string | null;
  countryCode?:  string | null;
  languageCode?: string;
  avatarUrl?:    string | null;
  preferences?:  Record<string, unknown>;
}

export interface WalletInput {
  walletVaultId: string;
  blockchain:    "BNB" | "ETHEREUM" | "TRON";
  address:       string;
  isPrimary:     boolean;
}

export interface WalletVaultResult {
  wallets: WalletInput[];
}

// FIX 4: typed rejection instead of null
export interface RecipientResolution {
  aegisId:  string;
  email:    string;
  identityId: string;
  wallets:    WalletMapping[];
}
export interface RecipientRejection {
  reason: "NOT_FOUND" | "NOT_ACTIVE" | "SUSPENDED" | "LOCKED" | "CLOSED" | "DELETED";
}

// ── Use Cases ─────────────────────────────────────────────────────────────────

export class IdentityUseCases {
  constructor(
    private readonly repo:         IdentityRepository,
    private readonly walletVault:  WalletVaultPort,
    private readonly rateLimiter:  RateLimiterPort,
    private readonly notifier:     NotificationPort
  ) {}

  // ── UC-01: Create identity skeleton (called by /register route) ──────────
  async createIdentity(params: CreateIdentityInput): Promise<Identity> {
    // FIX 2: enforce rate limit — 5 registrations per IP per hour
    const ipKey = `identity:register:${params.ipAddress ?? "unknown"}`;
    const rl    = await this.rateLimiter.check(ipKey, 5, 3600);
    if (!rl.allowed) {
      throw new AegisError("RATE_LIMITED", "Too many registration attempts. Try again later.");
    }

    // Duplicate email guard
    const existing = await this.repo.findByEmail(params.email);
    if (existing) {
      throw new AegisError("IDENTITY_EMAIL_EXISTS", "An account with this email already exists.");
    }

    // FIX 1: generate AegisID here, not in the route handler
    const aegisId = await AegisIdGenerator.generateUnique(
      (id) => this.repo.aegisIdExists(id)
    );

    return this.repo.create({
      aegisId,
      authProviderId: params.authProviderId,
      email:          params.email,
      accountType:    params.accountType ?? "INDIVIDUAL",
    });
  }

  // ── UC-02a: Send a one-time email verification code ─────────────────────
  async sendVerificationCode(authProviderId: string): Promise<{ sent: boolean }> {
    const identity = await this._requireByAuthId(authProviderId);

    // Idempotent no-op — nothing to verify once already past this stage.
    if (identity.state === "EMAIL_VERIFIED" || identity.state === "ACTIVE") {
      return { sent: false };
    }

    if (identity.state !== "PENDING_REGISTRATION") {
      throw new AegisError(
        "IDENTITY_INVALID_STATE",
        `Cannot send a verification code for identity in state: ${identity.state}`
      );
    }

    // Resend cooldown — one send per 60s per identity, prevents both accidental
    // double-submits and deliberate email-bombing of a target address.
    const cooldownKey = `identity:send-otp:${identity.id}`;
    const rl = await this.rateLimiter.check(cooldownKey, 1, 60);
    if (!rl.allowed) {
      throw new AegisError("RATE_LIMITED", "Please wait before requesting another code.");
    }

    const code       = OtpGenerator.generate();
    const codeHash   = OtpGenerator.hash(code, identity.id);
    const expiresAt  = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.repo.upsertOtp(identity.id, codeHash, expiresAt);

    const result = await this.notifier.sendOtpEmail({
      aegisId: identity.aegisId,
      code,
      eventId: `otp-${identity.id}-${Date.now()}`,
    });

    if (!result.delivered) {
      throw new AegisError(
        "NOTIFICATION_DELIVERY_FAILED",
        result.error ?? "Failed to send verification email. Please try again."
      );
    }

    return { sent: true };
  }

  // ── UC-02: Verify email → EMAIL_VERIFIED ────────────────────────────────
  async verifyEmail(authProviderId: string, code: string): Promise<void> {
    const identity = await this._requireByAuthId(authProviderId);

    // FIX 3: idempotent — don't throw if already verified
    if (identity.state === "EMAIL_VERIFIED" || identity.state === "ACTIVE") {
      return;
    }

    if (identity.state !== "PENDING_REGISTRATION") {
      throw new AegisError(
        "IDENTITY_INVALID_STATE",
        `Cannot verify email for identity in state: ${identity.state}`
      );
    }

    const otp = await this.repo.getOtp(identity.id);
    if (!otp) {
      throw new AegisError(
        "OTP_NOT_FOUND",
        "No verification code was requested for this account. Please request a new code."
      );
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new AegisError("OTP_EXPIRED", "This code has expired. Please request a new one.");
    }
    if (otp.attempts >= 5) {
      throw new AegisError("OTP_LOCKED", "Too many incorrect attempts. Please request a new code.");
    }

    const candidateHash = OtpGenerator.hash(code, identity.id);
    if (candidateHash !== otp.codeHash) {
      await this.repo.incrementOtpAttempts(identity.id);
      throw new AegisError("OTP_INVALID", "Incorrect code. Please try again.");
    }

    await this.repo.clearOtp(identity.id);

    await this.repo.updateState(identity.id, "EMAIL_VERIFIED", {
      fromState: "PENDING_REGISTRATION",
      toState:   "EMAIL_VERIFIED",
      actor:     "SYSTEM",
      reason:    "Email address confirmed via one-time code",
    });

    await this.repo.emitOutboxEvent(identity.id, "IDENTITY_EMAIL_VERIFIED", {
      aegisId: identity.aegisId,
      email:   identity.email,
    });
  }

  // ── UC-03: Complete onboarding → wallets generated → ACTIVE ─────────────
  async completeOnboarding(params: {
    authProviderId: string;
    fullName?:      string;
    username?:      string;
    countryCode?:   string;
    languageCode?:  string;
  }): Promise<{ wallets: WalletMapping[] }> {
    const identity = await this._requireByAuthId(params.authProviderId);

    if (identity.state !== "EMAIL_VERIFIED") {
      throw new AegisError(
        "IDENTITY_INVALID_STATE",
        `Onboarding requires EMAIL_VERIFIED state. Current: ${identity.state}`
      );
    }

    // FIX 8: enforce username uniqueness before writing
    if (params.username) {
      const taken = await this.repo.findByUsername(params.username);
      if (taken && taken.id !== identity.id) {
        throw new AegisError("IDENTITY_USERNAME_TAKEN", `Username '${params.username}' is already taken.`);
      }
    }

    // Save profile data
    await this.repo.upsertProfile(identity.id, {
      fullName:     params.fullName    ?? null,
      username:     params.username    ?? null,
      countryCode:  params.countryCode ?? null,
      languageCode: params.languageCode ?? "en-US",
    });

    // Generate wallets via Wallet Vault
    let vaultResult: WalletVaultResult;
    try {
      vaultResult = await this.walletVault.generateWallets(identity.aegisId);
    } catch {
      throw new AegisError(
        "IDENTITY_WALLET_VAULT_ERROR",
        "Wallet generation failed. Please try again."
      );
    }

    // FIX 5: rollback vault wallets if DB insert fails
    try {
      await this.repo.insertWallets(
        identity.id,
        vaultResult.wallets.map((w) => ({ ...w }))
      );
    } catch (err) {
      await this.walletVault.rollbackWallets(identity.aegisId).catch(() => {
        // Rollback failure is non-fatal — log and continue
        console.error("[IdentityUseCases] Wallet vault rollback failed after DB error");
      });
      throw new AegisError(
        "IDENTITY_WALLET_VAULT_ERROR",
        "Failed to bind wallets. Your account creation will complete — please contact support if wallets are missing."
      );
    }

    // Transition to ACTIVE
    await this.repo.updateState(identity.id, "ACTIVE", {
      fromState: "EMAIL_VERIFIED",
      toState:   "ACTIVE",
      actor:     "SYSTEM",
      reason:    "Onboarding completed — profile saved and wallets generated",
    });

    await this.repo.emitOutboxEvent(identity.id, "IDENTITY_ACTIVATED", {
      aegisId:     identity.aegisId,
      walletCount: vaultResult.wallets.length,
    });

    return { wallets: await this.repo.getWallets(identity.id) };
  }

  // ── UC-04: Get full identity card (owner view) ───────────────────────────
  // ── Lookup: resolve an email to its aegisId (no auth session required) ──
  // Added for SecurityLoginFailed events — a failed login has no session to
  // derive an aegisId from, but the alert still needs to reach the real
  // account's notification feed (keyed by aegisId, not by the raw email the
  // attempt used). Returns null rather than throwing when no identity
  // exists for that email, so callers can fall back gracefully.
  async findAegisIdByEmail(email: string): Promise<string | null> {
    const identity = await this.repo.findByEmail(email);
    return identity?.aegisId ?? null;
  }

  async getMyCard(authProviderId: string): Promise<IdentityCard> {
    const identity = await this._requireByAuthId(authProviderId);
    const [profile, wallets] = await Promise.all([
      this.repo.getProfile(identity.id),
      this.repo.getWallets(identity.id),
    ]);
    return {
      aegisId:         identity.aegisId,
      email:           identity.email,
      state:           identity.state,
      accountType:     identity.accountType,
      emailVerifiedAt: identity.emailVerifiedAt,
      profile,
      wallets,
      createdAt:       identity.createdAt,
    };
  }

  // ── UC-05: Get public compact card ──────────────────────────────────────
  async getPublicCard(aegisId: string): Promise<PublicIdentityCard> {
    const identity = await this.repo.findByAegisId(aegisId);
    if (!identity) throw new AegisError("IDENTITY_NOT_FOUND", `No identity found for ${aegisId}`);
    const profile = await this.repo.getProfile(identity.id);
    return {
      aegisId:     identity.aegisId,
      username:    profile?.username  ?? null,
      fullName:    profile?.fullName  ?? null,
      accountType: identity.accountType,
      state:       identity.state,
      createdAt:   identity.createdAt,
    };
  }

  // ── UC-06: Update mutable profile fields ────────────────────────────────
  async updateProfile(authProviderId: string, updates: ProfileInput): Promise<UserProfile> {
    const identity = await this._requireByAuthId(authProviderId);
    if (identity.state !== "ACTIVE") {
      throw new AegisError("IDENTITY_INVALID_STATE", "Profile updates require an ACTIVE account.");
    }

    // FIX 8: username uniqueness check on update
    if (updates.username !== undefined && updates.username !== null) {
      const taken = await this.repo.findByUsername(updates.username);
      if (taken && taken.id !== identity.id) {
        throw new AegisError("IDENTITY_USERNAME_TAKEN", `Username '${updates.username}' is already taken.`);
      }
    }

    const profile = await this.repo.upsertProfile(identity.id, updates);
    await this.repo.emitOutboxEvent(identity.id, "PROFILE_UPDATED", {
      aegisId:       identity.aegisId,
      updatedFields: Object.keys(updates).filter(k => updates[k as keyof ProfileInput] !== undefined),
    });
    return profile;
  }

  // ── UC-07–10: Admin state transitions ────────────────────────────────────
  async suspendAccount(adminAuthId: string, aegisId: string, reason: string): Promise<void> {
    await this._adminTransition(adminAuthId, aegisId, "SUSPENDED", reason);
  }

  async lockAccount(adminAuthId: string, aegisId: string, reason: string): Promise<void> {
    await this._adminTransition(adminAuthId, aegisId, "LOCKED", reason);
  }

  async unlockAccount(adminAuthId: string, aegisId: string, reason: string): Promise<void> {
    await this._adminTransition(adminAuthId, aegisId, "ACTIVE", reason);
  }

  async reactivateAccount(adminAuthId: string, aegisId: string, reason: string): Promise<void> {
    await this._adminTransition(adminAuthId, aegisId, "ACTIVE", reason);
  }

  // ── UC-11: Audit trail ───────────────────────────────────────────────────
  async getAuditTrail(aegisId: string): Promise<StateTransitionRecord[]> {
    const identity = await this.repo.findByAegisId(aegisId);
    if (!identity) throw new AegisError("IDENTITY_NOT_FOUND", `No identity found for ${aegisId}`);
    return this.repo.getTransitions(identity.id);
  }

  // ── UC-12: Resolve recipient (used by Transfer/Payment Engine) ───────────
  // FIX 4: returns typed result instead of null — callers can show proper error
  async resolveRecipient(aegisId: string): Promise<RecipientResolution | RecipientRejection> {
    const identity = await this.repo.findByAegisId(aegisId);
    if (!identity) return { reason: "NOT_FOUND" };

    if (identity.state !== "ACTIVE") {
      const reasonMap: Record<IdentityState, RecipientRejection["reason"]> = {
        PENDING_REGISTRATION: "NOT_ACTIVE",
        EMAIL_VERIFIED:       "NOT_ACTIVE",
        ACTIVE:               "NOT_ACTIVE",  // unreachable
        SUSPENDED:            "SUSPENDED",
        LOCKED:               "LOCKED",
        CLOSED:               "CLOSED",
        DELETED:              "DELETED",
      };
      return { reason: reasonMap[identity.state] ?? "NOT_ACTIVE" };
    }

    const wallets = await this.repo.getWallets(identity.id);
    return { identityId: identity.id, aegisId: identity.aegisId, email: identity.email, wallets };
  }

  // ── UC-13: User self-close account (FIX 9) ───────────────────────────────
  async closeAccount(authProviderId: string, reason: string): Promise<void> {
    const identity = await this._requireByAuthId(authProviderId);
    this._assertTransition(identity.state, "CLOSED", "USER", reason);
    await this.repo.updateState(identity.id, "CLOSED", {
      fromState: identity.state,
      toState:   "CLOSED",
      actor:     "USER",
      actorId:   identity.id,
      reason,
    });
    await this.repo.emitOutboxEvent(identity.id, "IDENTITY_CLOSED", {
      aegisId: identity.aegisId,
      reason,
    });
  }

  // ── UC-14: User self-lock (FIX 10) ──────────────────────────────────────
  async selfLock(authProviderId: string): Promise<void> {
    const identity = await this._requireByAuthId(authProviderId);
    this._assertTransition(identity.state, "LOCKED", "USER", "User-initiated account lock for security");
    await this.repo.updateState(identity.id, "LOCKED", {
      fromState: identity.state,
      toState:   "LOCKED",
      actor:     "USER",
      actorId:   identity.id,
      reason:    "User-initiated security lock",
    });
    await this.repo.emitOutboxEvent(identity.id, "IDENTITY_SELF_LOCKED", {
      aegisId: identity.aegisId,
    });
  }

  // ── UC-15: User self-unlock (FIX 10) ─────────────────────────────────────
  async selfUnlock(authProviderId: string): Promise<void> {
    const identity = await this._requireByAuthId(authProviderId);
    if (identity.state !== "LOCKED") {
      throw new AegisError("IDENTITY_INVALID_STATE", "Account is not locked.");
    }
    this._assertTransition(identity.state, "ACTIVE", "USER", "User-initiated account unlock");
    await this.repo.updateState(identity.id, "ACTIVE", {
      fromState: "LOCKED",
      toState:   "ACTIVE",
      actor:     "USER",
      actorId:   identity.id,
      reason:    "User-initiated security unlock",
    });
    await this.repo.emitOutboxEvent(identity.id, "IDENTITY_SELF_UNLOCKED", {
      aegisId: identity.aegisId,
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _requireByAuthId(authProviderId: string): Promise<Identity> {
    const identity = await this.repo.findByAuthProviderId(authProviderId);
    if (!identity) throw new AegisError("IDENTITY_NOT_FOUND", "Identity not found for this session.");
    return identity;
  }

  private _assertTransition(
    from: IdentityState,
    to:   IdentityState,
    actor: ActorType,
    reason: string
  ): void {
    const result = IdentityStateMachine.validate({ from, to, actor, reason });
    if (!result.valid) {
      throw new AegisError("IDENTITY_INVALID_TRANSITION", result.error!);
    }
  }

  // FIX 6: _adminTransition no longer fetches admin's identity record on every call.
  // Admin UUID from the JWT is sufficient for the transition record's actorId.
  private async _adminTransition(
    adminAuthId:   string,
    targetAegisId: string,
    toState:       IdentityState,
    reason:        string
  ): Promise<void> {
    const target = await this.repo.findByAegisId(targetAegisId);
    if (!target) throw new AegisError("IDENTITY_NOT_FOUND", `Target identity ${targetAegisId} not found.`);

    this._assertTransition(target.state, toState, "ADMIN", reason);

    await this.repo.updateState(target.id, toState, {
      fromState: target.state,
      toState,
      actor:     "ADMIN",
      actorId:   adminAuthId,   // use JWT sub directly — no extra DB fetch
      reason,
    });

    await this.repo.emitOutboxEvent(target.id, "ADMIN_ACTION", {
      aegisId:     targetAegisId,
      adminAuthId,
      action:      `${target.state} → ${toState}`,
      reason,
    });
  }
}

