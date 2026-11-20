/**
 * Matrici flussi elettorali — documento «Provenienza dei potenziali voti FN · Analisi Flussi 2026».
 * Modulo senza dipendenze: lo usano sia `politicalModel` sia il motore di previsione v4.
 */

export type FlussiMatrixId = "ipsos_luglio_2026" | "skytg24_ottobre_2026";

export type FlussiIpsos = {
  FdI: number;
  Lega: number;
  ast: number;
  /** Residuo «Altre provenienze»; se assente, derivato da 1 − (FdI + Lega + ast). */
  altri?: number;
};

export interface FlussiMatrixDefinition {
  id: FlussiMatrixId;
  title: string;
  badge: string;
  sourceShort: string;
  method: string;
  quotes: { FdI: number; Lega: number; ast: number; altri: number };
}

export const DEFAULT_FLUSSI_MATRIX_ID: FlussiMatrixId = "ipsos_luglio_2026";

export const FLUSSI_MATRICES: FlussiMatrixDefinition[] = [
  {
    id: "ipsos_luglio_2026",
    title: "Ipsos giugno/luglio",
    badge: "Analisi demoscopica pubblicata",
    sourceShort: "Ipsos Doxa, Pagnoncelli · 5 lug 2026",
    method:
      "Ipsos Doxa (Nando Pagnoncelli, 5 luglio 2026) · ~20.000 interviste (feb–giu 2026)",
    quotes: { FdI: 0.31, Lega: 0.25, ast: 0.36, altri: 0.08 },
  },
  {
    id: "skytg24_ottobre_2026",
    title: "Sky TG24 ottobre",
    badge: "Analisi demoscopica più recente",
    sourceShort: "Sky TG24, Numeri · 10 ott 2026",
    method:
      "Sky TG24 (10 ottobre 2026, programma Numeri del 9 ottobre) · rif. Europee 2024",
    quotes: { FdI: 0.195, Lega: 0.138, ast: 0.574, altri: 0.093 },
  },
];

const MATRIX_BY_ID = Object.fromEntries(
  FLUSSI_MATRICES.map((m) => [m.id, m]),
) as Record<FlussiMatrixId, FlussiMatrixDefinition>;

export function flussiFromMatrix(id: FlussiMatrixId): FlussiIpsos {
  const q = MATRIX_BY_ID[id].quotes;
  return { FdI: q.FdI, Lega: q.Lega, ast: q.ast, altri: q.altri };
}

export const OFFICIAL_FLUSSI: FlussiIpsos = flussiFromMatrix("ipsos_luglio_2026");

export function flussiAltri(f: FlussiIpsos): number {
  if (f.altri != null && f.altri >= 0) return f.altri;
  return Math.max(0, 1 - f.FdI - f.Lega - f.ast);
}

const FL_TOL = 1e-4;

export function flussiQuotesEqual(a: FlussiIpsos, b: FlussiIpsos): boolean {
  return (
    Math.abs(a.FdI - b.FdI) <= FL_TOL &&
    Math.abs(a.Lega - b.Lega) <= FL_TOL &&
    Math.abs(a.ast - b.ast) <= FL_TOL &&
    Math.abs(flussiAltri(a) - flussiAltri(b)) <= FL_TOL
  );
}

export function detectFlussiMatrixId(f: FlussiIpsos): FlussiMatrixId | null {
  for (const m of FLUSSI_MATRICES) {
    const q = flussiFromMatrix(m.id);
    if (flussiQuotesEqual(f, q)) return m.id;
  }
  return null;
}

export function isOfficialFlussi(flussi: FlussiIpsos): boolean {
  return detectFlussiMatrixId(flussi) === DEFAULT_FLUSSI_MATRIX_ID;
}

/** Percentuale italiana (es. 31,0%). */
export function formatFlussiPctIt(share: number): string {
  return `${(share * 100).toFixed(1).replace(".", ",")}%`;
}

export function formatFlussiCaptionIpsos(q: FlussiMatrixDefinition["quotes"]): string {
  return `FdI ${formatFlussiPctIt(q.FdI)} · Lega ${formatFlussiPctIt(q.Lega)} · Ast. ${formatFlussiPctIt(q.ast)} · Altri ${formatFlussiPctIt(q.altri)}`;
}

export function formatFlussiCaptionSky(q: FlussiMatrixDefinition["quotes"]): string {
  return `Ast. ${formatFlussiPctIt(q.ast)} · FdI ${formatFlussiPctIt(q.FdI)} · Lega ${formatFlussiPctIt(q.Lega)} · Altri ${formatFlussiPctIt(q.altri)}`;
}

export function formatFlussiCaption(id: FlussiMatrixId): string {
  const m = MATRIX_BY_ID[id];
  return id === "ipsos_luglio_2026"
    ? formatFlussiCaptionIpsos(m.quotes)
    : formatFlussiCaptionSky(m.quotes);
}

/** @deprecated Usare FLUSSI_MATRICES / flussiFromMatrix */
export const FLUSSI_PRESETS: Record<string, FlussiIpsos> = Object.fromEntries(
  FLUSSI_MATRICES.map((m) => [m.title, flussiFromMatrix(m.id)]),
);
