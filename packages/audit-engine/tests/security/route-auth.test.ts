import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression guard for the auth-bypass bug fixed in this PR: every GET/POST
 * route in this engine (other than the engine-to-engine API-key route)
 * previously only checked `Authorization?.startsWith("Bearer ")` — true for
 * literally any string, with zero JWT verification and zero role check.
 * See docs/CONTRACT_AUDIT.md.
 *
 * This test is intentionally static (reads route source, not HTTP
 * behavior) — reaching for a real request would need a Supabase-JWT mock
 * per route. Cheap and effective at stopping a regression back to the
 * hand-rolled prefix check, which is the actual way this bug was
 * introduced/missed.
 */
const root = join(__dirname, "..", "..", "src", "app", "api", "v1");

const adminRoutes = [
  "events/route.ts",
  "events/[id]/route.ts",
  "history/admins/[adminId]/route.ts",
  "history/correlations/[correlationId]/route.ts",
  "history/wallets/[walletId]/route.ts",
  "investigations/route.ts",
  "investigations/[id]/route.ts",
  "recent/route.ts",
  "statistics/route.ts",
  "statistics/engines/route.ts",
  "timeline/route.ts",
  "exports/route.ts",
];

const selfOrAdminRoutes = ["history/users/[userId]/route.ts"];

describe("audit engine route auth (regression guard)", () => {
  for (const rel of adminRoutes) {
    it(`${rel} calls requireAdmin() and never the old Bearer-prefix check`, () => {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toMatch(/requireAdmin\(request\)/);
      expect(src).not.toMatch(/startsWith\(["']Bearer/);
    });
  }

  for (const rel of selfOrAdminRoutes) {
    it(`${rel} calls requireAuth() with an explicit self-or-admin check`, () => {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toMatch(/requireAuth\(request\)/);
      expect(src).toMatch(/isSelf/);
      expect(src).toMatch(/isAdmin/);
      expect(src).not.toMatch(/startsWith\(["']Bearer/);
    });
  }

  it("POST /events keeps engine-to-engine API-key auth (not user auth)", () => {
    const src = readFileSync(join(root, "events", "route.ts"), "utf8");
    expect(src).toMatch(/x-audit-api-key/);
    expect(src).toMatch(/AUDIT_ENGINE_API_KEY/);
  });
});
