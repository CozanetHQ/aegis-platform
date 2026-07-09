/**
 * Portfolio Engine — Repository Ports (Interfaces)
 * 
 * These define the contracts the infrastructure layer must implement.
 */

import { PortfolioSnapshot } from '../entities/portfolio-snapshot.entity';
import { WalletSummaryEntity } from '../entities/wallet-summary.entity';
import { PerformanceMetricEntity } from '../entities/performance-metric.entity';
import { TimeRange, AllocationType } from '../enums/portfolio-enums';
import { AllocationEntry, HistoryPoint, DashboardSummaryVO } from '../value-objects/portfolio-value-objects';

/**
 * Read model for portfolio snapshots and history.
 */
export interface PortfolioRepository {
  // Snapshots
  saveSnapshot(snapshot: PortfolioSnapshot): Promise<void>;
  getLatestSnapshot(userId: string): Promise<PortfolioSnapshot | null>;
  getSnapshots(userId: string, limit: number, offset: number): Promise<PortfolioSnapshot[]>;

  // History
  getHistory(userId: string, range: TimeRange): Promise<HistoryPoint[]>;

  // Performance
  savePerformanceMetric(metric: PerformanceMetricEntity): Promise<void>;
  getPerformanceMetric(userId: string, range: TimeRange): Promise<PerformanceMetricEntity | null>;

  // Allocation
  getAllocation(userId: string, type: AllocationType): Promise<AllocationEntry[]>;

  // Wallet summaries
  saveWalletSummary(wallet: WalletSummaryEntity, userId: string): Promise<void>;
  getWalletSummaries(userId: string): Promise<WalletSummaryEntity[]>;
  getWalletSummary(userId: string, walletId: string): Promise<WalletSummaryEntity | null>;

  // Dashboard
  getDashboardSummary(userId: string): Promise<DashboardSummaryVO | null>;
  saveDashboardSummary(userId: string, summary: DashboardSummaryVO): Promise<void>;
}

/**
 * Cache port for intelligent caching with invalidation.
 */
export interface CachePort {
  get<T>(key: string): Promise<{ data: T; expiresAt: number } | null>;
  set<T>(key: string, data: T, ttlSeconds: number): Promise<void>;
  invalidate(key: string, reason: string): Promise<void>;
  invalidatePattern(pattern: string, reason: string): Promise<void>;
  getHitRate(): number;
  getMissRate(): number;
}
