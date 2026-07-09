/**
 * Portfolio Engine — Portfolio Snapshot Entity
 * 
 * A point-in-time record of the user's complete financial position.
 * Snapshots are immutable — they represent a historical record.
 */

import { TokenHolding } from '../value-objects/portfolio-value-objects';

export class PortfolioSnapshot {
  constructor(
    public readonly snapshotId: string,
    public readonly userId: string,
    public readonly timestamp: string,
    public readonly totalValue: number,
    public readonly availableValue: number,
    public readonly pendingValue: number,
    public readonly lockedValue: number,
    public readonly reservedValue: number,
    public readonly walletCount: number,
    public readonly chainCount: number,
    public readonly topHoldings: TokenHolding[],
    public readonly netWorth: number,
  ) {}

  get stablecoinValue(): number {
    return this.topHoldings
      .filter((h) => h.category === 'stablecoin')
      .reduce((sum, h) => sum + h.fiatValue, 0);
  }

  get volatileValue(): number {
    return this.topHoldings
      .filter((h) => h.category === 'volatile')
      .reduce((sum, h) => sum + h.fiatValue, 0);
  }

  get stablecoinPercentage(): number {
    return this.totalValue > 0 ? (this.stablecoinValue / this.totalValue) * 100 : 0;
  }

  get volatilePercentage(): number {
    return this.totalValue > 0 ? (this.volatileValue / this.totalValue) * 100 : 0;
  }

  toDTO() {
    return {
      snapshotId: this.snapshotId,
      userId: this.userId,
      timestamp: this.timestamp,
      totalValue: this.totalValue,
      availableValue: this.availableValue,
      pendingValue: this.pendingValue,
      lockedValue: this.lockedValue,
      reservedValue: this.reservedValue,
      walletCount: this.walletCount,
      chainCount: this.chainCount,
      topHoldings: this.topHoldings,
      netWorth: this.netWorth,
      stablecoinValue: this.stablecoinValue,
      stablecoinPercentage: this.stablecoinPercentage,
      volatileValue: this.volatileValue,
      volatilePercentage: this.volatilePercentage,
    };
  }
}
