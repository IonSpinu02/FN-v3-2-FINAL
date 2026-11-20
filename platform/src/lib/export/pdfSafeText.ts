/**
 * Normalizza testo per @react-pdf/renderer: glifi Unicode non affidabili
 * su font subset → ASCII sicuro, segni espliciti, spazi attorno ai separatori.
 */
export function pdfSafeText(input: unknown): string {
  let s = String(input ?? "");
  s = s.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\uFE58\uFE63\uFF0D]/g, "-");
  s = s.replace(/[→⇒➔➞➝➙]/g, "->");
  s = s.replace(/[←⇐]/g, "<-");
  s = s.replace(/[≈≃≅⁓]/g, " circa ");
  s = s.replace(/[Δ∆]/g, "Var. ");
  s = s.replace(/[≥≧]/g, ">=");
  s = s.replace(/[≤≦]/g, "<=");
  s = s.replace(/±/g, "+/-");
  s = s.replace(/\u2026/g, "...");
  s = s.replace(/[«»“”„‟]/g, '"');
  s = s.replace(/[‘’‚‛]/g, "'");
  s = s.replace(/[\u00A0\u202F\u2007\u2009]/g, " ");
  // Middot / bullet: Inter Bold a volte li droppa → ASCII " - "
  s = s.replace(/\s*[·•∙⋅\u00B7\u2022\u2219]\s*/g, " - ");
  // Latex / false superscripts
  s = s.replace(/\$?3\^?\{?\\?circ\}?\$?/gi, "3°");
  s = s.replace(/\$3\^\{\\circ\}\$/g, "3°");
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .trim();
  s = s.replace(/testiRegole/gi, "testi - Regole");
  s = s.replace(/\.n\.d\./gi, " - n.d.");
  s = s.replace(/itn\.d\./gi, "it - n.d.");
  s = s.replace(/\.{2,}/g, ".");
  s = s.replace(/\s+\./g, ".");
  // Evita "BIP.13-CVCARO" se un separatore e' andato perso
  s = s.replace(
    /\b(BIP\.\d+(?:-(?:EN|TR|CV|SAN))?)(?=[A-Z]{2,})/g,
    "$1 - ",
  );
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/** Rimuove jargon tecnico interno dal testo rivolto a Cabina di Regia. */
export function sanitizeDossierPublicText(input: unknown): string {
  let s = pdfSafeText(input);
  s = s.replace(/\bV4\b/gi, "");
  s = s.replace(/\bforecastEngineV4\b/gi, "");
  s = s.replace(/\bcomputationId\b/gi, "riferimento");
  s = s.replace(/\bRef\.\s*#/gi, "Codice verifica calcolo: #");
  s = s.replace(/\bsoft-?floor\b/gi, "soglia di smorzamento");
  s = s.replace(/\bwalk-?forward\b/gi, "verifica sul passato recente");
  s = s.replace(/\bMAE\b/g, "scarto medio");
  s = s.replace(/\bS0\b/g, "stima odierna");
  s = s.replace(/\bCoverage motore\b/gi, "Fonti acquisite");
  s = s.replace(/\bCoverage\b/gi, "Fonti");
  s = s.replace(/PRIORIT[AÀ]\s+ESPOSIZIONE\s+VANNACCI/gi, "priorità territoriali");
  s = s.replace(/Analisi AI live Anthropic/gi, "Analisi strategica AI su dati aggiornati");
  s = s.replace(/Regole deterministiche di modello/gi, "Elaborazione automatica su dati piattaforma");
  s = s.replace(/Sintesi di modello/gi, "Elaborazione automatica su dati piattaforma");
  s = s.replace(/Analisi assistita/gi, "Analisi strategica AI su dati aggiornati");
  s = s.replace(/deriva soli sondaggi V4/gi, "proiezione sui soli sondaggi");
  s = s.replace(
    /linea di fondo filtrata\s*\(~?([^)]+)%\)/gi,
    "zoccolo duro strutturale stimato intorno al $1% (al netto delle oscillazioni tra istituti)",
  );
  s = s.replace(
    /riferimento statico\s*(\+\/-|\+\/\-)?\s*([\d,]+)\s*pt/gi,
    "ipotesi di consenso fermo (+/-$2 punti)",
  );
  s = s.replace(/\bMSNA\b/g, "minori stranieri non accompagnati");
  // ERP idempotente: collassa annidamenti, non riespandere se gia' "case popolari"
  s = s.replace(/(?:case popolari\s*\()+\s*ERP\s*\)+/gi, "case popolari");
  s = s.replace(/\bcase popolari\s*\(\s*ERP\s*\)/gi, "case popolari");
  s = s.replace(/(?<!case popolari\s)\bERP\b/gi, "case popolari");
  s = s.replace(/\bvoti indicativi\b/gi, "voti");
  s = s.replace(/\+\s*\+/g, "+");
  // Collassa "circa circa circa"
  s = s.replace(/\b(circa\s+){2,}/gi, "circa ");
  // Apostrofi finti → accenti italiani (solo forme note, niente sostituzioni cieche)
  s = s.replace(/\bpiu'/gi, "più");
  s = s.replace(/\bgia'/gi, "già");
  s = s.replace(/\bpuo'/gi, "può");
  s = s.replace(/\bperche'/gi, "perché");
  s = s.replace(/\bperch(?![eéèêë])/gi, "perché");
  s = s.replace(/\bperche\b/gi, "perché");
  s = s.replace(/\bPrefeture\b/g, "Prefetture");
  s = s.replace(/\bcosi'/gi, "così");
  s = s.replace(/\bnon e'/gi, "non è");
  s = s.replace(/\bNon e'/g, "Non è");
  s = s.replace(/\be' anche\b/gi, "è anche");
  s = s.replace(/\bE' /g, "È ");
  s = s.replace(/\bsanita'/gi, "sanità");
  s = s.replace(/\bSANITA'/g, "SANITÀ");
  s = s.replace(/\battivita'/gi, "attività");
  s = s.replace(/\bopportunita'/gi, "opportunità");
  s = s.replace(/\bvelocita'/gi, "velocità");
  s = s.replace(/\bricettivita'/gi, "ricettività");
  s = s.replace(/\bpriorita'/gi, "priorità");
  s = s.replace(/\bmobilita'/gi, "mobilità");
  s = s.replace(/\bcontinuita'/gi, "continuità");
  s = s.replace(/\baffinita'/gi, "affinità");
  s = s.replace(/\bnatalita'/gi, "natalità");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/** Delta in punti con segno ASCII esplicito (+ / -). */
export function pdfSignedPp(n: number, digits = 2): string {
  const v = Math.abs(n) < 0.5 / 10 ** digits ? 0 : n;
  const body = Math.abs(v)
    .toFixed(digits)
    .replace(".", ",");
  if (v > 0) return `+${body}`;
  if (v < 0) return `-${body}`;
  return `+${body}`;
}

/** Percentuale con virgola italiana (senza segno). */
export function pdfPct(n: number, digits = 2): string {
  return `${Number(n).toFixed(digits).replace(".", ",")}%`;
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

const IT_MONTHS_LONG = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

/** Data ISO → `31 ott 2026` o `10 novembre 2026`. */
export function formatDateIt(
  iso: string,
  style: "short" | "long" = "short",
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!mo || mo < 1 || mo > 12) return iso;
  if (style === "long") {
    return `${d} ${IT_MONTHS_LONG[mo - 1]} ${y}`;
  }
  return `${d} ${IT_MONTHS_SHORT[mo - 1]} ${y}`;
}
