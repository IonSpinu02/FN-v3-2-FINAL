import type { Region } from "./constants";
import { REGIONS } from "./constants";
import type { CalculateOverrides, InstitutionalRow } from "./calculate";
import type { FnConfig } from "./types";
import type {
  IstituzioniDeltaSummary,
  LocalRegistryEntry,
} from "./localiTypes";

const CARICHE: (keyof InstitutionalRow)[] = ["dep", "creg", "sind", "com"];

export function emptyInstitutionalRow(): InstitutionalRow {
  return { dep: 0, creg: 0, sind: 0, com: 0 };
}

/** Conta voci registro con partito_fn=true, per regione e tipo carica. */
export function aggregateFnPresences(
  entries: LocalRegistryEntry[],
): Record<Region, InstitutionalRow> {
  const out = Object.fromEntries(
    REGIONS.map((r) => [r, emptyInstitutionalRow()]),
  ) as Record<Region, InstitutionalRow>;

  for (const e of entries) {
    if (!REGIONS.includes(e.regione)) {
      throw new Error(`Regione non valida nel registro: ${e.regione}`);
    }
    if (!CARICHE.includes(e.carica)) {
      throw new Error(`Carica non valida: ${e.carica}`);
    }
    if (e.partito_fn) {
      out[e.regione][e.carica] += 1;
    }
  }
  return out;
}

function configPresences(cfg: FnConfig): Record<Region, InstitutionalRow> {
  const out = Object.fromEntries(
    REGIONS.map((r) => [r, emptyInstitutionalRow()]),
  ) as Record<Region, InstitutionalRow>;
  const pres = cfg.presenze_istituzionali;
  for (const carica of CARICHE) {
    const map = pres[carica] ?? {};
    for (const r of REGIONS) {
      out[r][carica] = map[r] ?? 0;
    }
  }
  return out;
}

export function computeIstituzioniDelta(
  cfg: FnConfig,
  entries: LocalRegistryEntry[],
): {
  istituzioniDelta: CalculateOverrides["istituzioniDelta"];
  summary: IstituzioniDeltaSummary;
} {
  const fromRegistry = aggregateFnPresences(entries);
  const fromConfig = configPresences(cfg);
  const delta: NonNullable<CalculateOverrides["istituzioniDelta"]> = {};
  const byRegion: IstituzioniDeltaSummary["byRegion"] = {};
  let hasChanges = false;

  for (const r of REGIONS) {
    const rowDelta: Partial<InstitutionalRow> = {};
    const configRow: Partial<InstitutionalRow> = {};
    const registryRow: Partial<InstitutionalRow> = {};
    for (const c of CARICHE) {
      const reg = fromRegistry[r][c];
      const conf = fromConfig[r][c];
      configRow[c] = conf;
      registryRow[c] = reg;
      const d = reg - conf;
      if (d !== 0) {
        rowDelta[c] = d;
        hasChanges = true;
      }
    }
    if (Object.keys(rowDelta).length > 0) {
      delta[r] = rowDelta;
    }
    byRegion[r] = { ...rowDelta, config: configRow, registry: registryRow };
  }

  return {
    istituzioniDelta: hasChanges ? delta : undefined,
    summary: { byRegion, hasChanges },
  };
}

/** Applica toggle partito_fn su una voce (per revisione news). */
export function applyEventToEntry(
  entry: LocalRegistryEntry,
  tipo: "ingresso_fn" | "uscita_fn" | "cambio_giunta",
): LocalRegistryEntry {
  const updated = { ...entry, ultimo_aggiornamento: new Date().toISOString().slice(0, 10) };
  if (tipo === "ingresso_fn") updated.partito_fn = true;
  if (tipo === "uscita_fn") updated.partito_fn = false;
  if (tipo === "cambio_giunta") updated.partito_fn = !entry.partito_fn;
  return updated;
}
