/**
 * Portfolio Engine — Wallet Summary Entity
 * 
 * Represents a single wallet's financial position within the portfolio.
 */

import { TokenHolding } from '../value-objects/portfolio-value-objects';
import { WalletHealth } from '../enums/portfolio-enums';

export class WalletSummaryEntity {
  constructor(
    public readonly walletId: string,
    public readonly address: string,
    public readonly label: string,
    public readonly chain: string,
    public readonly availableBalance: string,
    public readonly tokenHoldings: TokenHolding[],
    public readonly totalFiatValue: number,
    public percentageOfPortfolio: number,
    public readonly lastActivity: string | null,
    public readonly health: WalletHealth,
  ) {}

  get tokenCount(): number {
    return this.tokenHoldings.length;
  }

  get hasBalance(): boolean {
    return this.totalFiatValue > 0;
  }

  get isHealthy(): boolean {
    return this.health === 'healthy';
  }

  toDTO() {
    return {
      walletId: this.walletId,
      address: this.address,
      label: this.label,
      chain: this.chain,
      availableBalance: this.availableBalance,
      tokenHoldings: this.tokenHoldings,
      totalFiatValue: this.totalFiatValue,
      percentageOfPortfolio: this.percentageOfPortfolio,
      lastActivity: this.lastActivity,
      health: this.health,
      tokenCount: this.tokenCount,
      hasBalance: this.hasBalance,
      isHealthy: this.isHealthy,
    };
  }
}
