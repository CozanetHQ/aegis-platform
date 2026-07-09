import { describe, it, expect, beforeEach } from "vitest";
import { AegisError } from "@cozanethq/aegis-shared-sdk";
import { IdentityUseCases } from "./identity-use-cases";
import type {
  IdentityRepository,
  WalletVaultPort,
  RateLimiterPort,
  NotificationPort,
  RepoCreateIdentityInput,
  TransitionInput,
  ProfileInput,
  WalletInput,
  OtpRecord,
} from "./identity-use-cases";
import { OtpGenerator } from "../domain/otp-generator";
import type { Identity, UserProfile, WalletMapping, StateTransitionRecord } from "../domain/identity-entity";
import type { IdentityState } from "../domain/identity-state-machine";

// ── Fakes ────────────────────────────────────────────────────────────────────

function makeIdentity(overrides: Partial<Identity> = {}): Identity {
  return {
    id: "id-1",
    aegisId: "AEG-ABCDEFGH",
    authProviderId: "auth-1",
    email: "user@example.com",
    emailVerifiedAt: null,
    state: "PENDING_REGISTRATION",
    accountType: "INDIVIDUAL",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

class FakeIdentityRepository implements IdentityRepository {
  identities: Identity[] = [];
  profiles: Map<string, UserProfile> = new Map();
  wallets: Map<string, WalletMapping[]> = new Map();
  transitions: Map<string, StateTransitionRecord[]> = new Map();
  outboxEvents: { identityId: string; eventType: string; payload: Record<string, unknown> }[] = [];
  otps: Map<string, OtpRecord> = new Map();
  private idCounter = 0;

  async findById(id: string) {
    return this.identities.find((i) => i.id === id) ?? null;
  }
  async findByAuthProviderId(authProviderId: string) {
    return this.identities.find((i) => i.authProviderId === authProviderId) ?? null;
  }
  async findByAegisId(aegisId: string) {
    return this.identities.find((i) => i.aegisId === aegisId) ?? null;
  }
  async findByEmail(email: string) {
    return this.identities.find((i) => i.email === email) ?? null;
  }
  async findByUsername(username: string) {
    for (const [identityId, profile] of this.profiles) {
      if (profile.username === username) {
        return this.identities.find((i) => i.id === identityId) ?? null;
      }
    }
    return null;
  }
  async aegisIdExists(aegisId: string) {
    return this.identities.some((i) => i.aegisId === aegisId);
  }
  async create(data: RepoCreateIdentityInput) {
    const identity = makeIdentity({
      id: `id-${++this.idCounter}`,
      aegisId: data.aegisId,
      authProviderId: data.authProviderId,
      email: data.email,
      accountType: data.accountType,
    });
    this.identities.push(identity);
    return identity;
  }
  async updateState(id: string, toState: IdentityState, _transition: TransitionInput) {
    const identity = this.identities.find((i) => i.id === id);
    if (identity) identity.state = toState;
    const record = this.transitions.get(id) ?? [];
    record.push({ ..._transition, identityId: id, id: `t-${record.length + 1}`, createdAt: new Date() } as unknown as StateTransitionRecord);
    this.transitions.set(id, record);
  }
  async getProfile(identityId: string) {
    return this.profiles.get(identityId) ?? null;
  }
  async upsertProfile(identityId: string, data: ProfileInput) {
    const existing = this.profiles.get(identityId);
    const profile: UserProfile = {
      id: existing?.id ?? `profile-${identityId}`,
      identityId,
      fullName: data.fullName !== undefined ? data.fullName : existing?.fullName ?? null,
      username: data.username !== undefined ? data.username : existing?.username ?? null,
      countryCode: data.countryCode !== undefined ? data.countryCode : existing?.countryCode ?? null,
      languageCode: data.languageCode ?? existing?.languageCode ?? "en-US",
      avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing?.avatarUrl ?? null,
      preferences: data.preferences ?? existing?.preferences ?? {},
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    this.profiles.set(identityId, profile);
    return profile;
  }
  async getWallets(identityId: string) {
    return this.wallets.get(identityId) ?? [];
  }
  async insertWallets(identityId: string, wallets: WalletInput[]) {
    const mapped: WalletMapping[] = wallets.map((w, i) => ({
      id: `wallet-${identityId}-${i}`,
      identityId,
      walletVaultId: w.walletVaultId,
      blockchain: w.blockchain,
      address: w.address,
      isPrimary: w.isPrimary,
      createdAt: new Date(),
    }));
    this.wallets.set(identityId, [...(this.wallets.get(identityId) ?? []), ...mapped]);
  }
  async getTransitions(identityId: string) {
    return this.transitions.get(identityId) ?? [];
  }
  async emitOutboxEvent(identityId: string, eventType: string, payload: Record<string, unknown>) {
    this.outboxEvents.push({ identityId, eventType, payload });
  }
  async upsertOtp(identityId: string, codeHash: string, expiresAt: Date) {
    this.otps.set(identityId, { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() });
  }
  async getOtp(identityId: string) {
    return this.otps.get(identityId) ?? null;
  }
  async incrementOtpAttempts(identityId: string) {
    const existing = this.otps.get(identityId);
    if (existing) existing.attempts += 1;
  }
  async clearOtp(identityId: string) {
    this.otps.delete(identityId);
  }
}

class FakeWalletVault implements WalletVaultPort {
  shouldFailGenerate = false;
  rollbackCalls: string[] = [];
  async generateWallets(identityId: string) {
    if (this.shouldFailGenerate) throw new Error("vault unreachable");
    return {
      wallets: [
        { walletVaultId: `vault-${identityId}`, blockchain: "ETHEREUM" as const, address: "0xabc", isPrimary: true },
      ],
    };
  }
  async rollbackWallets(identityId: string) {
    this.rollbackCalls.push(identityId);
  }
}

class FakeRateLimiter implements RateLimiterPort {
  allowed = true;
  async check() {
    return { allowed: this.allowed, remaining: this.allowed ? 4 : 0 };
  }
}

class FakeNotifier implements NotificationPort {
  shouldFail = false;
  lastCode: string | null = null;
  async sendOtpEmail(params: { aegisId: string; code: string; eventId: string }) {
    this.lastCode = params.code;
    if (this.shouldFail) return { delivered: false, error: "provider down" };
    return { delivered: true };
  }
}

function makeUseCases() {
  const repo = new FakeIdentityRepository();
  const vault = new FakeWalletVault();
  const limiter = new FakeRateLimiter();
  const notifier = new FakeNotifier();
  const useCases = new IdentityUseCases(repo, vault, limiter, notifier);
  return { repo, vault, limiter, notifier, useCases };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createIdentity", () => {
  it("creates a new identity with a generated aegisId", async () => {
    const { useCases } = makeUseCases();
    const identity = await useCases.createIdentity({ authProviderId: "auth-1", email: "a@b.com" });
    expect(identity.aegisId).toMatch(/^AEG-/);
    expect(identity.email).toBe("a@b.com");
    expect(identity.state).toBe("PENDING_REGISTRATION");
  });

  it("rejects when rate limited", async () => {
    const { useCases, limiter } = makeUseCases();
    limiter.allowed = false;
    await expect(useCases.createIdentity({ authProviderId: "auth-1", email: "a@b.com" }))
      .rejects.toThrow(AegisError);
    await expect(useCases.createIdentity({ authProviderId: "auth-1", email: "a@b.com" }))
      .rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("rejects duplicate email", async () => {
    const { useCases } = makeUseCases();
    await useCases.createIdentity({ authProviderId: "auth-1", email: "dup@b.com" });
    await expect(useCases.createIdentity({ authProviderId: "auth-2", email: "dup@b.com" }))
      .rejects.toMatchObject({ code: "IDENTITY_EMAIL_EXISTS" });
  });
});

describe("sendVerificationCode", () => {
  it("generates a code, stores its hash, and sends it via the notifier", async () => {
    const { repo, notifier, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    const result = await useCases.sendVerificationCode("auth-1");
    expect(result.sent).toBe(true);
    expect(notifier.lastCode).toMatch(/^\d{6}$/);
    const otp = await repo.getOtp(identity.id);
    expect(otp).not.toBeNull();
    expect(otp!.codeHash).toBe(OtpGenerator.hash(notifier.lastCode!, identity.id));
  });

  it("is a no-op once already verified", async () => {
    const { repo, notifier, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await useCases.sendVerificationCode("auth-1");
    await useCases.verifyEmail("auth-1", notifier.lastCode!);
    const result = await useCases.sendVerificationCode("auth-1");
    expect(result.sent).toBe(false);
  });

  it("surfaces a real error when the notifier fails to deliver", async () => {
    const { repo, notifier, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    notifier.shouldFail = true;
    await expect(useCases.sendVerificationCode("auth-1")).rejects.toMatchObject({ code: "NOTIFICATION_DELIVERY_FAILED" });
  });

  it("rejects a resend within the cooldown window", async () => {
    const { repo, limiter, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    limiter.allowed = false;
    await expect(useCases.sendVerificationCode("auth-1")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("verifyEmail", () => {
  it("transitions PENDING_REGISTRATION -> EMAIL_VERIFIED and emits an event", async () => {
    const { repo, notifier, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await useCases.sendVerificationCode("auth-1");
    await useCases.verifyEmail("auth-1", notifier.lastCode!);
    expect((await repo.findById(identity.id))!.state).toBe("EMAIL_VERIFIED");
    expect(repo.outboxEvents.some((e) => e.eventType === "IDENTITY_EMAIL_VERIFIED")).toBe(true);
  });

  it("is idempotent when already verified", async () => {
    const { repo, notifier, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await useCases.sendVerificationCode("auth-1");
    await useCases.verifyEmail("auth-1", notifier.lastCode!);
    await expect(useCases.verifyEmail("auth-1", notifier.lastCode!)).resolves.toBeUndefined();
  });

  it("throws IDENTITY_NOT_FOUND for unknown auth id", async () => {
    const { useCases } = makeUseCases();
    await expect(useCases.verifyEmail("nope", "123456")).rejects.toMatchObject({ code: "IDENTITY_NOT_FOUND" });
  });

  it("rejects an incorrect code and increments attempts", async () => {
    const { repo, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await useCases.sendVerificationCode("auth-1");
    await expect(useCases.verifyEmail("auth-1", "000000")).rejects.toMatchObject({ code: "OTP_INVALID" });
    expect((await repo.getOtp(identity.id))!.attempts).toBe(1);
  });

  it("rejects an expired code", async () => {
    const { repo, notifier, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await useCases.sendVerificationCode("auth-1");
    const otp = await repo.getOtp((await repo.findByAuthProviderId("auth-1"))!.id);
    otp!.expiresAt = new Date(Date.now() - 1000);
    await expect(useCases.verifyEmail("auth-1", notifier.lastCode!)).rejects.toMatchObject({ code: "OTP_EXPIRED" });
  });

  it("throws OTP_NOT_FOUND when no code was ever requested", async () => {
    const { repo, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-AAAAAAAA", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await expect(useCases.verifyEmail("auth-1", "123456")).rejects.toMatchObject({ code: "OTP_NOT_FOUND" });
  });
});

describe("completeOnboarding", () => {
  async function verifiedIdentity(repo: FakeIdentityRepository) {
    const identity = await repo.create({ aegisId: "AEG-BBBBBBBB", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "EMAIL_VERIFIED";
    return identity;
  }

  it("generates wallets and activates the account", async () => {
    const { repo, useCases } = makeUseCases();
    await verifiedIdentity(repo);
    const result = await useCases.completeOnboarding({ authProviderId: "auth-1", fullName: "Ada" });
    expect(result.wallets.length).toBe(1);
    expect((await repo.findByAuthProviderId("auth-1"))!.state).toBe("ACTIVE");
    expect(repo.outboxEvents.some((e) => e.eventType === "IDENTITY_ACTIVATED")).toBe(true);
  });

  it("rejects onboarding when not in EMAIL_VERIFIED state", async () => {
    const { repo, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-CCCCCCCC", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await expect(useCases.completeOnboarding({ authProviderId: "auth-1" }))
      .rejects.toMatchObject({ code: "IDENTITY_INVALID_STATE" });
  });

  it("rejects a taken username", async () => {
    const { repo, useCases } = makeUseCases();
    const other = await repo.create({ aegisId: "AEG-DDDDDDDD", authProviderId: "auth-other", email: "other@b.com", accountType: "INDIVIDUAL" });
    await repo.upsertProfile(other.id, { username: "ada" });
    await verifiedIdentity(repo);
    await expect(useCases.completeOnboarding({ authProviderId: "auth-1", username: "ada" }))
      .rejects.toMatchObject({ code: "IDENTITY_USERNAME_TAKEN" });
  });

  it("rolls back vault wallets if the DB insert fails", async () => {
    const { repo, useCases, vault } = makeUseCases();
    const identity = await verifiedIdentity(repo);
    repo.insertWallets = async () => { throw new Error("db down"); };
    await expect(useCases.completeOnboarding({ authProviderId: "auth-1" }))
      .rejects.toMatchObject({ code: "IDENTITY_WALLET_VAULT_ERROR" });
    expect(vault.rollbackCalls).toContain(identity.aegisId);
  });

  it("surfaces a clean error when the wallet vault itself fails", async () => {
    const { repo, useCases, vault } = makeUseCases();
    await verifiedIdentity(repo);
    vault.shouldFailGenerate = true;
    await expect(useCases.completeOnboarding({ authProviderId: "auth-1" }))
      .rejects.toMatchObject({ code: "IDENTITY_WALLET_VAULT_ERROR" });
  });
});

describe("resolveRecipient", () => {
  it("returns NOT_FOUND for an unknown aegisId", async () => {
    const { useCases } = makeUseCases();
    const result = await useCases.resolveRecipient("AEG-ZZZZZZZZ");
    expect(result).toEqual({ reason: "NOT_FOUND" });
  });

  it("returns a rejection reason for a non-active identity", async () => {
    const { repo, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-EEEEEEEE", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "SUSPENDED";
    const result = await useCases.resolveRecipient("AEG-EEEEEEEE");
    expect(result).toEqual({ reason: "SUSPENDED" });
  });

  it("resolves an active identity with its wallets", async () => {
    const { repo, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-FFFFFFFF", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "ACTIVE";
    await repo.insertWallets(identity.id, [{ walletVaultId: "v1", blockchain: "TRON", address: "T123", isPrimary: true }]);
    const result = await useCases.resolveRecipient("AEG-FFFFFFFF");
    expect(result).toMatchObject({ aegisId: "AEG-FFFFFFFF", identityId: identity.id });
    expect("wallets" in result && result.wallets.length).toBe(1);
  });
});

describe("closeAccount / selfLock / selfUnlock", () => {
  it("allows a user to self-close an active account", async () => {
    const { repo, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-GGGGGGGG", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "ACTIVE";
    await useCases.closeAccount("auth-1", "no longer needed");
    expect((await repo.findById(identity.id))!.state).toBe("CLOSED");
  });

  it("allows self-lock then self-unlock", async () => {
    const { repo, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-HHHHHHHH", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "ACTIVE";
    await useCases.selfLock("auth-1");
    expect((await repo.findById(identity.id))!.state).toBe("LOCKED");
    await useCases.selfUnlock("auth-1");
    expect((await repo.findById(identity.id))!.state).toBe("ACTIVE");
  });

  it("rejects self-unlock when the account isn't locked", async () => {
    const { repo, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-IIIIIIII", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await expect(useCases.selfUnlock("auth-1")).rejects.toMatchObject({ code: "IDENTITY_INVALID_STATE" });
  });
});

describe("admin transitions", () => {
  it("suspends, then unlocks-back-to-active via admin actions", async () => {
    const { repo, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-JJJJJJJJ", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "ACTIVE";
    await useCases.suspendAccount("admin-1", "AEG-JJJJJJJJ", "policy violation");
    expect((await repo.findById(identity.id))!.state).toBe("SUSPENDED");
    await useCases.reactivateAccount("admin-1", "AEG-JJJJJJJJ", "resolved");
    expect((await repo.findById(identity.id))!.state).toBe("ACTIVE");
    expect(repo.outboxEvents.filter((e) => e.eventType === "ADMIN_ACTION").length).toBe(2);
  });

  it("throws IDENTITY_NOT_FOUND for an unknown target", async () => {
    const { useCases } = makeUseCases();
    await expect(useCases.suspendAccount("admin-1", "AEG-NOTREAL1", "x"))
      .rejects.toMatchObject({ code: "IDENTITY_NOT_FOUND" });
  });

  it("rejects an invalid transition (e.g. suspending an already-suspended account)", async () => {
    const { repo, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-KKKKKKKK", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "SUSPENDED";
    await expect(useCases.suspendAccount("admin-1", "AEG-KKKKKKKK", "x"))
      .rejects.toMatchObject({ code: "IDENTITY_INVALID_TRANSITION" });
  });
});

describe("updateProfile", () => {
  it("updates profile fields for an active account", async () => {
    const { repo, useCases } = makeUseCases();
    const identity = await repo.create({ aegisId: "AEG-LLLLLLLL", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "ACTIVE";
    const profile = await useCases.updateProfile("auth-1", { fullName: "Grace Hopper" });
    expect(profile.fullName).toBe("Grace Hopper");
  });

  it("rejects profile updates on a non-active account", async () => {
    const { repo, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-MMMMMMMM", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    await expect(useCases.updateProfile("auth-1", { fullName: "x" }))
      .rejects.toMatchObject({ code: "IDENTITY_INVALID_STATE" });
  });

  it("rejects a taken username on update", async () => {
    const { repo, useCases } = makeUseCases();
    const other = await repo.create({ aegisId: "AEG-NNNNNNNN", authProviderId: "auth-other", email: "other@b.com", accountType: "INDIVIDUAL" });
    await repo.upsertProfile(other.id, { username: "taken" });
    const identity = await repo.create({ aegisId: "AEG-OOOOOOOO", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    identity.state = "ACTIVE";
    await expect(useCases.updateProfile("auth-1", { username: "taken" }))
      .rejects.toMatchObject({ code: "IDENTITY_USERNAME_TAKEN" });
  });
});

describe("findAegisIdByEmail", () => {
  it("returns the aegisId when found", async () => {
    const { repo, useCases } = makeUseCases();
    await repo.create({ aegisId: "AEG-PPPPPPPP", authProviderId: "auth-1", email: "a@b.com", accountType: "INDIVIDUAL" });
    expect(await useCases.findAegisIdByEmail("a@b.com")).toBe("AEG-PPPPPPPP");
  });

  it("returns null when not found", async () => {
    const { useCases } = makeUseCases();
    expect(await useCases.findAegisIdByEmail("nope@b.com")).toBeNull();
  });
});
