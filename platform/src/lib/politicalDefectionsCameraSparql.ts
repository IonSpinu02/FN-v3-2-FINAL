import type { Region } from "@/lib/engine/constants";

const SPARQL_ENDPOINT = "https://dati.camera.it/sparql";
const LEG19 = "http://dati.camera.it/ocd/legislatura.rdf/repubblica_19";
const TIMEOUT_MS = 6_000;
const CACHE_MS = 15 * 60 * 1000;

const MEMBERSHIP_QUERY = `PREFIX ocd: <http://dati.camera.it/ocd/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT ?deputato ?label ?gr ?start ?end WHERE {
  ?d a ocd:deputato ;
     ocd:rif_leg <${LEG19}> ;
     rdfs:label ?label ;
     ocd:aderisce ?ades .
  BIND(?d AS ?deputato)
  ?ades ocd:startDate ?start ;
        ocd:endDate ?end ;
        ocd:rif_gruppoParlamentare ?g .
  ?g dc:title ?gr .
}`;

export type CameraGroupChangeRow = {
  deputatoUri: string;
  nomeDisplay: string;
  gruppoDaRaw: string;
  gruppoARaw: string;
  dataCambioYmd: string;
  dataCambioIso: string;
  gruppoDaLabel: string;
  gruppoALabel: string;
  schedaCameraUrl: string;
};

let cache: { at: number; rows: CameraGroupChangeRow[] } | null = null;

function parseCameraDateYmd(ymd: string): string {
  if (ymd.length !== 8) return new Date().toISOString();
  const y = ymd.slice(0, 4);
  const m = ymd.slice(4, 6);
  const d = ymd.slice(6, 8);
  return `${y}-${m}-${d}T12:00:00+02:00`;
}

/** Camera RDF spesso usa "COGNOME Nome" — normalizza a "Nome Cognome". */
export function parseDeputatoLabelToName(label: string): string {
  const base = label.split(",")[0]?.trim() ?? label;
  const parts = base
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  if (parts.length < 2) return parts.join(" ");
  // Se il primo token è tutto maiuscolo nel raw originale → cognome-first
  const rawFirst = (base.split(/\s+/)[0] ?? "").replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (rawFirst.length >= 2 && rawFirst === rawFirst.toUpperCase()) {
    const [cognome, ...rest] = parts;
    return [...rest, cognome].join(" ");
  }
  return parts.join(" ");
}

/**
 * True solo se esiste una transizione reale tra gruppi distinti
 * (daPartito ≠ aPartito dopo normalizzazione).
 * Chi siede nel Misto dall'inizio senza `dataFine` su un gruppo precedente
 * non genera mai una riga CameraGroupChangeRow.
 */
export function isTrueCameraGroupChange(row: {
  gruppoDaLabel: string;
  gruppoALabel: string;
}): boolean {
  return Boolean(
    row.gruppoDaLabel &&
      row.gruppoALabel &&
      row.gruppoDaLabel !== row.gruppoALabel,
  );
}

/** Successione temporale: il gruppo precedente termina prima (o al) inizio del successivo. */
export function isChronologicalSuccession(fromEndYmd: string, toStartYmd: string): boolean {
  if (!/^\d{8}$/.test(fromEndYmd) || !/^\d{8}$/.test(toStartYmd)) return false;
  return fromEndYmd <= toStartYmd;
}

export function normalizeGruppoParlamentareTitle(raw: string): string {
  const u = raw.toUpperCase();
  if (u.includes("FRATELLI") || u.includes("(FDI)")) return "Fratelli d'Italia";
  if (u.includes("LEGA") || u.includes("SALVINI")) return "Lega";
  if (u.includes("FORZA ITALIA") || u.includes("FI-PPE")) return "Forza Italia";
  if (u.includes("MISTO")) return "Gruppo Misto";
  if (u.includes("NOI MODERATI")) return "Noi Moderati";
  if (u.includes("AZIONE") || u.includes("AZ-PER")) return "Azione";
  if (u.includes("ITALIA VIVA") || u.includes("IV-CR")) return "Italia Viva";
  if (u.includes("M5S") || u.includes("5 STELLE")) return "M5S";
  if (u.includes("FUTURO NAZIONALE") || u.includes("VANNACCI")) return "Futuro Nazionale";
  const cut = raw.split("(")[0]?.trim();
  return cut && cut.length > 2 ? cut : raw.slice(0, 48);
}

function cameraSchedaUrl(deputatoUri: string): string {
  const id = deputatoUri.split("/").pop() ?? "";
  if (id) return `https://www.camera.it/leg19/29?deputato=${encodeURIComponent(id)}`;
  return "https://www.camera.it/leg19/1083";
}

type SparqlBinding = {
  deputato?: { value: string };
  label?: { value: string };
  gr?: { value: string };
  start?: { value: string };
  end?: { value: string };
};

/** Esposto per test: regola Gallo (1 solo gruppo → nessun cambio). */
export function extractGroupChanges(bindings: SparqlBinding[]): CameraGroupChangeRow[] {
  const byLabel = new Map<
    string,
    { deputatoUri: string; memberships: { gr: string; start: string; end: string }[] }
  >();

  for (const b of bindings) {
    const label = b.label?.value;
    const deputatoUri = b.deputato?.value;
    const gr = b.gr?.value;
    const start = b.start?.value;
    const end = b.end?.value;
    if (!label || !deputatoUri || !gr || !start || !end) continue;
    if (!byLabel.has(label)) {
      byLabel.set(label, { deputatoUri, memberships: [] });
    }
    const entry = byLabel.get(label)!;
    entry.memberships.push({ gr, start, end });
  }

  const changes: CameraGroupChangeRow[] = [];
  for (const [label, { deputatoUri, memberships }] of byLabel) {
    const uniq = [
      ...new Map(memberships.map((m) => [m.start + m.end + m.gr, m])).values(),
    ].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

    // Almeno 2 adesioni a gruppi normalizzati DISTINTI (regola Francesco Gallo).
    const distinctGroups = new Set(
      uniq.map((m) => normalizeGruppoParlamentareTitle(m.gr)),
    );
    if (distinctGroups.size < 2) continue;

    for (let i = 0; i < uniq.length - 1; i++) {
      const from = uniq[i]!;
      const to = uniq[i + 1]!;
      if (!isChronologicalSuccession(from.end, to.start)) continue;
      const gruppoDaLabel = normalizeGruppoParlamentareTitle(from.gr);
      const gruppoALabel = normalizeGruppoParlamentareTitle(to.gr);
      // Solo cambi tra gruppi distinti (no churn intra-Misto / componenti).
      if (gruppoDaLabel === gruppoALabel) continue;
      const dataCambioYmd = to.start;
      changes.push({
        deputatoUri,
        nomeDisplay: parseDeputatoLabelToName(label),
        gruppoDaRaw: from.gr,
        gruppoARaw: to.gr,
        dataCambioYmd,
        dataCambioIso: parseCameraDateYmd(dataCambioYmd),
        gruppoDaLabel,
        gruppoALabel,
        schedaCameraUrl: cameraSchedaUrl(deputatoUri),
      });
    }
  }
  changes.sort((a, b) => b.dataCambioYmd.localeCompare(a.dataCambioYmd));
  return changes;
}

export async function fetchCameraLeg19GroupChanges(): Promise<{
  changes: CameraGroupChangeRow[];
  fetchedAt: string;
  source: "live" | "cache" | "empty";
}> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return {
      changes: cache.rows,
      fetchedAt: new Date(cache.at).toISOString(),
      source: "cache",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(MEMBERSHIP_QUERY)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
      signal: controller.signal,
      next: { revalidate: 900 },
    });
    if (!res.ok) throw new Error(`SPARQL ${res.status}`);
    const json = (await res.json()) as { results: { bindings: SparqlBinding[] } };
    const changes = extractGroupChanges(json.results.bindings ?? []);
    cache = { at: now, rows: changes };
    return { changes, fetchedAt: new Date(now).toISOString(), source: "live" };
  } catch {
    if (cache) {
      return {
        changes: cache.rows,
        fetchedAt: new Date(cache.at).toISOString(),
        source: "cache",
      };
    }
    return { changes: [], fetchedAt: new Date().toISOString(), source: "empty" };
  } finally {
    clearTimeout(timer);
  }
}

/** Ultimo cambio gruppo per cognome (match parziale). */
export function latestCameraChangeBySurname(
  changes: CameraGroupChangeRow[],
  nome: string,
): CameraGroupChangeRow | null {
  const parts = nome.toLowerCase().split(/\s+/);
  const cognome = parts[parts.length - 1];
  if (!cognome) return null;
  return (
    changes.find((c) => c.nomeDisplay.toLowerCase().includes(cognome)) ??
    changes.find((c) => c.nomeDisplay.toLowerCase() === nome.toLowerCase()) ??
    null
  );
}

export type CameraRegionHint = Region | null;
