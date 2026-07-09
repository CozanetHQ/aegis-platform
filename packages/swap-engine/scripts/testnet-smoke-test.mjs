/**
 * testnet-smoke-test.mjs — Real on-chain smoke test for the signing/
 * broadcast/confirm leg of the Phase 1 execution chain, run directly
 * against BSC Testnet (chainId 97) — no Supabase, no Vercel, no other
 * engine deployment required. This is what PRODUCTION_BLOCKERS.md /
 * docs/TESTNET_SMOKE_TEST.md refer to as "verified for real."
 *
 * Usage:
 *   node scripts/testnet-smoke-test.mjs <funded-testnet-private-key-hex>
 *
 * The address for that private key must hold a small amount of tBNB
 * (get some free from https://testnet.bnbchain.org/faucet-smart).
 * This script sends a tiny native transfer to itself (round-trips funds
 * back to the same address) to prove: build unsigned legacy tx -> sign
 * with viem (same signer class Wallet Vault uses) -> broadcast raw tx to
 * a real testnet RPC -> poll for a real confirmed receipt.
 */
import { createPublicClient, createWalletClient, http, fallback } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const TESTNET_RPCS = [
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://bsc-testnet.publicnode.com",
];
const chain = {
  id: 97,
  name: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "BNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: { default: { http: TESTNET_RPCS }, public: { http: TESTNET_RPCS } },
};

async function main() {
  const pk = process.argv[2];
  if (!pk) {
    console.error("Usage: node scripts/testnet-smoke-test.mjs <funded-testnet-private-key-hex>");
    process.exit(1);
  }
  const account = privateKeyToAccount(pk);
  console.log("Testnet address:", account.address);

  const publicClient = createPublicClient({ chain, transport: fallback(TESTNET_RPCS.map((u) => http(u, { timeout: 10_000 }))) });
  const walletClient = createWalletClient({ chain, account, transport: fallback(TESTNET_RPCS.map((u) => http(u, { timeout: 10_000 }))) });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance (wei):", balance.toString());
  if (balance === 0n) {
    console.error("Address has 0 tBNB. Fund it at https://testnet.bnbchain.org/faucet-smart and re-run.");
    process.exit(1);
  }

  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  const gasPrice = await publicClient.getGasPrice();
  const unsignedTx = {
    type: "legacy", chainId: chain.id, nonce, gasPrice, gas: 21_000n,
    to: account.address, value: 1n, // send 1 wei to self — smallest possible real transfer
  };
  console.log("Unsigned tx:", unsignedTx);

  // This is the exact call Wallet Vault's ViemTransactionSigner.sign() makes internally.
  const signedTx = await account.signTransaction(unsignedTx);
  console.log("Signed tx (first 40 chars):", signedTx.slice(0, 40) + "...");

  const txHash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx });
  console.log("Broadcast tx hash:", txHash);

  console.log("Waiting for confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  console.log("Confirmed. Status:", receipt.status, "Block:", receipt.blockNumber.toString());
  console.log(`View: https://testnet.bscscan.com/tx/${txHash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
