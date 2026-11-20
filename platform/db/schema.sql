-- Futuro Nazionale platform — Neon (eseguire nel SQL Editor Neon o via scripts/apply-neon-schema.mjs)

CREATE TABLE IF NOT EXISTS fn_locali_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  registry JSONB NOT NULL DEFAULT '[]'::jsonb,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fn_locali_state_updated_at ON fn_locali_state (updated_at DESC);

-- STEP 1: cache dominio + rate limit (vedi anche drizzle/0002_domain_cache_rate_limit.sql)
CREATE TABLE IF NOT EXISTS domain_cache (
  cache_key text PRIMARY KEY,
  payload_json jsonb NOT NULL,
  computed_at timestamptz NOT NULL,
  expires_at timestamptz,
  etag text,
  source_status jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS domain_cache_expires_at_idx ON domain_cache (expires_at);

CREATE TABLE IF NOT EXISTS api_rate_limit_hits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_rate_limit_hits_reset_at_idx ON api_rate_limit_hits (reset_at);

-- STEP 2
CREATE TABLE IF NOT EXISTS cron_locks (
  lock_key text PRIMARY KEY,
  owner_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cron_locks_expires_at_idx ON cron_locks (expires_at);

CREATE TABLE IF NOT EXISTS published_state (
  domain text PRIMARY KEY,
  version bigint NOT NULL DEFAULT 1,
  computation_id text,
  etag text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
