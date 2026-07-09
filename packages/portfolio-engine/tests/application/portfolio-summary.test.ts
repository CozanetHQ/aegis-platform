import { describe, it, expect, beforeEach } from 'vitest';
import { GetPortfolioSummaryUseCase } from '../../src/application/use-cases/portfolio-use-cases';
import {
  FakePortfolioRepository,
  FakeCache,
  FakeWalletVaultClient,
  FakeTransferClient,
  FakeMarketClient,
  createTestWallet,
  createTestBalance,
  createTestPrice,
} from '../fakes';
import { AssetCategory } from '../../src/domain/enums/portfolio-enums';

describe('GetPortfolioSummaryUseCase', () => {
  let repo: FakePortfolioRepository;
  let cache: FakeCache;
  let walletClient: FakeWalletVaultClient;
  let marketClient: FakeMarketClient;
  let transferClient: FakeTransferClient;
  let useCase: GetPortfolioSummaryUseCase;

  beforeEach(() => {
    repo = new FakePortfolioRepository();
    cache = new FakeCache();
    walletClient = new FakeWalletVaultClient();
    marketClient = new FakeMarketClient();
    transferClient = new FakeTransferClient();

    // Set up test data
    walletClient.wallets = [createTestWallet()];
    walletClient.balances.set('w-001', [
      createTestBalance('USDC', '5000000000', 6),
      createTestBalance('BNB', '10000000000000000000', 18),
    ]);
    marketClient.prices.set('USDC', createTestPrice('USDC', 1));
    marketClient.prices.set('BNB', createTestPrice('BNB', 500));

    useCase = new GetPortfolioSummaryUseCase(repo, cache, walletClient, marketClient, transferClient);
  });

  it('should return portfolio summary with correct total value', async () => {
    const summary = await useCase.execute('user-001');
    // USDC: 5000 * 1 = 5000, BNB: 10 * 500 = 5000, total = 10000
    expect(summary.portfolioValue).toBe(10000);
    expect(summary.walletCount).toBe(1);
    expect(summary.chainCount).toBe(1);
  });

  it('should return top holdings sorted by fiat value', async () => {
    const summary = await useCase.execute('user-001');
    expect(summary.topHoldings.length).toBe(2);
    // Both are 5000, so order depends on insertion
    expect(summary.topHoldings[0].fiatValue).toBeGreaterThanOrEqual(summary.topHoldings[1].fiatValue);
  });

  it('should calculate allocation by asset', async () => {
    const summary = await useCase.execute('user-001');
    expect(summary.allocation.byAsset.length).toBe(2);
    expect(summary.allocation.byAsset[0].percentage).toBe(50);
  });

  it('should calculate allocation by chain', async () => {
    const summary = await useCase.execute('user-001');
    expect(summary.allocation.byChain.length).toBe(1);
    expect(summary.allocation.byChain[0].key).toBe('bsc');
  });

  it('should set cacheHit to false on first call', async () => {
    const summary = await useCase.execute('user-001');
    expect(summary.cacheHit).toBe(false);
  });

  it('should return cached result on second call', async () => {
    await useCase.execute('user-001');
    const summary = await useCase.execute('user-001');
    expect(summary.cacheHit).toBe(true);
  });

  it('should handle empty wallets gracefully', async () => {
    walletClient.wallets = [];
    const summary = await useCase.execute('user-001');
    expect(summary.portfolioValue).toBe(0);
    expect(summary.walletCount).toBe(0);
  });

  it('should handle missing prices gracefully', async () => {
    marketClient.prices.clear();
    const summary = await useCase.execute('user-001');
    expect(summary.portfolioValue).toBe(0);
  });

  it('should save summary to repo', async () => {
    await useCase.execute('user-001');
    const saved = await repo.getDashboardSummary('user-001');
    expect(saved).not.toBeNull();
    expect(saved!.portfolioValue).toBe(10000);
  });
});
