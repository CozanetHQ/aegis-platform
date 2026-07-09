/**
 * index.ts — AEGIS Identity Engine · Public Interface
 *
 * This is the ONLY file other engines may import from the Identity Engine.
 *
 * UPDATED: Wallet Vault client selection:
 *   - HttpWalletVaultClient used when WALLET_VAULT_API_KEY is set (production)
 *   - LocalWalletVaultClient used as fallback (dev/test only — no real keys)
 */
import { IdentityUseCases }                          from "./application/identity-use-cases";
import { SupabaseIdentityRepository }               from "./infrastructure/identity-repository";
import { LocalWalletVaultClient, HttpWalletVaultClient } from "./infrastructure/wallet-vault-client";
import { UpstashRateLimiter }                       from "./infrastructure/rate-limiter";
import { NotificationClient }                       from "./infrastructure/notification-client";

export type {
  IdentityCard,
  PublicIdentityCard,
  WalletMapping,
  StateTransitionRecord,
} from "./domain/identity-entity";
export type { IdentityState } from "./domain/identity-state-machine";
export type {
  RecipientResolution,
  RecipientRejection,
} from "./application/identity-use-cases";

export function isRecipientResolved(
  r: import("./application/identity-use-cases").RecipientResolution
    | import("./application/identity-use-cases").RecipientRejection
): r is import("./application/identity-use-cases").RecipientResolution {
  return "identityId" in r;
}

let _engine: IdentityUseCases | null = null;

function getEngine(): IdentityUseCases {
  if (!_engine) {
    // Use real Wallet Vault HTTP client when API key is configured
    const walletVaultClient = process.env.WALLET_VAULT_API_KEY
      ? new HttpWalletVaultClient()
      : new LocalWalletVaultClient();

    _engine = new IdentityUseCases(
      new SupabaseIdentityRepository(),
      walletVaultClient,
      new UpstashRateLimiter(),
      new NotificationClient()
    );
  }
  return _engine;
}

export const IdentityEngine = {
  createIdentity:     (...args: Parameters<IdentityUseCases["createIdentity"]>)     => getEngine().createIdentity(...args),
  verifyEmail:        (...args: Parameters<IdentityUseCases["verifyEmail"]>)          => getEngine().verifyEmail(...args),
  sendVerificationCode: (...args: Parameters<IdentityUseCases["sendVerificationCode"]>) => getEngine().sendVerificationCode(...args),
  completeOnboarding: (...args: Parameters<IdentityUseCases["completeOnboarding"]>)  => getEngine().completeOnboarding(...args),
  getMyCard:          (...args: Parameters<IdentityUseCases["getMyCard"]>)            => getEngine().getMyCard(...args),
  getPublicCard:      (...args: Parameters<IdentityUseCases["getPublicCard"]>)        => getEngine().getPublicCard(...args),
  updateProfile:      (...args: Parameters<IdentityUseCases["updateProfile"]>)        => getEngine().updateProfile(...args),
  closeAccount:       (...args: Parameters<IdentityUseCases["closeAccount"]>)         => getEngine().closeAccount(...args),
  selfLock:           (...args: Parameters<IdentityUseCases["selfLock"]>)             => getEngine().selfLock(...args),
  selfUnlock:         (...args: Parameters<IdentityUseCases["selfUnlock"]>)           => getEngine().selfUnlock(...args),
  suspendAccount:     (...args: Parameters<IdentityUseCases["suspendAccount"]>)       => getEngine().suspendAccount(...args),
  lockAccount:        (...args: Parameters<IdentityUseCases["lockAccount"]>)          => getEngine().lockAccount(...args),
  unlockAccount:      (...args: Parameters<IdentityUseCases["unlockAccount"]>)        => getEngine().unlockAccount(...args),
  reactivateAccount:  (...args: Parameters<IdentityUseCases["reactivateAccount"]>)   => getEngine().reactivateAccount(...args),
  getAuditTrail:      (...args: Parameters<IdentityUseCases["getAuditTrail"]>)        => getEngine().getAuditTrail(...args),
  resolveRecipient:   (...args: Parameters<IdentityUseCases["resolveRecipient"]>)     => getEngine().resolveRecipient(...args),
  findAegisIdByEmail: (...args: Parameters<IdentityUseCases["findAegisIdByEmail"]>) => getEngine().findAegisIdByEmail(...args),
} as const;
