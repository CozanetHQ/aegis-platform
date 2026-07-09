import { describe, it, expect, beforeEach } from 'vitest';
import { PreviewPaymentUseCase } from '../../src/application/use-cases/portfolio-use-cases';
import { FakePaymentClient } from '../fakes';

describe('PreviewPaymentUseCase', () => {
  let paymentClient: FakePaymentClient;
  let useCase: PreviewPaymentUseCase;

  beforeEach(() => {
    paymentClient = new FakePaymentClient();
    useCase = new PreviewPaymentUseCase(paymentClient);
  });

  it('should return payment preview with correct fields', async () => {
    const preview = await useCase.execute('user-001', 100, 5, 0);
    expect(preview.availableFunds).toBe(1000);
    expect(preview.paymentAmount).toBe(100);
    expect(preview.paymentFee).toBe(5);
    expect(preview.canAfford).toBe(true);
  });

  it('should calculate total cost including fee and discount', async () => {
    const preview = await useCase.execute('user-001', 100, 5, 10);
    expect(preview.totalCost).toBe(95); // 100 + 5 - 10
  });

  it('should calculate balance after payment', async () => {
    const preview = await useCase.execute('user-001', 100, 5, 0);
    expect(preview.balanceAfterPayment).toBe(900); // 1000 - 100
    expect(preview.balanceAfterFees).toBe(895); // 1000 - 105
  });

  it('should show negative portfolio impact', async () => {
    const preview = await useCase.execute('user-001', 100, 5, 0);
    expect(preview.portfolioImpact).toBe(-105);
  });

  it('should detect insufficient funds', async () => {
    const preview = await useCase.execute('user-001', 2000, 50, 0);
    expect(preview.canAfford).toBe(false);
  });
});
