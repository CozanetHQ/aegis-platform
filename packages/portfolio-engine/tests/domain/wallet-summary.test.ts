import { describe, it, expect } from 'vitest';
import { WalletSummaryEntity } from '../../src/domain/entities/wallet-summary.entity';
import { WalletHealth } from '../../src/domain/enums/portfolio-enums';

describe('WalletSummaryEntity', () => {
  function createWallet(overrides: Partial<WalletSummaryEntity> = {}): WalletSummaryEntity {
    return new WalletSummaryEntity(
      overrides.walletId ?? 'w-001',
      overrides.address ?? '0xabc',
      overrides.label ?? 'Main',
      overrides.chain ?? 'bsc',
      overrides.availableBalance ?? '1000000',
      overrides.tokenHoldings ?? [],
      overrides.totalFiatValue ?? 500,
      overrides.percentageOfPortfolio ?? 50,
      overrides.lastActivity ?? new Date().toISOString(),
      overrides.health ?? WalletHealth.HEALTHY,
    );
  }

  it('should create wallet with correct values', () => {
    const w = createWallet();
    expect(w.walletId).toBe('w-001');
    expect(w.tokenCount).toBe(0);
    expect(w.hasBalance).toBe(true);
    expect(w.isHealthy).toBe(true);
  });

  it('should detect no balance', () => {
    const w = createWallet({ totalFiatValue: 0 });
    expect(w.hasBalance).toBe(false);
  });

  it('should detect unhealthy wallet', () => {
    const w = createWallet({ health: WalletHealth.INACTIVE });
    expect(w.isHealthy).toBe(false);
  });

  it('should produce correct DTO', () => {
    const w = createWallet();
    const dto = w.toDTO();
    expect(dto.walletId).toBe('w-001');
    expect(dto.hasBalance).toBe(true);
  });
});
