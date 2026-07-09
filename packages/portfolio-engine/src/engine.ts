/**
 * Portfolio Engine — Dependency Injection Container
 * 
 * Wires all the pieces together.
 */

import { SupabasePortfolioRepository } from './infrastructure/repositories/supabase-portfolio.repository';
import { InMemoryCache } from './infrastructure/cache/in-memory-cache';
import { HttpWalletVaultClient, HttpTransferClient, HttpMarketClient, HttpPaymentClient } from './infrastructure/clients/http-engine-clients';
import {
  GetPortfolioSummaryUseCase,
  GetPortfolioHistoryUseCase,
  GetWalletSummaryUseCase,
  GetAllocationUseCase,
  GetPerformanceUseCase,
  GetAvailableBalanceUseCase,
  PreviewTransferUseCase,
  PreviewPaymentUseCase,
  CreateSnapshotUseCase,
  InvalidateCacheUseCase,
  GetWalletSummariesUseCase,
} from './application/use-cases/portfolio-use-cases';

// Singleton instances
let cacheInstance: InMemoryCache | null = null;
let repoInstance: SupabasePortfolioRepository | null = null;
let walletClientInstance: HttpWalletVaultClient | null = null;
let transferClientInstance: HttpTransferClient | null = null;
let marketClientInstance: HttpMarketClient | null = null;
let paymentClientInstance: HttpPaymentClient | null = null;

function getCache(): InMemoryCache {
  if (!cacheInstance) cacheInstance = new InMemoryCache();
  return cacheInstance;
}

function getRepo(): SupabasePortfolioRepository {
  if (!repoInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    repoInstance = new SupabasePortfolioRepository(url, key);
  }
  return repoInstance;
}

function getWalletClient(): HttpWalletVaultClient {
  if (!walletClientInstance) {
    walletClientInstance = new HttpWalletVaultClient(
      process.env.WALLET_VAULT_URL ?? '',
      process.env.WALLET_VAULT_API_KEY ?? '',
    );
  }
  return walletClientInstance;
}

function getTransferClient(): HttpTransferClient {
  if (!transferClientInstance) {
    transferClientInstance = new HttpTransferClient(
      process.env.TRANSFER_ENGINE_URL ?? '',
      process.env.TRANSFER_ENGINE_API_KEY ?? '',
    );
  }
  return transferClientInstance;
}

function getMarketClient(): HttpMarketClient {
  if (!marketClientInstance) {
    marketClientInstance = new HttpMarketClient(
      process.env.MARKET_ENGINE_URL ?? '',
    );
  }
  return marketClientInstance;
}

function getPaymentClient(): HttpPaymentClient {
  if (!paymentClientInstance) {
    paymentClientInstance = new HttpPaymentClient(
      process.env.PAYMENT_ENGINE_URL ?? '',
      process.env.PAYMENT_ENGINE_API_KEY ?? '',
    );
  }
  return paymentClientInstance;
}

// Use case factories
export const useCases = {
  getPortfolioSummary: () => new GetPortfolioSummaryUseCase(getRepo(), getCache(), getWalletClient(), getMarketClient(), getTransferClient()),
  getPortfolioHistory: () => new GetPortfolioHistoryUseCase(getRepo()),
  getWalletSummary: () => new GetWalletSummaryUseCase(getRepo(), getCache()),
  getWalletSummaries: () => new GetWalletSummariesUseCase(getRepo(), getCache()),
  getAllocation: () => new GetAllocationUseCase(getRepo()),
  getPerformance: () => new GetPerformanceUseCase(getRepo()),
  getAvailableBalance: () => new GetAvailableBalanceUseCase(getWalletClient(), getMarketClient(), getCache()),
  previewTransfer: () => new PreviewTransferUseCase(getTransferClient(), getMarketClient()),
  previewPayment: () => new PreviewPaymentUseCase(getPaymentClient()),
  createSnapshot: () => new CreateSnapshotUseCase(getRepo()),
  invalidateCache: () => new InvalidateCacheUseCase(getCache()),
};

export function getCacheInstance() {
  return getCache();
}
