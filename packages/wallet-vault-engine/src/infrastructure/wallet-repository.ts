/**
 * wallet-repository.ts — Supabase-backed WalletRepository (Wallet Vault Engine)
 *
 * Touches ONLY this engine's tables: wallets, vault_keys, wallet_states.
 * Shared Supabase project (Rule 2) — no other engine's tables are read or written.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AegisError } from "@cozanethq/aegis-shared-sdk";
import type { WalletRepository } from "../application/wallet-vault-use-cases";
import type { Wallet, WalletState, Blockchain } from "../domain/wallet-entity";
import type { EncryptedMaterial } from "../domain/envelope-crypto";

interface WalletRow {
  id:              string;
  aegis_id:        string;
  blockchain:      Blockchain;
  address:         string;
  is_primary:      boolean;
  derivation_path: string;
  state:           WalletState;
  created_at:      string;
  updated_at:      string;
}

function toWallet(row: WalletRow): Wallet {
  return {
    id:             row.id,
    aegisId:        row.aegis_id,
    blockchain:     row.blockchain,
    address:        row.address,
    isPrimary:      row.is_primary,
    derivationPath: row.derivation_path,
    state:          row.state,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

export class SupabaseWalletRepository implements WalletRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByAegisId(aegisId: string): Promise<Wallet[]> {
    const { data, error } = await this.db
      .from("wallets")
      .select("*")
      .eq("aegis_id", aegisId);
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return (data ?? []).map((row) => toWallet(row as WalletRow));
  }

  async findById(walletId: string): Promise<Wallet | null> {
    const { data, error } = await this.db
      .from("wallets")
      .select("*")
      .eq("id", walletId)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    return data ? toWallet(data as WalletRow) : null;
  }

  async insertWallets(wallets: Omit<Wallet, "id" | "createdAt" | "updatedAt">[]): Promise<Wallet[]> {
    const rows = wallets.map((w) => ({
      aegis_id:        w.aegisId,
      blockchain:      w.blockchain,
      address:         w.address,
      is_primary:      w.isPrimary,
      derivation_path: w.derivationPath,
      state:           w.state,
    }));
    const { data, error } = await this.db.from("wallets").insert(rows).select("*");
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    if (!data) throw new AegisError("INTERNAL_ERROR", "Wallet creation returned no data.");
    return data.map((row) => toWallet(row as WalletRow));
  }

  async storeKeyMaterial(walletId: string, material: EncryptedMaterial): Promise<void> {
    const { error } = await this.db.from("vault_keys").insert({
      wallet_id:          walletId,
      encrypted_material: JSON.stringify({
        ciphertext: material.ciphertext,
        iv:         material.iv,
        authTag:    material.authTag,
      }),
      key_version: material.keyVersion,
      kms_key_ref: material.kmsKeyRef,
    });
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
  }

  async getKeyMaterial(walletId: string): Promise<EncryptedMaterial | null> {
    const { data, error } = await this.db
      .from("vault_keys")
      .select("*")
      .eq("wallet_id", walletId)
      .maybeSingle();
    if (error) throw new AegisError("DATABASE_UNAVAILABLE", error.message);
    if (!data) return null;

    const parsed = JSON.parse(data.encrypted_material) as {
      ciphertext: string;
      iv:         string;
      authTag:    string;
    };
    return {
      ciphertext: parsed.ciphertext,
      iv:         parsed.iv,
      authTag:    parsed.authTag,
      keyVersion: data.key_version,
      kmsKeyRef:  data.kms_key_ref,
    };
  }

  async updateState(
    walletId: string,
    toState: WalletState,
    reason: string,
    actorType: "USER" | "ADMIN" | "SYSTEM",
    actorId?: string
  ): Promise<void> {
    const wallet = await this.findById(walletId);
    if (!wallet) throw new AegisError("WALLET_NOT_FOUND", "Wallet does not exist.", 404);

    const { error: updateError, count } = await this.db
      .from("wallets")
      .update({ state: toState, updated_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", walletId)
      .eq("state", wallet.state); // optimistic lock on current state

    if (updateError) throw new AegisError("DATABASE_UNAVAILABLE", updateError.message);
    if ((count ?? 0) === 0) {
      throw new AegisError(
        "WALLET_INVALID_STATE",
        "State transition failed — wallet was modified concurrently or state mismatch."
      );
    }

    await this.db.from("wallet_states").insert({
      wallet_id:  walletId,
      from_state: wallet.state,
      to_state:   toState,
      reason,
      actor_type: actorType,
      actor_id:   actorId ?? null,
    });
  }
}
