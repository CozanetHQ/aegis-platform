/**
 * Supabase implementation of the Portfolio Repository.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PortfolioRepository, CachePort } from '../../domain/repositories/portfolio.repository';
import { PortfolioSnapshot } from '../../domain/entities/portfolio-snapshot.entity';
import { WalletSummaryEntity } from '../../domain/entities/wallet-summary.entity';
import { PerformanceMetricEntity } from '../../domain/entities/performance-metric.entity';
import { TimeRange, AllocationType } from '../../domain/enums/portfolio-enums';
import { AllocationEntry, HistoryPoint, DashboardSummaryVO, TokenHolding } from '../../domain/value-objects/portfolio-value-objects';

export class SupabasePortfolioRepository implements PortfolioRepository {
  private client: SupabaseClient;

  constructor(
    url: string,
    serviceKey: string,
  ) {
    this.client = createClient(url, serviceKey);
  }

  async saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    await this.client.from('portfolio_snapshots').insert({
      snapshot_id: snapshot.snapshotId,
      user_id: snapshot.userId,
      timestamp: snapshot.timestamp,
      total_value: snapshot.totalValue,
      available_value: snapshot.availableValue,
      pending_value: snapshot.pendingValue,
      locked_value: snapshot.lockedValue,
      reserved_value: snapshot.reservedValue,
      wallet_count: snapshot.walletCount,
      chain_count: snapshot.chainCount,
      top_holdings: JSON.stringify(snapshot.topHoldings),
      net_worth: snapshot.netWorth,
    });
  }

  async getLatestSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
    const { data, error } = await this.client
      .from('portfolio_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return this.mapSnapshot(data);
  }

  async getSnapshots(userId: string, limit: number, offset: number): Promise<PortfolioSnapshot[]> {
    const { data, error } = await this.client
      .from('portfolio_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) return [];
    return data.map((d) => this.mapSnapshot(d));
  }

  async getHistory(userId: string, range: TimeRange): Promise<HistoryPoint[]> {
    const now = Date.now();
    const rangeMs: Record<TimeRange, number> = {
      [TimeRange.ONE_HOUR]: 60 * 60 * 1000,
      [TimeRange.TWENTY_FOUR_HOURS]: 24 * 60 * 60 * 1000,
      [TimeRange.SEVEN_DAYS]: 7 * 24 * 60 * 60 * 1000,
      [TimeRange.THIRTY_DAYS]: 30 * 24 * 60 * 60 * 1000,
      [TimeRange.NINETY_DAYS]: 90 * 24 * 60 * 60 * 1000,
      [TimeRange.ONE_YEAR]: 365 * 24 * 60 * 60 * 1000,
      [TimeRange.ALL_TIME]: 10 * 365 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(now - rangeMs[range]).toISOString();

    const { data, error } = await this.client
      .from('portfolio_snapshots')
      .select('timestamp, total_value, available_value, pending_value, locked_value, wallet_count')
      .eq('user_id', userId)
      .gte('timestamp', since)
      .order('timestamp', { ascending: true });

    if (error || !data) return [];

    return data.map((d) => ({
      timestamp: d.timestamp,
      totalValue: d.total_value,
      availableValue: d.available_value,
      pendingValue: d.pending_value,
      lockedValue: d.locked_value,
      walletCount: d.wallet_count,
    }));
  }

  async savePerformanceMetric(metric: PerformanceMetricEntity): Promise<void> {
    await this.client.from('performance_metrics').upsert({
      id: metric.id,
      user_id: metric.userId,
      time_range: metric.timeRange,
      start_value: metric.startValue,
      end_value: metric.endValue,
      absolute_change: metric.absoluteChange,
      percentage_change: metric.percentageChange,
      unrealized_pnl: metric.unrealizedPnL,
      realized_pnl: metric.realizedPnL,
      snapshot_count: metric.snapshotCount,
      calculated_at: metric.calculatedAt,
    }, { onConflict: 'user_id,time_range' });
  }

  async getPerformanceMetric(userId: string, range: TimeRange): Promise<PerformanceMetricEntity | null> {
    const { data, error } = await this.client
      .from('performance_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('time_range', range)
      .single();

    if (error || !data) return null;

    return new PerformanceMetricEntity(
      data.id,
      data.user_id,
      data.time_range,
      data.start_value,
      data.end_value,
      data.absolute_change,
      data.percentage_change,
      data.unrealized_pnl,
      data.realized_pnl,
      data.snapshot_count,
      data.calculated_at,
    );
  }

  async getAllocation(userId: string, type: AllocationType): Promise<AllocationEntry[]> {
    const table = type === AllocationType.BY_ASSET ? 'asset_allocations'
      : type === AllocationType.BY_CHAIN ? 'chain_allocations'
      : 'asset_allocations';

    const { data, error } = await this.client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('fiat_value', { ascending: false });

    if (error || !data) return [];

    return data.map((d) => ({
      key: d.allocation_key,
      label: d.allocation_label,
      fiatValue: d.fiat_value,
      percentage: d.percentage,
      tokenCount: d.token_count,
    }));
  }

  async saveWalletSummary(wallet: WalletSummaryEntity, userId: string): Promise<void> {
    await this.client.from('wallet_summaries').upsert({
      wallet_id: wallet.walletId,
      user_id: userId,
      address: wallet.address,
      label: wallet.label,
      chain: wallet.chain,
      available_balance: wallet.availableBalance,
      token_holdings: JSON.stringify(wallet.tokenHoldings),
      total_fiat_value: wallet.totalFiatValue,
      percentage_of_portfolio: wallet.percentageOfPortfolio,
      last_activity: wallet.lastActivity,
      health: wallet.health,
    }, { onConflict: 'wallet_id' });
  }

  async getWalletSummaries(userId: string): Promise<WalletSummaryEntity[]> {
    const { data, error } = await this.client
      .from('wallet_summaries')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return [];

    return data.map((d) => new WalletSummaryEntity(
      d.wallet_id,
      d.address,
      d.label,
      d.chain,
      d.available_balance,
      typeof d.token_holdings === 'string' ? JSON.parse(d.token_holdings) : d.token_holdings,
      d.total_fiat_value,
      d.percentage_of_portfolio,
      d.last_activity,
      d.health,
    ));
  }

  async getWalletSummary(userId: string, walletId: string): Promise<WalletSummaryEntity | null> {
    const { data, error } = await this.client
      .from('wallet_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('wallet_id', walletId)
      .single();

    if (error || !data) return null;

    return new WalletSummaryEntity(
      data.wallet_id,
      data.address,
      data.label,
      data.chain,
      data.available_balance,
      typeof data.token_holdings === 'string' ? JSON.parse(data.token_holdings) : data.token_holdings,
      data.total_fiat_value,
      data.percentage_of_portfolio,
      data.last_activity,
      data.health,
    );
  }

  async getDashboardSummary(userId: string): Promise<DashboardSummaryVO | null> {
    const { data, error } = await this.client
      .from('portfolio_cache')
      .select('summary_data, updated_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    const summary = typeof data.summary_data === 'string' ? JSON.parse(data.summary_data) : data.summary_data;
    return { ...summary, lastUpdated: data.updated_at };
  }

  async saveDashboardSummary(userId: string, summary: DashboardSummaryVO): Promise<void> {
    await this.client.from('portfolio_cache').upsert({
      user_id: userId,
      summary_data: JSON.stringify(summary),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }

  private mapSnapshot(data: any): PortfolioSnapshot {
    return new PortfolioSnapshot(
      data.snapshot_id,
      data.user_id,
      data.timestamp,
      data.total_value,
      data.available_value,
      data.pending_value,
      data.locked_value,
      data.reserved_value,
      data.wallet_count,
      data.chain_count,
      typeof data.top_holdings === 'string' ? JSON.parse(data.top_holdings) : data.top_holdings,
      data.net_worth,
    );
  }
}
