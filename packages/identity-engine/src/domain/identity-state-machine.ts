/**
 * identity-state-machine.ts — AEGIS Identity Engine · Domain Layer
 *
 * Pure TypeScript. Zero imports. Zero framework dependencies.
 * This file must compile standalone with just the TypeScript compiler.
 *
 * The state machine is the single source of truth for identity lifecycle.
 * Every transition is validated here — before any DB write, always.
 *
 * FIX 1: CLOSED → ACTIVE re-activation path added for USER self-close undo.
 *   Previously only admins could reactivate, but lockAccount allowed USER
 *   to trigger LOCKED → ACTIVE, creating an inconsistency.
 *
 * FIX 2: USER can now self-lock (e.g. "freeze my account") and self-unlock.
 *   This aligns with the use-case where a user suspects compromise.
 *
 * FIX 3: SUSPENDED → CLOSED path added — admins can fully close a suspended
 *   account without needing to reactivate it first (unnecessary roundtrip).
 *
 * FIX 4: isTerminal() now correctly identifies CLOSED as non-terminal
 *   (it has transitions to ACTIVE and DELETED).
 */

export type IdentityState =
  | "PENDING_REGISTRATION"
  | "EMAIL_VERIFIED"
  | "ACTIVE"
  | "SUSPENDED"
  | "LOCKED"
  | "CLOSED"
  | "DELETED";

export type ActorType =
  | "SYSTEM"
  | "USER"
  | "ADMIN"
  | "SUPER_ADMIN";

export interface TransitionRequest {
  from:   IdentityState;
  to:     IdentityState;
  actor:  ActorType;
  reason: string;
}

export interface TransitionResult {
  valid:   boolean;
  error?:  string;
}

/**
 * Valid transition matrix.
 * Key: from-state. Value: map of to-state → permitted actors.
 */
const TRANSITIONS: Readonly<
  Partial<Record<IdentityState, Partial<Record<IdentityState, readonly ActorType[]>>>>
> = {
  PENDING_REGISTRATION: {
    EMAIL_VERIFIED: ["SYSTEM"],
  },
  EMAIL_VERIFIED: {
    ACTIVE:  ["SYSTEM"],
    DELETED: ["SUPER_ADMIN"],  // FIX: allow hard purge of abandoned signups
  },
  ACTIVE: {
    SUSPENDED: ["ADMIN", "SUPER_ADMIN"],
    LOCKED:    ["SYSTEM", "USER", "ADMIN", "SUPER_ADMIN"],  // FIX: USER can self-lock
    CLOSED:    ["USER", "ADMIN", "SUPER_ADMIN"],
    DELETED:   ["SUPER_ADMIN"],
  },
  SUSPENDED: {
    ACTIVE:  ["ADMIN", "SUPER_ADMIN"],
    LOCKED:  ["ADMIN", "SUPER_ADMIN"],
    CLOSED:  ["ADMIN", "SUPER_ADMIN"],     // FIX: don't force reactivate before closing
    DELETED: ["SUPER_ADMIN"],
  },
  LOCKED: {
    ACTIVE:  ["USER", "ADMIN", "SUPER_ADMIN"],  // FIX: USER can self-unlock
    DELETED: ["SUPER_ADMIN"],
  },
  CLOSED: {
    ACTIVE:  ["USER", "ADMIN", "SUPER_ADMIN"],  // FIX: USER self-close undo window
    DELETED: ["SYSTEM", "SUPER_ADMIN"],
  },
  DELETED: {
    // Terminal — no transitions out
  },
} as const;

export class IdentityStateMachine {
  /** Validate a proposed transition. Never mutates state. */
  static validate(req: TransitionRequest): TransitionResult {
    if (req.from === req.to) {
      return { valid: false, error: `Already in state ${req.from}` };
    }

    const targets = TRANSITIONS[req.from];
    if (!targets) {
      return { valid: false, error: `No transitions defined from ${req.from}` };
    }

    const permitted = targets[req.to];
    if (!permitted) {
      return {
        valid: false,
        error: `Transition ${req.from} → ${req.to} is not permitted`,
      };
    }

    if (!(permitted as readonly string[]).includes(req.actor)) {
      return {
        valid: false,
        error: `Actor '${req.actor}' cannot transition ${req.from} → ${req.to}`,
      };
    }

    return { valid: true };
  }

  /** All valid target states for a given current state and actor. */
  static getValidTargets(from: IdentityState, actor: ActorType): IdentityState[] {
    const targets = TRANSITIONS[from] ?? {};
    return (Object.entries(targets) as [IdentityState, readonly ActorType[]][])
      .filter(([, actors]) => (actors as readonly string[]).includes(actor))
      .map(([state]) => state);
  }

  /** Returns true if the state is terminal — no further transitions possible. */
  static isTerminal(state: IdentityState): boolean {
    const targets = TRANSITIONS[state];
    return !targets || Object.keys(targets).length === 0;
  }
}
