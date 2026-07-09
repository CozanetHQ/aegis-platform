# Audit Engine — Deployment

## Infrastructure

- **Repository**: `CozanetHQ/aegis-audit-engine` (GitHub)
- **Database**: Shared Supabase project, dedicated tables (audit_*)
- **Hosting**: Vercel (Next.js serverless functions)
- **Package Registry**: GitHub Packages (`@cozanethq/aegis-shared-sdk`)

## Environment Variables

| Variable | Description |
|----------|-------------|
| SUPABASE_URL | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key (bypasses RLS) |
| AUDIT_ENGINE_API_KEY | API key for engine-to-engine auth |
| GITHUB_PACKAGES_TOKEN | GitHub token for private npm packages |

## Database Migration

Run `004_audit_engine.sql` against the shared Supabase project. This creates:
- 7 tables (audit_events, audit_investigations, audit_exports, audit_devices, audit_sessions, audit_metadata, search_indexes)
- 20+ indexes for fast searching
- Immutability triggers (prevent UPDATE/DELETE on audit_events)
- REVOKE statements for role-based access control

## Build & Deploy

```bash
npm install
npm run typecheck  # Must pass with zero errors
npm test           # Must pass all 56 tests
vercel --prod      # Deploy to production
```

## Health Check

After deployment, verify:
```
GET /api/v1/health → 200 { status: "healthy" }
GET /api/v1/version → 200 { engine: "audit-engine" }
GET /api/v1/metrics → 200 (Prometheus format)
```
