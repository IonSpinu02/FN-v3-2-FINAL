-- Domain cache + rate limit (STEP 1 · stato condiviso Neon)
-- Ledger append-only: vedi drizzle/0001_ledger_append_only_hardening.sql

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