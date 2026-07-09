/**
 * in-memory-treasury-repository.ts — Treasury Engine
 *
 * KNOWN GAP (see PRODUCTION_BLOCKERS.md): in-process memory only — ledger
 * entries do not survive a restart and are not shared across serverless
 * invocations. This exists so the Phase 1 chain is genuinely runnable and
 * testable today without a Supabase project being provisioned first. Follows
 * the same TreasuryRepository port every other engine's Supabase-backed repo
 * implements, so swapping in `supabase-treasury-repository.ts` later requires
 * zero changes to calling code (same seam pattern as KmsPort in Wallet Vault).
 */
import { v4 as uuidv4 } from "uuid";
import type { TreasuryRepository } from "../application/ports";
import type { TreasuryLedgerEntry, LedgerEntryType } from "../domain/treasury-entities";

export class InMemoryTreasuryRepository implements TreasuryRepository {
  private entries: TreasuryLedgerEntry[] = [];

  async insertLedgerEntry(entry: Omit<TreasuryLedgerEntry, "id" | "createdAt">): Promise<TreasuryLedgerEntry> {
    const full: TreasuryLedgerEntry = { ...entry, id: uuidv4(), createdAt: new Date().toISOString() };
    this.entries.push(full);
    return full;
  }

  async listLedgerEntries(filter: { aegisId?: string; type?: LedgerEntryType; limit?: number }): Promise<TreasuryLedgerEntry[]> {
    let results = this.entries;
    if (filter.aegisId) results = results.filter((e) => e.aegisId === filter.aegisId);
    if (filter.type) results = results.filter((e) => e.type === filter.type);
    results = [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return results.slice(0, filter.limit ?? 50);
  }

  async sumGasSponsorshipLast24h(aegisId: string): Promise<bigint> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.entries
      .filter((e) => e.aegisId === aegisId && e.type === "GAS_SPONSORSHIP" && new Date(e.createdAt).getTime() >= cutoff)
      .reduce((sum, e) => sum + BigInt(e.amountWei), 0n);
  }
}
