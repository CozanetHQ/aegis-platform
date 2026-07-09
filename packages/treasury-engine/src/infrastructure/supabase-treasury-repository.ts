/**
 * supabase-treasury-repository.ts — Treasury Engine
 *
 * Real persistence, replacing in-memory-treasury-repository.ts (Phase 1
 * blocker #4 closed 2026-07-08). Talks to the shared Aegis Supabase project's
 * `treasury.ledger_entries` table via the service role client (Rule 2 — one
 * shared project, this engine only touches its own `treasury.*` schema).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TreasuryRepository } from "../application/ports";
import type { TreasuryLedgerEntry, LedgerEntryType } from "../domain/treasury-entities";

export class SupabaseTreasuryRepository implements TreasuryRepository {
  private client: SupabaseClient<any, "treasury", any>;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: "treasury" },
      auth: { persistSession: false },
    });
  }

  async insertLedgerEntry(entry: Omit<TreasuryLedgerEntry, "id" | "createdAt">): Promise<TreasuryLedgerEntry> {
    const { data, error } = await this.client
      .from("ledger_entries")
      .insert({
        type: entry.type,
        aegis_id: entry.aegisId,
        chain: entry.chain,
        correlation_id: entry.correlationId,
        amount_wei: entry.amountWei,
        tx_hash: entry.txHash ?? null,
        metadata: entry.metadata ?? {},
      })
      .select()
      .single();

    if (error) throw new Error(`SupabaseTreasuryRepository.insertLedgerEntry failed: ${error.message}`);
    return this.toDomain(data);
  }

  async listLedgerEntries(filter: { aegisId?: string; type?: LedgerEntryType; limit?: number }): Promise<TreasuryLedgerEntry[]> {
    let query = this.client.from("ledger_entries").select("*").order("created_at", { ascending: false }).limit(filter.limit ?? 50);
    if (filter.aegisId) query = query.eq("aegis_id", filter.aegisId);
    if (filter.type) query = query.eq("type", filter.type);

    const { data, error } = await query;
    if (error) throw new Error(`SupabaseTreasuryRepository.listLedgerEntries failed: ${error.message}`);
    return (data ?? []).map((row) => this.toDomain(row));
  }

  async sumGasSponsorshipLast24h(aegisId: string): Promise<bigint> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.client
      .from("ledger_entries")
      .select("amount_wei")
      .eq("aegis_id", aegisId)
      .eq("type", "GAS_SPONSORSHIP")
      .gte("created_at", cutoff);

    if (error) throw new Error(`SupabaseTreasuryRepository.sumGasSponsorshipLast24h failed: ${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + BigInt(row.amount_wei), 0n);
  }

  private toDomain(row: any): TreasuryLedgerEntry {
    return {
      id: row.id,
      type: row.type,
      aegisId: row.aegis_id,
      chain: row.chain,
      correlationId: row.correlation_id,
      amountWei: row.amount_wei.toString(),
      txHash: row.tx_hash,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  }
}
