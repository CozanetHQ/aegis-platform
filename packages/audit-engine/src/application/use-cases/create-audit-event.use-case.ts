// ── CreateAuditEventUseCase ──────────────────────────────────────────
//
// Receives an audit event from any engine and persists it immutably.
// This is the ONLY way to create an audit record — no direct DB writes.

import type { AuditEventRepository } from '../ports/audit-event-repository.port';
import type { AuditEvent } from '../../domain/entities/audit-event.entity';
import type { CreateAuditEventInput } from '../../domain/entities/audit-event.entity';
import { AuditError } from '../audit-error';

export class CreateAuditEventUseCase {
  constructor(private readonly repo: AuditEventRepository) {}

  async execute(input: CreateAuditEventInput): Promise<AuditEvent> {
    // Validate required fields
    if (!input.engine)     throw AuditError.validation('engine is required');
    if (!input.category)   throw AuditError.validation('category is required');
    if (!input.eventName)  throw AuditError.validation('eventName is required');
    if (!input.correlationId) throw AuditError.validation('correlationId is required');

    // Immutability is enforced at the entity + DB level — no update path exists.
    return this.repo.create(input);
  }
}
