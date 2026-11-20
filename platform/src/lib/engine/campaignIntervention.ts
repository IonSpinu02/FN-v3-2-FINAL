export const CAMPAIGN_INTERVENTION_KEY = "fn-campaign-intervention";
export const CAMPAIGN_INTERVENTION_EVENT = "fn-campaign-intervention";

export type CampaignIntervention = {
  region: string;
  tema: string;
  frase: string;
  /** Giorno ISO dell'atto. */
  date: string;
  /** Consenso nazionale nel momento della registrazione (0–100). */
  consensusPct: number;
};

export function saveCampaignIntervention(item: CampaignIntervention): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CAMPAIGN_INTERVENTION_KEY, JSON.stringify(item));
  window.dispatchEvent(new Event(CAMPAIGN_INTERVENTION_EVENT));
}

export function loadCampaignIntervention(): CampaignIntervention | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_INTERVENTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignIntervention;
    if (!parsed?.date || !Number.isFinite(parsed.consensusPct)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function dayMs(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
}

/** Confronto entro 14 giorni. Non attribuisce il movimento all'intervento. */
export function interventionControlNote(
  item: CampaignIntervention | null,
  currentPct: number,
  asOfIso: string,
): string | null {
  if (!item) return null;
  const start = dayMs(item.date);
  const asOf = dayMs(asOfIso);
  if (!Number.isFinite(start) || !Number.isFinite(asOf)) return null;
  const days = (asOf - start) / 86400000;
  if (days < 0 || days > 14) return null;
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");
  const delta = currentPct - item.consensusPct;
  const signed = `${delta > 0 ? "+" : ""}${fmt(delta)}`;
  const bucket = days >= 7 ? "14gg" : "7gg";
  return `Verifica temporale post-intervento, senza attribuzione causale automatica. [${item.date}] Azione eseguita su ${item.tema}/${item.region} -> Consenso alla data: ${fmt(item.consensusPct)}% -> Consenso rilevato dopo ${bucket}: ${fmt(currentPct)}% (Δ ${signed} pp).`;
}
