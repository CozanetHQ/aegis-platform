/**
 * Fake implementations for testing.
 */

import { PortfolioRepository, CachePort } from '../src/domain/repositories/portfolio.repository';
import { PortfolioSnapshot } from '../src/domain/entities/portfolio-snapshot.entity';
import { WalletSummaryEntity } from '../src/domain/entities/wallet-summary.entity';
import { PerformanceMetricEntity } from '../src/domain/entities/performance-metric.entity';
import { TimeRange, AllocationType } from '../src/domain/enums/portfolio-enums';
import { AllocationEntry, HistoryPoint, DashboardSummaryVO } from '../src/domain/value-objects/portfolio-value-objects';
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
} from '../src/application/ports/engine-clients.port';

export class FakePortfolioRepository implements PortfolioRepository {
  snapshots: Map<string, PortfolioSnapshot[]> = new Map();
  summaries: Map<string, WalletSummaryEntity[]> = new Map();
  metrics: Map<string, PerformanceMetricEntity> = new Map();
  dashboards: Map<string, DashboardSummaryVO> = new Map();

  async saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    const list = this.snapshots.get(snapshot.userId) ?? [];
    list.push(snapshot);
    this.snapshots.set(snapshot.userId, list);
  }

  async getLatestSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
    const list = this.snapshots.get(userId) ?? [];
    return list.length > 0 ? list[list.length - 1] : null;
  }

  async getSnapshots(userId: string, limit: number, offset: number): Promise<PortfolioSnapshot[]> {
    const list = this.snapshots.get(userId) ?? [];
    return list.slice(offset, offset + limit);
  }

  async getHistory(userId: string, range: TimeRange): Promise<HistoryPoint[]> {
    const list = this.snapshots.get(userId) ?? [];
    return list.map((s) => ({
      timestamp: s.timestamp,
      totalValue: s.totalValue,
      availableValue: s.availableValue,
      pendingValue: s.pendingValue,
      lockedValue: s.lockedValue,
      walletCount: s.walletCount,
    }));
  }

  async savePerformanceMetric(metric: PerformanceMetricEntity): Promise<void> {
    this.metrics.set(`${metric.userId}:${metric.timeRange}`, metric);
  }

  async getPerformanceMetric(userId: string, range: TimeRange): Promise<PerformanceMetricEntity | null> {
    return this.metrics.get(`${userId}:${range}`) ?? null;
  }

  async getAllocation(userId: string, type: AllocationType): Promise<AllocationEntry[]> {
    return [];
  }

  async saveWalletSummary(wallet: WalletSummaryEntity, userId: string): Promise<void> {
    const list = this.summaries.get(userId) ?? [];
    const idx = list.findIndex((w) => w.walletId === wallet.walletId);
    if (idx >= 0) list[idx] = wallet;
    else list.push(wallet);
    this.summaries.set(userId, list);
  }

  async getWalletSummaries(userId: string): Promise<WalletSummaryEntity[]> {
    return this.summaries.get(userId) ?? [];
  }

  async getWalletSummary(userId: string, walletId: string): Promise<WalletSummaryEntity | null> {
    const list = this.summaries.get(userId) ?? [];
    return list.find((w) => w.walletId === walletId) ?? null;
  }

  async getDashboardSummary(userId: string): Promise<DashboardSummaryVO | null> {
    return this.dashboards.get(userId) ?? null;
  }

  async saveDashboardSummary(userId: string, summary: DashboardSummaryVO): Promise<void> {
    this.dashboards.set(userId, summary);
  }
}

export class FakeCache implements CachePort {
  store: Map<string, { data: unknown; expiresAt: number }> = new Map();
  hits = 0;
  misses = 0;
  invalidations: string[] = [];

  async get<T>(key: string): Promise<{ data: T; expiresAt: number } | null> {
    const record = this.store.get(key);
    if (!record || record.expiresAt <= Date.now()) {
      this.misses++;
      return null;
    }
    this.hits++;
    return { data: record.data as T, expiresAt: record.expiresAt };
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async invalidate(key: string, reason: string): Promise<void> {
    this.store.delete(key);
    this.invalidations.push(key);
  }

  async invalidatePattern(pattern: string, reason: string): Promise<void> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of Array.from(this.store.keys())) {
      if (regex.test(key)) {
        this.store.delete(key);
        this.invalidations.push(key);
      }
    }
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  getMissRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.misses / total : 0;
  }
}

export class FakeWalletVaultClient implements WalletVaultClientPort {
  wallets: WalletVaultWallet[] = [];
  balances: Map<string, WalletVaultBalance[]> = new Map();

  async getWallets(userId: string): Promise<WalletVaultWallet[]> {
    return this.wallets;
  }

  async getWallet(walletId: string): Promise<WalletVaultWallet | null> {
    return this.wallets.find((w) => w.id === walletId) ?? null;
  }

  async getWalletBalances(walletId: string): Promise<WalletVaultBalance[]> {
    return this.balances.get(walletId) ?? [];
  }
}

export class FakeTransferClient implements TransferClientPort {
  transfers: TransferRecord[] = [];

  async getRecentTransfers(userId: string, limit: number): Promise<TransferRecord[]> {
    return this.transfers.slice(0, limit);
  }

  async getPendingTransfers(userId: string): Promise<TransferRecord[]> {
    return this.transfers.filter((t) => t.status === 'pending');
  }

  async previewTransfer(walletId: string, amount: string, token: string, chain: string): Promise<TransferPreviewResult> {
    return {
      currentBalance: '1000000000000000000',
      spendableBalance: '900000000000000000',
      networkFee: '210000000000000',
      sufficientFunds: true,
    };
  }
}

export class FakeMarketClient implements MarketClientPort {
  prices: Map<string, PriceData> = new Map();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getPrice(symbol: string, chain: string): Promise<PriceData | null> {
    return this.prices.get(symbol) ?? null;
  }

  async getPrices(tokens: { symbol: string; chain: string }[]): Promise<Map<string, PriceData>> {
    const map = new Map<string, PriceData>();
    for (const t of tokens) {
      const price = this.prices.get(t.symbol);
      if (price) map.set(`${t.symbol}:${t.chain}`, price);
    }
    return map;
  }
}

export class FakePaymentClient implements PaymentClientPort {
  async previewPayment(userId: string, amount: number, fee: number, discount: number): Promise<PaymentPreviewResult> {
    const available = 1000;
    const total = amount + fee - discount;
    return {
      availableFunds: available,
      canAfford: available >= total,
      balanceAfterPayment: available - amount,
      balanceAfterFees: available - total,
    };
  }
}

// Test data factory
export function createTestWallet(): WalletVaultWallet {
  return {
    id: 'w-001',
    address: '0x1234567890123456789012345678901234567890',
    chain: 'bsc',
    label: 'Main Wallet',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };
}

export function createTestBalance(symbol: string, amount: string, decimals: number): WalletVaultBalance {
  return { symbol, contractAddress: null, balance: amount, decimals };
}

export function createTestPrice(symbol: string, price: number): PriceData {
  return { symbol, price, currency: 'USD', timestamp: new Date().toISOString(), source: 'test', stale: false };
}
