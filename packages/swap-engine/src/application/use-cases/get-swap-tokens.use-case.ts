/**
 * get-swap-tokens.use-case.ts — Payment Engine · Application Layer
 *
 * Curated, verified list of BSC tokens supported for on-chain swaps via
 * PancakeSwap V2. Deliberately NOT reusing Market Engine's
 * get-token-metadata TOKEN_REGISTRY — that registry has placeholder/fake
 * contract addresses for several tokens (including CZN itself:
 * "0xczn_token_address", which isn't a real address). Addresses here are
 * taken from Market Engine's pancakeswap.provider.ts, which is already
 * live in production pricing CZN correctly.
 */
export interface SwapToken {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

const SWAP_TOKENS: SwapToken[] = [
  { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "BNB", decimals: 18, name: "BNB (Wrapped)" },
  { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18, name: "Tether USD" },
  { address: "0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA", symbol: "CZN", decimals: 9, name: "Cozy Network" },
];

export class GetSwapTokensUseCase {
  async execute(): Promise<SwapToken[]> {
    return SWAP_TOKENS;
  }
}
