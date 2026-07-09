/**
 * engine.ts — AEGIS Swap Engine · Public Interface
 *
 * The ONLY file other engines or API routes may import.
 *
 * Phase 1 (pre-existing): read-only PancakeSwap V2 quoting.
 * Phase 2 (added 2026-07-08): swap EXECUTION — signing and broadcasting the
 * trade via its own validate -> wallet-auth -> treasury-fee -> gas-sponsor ->
 * sign -> broadcast -> confirm chain, using its own WALLET_VAULT_API_KEY_SWAP
 * credential (per-engine-credential convention Transfer Engine established).
 */
import { GetSwapTokensUseCase } from "./application/use-cases/get-swap-tokens.use-case";
import { GetSwapQuoteUseCase } from "./application/use-cases/get-swap-quote.use-case";
import { ExecuteSwapUseCase, type ExecuteSwapInput } from "./application/use-cases/execute-swap.use-case";
import { PancakeSwapSwapProvider } from "./infrastructure/providers/pancakeswap-swap.provider";
import { PancakeSwapExecuteProvider } from "./infrastructure/providers/pancakeswap-execute.provider";
import { HttpWalletVaultClient, HttpTreasuryClient, HttpAuditClient, HttpNotificationClient, HttpPortfolioClient } from "./infrastructure/clients/http-engine-clients";

let _swapProvider: PancakeSwapSwapProvider | null = null;
function getSwapProvider(): PancakeSwapSwapProvider {
  return _swapProvider ??= new PancakeSwapSwapProvider();
}

let _executeUseCase: ExecuteSwapUseCase | null = null;
function getExecuteUseCase(): ExecuteSwapUseCase {
  if (_executeUseCase) return _executeUseCase;
  _executeUseCase = new ExecuteSwapUseCase(
    new HttpWalletVaultClient(process.env.WALLET_VAULT_ENGINE_URL ?? "", process.env.WALLET_VAULT_API_KEY_SWAP ?? ""),
    new HttpTreasuryClient(process.env.TREASURY_ENGINE_URL ?? "", process.env.TREASURY_ENGINE_API_KEY ?? ""),
    new HttpAuditClient(process.env.AUDIT_ENGINE_URL ?? "", process.env.AUDIT_ENGINE_API_KEY ?? ""),
    new HttpNotificationClient(process.env.NOTIFICATION_ENGINE_URL ?? "", process.env.NOTIFICATION_ENGINE_API_KEY ?? ""),
    new HttpPortfolioClient(process.env.PORTFOLIO_ENGINE_URL ?? ""),
    new PancakeSwapExecuteProvider(),
  );
  return _executeUseCase;
}

export const SwapEngine = {
  getSwapTokens: () =>
    new GetSwapTokensUseCase().execute(),

  getSwapQuote: (input: Parameters<GetSwapQuoteUseCase["execute"]>[0]) =>
    new GetSwapQuoteUseCase(getSwapProvider()).execute(input),

  executeSwap: (input: ExecuteSwapInput) =>
    getExecuteUseCase().execute(input),
} as const;
