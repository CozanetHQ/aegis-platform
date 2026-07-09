import type { AuditEventRepository } from '../ports/audit-event-repository.port';

export class GetStatisticsUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(): Promise<{
    totalEvents:    number;
    eventsLast24h:  number;
    byEngine:       Record<string, number>;
    byCategory:     Record<string, number>;
    bySeverity:     Record<string, number>;
    byOutcome:      Record<string, number>;
    byCountry:      Record<string, number>;
  }> {
    const [
      totalEvents,
      eventsLast24h,
      byEngine,
      byCategory,
      bySeverity,
      byOutcome,
      byCountry,
    ] = await Promise.all([
      this.repo.count(),
      this.repo.countLast24h(),
      this.repo.countByEngine(),
      this.repo.countByCategory(),
      this.repo.countBySeverity(),
      this.repo.countByOutcome(),
      this.repo.countByCountry(),
    ]);

    return {
      totalEvents,
      eventsLast24h,
      byEngine,
      byCategory,
      bySeverity,
      byOutcome,
      byCountry,
    };
  }
}
