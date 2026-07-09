-- ═══════════════════════════════════════════════════════════════════════
-- AEGIS Audit Engine — Migration 004
-- ═══════════════════════════════════════════════════════════════════════
--
-- The permanent memory of the AEGIS ecosystem.
-- All tables are INSERT-only for audit_events (enforced at DB level).
-- Investigations and exports are mutable (status transitions).
--
-- Table ownership: Audit Engine ONLY.
-- No other engine may touch these tables directly.
-- ═══════════════════════════════════════════════════════════════════════

-- ── audit_events ──────────────────────────────────────────────────────
-- The core append-only table. Every important action in AEGIS gets a row.

CREATE TABLE IF NOT EXISTS audit_events (
    event_id         TEXT PRIMARY KEY,
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT now(),
    engine           TEXT NOT NULL,
    category         TEXT NOT NULL,
    event_name       TEXT NOT NULL,
    severity         TEXT NOT NULL DEFAULT 'INFO',
    correlation_id   TEXT NOT NULL,
    user_id          TEXT,
    actor_id         TEXT,
    actor_type       TEXT NOT NULL DEFAULT 'SYSTEM',
    wallet_id        TEXT,
    wallet_address   TEXT,
    device_id        TEXT,
    ip_address       TEXT,
    country          TEXT,
    platform         TEXT NOT NULL DEFAULT 'UNKNOWN',
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_id       TEXT,
    session_id       TEXT,
    previous_state   JSONB,
    new_state        JSONB,
    outcome          TEXT NOT NULL DEFAULT 'SUCCESS',
    notes            TEXT,
    correction_for   TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast searching (all filter dimensions from the spec)
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp     ON audit_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id       ON audit_events (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation   ON audit_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_engine        ON audit_events (engine);
CREATE INDEX IF NOT EXISTS idx_audit_events_category      ON audit_events (category);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity      ON audit_events (severity);
CREATE INDEX IF NOT EXISTS idx_audit_events_outcome       ON audit_events (outcome);
CREATE INDEX IF NOT EXISTS idx_audit_events_wallet_id     ON audit_events (wallet_id) WHERE wallet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_wallet_addr   ON audit_events (wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_device        ON audit_events (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_ip            ON audit_events (ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_country       ON audit_events (country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_session       ON audit_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_actor         ON audit_events (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_event_name    ON audit_events (event_name);
CREATE INDEX IF NOT EXISTS idx_audit_events_platform      ON audit_events (platform);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at    ON audit_events (created_at DESC);

-- GIN index for metadata JSONB searches
CREATE INDEX IF NOT EXISTS idx_audit_events_metadata_gin  ON audit_events USING GIN (metadata);

-- Composite index for common "recent by user" queries
CREATE INDEX IF NOT EXISTS idx_audit_events_user_ts       ON audit_events (user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_wallet_ts     ON audit_events (wallet_id, timestamp DESC) WHERE wallet_id IS NOT NULL;

-- ── Immutability enforcement ──────────────────────────────────────────
-- REVOKE UPDATE and DELETE from all roles. Only INSERT + SELECT allowed.
-- This is a database-level guard — even if application code has a bug,
-- the data cannot be modified.
REVOKE UPDATE, DELETE ON audit_events FROM anon, authenticated;

-- Create a trigger that prevents UPDATE and DELETE entirely
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_events;
CREATE TRIGGER trg_prevent_audit_update
    BEFORE UPDATE ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_events;
CREATE TRIGGER trg_prevent_audit_delete
    BEFORE DELETE ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- ── audit_investigations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_investigations (
    investigation_id  TEXT PRIMARY KEY,
    initiated_by      TEXT NOT NULL,
    pivot_type        TEXT NOT NULL,
    pivot_value       TEXT NOT NULL,
    title             TEXT NOT NULL,
    description       TEXT,
    status            TEXT NOT NULL DEFAULT 'OPEN',
    event_ids         JSONB NOT NULL DEFAULT '[]'::jsonb,
    anomalies         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_inv_initiated  ON audit_investigations (initiated_by);
CREATE INDEX IF NOT EXISTS idx_audit_inv_status     ON audit_investigations (status);
CREATE INDEX IF NOT EXISTS idx_audit_inv_pivot      ON audit_investigations (pivot_type, pivot_value);
CREATE INDEX IF NOT EXISTS idx_audit_inv_created    ON audit_investigations (created_at DESC);

-- ── audit_exports ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_exports (
    export_id     TEXT PRIMARY KEY,
    requested_by  TEXT NOT NULL,
    format        TEXT NOT NULL,
    filters       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status        TEXT NOT NULL DEFAULT 'PENDING',
    file_url      TEXT,
    total_events  INTEGER NOT NULL DEFAULT 0,
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_exp_requested  ON audit_exports (requested_by);
CREATE INDEX IF NOT EXISTS idx_audit_exp_status     ON audit_exports (status);
CREATE INDEX IF NOT EXISTS idx_audit_exp_created    ON audit_exports (created_at DESC);

-- ── audit_devices ─────────────────────────────────────────────────────
-- Aggregated device info for cross-referencing
CREATE TABLE IF NOT EXISTS audit_devices (
    device_id     TEXT PRIMARY KEY,
    first_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
    ip_addresses  JSONB NOT NULL DEFAULT '[]'::jsonb,
    countries     JSONB NOT NULL DEFAULT '[]'::jsonb,
    platforms     JSONB NOT NULL DEFAULT '[]'::jsonb,
    event_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_audit_devices_last_seen  ON audit_devices (last_seen DESC);

-- ── audit_sessions ────────────────────────────────────────────────────
-- Aggregated session info for timeline reconstruction
CREATE TABLE IF NOT EXISTS audit_sessions (
    session_id    TEXT PRIMARY KEY,
    user_id       TEXT,
    device_id     TEXT,
    ip_address    TEXT,
    country       TEXT,
    platform      TEXT,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at      TIMESTAMPTZ,
    event_count   INTEGER NOT NULL DEFAULT 0,
    engines       JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_sessions_user      ON audit_sessions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_sessions_started   ON audit_sessions (started_at DESC);

-- ── Audit metadata table (count by field — for fast stats) ────────────
-- Materialized view would be ideal, but Supabase free tier doesn't
-- support them well. This is a simple count cache table.
CREATE TABLE IF NOT EXISTS audit_metadata (
    id           SERIAL PRIMARY KEY,
    field_name   TEXT NOT NULL,
    field_value  TEXT NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(field_name, field_value)
);

CREATE INDEX IF NOT EXISTS idx_audit_meta_field  ON audit_metadata (field_name);

-- ── search_indexes (for full-text search) ─────────────────────────────
-- Stores pre-computed search tokens for each event
CREATE TABLE IF NOT EXISTS search_indexes (
    event_id     TEXT NOT NULL REFERENCES audit_events(event_id) ON DELETE CASCADE,
    search_text  TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_text_gin  ON search_indexes USING GIN (to_tsvector('english', search_text));
CREATE INDEX IF NOT EXISTS idx_search_event_id  ON search_indexes (event_id);

-- ═══════════════════════════════════════════════════════════════════════
-- END Migration 004
-- ═══════════════════════════════════════════════════════════════════════
