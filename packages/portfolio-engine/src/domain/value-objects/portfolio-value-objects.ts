/**
 * Portfolio Engine — Value Objects
 */

import { BalanceType, AssetCategory, WalletHealth, TimeRange } from '../enums/portfolio-enums';

/**
 * Represents a single balance type with its amount in both token and fiat.
 */
export interface BalanceBreakdown {
  type: BalanceType;
  tokenAmount: string;
  fiatValue: number;
  lastUpdated: string;
}

/**
 * A token holding within a wallet.
 */
export interface TokenHolding {
  symbol: string;
  contractAddress: string | null;
  balance: string;
  decimals: number;
  fiatValue: number;
  pricePerToken: number;
  priceTimestamp: string | null;
  category: AssetCategory;
  percentageOfPortfolio: number;
}

/**
 * A wallet's summary within the portfolio.
 */
export interface WalletSummaryVO {
  walletId: string;
  address: string;
  label: string;
  chain: string;
  availableBalance: string;
  tokenHoldings: TokenHolding[];
  totalFiatValue: number;
  percentageOfPortfolio: number;
  lastActivity: string | null;
  health: WalletHealth;
}

/**
 * Asset allocation entry.
 */
export interface AllocationEntry {
  key: string;
  label: string;
  fiatValue: number;
  percentage: number;
  tokenCount: number;
}

/**
 * Performance metrics for a time range.
 */
export interface PerformanceMetric {
  timeRange: TimeRange;
  startValue: number;
  endValue: number;
  absoluteChange: number;
  percentageChange: number;
  unrealizedPnL: number;
  realizedPnL: number;
  snapshotCount: number;
}

/**
 * A point in the portfolio history chart.
 */
export interface HistoryPoint {
  timestamp: string;
  totalValue: number;
  availableValue: number;
  pendingValue: number;
  lockedValue: number;
  walletCount: number;
}

/**
 * Transfer preview — what happens to balances after a transfer.
 */
export interface TransferPreview {
  currentBalance: string;
  spendableBalance: string;
  transferAmount: string;
  networkFee: string;
  remainingAfterTransfer: string;
  remainingAfterNetworkFee: string;
  remainingFiatValue: number;
  sufficientFunds: boolean;
}

/**
 * Payment preview — what happens to balances after a payment.
 */
export interface PaymentPreview {
  availableFunds: number;
  paymentAmount: number;
  paymentFee: number;
  discount: number;
  totalCost: number;
  canAfford: boolean;
  balanceAfterPayment: number;
  balanceAfterFees: number;
  portfolioImpact: number;
}

/**
 * Cache entry with TTL.
 */
export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  invalidationReason: string | null;
}

/**
 * Portfolio snapshot — a point-in-time record.
 */
export interface PortfolioSnapshotVO {
  snapshotId: string;
  userId: string;
  timestamp: string;
  totalValue: number;
  availableValue: number;
  pendingValue: number;
  lockedValue: number;
  reservedValue: number;
  walletCount: number;
  chainCount: number;
  topHoldings: TokenHolding[];
  netWorth: number;
}

/**
 * Dashboard summary — the main response for dashboard screens.
 */
export interface DashboardSummaryVO {
  userId: string;
  portfolioValue: number;
  totalAssets: number;
  walletCount: number;
  chainCount: number;
  topHoldings: TokenHolding[];
  recentTransactions: RecentTransaction[];
  allocation: {
    byAsset: AllocationEntry[];
    byChain: AllocationEntry[];
  };
  performance: {
    daily: PerformanceMetric;
    weekly: PerformanceMetric;
    monthly: PerformanceMetric;
  };
  netWorth: number;
  lastUpdated: string;
  cacheHit: boolean;
}

/**
 * Recent transaction for dashboard display.
 */
export interface RecentTransaction {
  id: string;
  type: string;
  amount: string;
  token: string;
  chain: string;
  status: string;
  timestamp: string;
}
