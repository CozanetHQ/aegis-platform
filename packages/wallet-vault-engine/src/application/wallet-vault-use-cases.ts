/**
 * wallet-vault-use-cases.ts — Application layer (Wallet Vault Engine)
 */
import { AegisError } from "@cozanethq/aegis-shared-sdk";
import {
  type Wallet,
  type Blockchain,
  type WalletState,
  SUPPORTED_BLOCKCHAINS,
  PRIMARY_BLOCKCHAIN,
  canTransition,
  isSignable,
} from "../domain/wallet-entity";
import { deriveWallet, derivationPathFor } from "../domain/hd-derivation";
import { EnvelopeAesGcmKms, type KmsPort, type EncryptedMaterial } from "../domain/envelope-crypto";

// ── Ports ────────────────────────────────────────────────────────────────────

export interface WalletRepository {
  findByAegisId(aegisId: string): Promise<Wallet[]>;
  findById(walletId: string): Promise<Wallet | null>;
  insertWallets(wallets: Omit<Wallet, "id" | "createdAt" | "updatedAt">[]): Promise<Wallet[]>;
  storeKeyMaterial(walletId: string, material: EncryptedMaterial): Promise<void>;
  getKeyMaterial(walletId: string): Promise<EncryptedMaterial | null>;
  updateState(walletId: string, toState: WalletState, reason: string, actorType: "USER" | "ADMIN" | "SYSTEM", actorId?: string): Promise<void>;
}

export interface TransactionSigner {
  /** Signs a raw unsigned tx payload with the given private key, for the given chain. */
  sign(blockchain: Blockchain, privateKeyHex: string, unsignedTx: Record<string, unknown>): Promise<string>;
}

// ── Use cases ────────────────────────────────────────────────────────────────

export class WalletVaultUseCases {
  private readonly kms: KmsPort;

  constructor(
    private readonly repo:   WalletRepository,
    private readonly signer: TransactionSigner,
    kms?: KmsPort
  ) {
    this.kms = kms ?? new EnvelopeAesGcmKms();
  }

  /**
   * Called once by Identity Engine during onboarding. Generates one wallet
   * per supported blockchain for the given aegisId. Idempotent — if wallets
   * already exist for this aegisId, returns them unchanged rather than
   * generating duplicates.
   */
  async generateWalletsForIdentity(aegisId: string): Promise<Wallet[]> {
    const existing = await this.repo.findByAegisId(aegisId);
    if (existing.length > 0) {
      // BUGFIX 2026-07-04: previously returned existing wallets unconditionally.
      // If a prior generation run inserted the wallet rows but failed partway
      // through storing key material (no cross-table transaction between
      // insertWallets and the storeKeyMaterial loop below), this idempotency
      // check would silently hand back a wallet that can never sign — and
      // since it "already exists", every future call would keep returning it
      // broken forever with no repair path. Now self-heals: re-derives and
      // stores key material for any existing wallet that's missing it.
      await this._repairMissingKeyMaterial(aegisId, existing);
      return existing;
    }

    const toInsert: Omit<Wallet, "id" | "createdAt" | "updatedAt">[] = [];
    const keyMaterialByAddress: Record<string, string> = {};

    for (const blockchain of SUPPORTED_BLOCKCHAINS) {
      const { address, privateKeyHex } = deriveWallet(aegisId, blockchain);
      toInsert.push({
        aegisId,
        blockchain,
        address,
        // BUGFIX 2026-07-04: every blockchain was being marked isPrimary:
        // true — there was no single primary wallet per identity, just every
        // row set to true. Only PRIMARY_BLOCKCHAIN is primary; the rest are
        // explicitly secondary. (Confirmed live in production: all 9 existing
        // wallet rows had is_primary=true — see backfill migration.)
        isPrimary:      blockchain === PRIMARY_BLOCKCHAIN,
        derivationPath: derivationPathFor(aegisId, blockchain),
        state:          "ACTIVE",
      });
      keyMaterialByAddress[`${blockchain}:${address}`] = privateKeyHex;
    }

    const inserted = await this.repo.insertWallets(toInsert);

    for (const wallet of inserted) {
      const privateKeyHex = keyMaterialByAddress[`${wallet.blockchain}:${wallet.address}`];
      const encrypted = await this.kms.encrypt(privateKeyHex);
      await this.repo.storeKeyMaterial(wallet.id, encrypted);
    }

    return inserted;
  }

  /** Re-derives (from the deterministic HD root — never re-persists a new
   * address, only re-encrypts and stores the key material) and stores key
   * material for any wallet that's missing it. Deterministic derivation means
   * this is safe to run repeatedly and cannot change an existing address. */
  private async _repairMissingKeyMaterial(aegisId: string, wallets: Wallet[]): Promise<void> {
    for (const wallet of wallets) {
      const existingMaterial = await this.repo.getKeyMaterial(wallet.id);
      if (existingMaterial) continue;

      const { address, privateKeyHex } = deriveWallet(aegisId, wallet.blockchain);
      if (address !== wallet.address) {
        // Should be impossible (derivation is deterministic on aegisId+blockchain
        // alone) — if it ever happens, something is more seriously wrong than a
        // missing key, so don't silently store a key for a mismatched address.
        throw new AegisError(
          "INTERNAL_ERROR",
          `Re-derived address for wallet ${wallet.id} does not match stored address — refusing to repair.`,
          500
        );
      }
      const encrypted = await this.kms.encrypt(privateKeyHex);
      await this.repo.storeKeyMaterial(wallet.id, encrypted);
    }
  }

  /** Public wallet info only — never key material. Called by Identity/Transfer/Payment engines. */
  async getWallets(aegisId: string): Promise<Wallet[]> {
    return this.repo.findByAegisId(aegisId);
  }

  /**
   * Signs an unsigned transaction for a given wallet. Called by Transfer Engine.
   * Enforces: wallet must exist, must belong to the claimed aegisId (ownership
   * guard), and must be in ACTIVE state.
   */
  async signTransaction(
    walletId: string,
    requestingAegisId: string,
    unsignedTx: Record<string, unknown>
  ): Promise<string> {
    const wallet = await this.repo.findById(walletId);
    if (!wallet) {
      throw new AegisError("WALLET_NOT_FOUND", "Wallet does not exist.", 404);
    }
    if (wallet.aegisId !== requestingAegisId) {
      throw new AegisError("WALLET_OWNERSHIP_MISMATCH", "Wallet does not belong to the requesting identity.", 403);
    }
    if (!isSignable(wallet.state)) {
      throw new AegisError("WALLET_NOT_SIGNABLE", `Wallet is ${wallet.state}, cannot sign transactions.`, 409);
    }

    const material = await this.repo.getKeyMaterial(walletId);
    if (!material) {
      throw new AegisError("INTERNAL_ERROR", "Key material missing for wallet.", 500);
    }
    const privateKeyHex = await this.kms.decrypt(material);

    return this.signer.sign(wallet.blockchain, privateKeyHex, unsignedTx);
  }

  async freezeWallet(walletId: string, reason: string, actorId?: string): Promise<void> {
    await this.transition(walletId, "FROZEN", reason, "ADMIN", actorId);
  }

  async unfreezeWallet(walletId: string, reason: string, actorId?: string): Promise<void> {
    await this.transition(walletId, "ACTIVE", reason, "ADMIN", actorId);
  }

  async deprecateWallet(walletId: string, reason: string, actorId?: string): Promise<void> {
    await this.transition(walletId, "DEPRECATED", reason, "ADMIN", actorId);
  }

  private async transition(
    walletId: string,
    toState: WalletState,
    reason: string,
    actorType: "USER" | "ADMIN" | "SYSTEM",
    actorId?: string
  ): Promise<void> {
    const wallet = await this.repo.findById(walletId);
    if (!wallet) {
      throw new AegisError("WALLET_NOT_FOUND", "Wallet does not exist.", 404);
    }
    if (!canTransition(wallet.state, toState)) {
      throw new AegisError(
        "WALLET_INVALID_STATE",
        `Cannot transition wallet from ${wallet.state} to ${toState}.`,
        409
      );
    }
    await this.repo.updateState(walletId, toState, reason, actorType, actorId);
  }
}
