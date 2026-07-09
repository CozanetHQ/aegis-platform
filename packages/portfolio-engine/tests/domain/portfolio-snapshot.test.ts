import { describe, it, expect } from 'vitest';
import { PortfolioSnapshot } from '../../src/domain/entities/portfolio-snapshot.entity';
import { AssetCategory } from '../../src/domain/enums/portfolio-enums';

describe('PortfolioSnapshot Entity', () => {
  function createSnapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
    return new PortfolioSnapshot(
      overrides.snapshotId ?? 'snap-001',
      overrides.userId ?? 'user-001',
      overrides.timestamp ?? new Date().toISOString(),
      overrides.totalValue ?? 10000,
      overrides.availableValue ?? 9000,
      overrides.pendingValue ?? 500,
      overrides.lockedValue ?? 300,
      overrides.reservedValue ?? 200,
      overrides.walletCount ?? 3,
      overrides.chainCount ?? 2,
      overrides.topHoldings ?? [
        { symbol: 'USDC', contractAddress: null, balance: '5000000000', decimals: 6, fiatValue: 5000, pricePerToken: 1, priceTimestamp: null, category: AssetCategory.STABLECOIN, percentageOfPortfolio: 50 },
        { symbol: 'BNB', contractAddress: null, balance: '10000000000000000000', decimals: 18, fiatValue: 5000, pricePerToken: 500, priceTimestamp: null, category: AssetCategory.NATIVE, percentageOfPortfolio: 50 },
      ],
      overrides.netWorth ?? 10000,
    );
  }

  it('should create a snapshot with correct values', () => {
    const snap = createSnapshot();
    expect(snap.snapshotId).toBe('snap-001');
    expect(snap.totalValue).toBe(10000);
    expect(snap.walletCount).toBe(3);
  });

  it('should calculate stablecoin value correctly', () => {
    const snap = createSnapshot();
    expect(snap.stablecoinValue).toBe(5000);
  });

  it('should calculate volatile value correctly', () => {
    const snap = createSnapshot();
    expect(snap.volatileValue).toBe(0); // BNB is NATIVE not VOLATILE
  });

  it('should calculate stablecoin percentage', () => {
    const snap = createSnapshot();
    expect(snap.stablecoinPercentage).toBe(50);
  });

  it('should handle zero total value without division errors', () => {
    const snap = createSnapshot({ totalValue: 0, topHoldings: [] });
    expect(snap.stablecoinPercentage).toBe(0);
    expect(snap.volatilePercentage).toBe(0);
  });

  it('should produce correct DTO', () => {
    const snap = createSnapshot();
    const dto = snap.toDTO();
    expect(dto.snapshotId).toBe('snap-001');
    expect(dto.stablecoinValue).toBe(5000);
    expect(dto.stablecoinPercentage).toBe(50);
  });
});
