/**
 * identity-entity.ts — AEGIS Identity Engine · Domain Layer
 *
 * Pure domain types. No imports from infrastructure, database, or frameworks.
 * These types define what Identity means to the Aegis platform.
 */
import type { IdentityState } from "./identity-state-machine";

export type AccountType =
  | "INDIVIDUAL"
  | "BUSINESS"
  | "ORGANIZATION"
  | "DEVELOPER"
  | "MERCHANT"
  | "SUBSCRIPTION"
  | "AI_ASSISTANT";

/** The immutable kernel identity record. */
export interface Identity {
  /** Internal UUID — never exposed to API clients */
  id:              string;
  /** AEG-XXXXXX — public, permanent, immutable */
  aegisId:         string;
  /** Supabase Auth UUID — immutable after creation */
  authProviderId:  string;
  /** Permanent email — immutable */
  email:           string;
  emailVerifiedAt: Date | null;
  state:           IdentityState;
  accountType:     AccountType;
  createdAt:       Date;
  updatedAt:       Date;
}

/** Mutable profile data owned by the Identity Engine */
export interface UserProfile {
  id:           string;
  identityId:   string;
  fullName:     string | null;
  username:     string | null;
  countryCode:  string | null;
  languageCode: string;
  avatarUrl:    string | null;
  preferences:  Record<string, unknown>;
  createdAt:    Date;
  updatedAt:    Date;
}

/** Wallet-to-identity binding — owned by Identity Engine, written by Wallet Vault */
export interface WalletMapping {
  id:            string;
  identityId:    string;
  walletVaultId: string;
  blockchain:    "BNB" | "ETHEREUM" | "TRON";
  address:       string;
  isPrimary:     boolean;
  createdAt:     Date;
}

/** Recovery factors — lockout tracking */
export interface RecoveryStatus {
  id:                      string;
  identityId:              string;
  hasAuthenticator:        boolean;
  lastRecoveryAttemptAt:   Date | null;
  recoveryLockoutUntil:    Date | null;
  failedRecoveryAttempts:  number;
}

/** Full identity card — owner view only */
export interface IdentityCard {
  aegisId:         string;
  email:           string;
  state:           IdentityState;
  accountType:     AccountType;
  emailVerifiedAt: Date | null;
  profile:         UserProfile | null;
  wallets:         WalletMapping[];
  createdAt:       Date;
}

/** Compact public card — safe for unauthenticated callers */
export interface PublicIdentityCard {
  aegisId:     string;
  username:    string | null;
  fullName:    string | null;
  accountType: AccountType;
  state:       IdentityState;
  createdAt:   Date;
}

/** A single entry in the state transition audit trail */
export interface StateTransitionRecord {
  id:        string;
  fromState: IdentityState;
  toState:   IdentityState;
  reason:    string;
  actorType: string;
  actorId:   string | null;
  createdAt: Date;
}
