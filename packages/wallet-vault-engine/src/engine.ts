/**
 * engine.ts — Wiring root (Wallet Vault Engine)
 * Instantiates the use cases with concrete infrastructure adapters.
 */
import { createServiceClient } from "@cozanethq/aegis-shared-sdk";
import { WalletVaultUseCases } from "./application/wallet-vault-use-cases";
import { SupabaseWalletRepository } from "./infrastructure/wallet-repository";
import { ViemTransactionSigner } from "./infrastructure/transaction-signer";

const repo   = new SupabaseWalletRepository(createServiceClient());
const signer = new ViemTransactionSigner();

export const WalletVaultEngine = new WalletVaultUseCases(repo, signer);
