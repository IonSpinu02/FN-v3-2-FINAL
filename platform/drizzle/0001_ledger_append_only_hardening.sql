-- Hardening ledger: hash-chain + trigger anti UPDATE/DELETE sui campi originari.
-- Consente solo UPDATE controllato di subsequent_outcome_json su decision_ledger_snapshots.

ALTER TABLE decision_ledger_snapshots
  ADD COLUMN IF NOT EXISTS prev_hash text NOT NULL DEFAULT repeat('0', 64),
  ADD COLUMN IF NOT EXISTS entry_hash text NOT NULL DEFAULT repeat('0', 64);

ALTER TABLE supervision_audit_log
  ADD COLUMN IF NOT EXISTS prev_hash text NOT NULL DEFAULT repeat('0', 64),
  ADD COLUMN IF NOT EXISTS entry_hash text NOT NULL DEFAULT repeat('0', 64);

CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'LEDGER_IMMUTABLE: DELETE vietato su % (append-only)', TG_TABLE_NAME;
  END IF;

  IF TG_TABLE_NAME = 'supervision_audit_log' THEN
    RAISE EXCEPTION 'LEDGER_IMMUTABLE: UPDATE vietato su supervision_audit_log';
  END IF;

  IF TG_TABLE_NAME = 'decision_ledger_snapshots' THEN
    -- Solo subsequent_outcome_json può cambiare; tutto il resto è immutabile.
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.computation_id IS DISTINCT FROM OLD.computation_id
       OR NEW.emitted_at IS DISTINCT FROM OLD.emitted_at
       OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
       OR NEW.calibration_state_json IS DISTINCT FROM OLD.calibration_state_json
       OR NEW.inputs_manifest_json IS DISTINCT FROM OLD.inputs_manifest_json
       OR NEW.assumptions_json IS DISTINCT FROM OLD.assumptions_json
       OR NEW.outputs_json IS DISTINCT FROM OLD.outputs_json
       OR NEW.prev_hash IS DISTINCT FROM OLD.prev_hash
       OR NEW.entry_hash IS DISTINCT FROM OLD.entry_hash
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'LEDGER_IMMUTABLE: solo subsequent_outcome_json è aggiornabile su decision_ledger_snapshots';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ledger_mutation_snapshots ON decision_ledger_snapshots;
CREATE TRIGGER trg_prevent_ledger_mutation_snapshots
  BEFORE UPDATE OR DELETE ON decision_ledger_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_prevent_ledger_mutation_supervision ON supervision_audit_log;
CREATE TRIGGER trg_prevent_ledger_mutation_supervision
  BEFORE UPDATE OR DELETE ON supervision_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_mutation();
