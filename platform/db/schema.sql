-- Futuro Nazionale platform — Neon (eseguire nel SQL Editor Neon o via scripts/apply-neon-schema.mjs)

CREATE TABLE IF NOT EXISTS fn_locali_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  registry JSONB NOT NULL DEFAULT '[]'::jsonb,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fn_locali_state_updated_at ON fn_locali_state (updated_at DESC);
