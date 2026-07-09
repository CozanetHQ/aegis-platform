// ── Audit Engine · Domain Repository Port: AuditEvent ────────────────
//
// Interface contract — the infrastructure layer provides the concrete
// Supabase implementation. Designed so a future migration to a separate
// database or message queue only requires swapping this implementation.

import type { AuditEvent, CreateAuditEventInput } from '../entities/audit-event.entity';

export interface AuditEventQuery {
  userId?:        string;
  walletId?:      string;
  walletAddress?: string;
  engine?:        string;
  category?:      string;
  eventName?:     string;
  severity?:      string;
  outcome?:       string;
  correlationId?: string;
  sessionId?:     string;
  deviceId?:      string;
  ipAddress?:     string;
  country?:       string;
  actorId?:       string;
  actorType?:     string;
  platform?:      string;
  startDate?:     string;
  endDate?:       string;
  limit?:         number;
  offset?:        number;
  orderBy?:       string;
  orderDir?:      'asc' | 'desc';
}

export interface AuditEventRepository {
  create(input: CreateAuditEventInput): Promise<AuditEvent>;
  getById(eventId: string): Promise<AuditEvent | null>;
  search(query: AuditEventQuery): Promise<{ events: AuditEvent[]; total: number }>;
  getByCorrelationId(correlationId: string): Promise<AuditEvent[]>;
  getByUserId(userId: string, limit?: number, offset?: number): Promise<{ events: AuditEvent[]; total: number }>;
  getByWalletId(walletId: string, limit?: number, offset?: number): Promise<{ events: AuditEvent[]; total: number }>;
  getByWalletAddress(address: string, limit?: number, offset?: number): Promise<{ events: AuditEvent[]; total: number }>;
  getRecent(limit: number): Promise<AuditEvent[]>;
  getHighRisk(limit: number, offset?: number): Promise<{ events: AuditEvent[]; total: number }>;
  getFailed(limit: number, offset?: number): Promise<{ events: AuditEvent[]; total: number }>;
  getSecurityEvents(limit: number, offset?: number): Promise<{ events: AuditEvent[]; total: number }>;
  getAdminHistory(actorId: string, limit?: number, offset?: number): Promise<{ events: AuditEvent[]; total: number }>;
  count(): Promise<number>;
  countByEngine(): Promise<Record<string, number>>;
  countByCategory(): Promise<Record<string, number>>;
  countBySeverity(): Promise<Record<string, number>>;
  countByOutcome(): Promise<Record<string, number>>;
  countByCountry(): Promise<Record<string, number>>;
  countLast24h(): Promise<number>;
  // Immutability guard — no update/delete methods exist by design.
}
