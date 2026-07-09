import type { InvestigationRepository } from '../ports/investigation-repository.port';
import type { AuditEventRepository } from '../ports/audit-event-repository.port';
import { AuditError } from '../audit-error';

export class GetInvestigationUseCase {
  constructor(
    private readonly investigations: InvestigationRepository,
    private readonly events:         AuditEventRepository,
  ) {}

  async execute(id: string): Promise<{
    investigation: Record<string, unknown>;
    events: Record<string, unknown>[];
  }> {
    const inv = await this.investigations.getById(id);
    if (!inv) throw AuditError.notFound(`Investigation ${id} not found`);

    const eventRecords: Record<string, unknown>[] = [];
    for (const eventId of inv.eventIds) {
      const event = await this.events.getById(eventId);
      if (event) eventRecords.push(event.toPublicJSON());
    }

    return {
      investigation: inv.toPublicJSON(),
      events: eventRecords,
    };
  }
}
