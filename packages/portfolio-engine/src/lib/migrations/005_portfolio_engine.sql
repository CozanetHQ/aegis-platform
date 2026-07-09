-- AEGIS Portfolio Engine — Database Schema
-- Migration: 005_portfolio_engine.sql
-- 
-- This engine is the financial read model of AEGIS.
-- It stores historical snapshots, wallet summaries, allocations,
-- performance metrics, and cached dashboard data.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- portfolio_snapshots — immutable point-in-time records
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id UUID NOT NULL DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  available_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  pending_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  locked_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  reserved_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  wallet_count INTEGER NOT NULL DEFAULT 0,
  chain_count INTEGER NOT NULL DEFAULT 0,
  top_holdings JSONB NOT NULL DEFAULT '[]',
  net_worth DECIMAL(20,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_timestamp ON portfolio_snapshots(user_id, timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_snapshot_id ON portfolio_snapshots(snapshot_id);

-- ============================================================
-- portfolio_history — aggregated history for charting
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolio_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  total_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  available_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  pending_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  locked_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  wallet_count INTEGER NOT NULL DEFAULT 0,
  interval_type TEXT NOT NULL DEFAULT 'hourly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_user_timestamp ON portfolio_history(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_history_user_interval ON portfolio_history(user_id, interval_type, timestamp DESC);

-- ============================================================
-- portfolio_cache — cached dashboard summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolio_cache (
  user_id TEXT PRIMARY KEY,
  summary_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- wallet_summaries — per-wallet financial position
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_summaries (
  id BIGSERIAL PRIMARY KEY,
  wallet_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  chain TEXT NOT NULL,
  available_balance TEXT NOT NULL DEFAULT '0',
  token_holdings JSONB NOT NULL DEFAULT '[]',
  total_fiat_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  percentage_of_portfolio DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_activity TIMESTAMPTZ,
  health TEXT NOT NULL DEFAULT 'healthy',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_summaries_user ON wallet_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_summaries_user_chain ON wallet_summaries(user_id, chain);

-- ============================================================
-- asset_allocations — allocation by token/asset
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_allocations (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  allocation_key TEXT NOT NULL,
  allocation_label TEXT NOT NULL,
  fiat_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'token',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, allocation_key)
);

CREATE INDEX IF NOT EXISTS idx_asset_alloc_user ON asset_allocations(user_id);

-- ============================================================
-- chain_allocations — allocation by blockchain
-- ============================================================
CREATE TABLE IF NOT EXISTS chain_allocations (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  allocation_key TEXT NOT NULL,
  allocation_label TEXT NOT NULL,
  fiat_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  wallet_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, allocation_key)
);

CREATE INDEX IF NOT EXISTS idx_chain_alloc_user ON chain_allocations(user_id);

-- ============================================================
-- performance_metrics — P/L and change metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  time_range TEXT NOT NULL,
  start_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  end_value DECIMAL(20,8) NOT NULL DEFAULT 0,
  absolute_change DECIMAL(20,8) NOT NULL DEFAULT 0,
  percentage_change DECIMAL(10,4) NOT NULL DEFAULT 0,
  unrealized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
  realized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, time_range)
);

CREATE INDEX IF NOT EXISTS idx_perf_user_range ON performance_metrics(user_id, time_range);

-- ============================================================
-- portfolio_jobs — background job tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolio_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON portfolio_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON portfolio_jobs(user_id);

-- ============================================================
-- portfolio_metrics — engine observability
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolio_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(20,4) NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON portfolio_metrics(metric_name, recorded_at DESC);
