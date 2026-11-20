/** Etichette storage ledger — safe per client e server. */

export const LEDGER_FILE_BADGE =
  "Archivio locale di sviluppo (.jsonl) — usare PostgreSQL per persistenza di produzione";

export function ledgerStorageLabel(kind: "postgres" | "file"): string {
  return kind === "postgres"
    ? "PostgreSQL (append-only + trigger anti-mutation)"
    : LEDGER_FILE_BADGE;
}
