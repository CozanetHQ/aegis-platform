import { describe, it, expect } from 'vitest';
import { PerformanceMetricEntity } from '../../src/domain/entities/performance-metric.entity';
import { TimeRange } from '../../src/domain/enums/portfolio-enums';

describe('PerformanceMetricEntity', () => {
  function createMetric(overrides: Partial<PerformanceMetricEntity> = {}): PerformanceMetricEntity {
    return new PerformanceMetricEntity(
      overrides.id ?? 'm-001',
      overrides.userId ?? 'user-001',
      overrides.timeRange ?? TimeRange.TWENTY_FOUR_HOURS,
      overrides.startValue ?? 1000,
      overrides.endValue ?? 1200,
      overrides.absoluteChange ?? 200,
      overrides.percentageChange ?? 20,
      overrides.unrealizedPnL ?? 150,
      overrides.realizedPnL ?? 50,
      overrides.snapshotCount ?? 24,
      overrides.calculatedAt ?? new Date().toISOString(),
    );
  }

  it('should detect profit', () => {
    const m = createMetric({ absoluteChange: 200 });
    expect(m.isProfit).toBe(true);
    expect(m.isLoss).toBe(false);
  });

  it('should detect loss', () => {
    const m = createMetric({ absoluteChange: -100 });
    expect(m.isLoss).toBe(true);
    expect(m.isProfit).toBe(false);
  });

  it('should calculate total PnL', () => {
    const m = createMetric({ unrealizedPnL: 150, realizedPnL: 50 });
    expect(m.totalPnL).toBe(200);
  });

  it('should produce correct DTO', () => {
    const m = createMetric();
    const dto = m.toDTO();
    expect(dto.totalPnL).toBe(200);
    expect(dto.isProfit).toBe(true);
  });
});
