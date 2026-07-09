# Architecture

## Clean Architecture Layers

### Domain Layer (`src/domain/`)
- **Entities**: PortfolioSnapshot, WalletSummaryEntity, PerformanceMetricEntity
- **Value Objects**: BalanceBreakdown, TokenHolding, AllocationEntry, TransferPreview, PaymentPreview, etc.
- **Enums**: BalanceType, TimeRange, AllocationType, AssetCategory, WalletHealth, CacheInvalidationReason
- **Repository Ports**: PortfolioRepository, CachePort (interfaces)

### Application Layer (`src/application/`)
- **Ports**: Engine client interfaces (WalletVaultClientPort, TransferClientPort, MarketClientPort, PaymentClientPort)
- **Use Cases**: 12 use cases covering summary, history, allocation, performance, balance, previews, snapshots, cache invalidation

### Infrastructure Layer (`src/infrastructure/`)
- **Repositories**: SupabasePortfolioRepository
- **Clients**: HttpWalletVaultClient, HttpTransferClient, HttpMarketClient, HttpPaymentClient
- **Cache**: InMemoryCache (replaceable with Redis)

### Interface Layer (`src/app/api/`)
- 16 API routes following RESTful conventions
- All routes use `force-dynamic` to prevent static prerendering

## Rules

1. Engines communicate via HTTP — never direct imports across boundaries
2. The Portfolio Engine never duplicates business logic from other engines
3. Prices always come from the Market Engine — never invented
4. Cache is invalidated on events from source engines
5. Snapshots are immutable historical records
6. Only read-only financial information is exposed — no private keys or secrets
