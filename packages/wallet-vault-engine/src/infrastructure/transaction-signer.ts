/**
 * transaction-signer.ts — viem-based signer for EVM chains, stub for TRON (Wallet Vault Engine)
 */
import { privateKeyToAccount } from "viem/accounts";
import { serializeTransaction, type TransactionSerializable } from "viem";
import type { TransactionSigner } from "../application/wallet-vault-use-cases";
import type { Blockchain } from "../domain/wallet-entity";
import { AegisError } from "@cozanethq/aegis-shared-sdk";

export class ViemTransactionSigner implements TransactionSigner {
  async sign(blockchain: Blockchain, privateKeyHex: string, unsignedTx: Record<string, unknown>): Promise<string> {
    if (blockchain === "ETHEREUM" || blockchain === "BNB") {
      const account = privateKeyToAccount(privateKeyHex as `0x${string}`);
      const tx = unsignedTx as unknown as TransactionSerializable;
      return account.signTransaction(tx);
    }

    // TRON signing requires a different transaction format (protobuf-based),
    // out of scope for this MVP pass — flagged as a known gap rather than faked.
    throw new AegisError(
      "SIGNING_NOT_IMPLEMENTED",
      "TRON transaction signing is not yet implemented in the Wallet Vault Engine.",
      501
    );
  }
}
