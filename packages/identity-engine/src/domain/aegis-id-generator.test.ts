import { describe, it, expect } from "vitest";
import { AegisIdGenerator } from "./aegis-id-generator";

describe("AegisIdGenerator.generate", () => {
  it("produces an ID matching the AEG-XXXXXXXX format", () => {
    const id = AegisIdGenerator.generate();
    expect(id).toMatch(/^AEG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it("never includes confusable characters 0, O, I, 1", () => {
    for (let i = 0; i < 200; i++) {
      const id = AegisIdGenerator.generate();
      expect(id).not.toMatch(/[0OI1]/);
    }
  });

  it("generates distinct IDs across many calls (no obvious collisions)", () => {
    const ids = new Set(Array.from({ length: 500 }, () => AegisIdGenerator.generate()));
    expect(ids.size).toBe(500);
  });
});

describe("AegisIdGenerator.isValid", () => {
  it("accepts a well-formed ID", () => {
    expect(AegisIdGenerator.isValid("AEG-ABCDEFGH")).toBe(true);
  });

  it("rejects an ID that's too short (old 6-char format)", () => {
    expect(AegisIdGenerator.isValid("AEG-ABCDEF")).toBe(false);
  });

  it("rejects an ID with confusable characters", () => {
    expect(AegisIdGenerator.isValid("AEG-0OI1ABCD")).toBe(false);
  });

  it("rejects an ID missing the prefix", () => {
    expect(AegisIdGenerator.isValid("ABCDEFGH")).toBe(false);
  });

  it("rejects lowercase", () => {
    expect(AegisIdGenerator.isValid("AEG-abcdefgh")).toBe(false);
  });
});

describe("AegisIdGenerator.generateUnique", () => {
  it("returns the first generated ID when it does not already exist", async () => {
    const id = await AegisIdGenerator.generateUnique(async () => false);
    expect(AegisIdGenerator.isValid(id)).toBe(true);
  });

  it("retries on collision until a free ID is found", async () => {
    let calls = 0;
    const id = await AegisIdGenerator.generateUnique(async () => {
      calls += 1;
      return calls < 3; // first two calls report "exists", third is free
    });
    expect(calls).toBe(3);
    expect(AegisIdGenerator.isValid(id)).toBe(true);
  });

  it("throws after exhausting maxRetries when every ID collides", async () => {
    await expect(
      AegisIdGenerator.generateUnique(async () => true, 3)
    ).rejects.toThrow(/after 3 attempts/);
  });
});
