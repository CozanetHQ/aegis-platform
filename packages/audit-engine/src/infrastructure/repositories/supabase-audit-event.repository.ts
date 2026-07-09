// ── SupabaseAuditEventRepository ─────────────────────────────────────
//
// Concrete implementation of AuditEventRepository using Supabase.
// All writes go to the `audit_events` table. The table has INSERT-only
// permissions at the DB level (no UPDATE/DELETE) to enforce immutability.
//
// Designed for future migration: swap this file for a different DB
// implementation and the application layer doesn't change.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AuditEvent } from '../../domain/entities/audit-event.entity';
import type { CreateAuditEventInput } from '../../domain/entities/audit-event.entity';
import type { AuditEventQuery, AuditEventRepository } from '../../domain/repositories/audit-event.repository';

interface AuditEventRow {
  event_id:        string;
  timestamp:       string;
  engine:          string;
  category:        string;
  event_name:      string;
  severity:        string;
  correlation_id:  string;
  user_id:         string | null;
  actor_id:        string | null;
  actor_type:      string;
  wallet_id:       string | null;
  wallet_address:  string | null;
  device_id:       string | null;
  ip_address:      string | null;
  country:         string | null;
  platform:        string;
  metadata:        Record<string, unknown>;
  request_id:      string | null;
  session_id:      string | null;
  previous_state:  Record<string, unknown> | null;
  new_state:       Record<string, unknown> | null;
  outcome:         string;
  notes:           string | null;
  correction_for:  string | null;
  created_at:      string;
}

function rowToEntity(row: AuditEventRow): AuditEvent {
  return AuditEvent.rehydrate({
    eventId:       row.event_id,
    timestamp:     row.timestamp,
    engine:        row.engine,
    category:      row.category,
    eventName:     row.event_name,
    severity:      row.severity,
    correlationId: row.correlation_id,
    userId:        row.user_id,
    actorId:       row.actor_id,
    actorType:     row.actor_type,
    walletId:      row.wallet_id,
    walletAddress: row.wallet_address,
    deviceId:      row.device_id,
    ipAddress:     row.ip_address,
    country:       row.country,
    platform:      row.platform,
    metadata:      row.metadata ?? {},
    requestId:     row.request_id,
    sessionId:     row.session_id,
    previousState: row.previous_state,
    newState:      row.new_state,
    outcome:       row.outcome,
    notes:         row.notes,
    correctionFor: row.correction_for,
    createdAt:     row.created_at,
  });
}

function inputToRow(input: CreateAuditEventInput): Omit<AuditEventRow, 'created_at'> {
  const event = AuditEvent.create(input);
  return {
    event_id:       event.eventId,
    timestamp:      event.timestamp,
    engine:         event.engine,
    category:       event.category,
    event_name:     event.eventName,
    severity:       event.severity,
    correlation_id: event.correlationId,
    user_id:        event.userId,
    actor_id:       event.actorId,
    actor_type:     event.actorType,
    wallet_id:      event.walletId,
    wallet_address: event.walletAddress,
    device_id:      event.deviceId,
    ip_address:     event.ipAddress,
    country:        event.country,
    platform:       event.platform,
    metadata:       event.metadata,
    request_id:     event.requestId,
    session_id:     event.sessionId,
    previous_state: event.previousState,
    new_state:      event.newState,
    outcome:        event.outcome,
    notes:          event.notes,
    correction_for: event.correctionFor,
  };
}

export class SupabaseAuditEventRepository implements AuditEventRepository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    if (client) {
      this.client = client;
    } else {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set');
      this.client = createClient(url, key, { auth: { persistSession: false } });
    }
  }

  async create(input: CreateAuditEventInput): Promise<AuditEvent> {
    const row = inputToRow(input);
    const { data, error } = await this.client
      .from('audit_events')
      .insert({ ...row, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw new Error(`[AuditEventRepository] create failed: ${error.message}`);
    return rowToEntity(data as AuditEventRow);
  }

  async getById(eventId: string): Promise<AuditEvent | null> {
    const { data, error } = await this.client
      .from('audit_events')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) throw new Error(`[AuditEventRepository] getById failed: ${error.message}`);
    if (!data) return null;
    return rowToEntity(data as AuditEventRow);
  }

  async search(query: AuditEventQuery): Promise<{ events: AuditEvent[]; total: number }> {
    let q = this.client.from('audit_events').select('*', { count: 'exact' });

    if (query.userId)        q = q.eq('user_id', query.userId);
    if (query.walletId)      q = q.eq('wallet_id', query.walletId);
    if (query.walletAddress) q = q.eq('wallet_address', query.walletAddress);
    if (query.engine)        q = q.eq('engine', query.engine);
    if (query.category)      q = q.eq('category', query.category);
    if (query.eventName)     q = q.eq('event_name', query.eventName);
    if (query.severity)      q = q.eq('severity', query.severity);
    if (query.outcome)       q = q.eq('outcome', query.outcome);
    if (query.correlationId) q = q.eq('correlation_id', query.correlationId);
    if (query.sessionId)     q = q.eq('session_id', query.sessionId);
    if (query.deviceId)      q = q.eq('device_id', query.deviceId);
    if (query.ipAddress)     q = q.eq('ip_address', query.ipAddress);
    if (query.country)       q = q.eq('country', query.country);
    if (query.actorId)       q = q.eq('actor_id', query.actorId);
    if (query.actorType)     q = q.eq('actor_type', query.actorType);
    if (query.platform)      q = q.eq('platform', query.platform);
    if (query.startDate)     q = q.gte('timestamp', query.startDate);
    if (query.endDate)       q = q.lte('timestamp', query.endDate);

    const orderCol = query.orderBy ?? 'timestamp';
    const ascending = query.orderDir === 'asc';
    q = q.order(orderCol, { ascending });

    const limit  = Math.min(query.limit ?? 50, 500);
    const offset = query.offset ?? 0;
    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;

    if (error) throw new Error(`[AuditEventRepository] search failed: ${error.message}`);
    const events = (data as AuditEventRow[] ?? []).map(rowToEntity);
    return { events, total: count ?? 0 };
  }

  async getByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    const { data, error } = await this.client
      .from('audit_events')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('timestamp', { ascending: true })
      .limit(500);

    if (error) throw new Error(`[AuditEventRepository] getByCorrelationId failed: ${error.message}`);
    return (data as AuditEventRow[] ?? []).map(rowToEntity);
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
    const { data, error } = await this.client
      .from('audit_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) throw new Error(`[AuditEventRepository] getRecent failed: ${error.message}`);
    return (data as AuditEventRow[] ?? []).map(rowToEntity);
  }

  async getHighRisk(limit: number, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    const { data, error, count } = await this.client
      .from('audit_events')
      .select('*', { count: 'exact' })
      .in('severity', ['HIGH', 'CRITICAL'])
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`[AuditEventRepository] getHighRisk failed: ${error.message}`);
    return { events: (data as AuditEventRow[] ?? []).map(rowToEntity), total: count ?? 0 };
  }

  async getFailed(limit: number, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    const { data, error, count } = await this.client
      .from('audit_events')
      .select('*', { count: 'exact' })
      .eq('outcome', 'FAILURE')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`[AuditEventRepository] getFailed failed: ${error.message}`);
    return { events: (data as AuditEventRow[] ?? []).map(rowToEntity), total: count ?? 0 };
  }

  async getSecurityEvents(limit: number, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    const { data, error, count } = await this.client
      .from('audit_events')
      .select('*', { count: 'exact' })
      .in('category', ['SECURITY', 'AUTHENTICATION'])
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`[AuditEventRepository] getSecurityEvents failed: ${error.message}`);
    return { events: (data as AuditEventRow[] ?? []).map(rowToEntity), total: count ?? 0 };
  }

  async getAdminHistory(actorId: string, limit = 50, offset = 0): Promise<{ events: AuditEvent[]; total: number }> {
    return this.search({ actorId, limit, offset, orderBy: 'timestamp', orderDir: 'desc' });
  }

  async count(): Promise<number> {
    const { count, error } = await this.client
      .from('audit_events')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(`[AuditEventRepository] count failed: ${error.message}`);
    return count ?? 0;
  }

  async countByEngine(): Promise<Record<string, number>> {
    return this.countByField('engine');
  }

  async countByCategory(): Promise<Record<string, number>> {
    return this.countByField('category');
  }

  async countBySeverity(): Promise<Record<string, number>> {
    return this.countByField('severity');
  }

  async countByOutcome(): Promise<Record<string, number>> {
    return this.countByField('outcome');
  }

  async countByCountry(): Promise<Record<string, number>> {
    return this.countByField('country');
  }

  async countLast24h(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await this.client
      .from('audit_events')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', cutoff);
    if (error) throw new Error(`[AuditEventRepository] countLast24h failed: ${error.message}`);
    return count ?? 0;
  }

  private async countByField(field: string): Promise<Record<string, number>> {
    // Supabase doesn't support GROUP BY directly via the JS client,
    // so we fetch distinct values and count each. For production scale,
    // this should be replaced with an RPC call to a stored function.
    const { data, error } = await this.client
      .from('audit_events')
      .select(field)
      .not(field, 'is', null);

    if (error) throw new Error(`[AuditEventRepository] countByField(${field}) failed: ${error.message}`);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const val = String((row as unknown as Record<string, unknown>)[field] ?? "");
      if (val) counts[val] = (counts[val] ?? 0) + 1;
    }
    return counts;
  }
}
