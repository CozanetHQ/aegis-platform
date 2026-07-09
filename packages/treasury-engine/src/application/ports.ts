/**
 * ports.ts — Application layer ports (Treasury Engine)
 */
import type { TreasuryLedgerEntry, LedgerEntryType } from "../domain/treasury-entities";

export interface TreasuryRepository {
  insertLedgerEntry(entry: Omit<TreasuryLedgerEntry, "id" | "createdAt">): Promise<TreasuryLedgerEntry>;
  listLedgerEntries(filter: { aegisId?: string; type?: LedgerEntryType; limit?: number }): Promise<TreasuryLedgerEntry[]>;
  /** Sum of GAS_SPONSORSHIP amountWei for this aegisId in the last 24h — used for the daily cap. */
  sumGasSponsorshipLast24h(aegisId: string): Promise<bigint>;
}

export interface ChainClient {
  getNativeBalanceWei(address: string): Promise<bigint>;
  /** Sends `amountWei` of the chain's native token from the treasury hot wallet to `toAddress`.
   *  Returns the broadcast tx hash. */
  sendNativeTopUp(toAddress: string, amountWei: bigint): Promise<string>;
  getTreasuryAddress(): string;
}
