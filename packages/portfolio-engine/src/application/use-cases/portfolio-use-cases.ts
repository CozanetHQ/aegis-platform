/**
 * Portfolio Engine — Application Use Cases
 * 
 * Each use case represents a single business operation.
 */

import { PortfolioRepository, CachePort } from '../../domain/repositories/portfolio.repository';
import { WalletVaultClientPort, TransferClientPort, MarketClientPort, PaymentClientPort, WalletVaultWallet, WalletVaultBalance, TransferRecord, PriceData } from '../ports/engine-clients.port';
import { PortfolioSnapshot } from '../../domain/entities/portfolio-snapshot.entity';
import { WalletSummaryEntity } from '../../domain/entities/wallet-summary.entity';
import { PerformanceMetricEntity } from '../../domain/entities/performance-metric.entity';
import { BalanceType, TimeRange, AllocationType, AssetCategory, WalletHealth, CacheInvalidationReason } from '../../domain/enums/portfolio-enums';
import { AllocationEntry, HistoryPoint, DashboardSummaryVO, TransferPreview, PaymentPreview, TokenHolding, RecentTransaction } from '../../domain/value-objects/portfolio-value-objects';

const CACHE_TTL = 30; // 30 seconds
const CACHE_PREFIX = 'portfolio';

function cacheKey(userId: string, suffix: string): string {
  return `${CACHE_PREFIX}:${userId}:${suffix}`;
}

/**
 * Get the complete portfolio summary for the dashboard.
 */
export class GetPortfolioSummaryUseCase {
  constructor(
    private repo: PortfolioRepository,
    private cache: CachePort,
    private walletClient: WalletVaultClientPort,
    private marketClient: MarketClientPort,
    private transferClient: TransferClientPort,
  ) {}

  async execute(userId: string): Promise<DashboardSummaryVO> {
    const cacheKeyVal = cacheKey(userId, 'summary');

    // Try cache first
    const cached = await this.cache.get<DashboardSummaryVO>(cacheKeyVal);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.data, cacheHit: true };
    }

    // Fetch from source engines
    const [wallets, transfers] = await Promise.allSettled([
      this.walletClient.getWallets(userId),
      this.transferClient.getRecentTransfers(userId, 10),
    ]);

    const walletList = wallets.status === 'fulfilled' ? wallets.value : [];
    const transferList = transfers.status === 'fulfilled' ? transfers.value : [];

    // Get balances for each wallet
    const walletSummaries: WalletSummaryEntity[] = [];
    const allHoldings: TokenHolding[] = [];

    for (const wallet of walletList) {
      const balancesResult = await this.walletClient.getWalletBalances(wallet.id).catch(() => []);
      const balances: WalletVaultBalance[] = balancesResult;

      const holdings: TokenHolding[] = [];
      let walletFiatValue = 0;

      for (const bal of balances) {
        const priceData = await this.marketClient.getPrice(bal.symbol, wallet.chain).catch(() => null);
        const price = priceData?.price ?? 0;
        const tokenAmount = parseFloat(bal.balance) / Math.pow(10, bal.decimals);
        const fiatValue = tokenAmount * price;

        const category = this.categorizeAsset(bal.symbol);
        holdings.push({
          symbol: bal.symbol,
          contractAddress: bal.contractAddress,
          balance: bal.balance,
          decimals: bal.decimals,
          fiatValue,
          pricePerToken: price,
          priceTimestamp: priceData?.timestamp ?? null,
          category,
          percentageOfPortfolio: 0, // calculated below
        });

        walletFiatValue += fiatValue;
      }

      allHoldings.push(...holdings);
      walletSummaries.push(new WalletSummaryEntity(
        wallet.id,
        wallet.address,
        wallet.label,
        wallet.chain,
        balances[0]?.balance ?? '0',
        holdings,
        walletFiatValue,
        0, // calculated below
        wallet.lastActivity,
        this.assessHealth(walletFiatValue, wallet.lastActivity),
      ));
    }

    // Calculate total values
    const totalValue = allHoldings.reduce((sum, h) => sum + h.fiatValue, 0);
    const availableValue = totalValue; // all available unless locked
    const pendingValue = 0; // from pending transfers
    const lockedValue = 0;
    const reservedValue = 0;

    // Calculate percentages
    if (totalValue > 0) {
      for (const h of allHoldings) {
        h.percentageOfPortfolio = (h.fiatValue / totalValue) * 100;
      }
      for (const w of walletSummaries) {
        w['percentageOfPortfolio'] = (w.totalFiatValue / totalValue) * 100;
      }
    }

    // Top holdings (sorted by fiat value, top 10)
    const topHoldings = [...allHoldings]
      .sort((a, b) => b.fiatValue - a.fiatValue)
      .slice(0, 10);

    // Allocations
    const allocationByAsset = this.calculateAllocationByAsset(allHoldings, totalValue);
    const allocationByChain = this.calculateAllocationByChain(walletSummaries, totalValue);

    // Recent transactions
    const recentTransactions: RecentTransaction[] = transferList.map((t) => ({
      id: t.transferRef,
      type: t.direction,
      amount: t.amount,
      token: t.token,
      chain: t.chain,
      status: t.status,
      timestamp: t.createdAt,
    }));

    // Performance (from repo or calculate from snapshots)
    const dailyPerf = await this.repo.getPerformanceMetric(userId, TimeRange.TWENTY_FOUR_HOURS);
    const weeklyPerf = await this.repo.getPerformanceMetric(userId, TimeRange.SEVEN_DAYS);
    const monthlyPerf = await this.repo.getPerformanceMetric(userId, TimeRange.THIRTY_DAYS);

    const summary: DashboardSummaryVO = {
      userId,
      portfolioValue: totalValue,
      totalAssets: allHoldings.length,
      walletCount: walletList.length,
      chainCount: new Set(walletList.map((w) => w.chain)).size,
      topHoldings,
      recentTransactions,
      allocation: {
        byAsset: allocationByAsset,
        byChain: allocationByChain,
      },
      performance: {
        daily: dailyPerf?.toDTO() ?? this.zeroPerformance(TimeRange.TWENTY_FOUR_HOURS),
        weekly: weeklyPerf?.toDTO() ?? this.zeroPerformance(TimeRange.SEVEN_DAYS),
        monthly: monthlyPerf?.toDTO() ?? this.zeroPerformance(TimeRange.THIRTY_DAYS),
      },
      netWorth: totalValue,
      lastUpdated: new Date().toISOString(),
      cacheHit: false,
    };

    // Save to cache
    await this.cache.set(cacheKeyVal, summary, CACHE_TTL);
    await this.repo.saveDashboardSummary(userId, summary);

    return summary;
  }

  private categorizeAsset(symbol: string): AssetCategory {
    const stablecoins = ['USDC', 'USDT', 'BUSD', 'DAI', 'FRAX', 'USDC.E', 'USDT.E'];
    if (stablecoins.includes(symbol.toUpperCase())) return AssetCategory.STABLECOIN;
    const native = ['ETH', 'BNB', 'MATIC', 'ARB', 'TRX', 'BTC'];
    if (native.includes(symbol.toUpperCase())) return AssetCategory.NATIVE;
    return AssetCategory.TOKEN;
  }

  private assessHealth(fiatValue: number, lastActivity: string | null): WalletHealth {
    if (fiatValue === 0) return WalletHealth.INACTIVE;
    if (fiatValue < 1) return WalletHealth.DUST;
    if (fiatValue < 10) return WalletHealth.LOW_BALANCE;
    if (lastActivity) {
      const daysSince = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 30) return WalletHealth.INACTIVE;
    }
    return WalletHealth.HEALTHY;
  }

  private calculateAllocationByAsset(holdings: TokenHolding[], totalValue: number): AllocationEntry[] {
    const map = new Map<string, { value: number; count: number }>();
    for (const h of holdings) {
      const existing = map.get(h.symbol) ?? { value: 0, count: 0 };
      existing.value += h.fiatValue;
      existing.count += 1;
      map.set(h.symbol, existing);
    }
    return Array.from(map.entries())
      .map(([key, val]) => ({
        key,
        label: key,
        fiatValue: val.value,
        percentage: totalValue > 0 ? (val.value / totalValue) * 100 : 0,
        tokenCount: val.count,
      }))
      .sort((a, b) => b.fiatValue - a.fiatValue);
  }

  private calculateAllocationByChain(wallets: WalletSummaryEntity[], totalValue: number): AllocationEntry[] {
    const map = new Map<string, { value: number; count: number }>();
    for (const w of wallets) {
      const existing = map.get(w.chain) ?? { value: 0, count: 0 };
      existing.value += w.totalFiatValue;
      existing.count += 1;
      map.set(w.chain, existing);
    }
    return Array.from(map.entries())
      .map(([key, val]) => ({
        key,
        label: key,
        fiatValue: val.value,
        percentage: totalValue > 0 ? (val.value / totalValue) * 100 : 0,
        tokenCount: val.count,
      }))
      .sort((a, b) => b.fiatValue - a.fiatValue);
  }

  private zeroPerformance(range: TimeRange) {
    return {
      timeRange: range,
      startValue: 0,
      endValue: 0,
      absoluteChange: 0,
      percentageChange: 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      snapshotCount: 0,
    };
  }
}

/**
 * Get portfolio history for charting.
 */
export class GetPortfolioHistoryUseCase {
  constructor(private repo: PortfolioRepository) {}

  async execute(userId: string, range: TimeRange): Promise<HistoryPoint[]> {
    return this.repo.getHistory(userId, range);
  }
}

/**
 * Get a single wallet's summary.
 */
export class GetWalletSummaryUseCase {
  constructor(
    private repo: PortfolioRepository,
    private cache: CachePort,
  ) {}

  async execute(userId: string, walletId: string) {
    const key = cacheKey(userId, `wallet:${walletId}`);
    const cached = await this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const summary = await this.repo.getWalletSummary(userId, walletId);
    if (summary) {
      await this.cache.set(key, summary.toDTO(), CACHE_TTL);
      return summary.toDTO();
    }
    return null;
  }
}

/**
 * Get asset allocation.
 */
export class GetAllocationUseCase {
  constructor(private repo: PortfolioRepository) {}

  async execute(userId: string, type: AllocationType): Promise<AllocationEntry[]> {
    return this.repo.getAllocation(userId, type);
  }
}

/**
 * Get performance metrics.
 */
export class GetPerformanceUseCase {
  constructor(private repo: PortfolioRepository) {}

  async execute(userId: string, range: TimeRange) {
    const metric = await this.repo.getPerformanceMetric(userId, range);
    return metric?.toDTO() ?? null;
  }
}

/**
 * Get available balance for a user/wallet.
 */
export class GetAvailableBalanceUseCase {
  constructor(
    private walletClient: WalletVaultClientPort,
    private marketClient: MarketClientPort,
    private cache: CachePort,
  ) {}

  async execute(userId: string, walletId?: string) {
    const key = cacheKey(userId, `balance:${walletId ?? 'all'}`);
    const cached = await this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    if (walletId) {
      const balances = await this.walletClient.getWalletBalances(walletId).catch(() => []);
      let totalFiat = 0;
      const breakdown: { symbol: string; balance: string; fiatValue: number }[] = [];

      for (const bal of balances) {
        const price = await this.marketClient.getPrice(bal.symbol, '').catch(() => null);
        const tokenAmount = parseFloat(bal.balance) / Math.pow(10, bal.decimals);
        const fiatValue = tokenAmount * (price?.price ?? 0);
        totalFiat += fiatValue;
        breakdown.push({ symbol: bal.symbol, balance: bal.balance, fiatValue });
      }

      const result = {
        walletId,
        available: totalFiat,
        pending: 0,
        locked: 0,
        reserved: 0,
        total: totalFiat,
        breakdown,
        lastUpdated: new Date().toISOString(),
      };
      await this.cache.set(key, result, CACHE_TTL);
      return result;
    }

    // All wallets
    const wallets = await this.walletClient.getWallets(userId).catch(() => []);
    let totalFiat = 0;
    for (const wallet of wallets) {
      const balances = await this.walletClient.getWalletBalances(wallet.id).catch(() => []);
      for (const bal of balances) {
        const price = await this.marketClient.getPrice(bal.symbol, wallet.chain).catch(() => null);
        const tokenAmount = parseFloat(bal.balance) / Math.pow(10, bal.decimals);
        totalFiat += tokenAmount * (price?.price ?? 0);
      }
    }

    const result = {
      available: totalFiat,
      pending: 0,
      locked: 0,
      reserved: 0,
      total: totalFiat,
      lastUpdated: new Date().toISOString(),
    };
    await this.cache.set(key, result, CACHE_TTL);
    return result;
  }
}

/**
 * Preview a transfer — what happens to balances.
 */
export class PreviewTransferUseCase {
  constructor(
    private transferClient: TransferClientPort,
    private marketClient: MarketClientPort,
  ) {}

  async execute(walletId: string, amount: string, token: string, chain: string): Promise<TransferPreview> {
    const preview = await this.transferClient.previewTransfer(walletId, amount, token, chain);
    const price = await this.marketClient.getPrice(token, chain).catch(() => null);
    const tokenAmount = parseFloat(amount);
    const remaining = parseFloat(preview.currentBalance) - tokenAmount - parseFloat(preview.networkFee);

    return {
      currentBalance: preview.currentBalance,
      spendableBalance: preview.spendableBalance,
      transferAmount: amount,
      networkFee: preview.networkFee,
      remainingAfterTransfer: String(Math.max(0, parseFloat(preview.currentBalance) - tokenAmount)),
      remainingAfterNetworkFee: String(Math.max(0, remaining)),
      remainingFiatValue: Math.max(0, remaining) * (price?.price ?? 0),
      sufficientFunds: preview.sufficientFunds,
    };
  }
}

/**
 * Preview a payment — what happens to balances.
 */
export class PreviewPaymentUseCase {
  constructor(
    private paymentClient: PaymentClientPort,
  ) {}

  async execute(userId: string, amount: number, fee: number, discount: number): Promise<PaymentPreview> {
    const preview = await this.paymentClient.previewPayment(userId, amount, fee, discount);
    return {
      availableFunds: preview.availableFunds,
      paymentAmount: amount,
      paymentFee: fee,
      discount,
      totalCost: amount + fee - discount,
      canAfford: preview.canAfford,
      balanceAfterPayment: preview.balanceAfterPayment,
      balanceAfterFees: preview.balanceAfterFees,
      portfolioImpact: -(amount + fee - discount),
    };
  }
}

/**
 * Create a portfolio snapshot.
 */
export class CreateSnapshotUseCase {
  constructor(private repo: PortfolioRepository) {}

  async execute(snapshot: PortfolioSnapshot): Promise<void> {
    await this.repo.saveSnapshot(snapshot);
  }
}

/**
 * Invalidate the cache when an event is received.
 */
export class InvalidateCacheUseCase {
  constructor(private cache: CachePort) {}

  async execute(userId: string, reason: CacheInvalidationReason): Promise<void> {
    await this.cache.invalidatePattern(`${CACHE_PREFIX}:${userId}:*`, reason);
  }
}

/**
 * Get all wallet summaries for a user.
 */
export class GetWalletSummariesUseCase {
  constructor(
    private repo: PortfolioRepository,
    private cache: CachePort,
  ) {}

  async execute(userId: string) {
    const key = cacheKey(userId, 'wallets');
    const cached = await this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const summaries = await this.repo.getWalletSummaries(userId);
    const dtos = summaries.map((s) => s.toDTO());
    await this.cache.set(key, dtos, CACHE_TTL);
    return dtos;
  }
}
