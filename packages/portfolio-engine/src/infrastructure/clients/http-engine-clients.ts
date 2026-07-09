/**
 * HTTP clients for communicating with other AEGIS engines.
 * All communication is via HTTP — never direct imports.
 */

import {
  WalletVaultClientPort,
  TransferClientPort,
  MarketClientPort,
  PaymentClientPort,
  WalletVaultWallet,
  WalletVaultBalance,
  TransferRecord,
  TransferPreviewResult,
  PriceData,
  PaymentPreviewResult,
} from '../../application/ports/engine-clients.port';

async function fetchJson(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error?.error?.message ?? `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * HTTP client for the Wallet Vault Engine.
 */
export class HttpWalletVaultClient implements WalletVaultClientPort {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async getWallets(userId: string): Promise<WalletVaultWallet[]> {
    try {
      const data = await fetchJson(`${this.baseUrl}/api/v1/wallets`, {
        headers: { 'X-Wallet-API-Key': this.apiKey, 'X-User-Id': userId },
      });
      const wallets = data?.data ?? [];
      return Array.isArray(wallets) ? wallets : [wallets];
    } catch {
      return [];
    }
  }

  async getWallet(walletId: string): Promise<WalletVaultWallet | null> {
    try {
      const data = await fetchJson(`${this.baseUrl}/api/v1/wallets/${walletId}`, {
        headers: { 'X-Wallet-API-Key': this.apiKey },
      });
      return data?.data ?? null;
    } catch {
      return null;
    }
  }

  async getWalletBalances(walletId: string): Promise<WalletVaultBalance[]> {
    try {
      const data = await fetchJson(`${this.baseUrl}/api/v1/wallets/${walletId}/balances`, {
        headers: { 'X-Wallet-API-Key': this.apiKey },
      });
      const balances = data?.data ?? [];
      return Array.isArray(balances) ? balances : [balances];
    } catch {
      return [];
    }
  }
}

/**
 * HTTP client for the Transfer Engine.
 */
export class HttpTransferClient implements TransferClientPort {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async getRecentTransfers(userId: string, limit: number): Promise<TransferRecord[]> {
    try {
      const data = await fetchJson(`${this.baseUrl}/api/v1/transfers?limit=${limit}`, {
        headers: { 'X-Transfer-API-Key': this.apiKey, 'X-User-Id': userId },
      });
      const transfers = data?.data ?? [];
      return Array.isArray(transfers) ? transfers : [transfers];
    } catch {
      return [];
    }
  }

  async getPendingTransfers(userId: string): Promise<TransferRecord[]> {
    try {
      const data = await fetchJson(`${this.baseUrl}/api/v1/transfers?status=pending`, {
        headers: { 'X-Transfer-API-Key': this.apiKey, 'X-User-Id': userId },
      });
      return data?.data ?? [];
    } catch {
      return [];
    }
  }

  async previewTransfer(walletId: string, amount: string, token: string, chain: string): Promise<TransferPreviewResult> {
    try {
      const data = await fetchJson(`${this.baseUrl}/api/v1/transfers/preview`, {
        method: 'POST',
        headers: { 'X-Transfer-API-Key': this.apiKey },
        body: JSON.stringify({ walletId, amount, token, chain }),
      });
      return data?.data ?? {
        currentBalance: '0',
        spendableBalance: '0',
        networkFee: '0',
        sufficientFunds: false,
      };
    } catch {
      return {
        currentBalance: '0',
        spendableBalance: '0',
        networkFee: '0',
        sufficientFunds: false,
      };
    }
  }
}

/**
 * Shape actually returned by Market Engine's GET /api/v1/prices — see its
 * canonical openapi/openapi.json and get-prices.use-case.ts. NOT the same
 * shape as this engine's own PriceData (that mismatch was exactly the bug
 * fixed here — see docs/CONTRACT_AUDIT.md).
 */
interface MarketEnginePriceEntry {
  symbol: string;
  priceUsd: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
  high24h?: number;
  low24h?: number;
  name?: string;
  updatedAt: string;
}

/** Prices are considered stale if older than 2x Market Engine's own 60s cache TTL. */
const STALE_THRESHOLD_MS = 120_000;
const PRICE_FETCH_TIMEOUT_MS = 5_000;

function toPriceData(entry: MarketEnginePriceEntry): PriceData {
  const ageMs = Date.now() - new Date(entry.updatedAt).getTime();
  return {
    symbol: entry.symbol,
    price: entry.priceUsd,
    currency: 'USD',
    timestamp: entry.updatedAt,
    source: 'market-engine',
    stale: !Number.isFinite(ageMs) || ageMs > STALE_THRESHOLD_MS,
  };
}

/**
 * HTTP client for the Market Engine.
 * If unavailable, returns null prices (stale handling).
 *
 * FIXED (contract-first migration, 2026-07): this client previously could
 * never successfully fetch a live price at all —
 *   1. isAvailable() checked status === 'ok'; the real /health returns
 *      'healthy' | 'degraded', so availability was always false and every
 *      price call short-circuited before even trying.
 *   2. getPrice() called GET /prices/{symbol}?chain=... — no such route
 *      exists. The real, only route is GET /prices?symbols=A,B,C (a flat,
 *      comma-separated query param, no path segment, no chain scoping —
 *      Market Engine prices are chain-agnostic, e.g. ETH is priced the same
 *      regardless of which chain a token variant lives on).
 *   3. It also unwrapped a { data: {...} } envelope that doesn't exist —
 *      the real response is the flat { prices: [...], count, timestamp }
 *      shown in ok(data) in prices/route.ts — and even the item shape
 *      differs (priceUsd/updatedAt, not price/timestamp/currency/source/
 *      stale).
 * See docs/CONTRACT_AUDIT.md for the full audit.
 */
export class HttpMarketClient implements MarketClientPort {
  private available: boolean | null = null;
  private lastCheck: number = 0;
  private checkInterval = 30000; // 30 seconds

  constructor(private baseUrl: string) {}

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.available !== null && now - this.lastCheck < this.checkInterval) {
      return this.available;
    }
    try {
      const data = await fetchJson(`${this.baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
      this.available = data?.status === 'healthy';
    } catch {
      this.available = false;
    }
    this.lastCheck = now;
    return this.available;
  }

  /**
   * `chain` is accepted for port-interface compatibility with callers, but
   * intentionally not forwarded — Market Engine's /prices contract has no
   * chain concept at all, so a per-chain price simply doesn't exist upstream.
   */
  async getPrice(symbol: string, _chain: string): Promise<PriceData | null> {
    const available = await this.isAvailable();
    if (!available) return null;

    try {
      const data = await fetchJson(
        `${this.baseUrl}/api/v1/prices?symbols=${encodeURIComponent(symbol.toUpperCase())}`,
        { signal: AbortSignal.timeout(PRICE_FETCH_TIMEOUT_MS) },
      );
      const entries: MarketEnginePriceEntry[] = Array.isArray(data?.prices) ? data.prices : [];
      const match = entries.find((e) => e.symbol?.toUpperCase() === symbol.toUpperCase());
      return match ? toPriceData(match) : null;
    } catch {
      return null;
    }
  }

  /**
   * Batches ALL requested symbols into a single upstream call (Market
   * Engine's /prices already supports comma-separated symbols) rather than
   * one HTTP round-trip per token. Since price data is chain-agnostic, the
   * same price is applied to every {symbol, chain} pair requested for a
   * given symbol.
   */
  async getPrices(tokens: { symbol: string; chain: string }[]): Promise<Map<string, PriceData>> {
    const map = new Map<string, PriceData>();
    if (tokens.length === 0) return map;

    const available = await this.isAvailable();
    if (!available) return map;

    const uniqueSymbols = [...new Set(tokens.map((t) => t.symbol.toUpperCase()))];

    try {
      const data = await fetchJson(
        `${this.baseUrl}/api/v1/prices?symbols=${uniqueSymbols.map(encodeURIComponent).join(',')}`,
        { signal: AbortSignal.timeout(PRICE_FETCH_TIMEOUT_MS) },
      );
      const entries: MarketEnginePriceEntry[] = Array.isArray(data?.prices) ? data.prices : [];
      const bySymbol = new Map(entries.map((e) => [e.symbol?.toUpperCase(), toPriceData(e)]));

      for (const t of tokens) {
        const price = bySymbol.get(t.symbol.toUpperCase());
        if (price) map.set(`${t.symbol}:${t.chain}`, price);
      }
    } catch {
      // Leave map empty — callers already treat missing entries as "no price".
    }

    return map;
  }
}

/**
 * HTTP client for the Payment Engine.
 */
export class HttpPaymentClient implements PaymentClientPort {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async previewPayment(userId: string, amount: number, fee: number, discount: number): Promise<PaymentPreviewResult> {
    try {
      const data = await fetchJson(`${this.baseUrl}/api/v1/payments/preview`, {
        method: 'POST',
        headers: { 'X-Payment-API-Key': this.apiKey, 'X-User-Id': userId },
        body: JSON.stringify({ amount, fee, discount }),
      });
      return data?.data ?? {
        availableFunds: 0,
        canAfford: false,
        balanceAfterPayment: 0,
        balanceAfterFees: 0,
      };
    } catch {
      return {
        availableFunds: 0,
        canAfford: false,
        balanceAfterPayment: 0,
        balanceAfterFees: 0,
      };
    }
  }
}
