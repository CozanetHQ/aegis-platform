/**
 * Portfolio Engine — Performance Metric Entity
 * 
 * Tracks P/L and change metrics over different time ranges.
 */

import { TimeRange } from '../enums/portfolio-enums';

export class PerformanceMetricEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly timeRange: TimeRange,
    public readonly startValue: number,
    public readonly endValue: number,
    public readonly absoluteChange: number,
    public readonly percentageChange: number,
    public readonly unrealizedPnL: number,
    public readonly realizedPnL: number,
    public readonly snapshotCount: number,
    public readonly calculatedAt: string,
  ) {}

  get isProfit(): boolean {
    return this.absoluteChange >= 0;
  }

  get isLoss(): boolean {
    return this.absoluteChange < 0;
  }

  get totalPnL(): number {
    return this.unrealizedPnL + this.realizedPnL;
  }

  toDTO() {
    return {
      id: this.id,
      userId: this.userId,
      timeRange: this.timeRange,
      startValue: this.startValue,
      endValue: this.endValue,
      absoluteChange: this.absoluteChange,
      percentageChange: this.percentageChange,
      unrealizedPnL: this.unrealizedPnL,
      realizedPnL: this.realizedPnL,
      totalPnL: this.totalPnL,
      snapshotCount: this.snapshotCount,
      calculatedAt: this.calculatedAt,
      isProfit: this.isProfit,
      isLoss: this.isLoss,
    };
  }
}
