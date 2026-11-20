import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import type { BasinId, BridgeTheme, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";

export type VannacciDirective = {
  scale: string;
  equation: string;
  moves: readonly [string, string, string];
  phase: string;
  residual: string | null;
};

export const BASIN_COMMAND: Record<BasinId, string> = {
  delusi_coalizione: "Delusi Centrodestra (Lega / FdI / FI)",
  astensione_recuperabile: "Astensione di protesta recuperabile",
  voto_tematico_ponte: "Ceto produttivo e voto tematico (PMI, sicurezza, sanità)",
  radicamento_civico_eletti: "Reti civiche e amministratori locali",
};

export const THEME_ATTACK: Record<BridgeTheme, string> = {
  Sicurezza: "Sicurezza stazioni e presidio delle forze dell'ordine",
  "Liste d'attesa Sanità": "Piano urgenza liste d'attesa sanità",
  "Energia PMI": "Stop follie Green Deal e salva-manifattura",
  "Fisco P.IVA": "Scudo fiscale P.IVA e energia PMI",
  "Casa/Mutui": "Casa, mutui e potere d'acquisto",
  "Trasporti/Flussi": "Presidio dei flussi e dei nodi di trasporto",
};

const ACCELERATORS =
  "polarizzazione su scadenze elettorali, crisi di consenso nel perimetro centrodestra, patti con liste civiche territoriali";

function phaseOf(result: StrategicBackcastResult): string {
  if (result.feasibilityBand === "SHOCK_ESOGENO_RICHIESTO") return "Sfondamento di Sistema";
  if (result.feasibilityBand === "MOBILITAZIONE_STRAORDINARIA" || result.targetPct >= 10.5) return "Mobilitazione Straordinaria";
  if (result.feasibilityBand === "ESPANSIONE_ORGANICA" || result.targetPct >= 8.5) return "Espansione";
  return "Consolidamento";
}

function equationOf(targetPct: number): string {
  if (targetPct < 8.5) {
    return "Il passo è capitalizzare la visibilità e i temi identitari: sicurezza urbana, confini, legalità.";
  }
  if (targetPct < 10.5) {
    return "Al traino personale vanno affiancati i temi-ponte economici e sociali: crisi dell'auto e bollette delle PMI al Nord, liste d'attesa della sanità e potere d'acquisto al Centro-Sud, per intercettare delusi del centrodestra e ceto produttivo.";
  }
  return "La sola esposizione televisiva e sui social va in saturazione senza gambe sul territorio. La priorità è convertire la notorietà in radicamento fisico: presidi provinciali, innesto di amministratori uscenti da Lega, FdI e liste civiche, mobilitazione dell'astensione.";
}

export function localCommitteeNeed(votes: number): number {
  if (votes <= 0) return 0;
  return Math.ceil(votes / 12000);
}

export function buildVannacciStrategicDirective(result: StrategicBackcastResult): VannacciDirective {
  const phase = phaseOf(result);
  const ranked = [...result.regions].sort(
    (a, b) => b.addedVotes - a.addedVotes || b.ceilingPct - b.anchorPct - (a.ceilingPct - a.anchorPct),
  );
  const topRegions = ranked.slice(0, 4).map((row) => row.region);
  const themes = result.themes.slice(0, 2).map((row) => row.theme);
  const scale = `Dal ${formatDecimalIt(result.currentPct, 2)}% attuale al ${formatDecimalIt(result.targetPct, 1)}% in ${result.horizonDays} giorni servono +${formatIntIt(result.totalDeltaVotes)} voti complessivi (+${formatIntIt(result.netSurplusVotes)} oltre la spinta inerziale V4). Fase: ${phase}.`;
  const residual =
    result.exogenousGapPct > 0.05
      ? `La macchina organizzativa e tematica a pieno regime arriva fino al ${formatDecimalIt(result.achievablePct, 1)}%. I restanti ${formatDecimalIt(result.exogenousGapPct, 2)} pp chiedono fattori politici acceleratori: ${ACCELERATORS}.`
      : null;
  const themeMove =
    themes.length >= 2
      ? `Apri il fronte tematico ${themes[0]} e ${themes[1]}`
      : themes.length === 1
        ? `Apri il fronte tematico ${themes[0]}`
        : "Tieni i temi ordinari dell'ordine del giorno, senza aprire fronti extra";
  const committees = result.network.monthlyCommitteeNeed;
  const elected = result.network.monthlyElectedNeed;
  const networkMove =
    committees > 0 || elected > 0
      ? `Ritmo rete: +${formatIntIt(committees)} comitati/mese e +${formatIntIt(elected)} amministratori locali`
      : "Ritmo rete: presidio ordinario, senza nuova cadenza di comitati";
  return {
    scale,
    equation: equationOf(result.targetPct),
    moves: [`Concentra il 70% delle uscite su ${topRegions.join(", ")}`, themeMove, networkMove],
    phase,
    residual,
  };
}
