# Testnet Smoke Test — Sign / Broadcast / Confirm

This verifies the highest-risk leg of the Phase 1 execution chain — building
an unsigned tx, signing it (the same `account.signTransaction()` call Wallet
Vault's `ViemTransactionSigner` makes internally), broadcasting the raw
signed tx, and polling for a real confirmed receipt — against real BSC
Testnet (chainId 97), with zero code changes vs. the mainnet-configured path
(only `BSC_CHAIN_ID`/RPC URLs differ).

## Why this and not a full end-to-end run through all deployed engines

Treasury Engine and Swap Engine's `/execute` route are not deployed anywhere
yet (see `../../aegis-architecture/PRODUCTION_BLOCKERS.md`, blocker #5) — no
Vercel project, no Supabase project for Treasury's ledger. A full run through
the Gateway would need all of that provisioned first. What CAN be verified
today, with zero additional infrastructure, is the on-chain mechanics
themselves — which is also the part where a bug is most expensive (a broken
approve/swap encoding or signature would show up here).

## How to run it

1. Generate or reuse a throwaway testnet key. Example generated during this
   session (zero real value, testnet-only, safe to reuse/discard):
   - Address: `0xfC302D01Cab72348B1c6435BD3d6571d454EdFcc`
2. Fund it with free testnet BNB: https://testnet.bnbchain.org/faucet-smart
   (requires a quick human captcha/login step — not something to automate
   against a third party's anti-abuse gate).
3. `cd aegis-swap-engine && node scripts/testnet-smoke-test.mjs <private-key-hex>`

## What it proves / doesn't prove

Proves: legacy-tx construction, viem signing (same code path Wallet Vault
uses), raw broadcast, and receipt polling all work against a real BSC node.

Doesn't prove: the full multi-engine orchestration (that's covered by
`tests/application/execute-swap.test.ts`'s use-case tests with fakes,
5/5 passing), PancakeSwap router calldata specifically (the smoke test does
a plain native transfer, not a router swap, to avoid needing testnet
liquidity pools funded) or Treasury's gas-sponsorship top-up (needs a funded
treasury hot wallet — same faucet constraint as above, times two wallets).

## Status as of 2026-07-08

Not yet run — needs the owner to fund the address above (or a different
throwaway key) via the faucet's human-gated flow, since I can't complete a
captcha on your behalf. Once funded, the script runs in under a minute and
prints a real testnet.bscscan.com link to the confirmed transaction.
