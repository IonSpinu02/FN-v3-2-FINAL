-- STEP 2: lock cron anti-stallo + puntatori pubblicazione leggeri

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