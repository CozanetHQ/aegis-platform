import type { AuditEventRepository, AuditEventQuery } from '../src/domain/repositories/audit-event.repository';
import type { CreateAuditEventInput } from '../src/domain/entities/audit-event.entity';
import type { InvestigationRepository } from '../src/domain/repositories/audit-investigation.repository';
import type { CreateInvestigationInput } from '../src/domain/entities/audit-investigation.entity';
import type { ExportRepository } from '../src/domain/repositories/audit-export.repository';
import type { CreateExportInput } from '../src/domain/entities/audit-export.entity';
import { AuditEvent } from '../src/domain/entities/audit-event.entity';
import { AuditInvestigation } from '../src/domain/entities/audit-investigation.entity';
import { AuditExport } from '../src/domain/entities/audit-export.entity';

export class FakeAuditEventRepository implements AuditEventRepository {
  private events: Map<string, AuditEvent> = new Map();

  async create(input: CreateAuditEventInput): Promise<AuditEvent> {
    const event = AuditEvent.create(input);
    this.events.set(event.eventId, event);
    return event;
  }
  async getById(eventId: string): Promise<AuditEvent | null> {
    return this.events.get(eventId) ?? null;
  }
  async search(query: AuditEventQuery): Promise<{ events: AuditEvent[]; total: number }> {
    let events = [...this.events.values()];
    if (query.userId)        events = events.filter(e => e.userId === query.userId);
    if (query.walletId)      events = events.filter(e => e.walletId === query.walletId);
    if (query.walletAddress) events = events.filter(e => e.walletAddress === query.walletAddress);
    if (query.engine)        events = events.filter(e => e.engine === query.engine);
    if (query.category)      events = events.filter(e => e.category === query.category);
    if (query.eventName)     events = events.filter(e => e.eventName === query.eventName);
    if (query.severity)      events = events.filter(e => e.severity === query.severity);
    if (query.outcome)       events = events.filter(e => e.outcome === query.outcome);
    if (query.correlationId) events = events.filter(e => e.correlationId === query.correlationId);
    if (query.sessionId)     events = events.filter(e => e.sessionId === query.sessionId);
    if (query.deviceId)      events = events.filter(e => e.deviceId === query.deviceId);
    if (query.ipAddress)     events = events.filter(e => e.ipAddress === query.ipAddress);
    if (query.country)       events = events.filter(e => e.country === query.country);
    if (query.actorId)       events = events.filter(e => e.actorId === query.actorId);
    if (query.actorType)     events = events.filter(e => e.actorType === query.actorType);
    if (query.platform)      events = events.filter(e => e.platform === query.platform);
    if (query.startDate)     events = events.filter(e => e.timestamp >= query.startDate!);
    if (query.endDate)       events = events.filter(e => e.timestamp <= query.endDate!);
    const ascending = query.orderDir === 'asc';
    events.sort((a, b) => { const cmp = a.timestamp.localeCompare(b.timestamp); return ascending ? cmp : -cmp; });
    const total = events.length;
    const limit = Math.min(query.limit ?? 50, 500);
    const offset = query.offset ?? 0;
    return { events: events.slice(offset, offset + limit), total };
  }
  async getByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    return [...this.events.values()].filter(e => e.correlationId === correlationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  async getByUserId(userId: string, limit = 50, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    return this.search({ userId, limit, offset, orderBy: 'timestamp', orderDir: 'desc' });
  }
  async getByWalletId(walletId: string, limit = 50, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    return this.search({ walletId, limit, offset, orderBy: 'timestamp', orderDir: 'desc' });
  }
  async getByWalletAddress(address: string, limit = 50, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    return this.search({ walletAddress: address, limit, offset, orderBy: 'timestamp', orderDir: 'desc' });
  }
  async getRecent(limit: number): Promise<AuditEvent[]> {
    return [...this.events.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, Math.min(limit, 200));
  }
  async getHighRisk(limit: number, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    const all = [...this.events.values()].filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL');
    return { events: all.slice(offset, offset + limit), total: all.length };
  }
  async getFailed(limit: number, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    const all = [...this.events.values()].filter(e => e.outcome === 'FAILURE');
    return { events: all.slice(offset, offset + limit), total: all.length };
  }
  async getSecurityEvents(limit: number, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    const all = [...this.events.values()].filter(e => e.category === 'SECURITY' || e.category === 'AUTHENTICATION');
    return { events: all.slice(offset, offset + limit), total: all.length };
  }
  async getAdminHistory(actorId: string, limit = 50, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    return this.search({ actorId, limit, offset, orderBy: 'timestamp', orderDir: 'desc' });
  }
  async count(): Promise<number> { return this.events.size; }
  async countByEngine(): Promise<Record<string, number>> {
    const c: Record<string, number> = {};
    for (const e of this.events.values()) c[e.engine] = (c[e.engine] ?? 0) + 1;
    return c;
  }
  async countByCategory(): Promise<Record<string, number>> {
    const c: Record<string, number> = {};
    for (const e of this.events.values()) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }
  async countBySeverity(): Promise<Record<string, number>> {
    const c: Record<string, number> = {};
    for (const e of this.events.values()) c[e.severity] = (c[e.severity] ?? 0) + 1;
    return c;
  }
  async countByOutcome(): Promise<Record<string, number>> {
    const c: Record<string, number> = {};
    for (const e of this.events.values()) c[e.outcome] = (c[e.outcome] ?? 0) + 1;
    return c;
  }
  async countByCountry(): Promise<Record<string, number>> {
    const c: Record<string, number> = {};
    for (const e of this.events.values()) { if (e.country) c[e.country] = (c[e.country] ?? 0) + 1; }
    return c;
  }
  async countLast24h(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return [...this.events.values()].filter(e => e.timestamp >= cutoff).length;
  }
}

export class FakeInvestigationRepository implements InvestigationRepository {
  private invs: Map<string, AuditInvestigation> = new Map();
  async create(input: CreateInvestigationInput): Promise<AuditInvestigation> {
    const inv = AuditInvestigation.create(input);
    this.invs.set(inv.investigationId, inv);
    return inv;
  }
  async getById(id: string): Promise<AuditInvestigation | null> { return this.invs.get(id) ?? null; }
  async list(limit: number, offset: number): Promise<{ investigations: AuditInvestigation[]; total: number }> {
    const all = [...this.invs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { investigations: all.slice(offset, offset + limit), total: all.length };
  }
  async update(inv: AuditInvestigation): Promise<AuditInvestigation> {
    this.invs.set(inv.investigationId, inv);
    return inv;
  }
}

export class FakeExportRepository implements ExportRepository {
  private exps: Map<string, AuditExport> = new Map();
  async create(input: CreateExportInput): Promise<AuditExport> {
    const exp = AuditExport.create(input);
    this.exps.set(exp.exportId, exp);
    return exp;
  }
  async getById(id: string): Promise<AuditExport | null> { return this.exps.get(id) ?? null; }
  async list(limit: number, offset: number): Promise<{ exports: AuditExport[]; total: number }> {
    const all = [...this.exps.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { exports: all.slice(offset, offset + limit), total: all.length };
  }
  async update(exp: AuditExport): Promise<AuditExport> {
    this.exps.set(exp.exportId, exp);
    return exp;
  }
}
