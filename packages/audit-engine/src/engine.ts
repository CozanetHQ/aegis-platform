// @cozanethq/aegis-audit-engine — composition root.
// Wires domain/application use-cases to concrete Supabase infrastructure.
// Route handlers import from here, never construct use-cases themselves.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuditEventRepository } from './infrastructure/repositories/supabase-audit-event.repository';
import { SupabaseInvestigationRepository } from './infrastructure/repositories/supabase-investigation.repository';
import { SupabaseExportRepository } from './infrastructure/repositories/supabase-export.repository';
import { CreateAuditEventUseCase } from './application/use-cases/create-audit-event.use-case';
import { SearchAuditEventsUseCase } from './application/use-cases/search-audit-events.use-case';
import { GetTimelineUseCase } from './application/use-cases/get-timeline.use-case';
import { StartInvestigationUseCase } from './application/use-cases/start-investigation.use-case';
import { GetInvestigationUseCase } from './application/use-cases/get-investigation.use-case';
import { ListInvestigationsUseCase } from './application/use-cases/list-investigations.use-case';
import { ExportAuditDataUseCase } from './application/use-cases/export-audit-data.use-case';
import { ListExportsUseCase } from './application/use-cases/list-exports.use-case';
import { GetStatisticsUseCase } from './application/use-cases/get-statistics.use-case';
import { GetEngineActivityUseCase } from './application/use-cases/get-engine-activity.use-case';
import { GetRecentEventsUseCase } from './application/use-cases/get-recent-events.use-case';
import { GetUserHistoryUseCase } from './application/use-cases/get-user-history.use-case';
import { GetWalletHistoryUseCase } from './application/use-cases/get-wallet-history.use-case';
import { GetCorrelationLookupUseCase } from './application/use-cases/get-correlation-lookup.use-case';
import { GetAdminHistoryUseCase } from './application/use-cases/get-admin-history.use-case';

function buildSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}

let cached: ReturnType<typeof build> | null = null;

function build() {
  const db = buildSupabase();
  const eventRepo = new SupabaseAuditEventRepository(db);
  const investigationRepo = new SupabaseInvestigationRepository(db);
  const exportRepo = new SupabaseExportRepository(db);

  return {
    db,
    eventRepo,
    investigationRepo,
    exportRepo,
    createAuditEvent:     new CreateAuditEventUseCase(eventRepo),
    searchAuditEvents:    new SearchAuditEventsUseCase(eventRepo),
    getTimeline:          new GetTimelineUseCase(eventRepo),
    startInvestigation:   new StartInvestigationUseCase(investigationRepo, eventRepo),
    getInvestigation:     new GetInvestigationUseCase(investigationRepo, eventRepo),
    listInvestigations:   new ListInvestigationsUseCase(investigationRepo),
    exportAuditData:      new ExportAuditDataUseCase(exportRepo, eventRepo),
    listExports:          new ListExportsUseCase(exportRepo),
    getStatistics:        new GetStatisticsUseCase(eventRepo),
    getEngineActivity:    new GetEngineActivityUseCase(eventRepo),
    getRecentEvents:      new GetRecentEventsUseCase(eventRepo),
    getUserHistory:       new GetUserHistoryUseCase(eventRepo),
    getWalletHistory:     new GetWalletHistoryUseCase(eventRepo),
    getCorrelationLookup: new GetCorrelationLookupUseCase(eventRepo),
    getAdminHistory:      new GetAdminHistoryUseCase(eventRepo),
  };
}

/** Lazily built + memoized so route handlers share one Supabase client per lambda instance. */
export function AuditEngine() {
  if (!cached) cached = build();
  return cached;
}
