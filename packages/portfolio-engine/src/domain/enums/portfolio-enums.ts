/**
 * Portfolio Engine — Domain Enums
 */

export enum BalanceType {
  AVAILABLE = 'available',
  PENDING = 'pending',
  LOCKED = 'locked',
  RESERVED = 'reserved',
  STAKED = 'staked',
  REWARD = 'reward',
  BUSINESS = 'business',
  TREASURY = 'treasury',
}

export enum TimeRange {
  ONE_HOUR = '1h',
  TWENTY_FOUR_HOURS = '24h',
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
  ONE_YEAR = '1y',
  ALL_TIME = 'all',
}

export enum AllocationType {
  BY_ASSET = 'by_asset',
  BY_CHAIN = 'by_chain',
  BY_WALLET = 'by_wallet',
  BY_CATEGORY = 'by_category',
  BY_STABLECOIN = 'by_stablecoin',
  BY_VOLATILE = 'by_volatile',
}

export enum AssetCategory {
  STABLECOIN = 'stablecoin',
  VOLATILE = 'volatile',
  NATIVE = 'native',
  TOKEN = 'token',
}

export enum WalletHealth {
  HEALTHY = 'healthy',
  LOW_BALANCE = 'low_balance',
  INACTIVE = 'inactive',
  DUST = 'dust',
}

export enum CacheInvalidationReason {
  TRANSFER_COMPLETED = 'transfer_completed',
  PAYMENT_COMPLETED = 'payment_completed',
  WALLET_UPDATED = 'wallet_updated',
  REWARD_RECEIVED = 'reward_received',
  MARKET_PRICES_UPDATED = 'market_prices_updated',
  MANUAL = 'manual',
}

export enum EventType {
  PORTFOLIO_UPDATED = 'portfolio.updated',
  SNAPSHOT_CREATED = 'snapshot.created',
  PERFORMANCE_UPDATED = 'performance.updated',
  ALLOCATION_CHANGED = 'allocation.changed',
}

export enum EngineName {
  IDENTITY = 'identity',
  WALLET_VAULT = 'wallet-vault',
  TRANSFER = 'transfer',
  PAYMENT = 'payment',
  NOTIFICATION = 'notification',
  AUDIT = 'audit',
  PORTFOLIO = 'portfolio',
  MARKET = 'market',
  REWARDS = 'rewards',
  BUSINESS = 'business',
  AI = 'ai',
  GATEWAY = 'gateway',
}
