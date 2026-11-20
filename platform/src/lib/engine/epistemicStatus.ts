import { fnv1a64Hex } from "@/lib/engine/computationFingerprint";

/**
 * Stati epistemologici uniformi su notizie, passaggi e conclusioni.
 */
export type EpistemicStatus =
  | "FATTO_DOCUMENTATO"
  | "ESTRAZIONE_DA_VERIFICARE"
  | "INTERPRETAZIONE_IPOTESI"
  | "DATI_INSUFFICIENTI_CONTRADDIZIONE";

export type EpistemicBadge = {
  status: EpistemicStatus;
  label: string;
  short: string;
  tone: "documented" | "review" | "hypothesis" | "insufficient";
};

export const EPISTEMIC_BADGES: Record<EpistemicStatus, EpistemicBadge> = {
  FATTO_DOCUMENTATO: {
    status: "FATTO_DOCUMENTATO",
    label: "Fatto documentato",
    short: "DOCUMENTATO",
    tone: "documented",
  },
  ESTRAZIONE_DA_VERIFICARE: {
    status: "ESTRAZIONE_DA_VERIFICARE",
    label: "Estrazione automatica da verificare",
    short: "DA VERIFICARE",
    tone: "review",
  },
  INTERPRETAZIONE_IPOTESI: {
    status: "INTERPRETAZIONE_IPOTESI",
    label: "Interpretazione / ipotesi di scenario",
    short: "IPOTESI",
    tone: "hypothesis",
  },
  DATI_INSUFFICIENTI_CONTRADDIZIONE: {
    status: "DATI_INSUFFICIENTI_CONTRADDIZIONE",
    label: "Dati insufficienti / contraddizione",
    short: "INSUFFICIENTE",
    tone: "insufficient",
  },
};

export type SupervisionDecision = "confirmed" | "excluded" | "flagged_contradiction";

export type SupervisionEntityType =
  | "news_item"
  | "party_switch"
  | "event"
  | "claim";

/** Classifica un titolo grezzo in assenza di atto primario verificato. */
export function classifyHeadlineEpistemic(opts: {
  hasPrimarySource?: boolean;
  confidence?: "high" | "medium" | "low";
  contradicted?: boolean;
  isScenarioClaim?: boolean;
}): EpistemicStatus {
  if (opts.contradicted) return "DATI_INSUFFICIENTI_CONTRADDIZIONE";
  if (opts.isScenarioClaim) return "INTERPRETAZIONE_IPOTESI";
  if (opts.hasPrimarySource && opts.confidence === "high") return "FATTO_DOCUMENTATO";
  if (opts.confidence === "low") return "DATI_INSUFFICIENTI_CONTRADDIZIONE";
  return "ESTRAZIONE_DA_VERIFICARE";
}

/** ID stabile per un titolo notizia (hash, indipendente dall'ordine in lista). */
export function newsEntityId(headline: string): string {
  return `news:${fnv1a64Hex(headline.trim().toLowerCase()).slice(0, 12)}`;
}

/** ID stabile per un passaggio / claim di dossier. */
export function claimEntityId(text: string): string {
  return `claim:${fnv1a64Hex(text.trim().toLowerCase()).slice(0, 12)}`;
}

/** ID stabile per un cambio di partito / defezione. */
export function partySwitchEntityId(key: string): string {
  return `party_switch:${fnv1a64Hex(key.trim().toLowerCase()).slice(0, 12)}`;
}
