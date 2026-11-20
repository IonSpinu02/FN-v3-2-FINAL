/** Interi con separatore migliaia italiano (punto). */
export function formatIntIt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatPctIt(share: number, digits = 2): string {
  return `${(share * 100).toFixed(digits).replace(".", ",")}%`;
}

/** Punti percentuali con segno esplicito; evita `-0,00`. */
export function formatPpSignedIt(ppVal: number, digits = 2): string {
  const v = Math.abs(ppVal) < 0.005 ? 0 : ppVal;
  const body = v.toFixed(digits).replace(".", ",");
  if (v > 0) return `+${body} pp`;
  if (v < 0) return `${body} pp`;
  return `+${body} pp`;
}

/** Come `formatPpSignedIt`, ma in parole: «+0,60 punti». */
export function formatPuntiSignedIt(ppVal: number, digits = 2): string {
  return formatPpSignedIt(ppVal, digits).replace(" pp", " punti");
}

export function formatDecimalIt(n: number, digits = 4): string {
  return n.toFixed(digits).replace(".", ",");
}

const IT_MONTHS_SHORT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
] as const;

/** ISO `YYYY-MM-DD` → `29 ott 2026` (helper leggero, zero dipendenze). */
export function formatIsoDateIt(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!mo || mo < 1 || mo > 12) return iso.trim();
  return `${d} ${IT_MONTHS_SHORT[mo - 1]} ${y}`;
}

/** Voti compatti per badge card (+30.400 voti). */
export function formatCompactVotes(n: number): string {
  return formatIntIt(n);
}

export {
  formatApproximateVotes,
  hasUnitVotePrecision,
} from "@/lib/formatApproximateVotes";
