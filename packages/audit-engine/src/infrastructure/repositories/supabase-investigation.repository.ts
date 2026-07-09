import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AuditInvestigation } from '../../domain/entities/audit-investigation.entity';
import type { CreateInvestigationInput } from '../../domain/entities/audit-investigation.entity';
import type { InvestigationRepository } from '../../domain/repositories/audit-investigation.repository';

interface InvestigationRow {
  investigation_id: string;
  initiated_by:     string;
  pivot_type:       string;
  pivot_value:      string;
  title:            string;
  description:      string | null;
  status:           string;
  event_ids:        string[];
  anomalies:        Record<string, unknown>[];
  created_at:       string;
  updated_at:       string;
  closed_at:        string | null;
}

function rowToEntity(row: InvestigationRow): AuditInvestigation {
  return AuditInvestigation.rehydrate({
    investigationId: row.investigation_id,
    initiatedBy:     row.initiated_by,
    pivotType:       row.pivot_type,
    pivotValue:      row.pivot_value,
    title:           row.title,
    description:     row.description,
    status:          row.status as AuditInvestigation['status'],
    eventIds:        row.event_ids ?? [],
    anomalies:       row.anomalies ?? [],
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    closedAt:        row.closed_at,
  });
}

export class SupabaseInvestigationRepository implements InvestigationRepository {
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

  async create(input: CreateInvestigationInput): Promise<AuditInvestigation> {
    const inv = AuditInvestigation.create(input);
    const props = inv.toProps();

    const { data, error } = await this.client
      .from('audit_investigations')
      .insert({
        investigation_id: props.investigationId,
        initiated_by:     props.initiatedBy,
        pivot_type:       props.pivotType,
        pivot_value:      props.pivotValue,
        title:            props.title,
        description:      props.description,
        status:           props.status,
        event_ids:        props.eventIds,
        anomalies:        props.anomalies,
        created_at:       props.createdAt,
        updated_at:       props.updatedAt,
        closed_at:        props.closedAt,
      })
      .select()
      .single();

    if (error) throw new Error(`[InvestigationRepository] create failed: ${error.message}`);
    return rowToEntity(data as InvestigationRow);
  }

  async getById(id: string): Promise<AuditInvestigation | null> {
    const { data, error } = await this.client
      .from('audit_investigations')
      .select('*')
      .eq('investigation_id', id)
      .maybeSingle();

    if (error) throw new Error(`[InvestigationRepository] getById failed: ${error.message}`);
    if (!data) return null;
    return rowToEntity(data as InvestigationRow);
  }

  async list(limit: number, offset: number): Promise<{ investigations: AuditInvestigation[]; total: number }> {
    const { data, error, count } = await this.client
      .from('audit_investigations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`[InvestigationRepository] list failed: ${error.message}`);
    return {
      investigations: (data as InvestigationRow[] ?? []).map(rowToEntity),
      total: count ?? 0,
    };
  }

  async update(inv: AuditInvestigation): Promise<AuditInvestigation> {
    const props = inv.toProps();
    const { data, error } = await this.client
      .from('audit_investigations')
      .update({
        status:     props.status,
        event_ids:  props.eventIds,
        anomalies:  props.anomalies,
        updated_at: props.updatedAt,
        closed_at:  props.closedAt,
      })
      .eq('investigation_id', props.investigationId)
      .select()
      .single();

    if (error) throw new Error(`[InvestigationRepository] update failed: ${error.message}`);
    return rowToEntity(data as InvestigationRow);
  }
}
