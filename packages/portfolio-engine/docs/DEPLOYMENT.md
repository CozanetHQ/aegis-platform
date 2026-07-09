# Deployment

## Vercel

The Portfolio Engine deploys as a Next.js application on Vercel.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `PORTFOLIO_ENGINE_API_KEY` | API key for admin endpoints |
| `WALLET_VAULT_URL` | Wallet Vault Engine URL |
| `WALLET_VAULT_API_KEY` | Wallet Vault API key |
| `TRANSFER_ENGINE_URL` | Transfer Engine URL |
| `TRANSFER_ENGINE_API_KEY` | Transfer Engine API key |
| `MARKET_ENGINE_URL` | Market Engine URL (when available) |
| `PAYMENT_ENGINE_URL` | Payment Engine URL (when available) |
| `PAYMENT_ENGINE_API_KEY` | Payment Engine API key (when available) |
| `GITHUB_PACKAGES_TOKEN` | GitHub token for private SDK |

### Database

Run `src/lib/migrations/005_portfolio_engine.sql` against the Supabase project.

### GitHub

Repository: `CozanetHQ/aegis-portfolio-engine`

### Build Commands

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # next build
```

### Smoke Test

After deployment, verify:
1. `GET /api/v1/health` → 200 with status "ok"
2. `GET /api/v1/version` → 200 with version info
3. `GET /api/v1/metrics` → 200 with cache stats
4. `GET /api/v1/openapi.json` → 200 with OpenAPI spec
5. `GET /api/v1/summary` without `X-User-Id` → 401
6. `GET /api/v1/admin/statistics` without API key → 401
