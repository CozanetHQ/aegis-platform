import { describe, it, expect, beforeEach } from 'vitest';
import { PreviewTransferUseCase } from '../../src/application/use-cases/portfolio-use-cases';
import { FakeTransferClient, FakeMarketClient, createTestPrice } from '../fakes';

describe('PreviewTransferUseCase', () => {
  let transferClient: FakeTransferClient;
  let marketClient: FakeMarketClient;
  let useCase: PreviewTransferUseCase;

  beforeEach(() => {
    transferClient = new FakeTransferClient();
    marketClient = new FakeMarketClient();
    marketClient.prices.set('BNB', createTestPrice('BNB', 500));
    useCase = new PreviewTransferUseCase(transferClient, marketClient);
  });

  it('should return transfer preview with correct fields', async () => {
    const preview = await useCase.execute('w-001', '1000000000000000000', 'BNB', 'bsc');
    expect(preview.currentBalance).toBe('1000000000000000000');
    expect(preview.spendableBalance).toBe('900000000000000000');
    expect(preview.transferAmount).toBe('1000000000000000000');
    expect(preview.networkFee).toBe('210000000000000');
    expect(preview.sufficientFunds).toBe(true);
  });

  it('should calculate remaining balance after transfer', async () => {
    const preview = await useCase.execute('w-001', '100000000000000000', 'BNB', 'bsc');
    const current = 1000000000000000000;
    const amount = 100000000000000000;
    const expectedRemaining = String(Math.max(0, current - amount));
    expect(preview.remainingAfterTransfer).toBe(expectedRemaining);
  });

  it('should calculate remaining fiat value', async () => {
    const preview = await useCase.execute('w-001', '100000000000000000', 'BNB', 'bsc');
    expect(preview.remainingFiatValue).toBeGreaterThan(0);
  });
});
