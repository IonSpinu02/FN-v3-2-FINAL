import { formatIntIt } from "@/lib/formatIt";

/**
 * Arrotonda i voti previsionali in modo coerente con l’incertezza del modello.
 * Non mostra mai precisione al singolo elettore (es. +151.171).
 * Base tipica: affluenza Europee ~23,26M voti validi (dichiarata in nota).
 */
export function formatApproximateVotes(
  votes: number,
  opts?: { signed?: boolean; suffix?: string },
): string {
  const signed = opts?.signed !== false;
  const suffix = opts?.suffix ?? " voti indicativi";
  const abs = Math.abs(votes);
  let rounded: number;
  if (abs < 500) {
    rounded = Math.round(abs / 100) * 100;
    if (rounded === 0 && abs > 0) rounded = 100;
  } else if (abs < 5_000) {
    rounded = Math.round(abs / 500) * 500;
  } else if (abs < 50_000) {
    rounded = Math.round(abs / 1_000) * 1_000;
  } else if (abs < 250_000) {
    rounded = Math.round(abs / 5_000) * 5_000;
  } else {
    rounded = Math.round(abs / 10_000) * 10_000;
  }
  const body = formatIntIt(rounded);
  if (!signed) return `circa ${body}${suffix}`;
  if (votes > 0) return `circa +${body}${suffix}`;
  if (votes < 0) return `circa −${body}${suffix}`;
  return `circa ${body}${suffix}`;
}

/** Forma breve per KPI: +1,25 mln oppure +118k. */
export function formatCompactVotes(votes: number): string {
  const sign = votes > 0 ? "+" : votes < 0 ? "−" : "";
  const abs = Math.abs(votes);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace(".", ",")} mln`;
  return `${sign}${formatIntIt(Math.round(abs / 1_000))}k`;
}

/** True se la stringa mostra ancora precisione all’unità (da evitare in UI). */
export function hasUnitVotePrecision(label: string): boolean {
  return /[+\-−]?\d{1,3}(?:\.\d{3})+(?!\s*000\b)/.test(label) && !/circa/i.test(label);
}
