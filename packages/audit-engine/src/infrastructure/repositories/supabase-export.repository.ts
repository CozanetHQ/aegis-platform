import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AuditExport } from '../../domain/entities/audit-export.entity';
import type { CreateExportInput } from '../../domain/entities/audit-export.entity';
import type { ExportRepository } from '../../domain/repositories/audit-export.repository';

interface ExportRow {
  export_id:    string;
  requested_by: string;
  format:       string;
  filters:      Record<string, unknown>;
  status:       string;
  file_url:     string | null;
  total_events: number;
  error:        string | null;
  created_at:   string;
  completed_at: string | null;
  expires_at:   string | null;
}

function rowToEntity(row: ExportRow): AuditExport {
  return AuditExport.rehydrate({
    exportId:    row.export_id,
    requestedBy: row.requested_by,
    format:      row.format as AuditExport['format'],
    filters:     row.filters ?? {},
    status:      row.status as AuditExport['status'],
    fileUrl:     row.file_url,
    totalEvents: row.total_events,
    error:       row.error,
    createdAt:   row.created_at,
    completedAt: row.completed_at,
    expiresAt:   row.expires_at,
  });
}

export class SupabaseExportRepository implements ExportRepository {
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

  async create(input: CreateExportInput): Promise<AuditExport> {
    const exp = AuditExport.create(input);
    const props = exp.toProps();

    const { data, error } = await this.client
      .from('audit_exports')
      .insert({
        export_id:    props.exportId,
        requested_by: props.requestedBy,
        format:       props.format,
        filters:      props.filters,
        status:       props.status,
        file_url:     props.fileUrl,
        total_events: props.totalEvents,
        error:        props.error,
        created_at:   props.createdAt,
        completed_at: props.completedAt,
        expires_at:   props.expiresAt,
      })
      .select()
      .single();

    if (error) throw new Error(`[ExportRepository] create failed: ${error.message}`);
    return rowToEntity(data as ExportRow);
  }

  async getById(id: string): Promise<AuditExport | null> {
    const { data, error } = await this.client
      .from('audit_exports')
      .select('*')
      .eq('export_id', id)
      .maybeSingle();

    if (error) throw new Error(`[ExportRepository] getById failed: ${error.message}`);
    if (!data) return null;
    return rowToEntity(data as ExportRow);
  }

  async list(limit: number, offset: number): Promise<{ exports: AuditExport[]; total: number }> {
    const { data, error, count } = await this.client
      .from('audit_exports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`[ExportRepository] list failed: ${error.message}`);
    return {
      exports: (data as ExportRow[] ?? []).map(rowToEntity),
      total: count ?? 0,
    };
  }

  async update(exp: AuditExport): Promise<AuditExport> {
    const props = exp.toProps();
    const { data, error } = await this.client
      .from('audit_exports')
      .update({
        status:       props.status,
        file_url:     props.fileUrl,
        total_events: props.totalEvents,
        error:        props.error,
        completed_at: props.completedAt,
      })
      .eq('export_id', props.exportId)
      .select()
      .single();

    if (error) throw new Error(`[ExportRepository] update failed: ${error.message}`);
    return rowToEntity(data as ExportRow);
  }
}
