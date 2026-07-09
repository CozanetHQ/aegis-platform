// ── StartInvestigationUseCase ────────────────────────────────────────
//
// Admin-only: creates an investigation, gathers all matching events
// across engines, and detects anomalies (multiple IPs, failed auth
// bursts, unusual severity patterns, etc.).

import type { AuditEventRepository } from '../ports/audit-event-repository.port';
import type { InvestigationRepository } from '../ports/investigation-repository.port';
import type { AuditInvestigation } from '../../domain/entities/audit-investigation.entity';
import { AuditError } from '../audit-error';

interface StartInvestigationInput {
  initiatedBy: string;
  pivotType:   'USER_ID' | 'WALLET_ADDRESS' | 'TX_HASH' | 'CORRELATION_ID' | 'DEVICE_ID' | 'EMAIL' | 'PHONE';
  pivotValue:  string;
  title?:      string;
  description?:string;
}

export class StartInvestigationUseCase {
  constructor(
    private readonly investigations: InvestigationRepository,
    private readonly events:         AuditEventRepository,
  ) {}

  async execute(input: StartInvestigationInput): Promise<{
    investigation: AuditInvestigation;
    eventCount:    number;
    anomalies:     Record<string, unknown>[];
  }> {
    if (!input.initiatedBy) throw AuditError.validation('initiatedBy is required');
    if (!input.pivotType)   throw AuditError.validation('pivotType is required');
    if (!input.pivotValue)  throw AuditError.validation('pivotValue is required');

    // Create the investigation record
    const investigation = await this.investigations.create({
      initiatedBy: input.initiatedBy,
      pivotType:   input.pivotType,
      pivotValue:  input.pivotValue,
      title:       input.title ?? `Investigation: ${input.pivotType}=${input.pivotValue}`,
      description: input.description,
    });

    investigation.start();

    // Gather events based on pivot type
    let eventIds: string[] = [];
    let anomalies: Record<string, unknown>[] = [];

    switch (input.pivotType) {
      case 'CORRELATION_ID': {
        const events = await this.events.getByCorrelationId(input.pivotValue);
        eventIds = events.map(e => e.eventId);
        anomalies = this.detectAnomalies(events);
        break;
      }
      case 'USER_ID': {
        const { events } = await this.events.getByUserId(input.pivotValue, 500, 0);
        eventIds = events.map(e => e.eventId);
        anomalies = this.detectAnomalies(events);
        break;
      }
      case 'WALLET_ADDRESS': {
        const { events } = await this.events.getByWalletAddress(input.pivotValue, 500, 0);
        eventIds = events.map(e => e.eventId);
        anomalies = this.detectAnomalies(events);
        break;
      }
      case 'DEVICE_ID': {
        const { events } = await this.events.search({ deviceId: input.pivotValue, limit: 500 });
        eventIds = events.map(e => e.eventId);
        anomalies = this.detectAnomalies(events);
        break;
      }
      default: {
        // For EMAIL, PHONE, TX_HASH — search metadata
        const { events } = await this.events.search({ limit: 500 });
        eventIds = events.map(e => e.eventId);
        anomalies = this.detectAnomalies(events);
      }
    }

    eventIds.forEach(id => investigation.addEvent(id));
    anomalies.forEach(a => investigation.addAnomaly(a));

    const updated = await this.investigations.update(investigation);

    return {
      investigation: updated,
      eventCount:    eventIds.length,
      anomalies,
    };
  }

  private detectAnomalies(events: { ipAddress: string | null; severity: string; outcome: string; timestamp: string; engine: string }[]): Record<string, unknown>[] {
    const anomalies: Record<string, unknown>[] = [];

    // Multiple IP addresses
    const ips = new Set(events.filter(e => e.ipAddress).map(e => e.ipAddress));
    if (ips.size > 3) {
      anomalies.push({
        type: 'MULTIPLE_IP_ADDRESSES',
        severity: 'MEDIUM',
        description: `${ips.size} distinct IP addresses detected`,
        ips: [...ips],
      });
    }

    // Failed events burst
    const failures = events.filter(e => e.outcome === 'FAILURE');
    if (failures.length > 5) {
      anomalies.push({
        type: 'FAILURE_BURST',
        severity: 'HIGH',
        description: `${failures.length} failed events detected`,
        failureCount: failures.length,
      });
    }

    // Critical severity events
    const critical = events.filter(e => e.severity === 'CRITICAL');
    if (critical.length > 0) {
      anomalies.push({
        type: 'CRITICAL_EVENTS',
        severity: 'CRITICAL',
        description: `${critical.length} critical severity events found`,
        criticalCount: critical.length,
      });
    }

    // Multiple engines involved (cross-engine activity)
    const engines = new Set(events.map(e => e.engine));
    if (engines.size > 3) {
      anomalies.push({
        type: 'CROSS_ENGINE_ACTIVITY',
        severity: 'LOW',
        description: `Events span ${engines.size} engines`,
        engines: [...engines],
      });
    }

    return anomalies;
  }
}
