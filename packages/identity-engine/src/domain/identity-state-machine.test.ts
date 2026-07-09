import { describe, it, expect } from "vitest";
import { IdentityStateMachine } from "./identity-state-machine";

describe("IdentityStateMachine.validate", () => {
  it("rejects a transition to the same state", () => {
    const result = IdentityStateMachine.validate({
      from: "ACTIVE", to: "ACTIVE", actor: "USER", reason: "noop",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Already in state/);
  });

  it("rejects any transition out of the terminal DELETED state", () => {
    const result = IdentityStateMachine.validate({
      from: "DELETED", to: "ACTIVE", actor: "SUPER_ADMIN", reason: "resurrect",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not permitted/);
  });

  it("reports 'no transitions defined' for a state genuinely absent from the matrix", () => {
    // Cast bypasses the type system to simulate a truly unmapped state.
    const result = IdentityStateMachine.validate({
      from: "NOT_A_REAL_STATE" as never, to: "ACTIVE", actor: "SYSTEM", reason: "n/a",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/No transitions defined/);
  });

  it("rejects a transition that isn't in the matrix", () => {
    const result = IdentityStateMachine.validate({
      from: "PENDING_REGISTRATION", to: "SUSPENDED", actor: "SYSTEM", reason: "n/a",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not permitted/);
  });

  it("rejects a valid transition attempted by an unauthorized actor", () => {
    const result = IdentityStateMachine.validate({
      from: "ACTIVE", to: "SUSPENDED", actor: "USER", reason: "self-suspend attempt",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cannot transition/);
  });

  it("allows SYSTEM to move PENDING_REGISTRATION -> EMAIL_VERIFIED", () => {
    const result = IdentityStateMachine.validate({
      from: "PENDING_REGISTRATION", to: "EMAIL_VERIFIED", actor: "SYSTEM", reason: "email confirmed",
    });
    expect(result.valid).toBe(true);
  });

  it("allows USER to self-lock an ACTIVE account", () => {
    const result = IdentityStateMachine.validate({
      from: "ACTIVE", to: "LOCKED", actor: "USER", reason: "suspected compromise",
    });
    expect(result.valid).toBe(true);
  });

  it("allows USER to self-unlock", () => {
    const result = IdentityStateMachine.validate({
      from: "LOCKED", to: "ACTIVE", actor: "USER", reason: "confirmed identity",
    });
    expect(result.valid).toBe(true);
  });

  it("allows ADMIN to move SUSPENDED directly to CLOSED (no forced reactivation)", () => {
    const result = IdentityStateMachine.validate({
      from: "SUSPENDED", to: "CLOSED", actor: "ADMIN", reason: "compliance closure",
    });
    expect(result.valid).toBe(true);
  });

  it("only SUPER_ADMIN can hard-delete an EMAIL_VERIFIED (abandoned) signup", () => {
    const admin = IdentityStateMachine.validate({
      from: "EMAIL_VERIFIED", to: "DELETED", actor: "ADMIN", reason: "cleanup",
    });
    const superAdmin = IdentityStateMachine.validate({
      from: "EMAIL_VERIFIED", to: "DELETED", actor: "SUPER_ADMIN", reason: "cleanup",
    });
    expect(admin.valid).toBe(false);
    expect(superAdmin.valid).toBe(true);
  });
});

describe("IdentityStateMachine.getValidTargets", () => {
  it("returns only states reachable by USER from ACTIVE", () => {
    const targets = IdentityStateMachine.getValidTargets("ACTIVE", "USER");
    expect(targets.sort()).toEqual(["CLOSED", "LOCKED"].sort());
  });

  it("returns empty array for a terminal state", () => {
    expect(IdentityStateMachine.getValidTargets("DELETED", "SUPER_ADMIN")).toEqual([]);
  });
});

describe("IdentityStateMachine.isTerminal", () => {
  it("DELETED is terminal", () => {
    expect(IdentityStateMachine.isTerminal("DELETED")).toBe(true);
  });

  it("CLOSED is NOT terminal (can return to ACTIVE or go to DELETED)", () => {
    expect(IdentityStateMachine.isTerminal("CLOSED")).toBe(false);
  });

  it("ACTIVE is not terminal", () => {
    expect(IdentityStateMachine.isTerminal("ACTIVE")).toBe(false);
  });
});
