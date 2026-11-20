import { BIP_CHAPTERS } from "@/lib/bipProgramCatalog";
import { BIP_FLAGSHIP_TREND_TEMPLATES } from "@/lib/googleTrendsBipCatalog";
import { REGIONS, type Region } from "@/lib/engine/constants";
import { causeNoteForWindow } from "@/lib/engine/consensoCauseNote";
import { scoreHeadline } from "@/lib/engine/growthEvidence";
import type { GrowthEvidence, HorizonProjection } from "@/lib/engine/growthTrajectory";
import { NATIONAL_FABBISOGNI_BENCHMARKS } from "@/lib/engine/osservatorioTerritoryScope";
import { getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import { catalogSeedsForNewsFeed } from "@/lib/politicalDefectionsCatalog";
import { FLUSSI_MATRICES } from "@/lib/politicalModel";

export type FactorStatus = "FAVOREVOLE" | "CRITICO" | "NEUTRO";

export type WeightedFactorRow = {
  id: string;
  name: string;
  weightPct: number;
  /** Punti del motore, se questo fattore ha una riga propria. Altrimenti null: è contesto, non un addendo. */
  impactPp: number | null;
  status: FactorStatus;
  evidence: string;
  sourceLabel: string;
};

export type BipAct = {
  title: string;
  chapter: string;
  body: string;
  ente: string;
  tempi: string;
  kind: "scheda";
};

export type TerritoryDirective = {
  region: string;
  basin: string;
  permeabilita: number;
  piazza: string;
  leva: string;
  fdiPct: number;
  legaPct: number;
  cdxPct: number;
  pdPct: number;
  preferenze: number | null;
  preferenzeTipo: "osservato" | "ricostruito" | null;
  iscritti: number | null;
};

export type ExecutiveStrategicBriefing = {
  macroFactors: WeightedFactorRow[];
  causalDiagnosis: {
    sintesiEsecutiva: string;
    anatomiaDelMovimento: string;
    analisiRischioOpportunita: string;
  };
  remediationPlan: {
    regolaAurea: string;
    atti: BipAct[];
    dichiarazione: string;
    direttrici: TerritoryDirective[];
  };
};

function statusFromPp(pp: number | null, gap = false): FactorStatus {
  if (gap) return "CRITICO";
  if (pp == null) return "NEUTRO";
  if (pp < -0.02) return "CRITICO";
  if (pp > 0.02) return "FAVOREVOLE";
  return "NEUTRO";
}

function europeanPreferences(): { n: number; source: string } | null {
  for (const person of catalogSeedsForNewsFeed()) {
    const n = person.electoral.preferenzeStoriche;
    const source = person.electoral.sourceLabel;
    if (n && n >= 100_000 && source) return { n, source };
  }
  return null;
}

function shareIt(fraction: number): string {
  return (fraction * 100).toFixed(1).replace(".", ",");
}

function headlineAccount(headlines: string[], newsScore: number): string {
  const neg = headlines.filter((title) => scoreHeadline(title) < 0).length;
  const pos = headlines.filter((title) => scoreHeadline(title) > 0).length;
  const neu = headlines.length - neg - pos;
  const parts = [
    neg > 0 ? `${neg} con parole di calo` : null,
    pos > 0 ? `${pos} con parole di crescita` : null,
    neu > 0 ? `${neu} neutr${neu === 1 ? "o" : "i"}` : null,
  ].filter((part): part is string => part != null);
  const driving =
    newsScore < 0
      ? headlines.find((title) => scoreHeadline(title) < 0)
      : newsScore > 0
        ? headlines.find((title) => scoreHeadline(title) > 0)
        : null;
  const count = `${headlines.length} titoli in finestra${parts.length > 0 ? ` (${parts.join(", ")})` : ""}.`;
  return driving ? `${count} Titolo trainante sul segno: «${driving}».` : count;
}

export function piazzaForRegion(region: Region): string {
  return SQUARE[region]?.piazza ?? "Nessuna piazza di scheda per questa regione.";
}

const SQUARE: Partial<Record<Region, { piazza: string; leva: string }>> = {
  Veneto: {
    piazza:
      "Distretti PMI Vicenza–Treviso–Padova e sicurezza di abitazioni e stazioni (Mestre–Verona). Scheda territoriale.",
    leva: "Taglio degli oneri sulle bollette industriali, stop al saldo e acconto, legittima difesa.",
  },
  "Friuli-Venezia Giulia": {
    piazza: "Trieste, Gorizia e polo navale di Monfalcone. Scheda territoriale.",
    leva: "Presidio del confine sulla rotta balcanica, rimpatri e trasferimento dei costi MSNA dai Comuni alle Prefetture.",
  },
  Lombardia: {
    piazza:
      "Milano (Stazione Centrale e San Vittore, oltre il 200% in scheda contro il 138% nazionale) e distretti manifatturieri Brescia–Brianza.",
    leva: "Protocollo di sicurezza nelle stazioni, piano carceri e Mutuo Tricolore per le giovani coppie.",
  },
  Piemonte: {
    piazza: "Indotto auto e cassa integrazione a Mirafiori. Scheda territoriale.",
    leva: "Stop agli obblighi che chiudono il motore termico, biocarburanti e tutela della filiera.",
  },
  Puglia: {
    piazza: "Carceri del distretto Puglia-Basilicata, 165% in scheda.",
    leva: "Piano carceri e rimpatrio dei detenuti stranieri.",
  },
  Campania: {
    piazza: "Indotto auto a Pomigliano. Scheda territoriale.",
    leva: "Tutela dei motori termici e del lavoro giovane nell'automotive.",
  },
  Lazio: {
    piazza: "Stazione Termini ed Esquilino. Scheda territoriale.",
    leva: "Presidio delle stazioni e sgombero delle occupazioni.",
  },
};

function spokenDeclaration(stageTitle: string | null): string {
  const prefix = "Bozza per lo staff · ";
  if (stageTitle && /bilancio|manovra/i.test(stageTitle)) {
    return `${prefix}«Mentre nei palazzi romani passano le giornate a misurare i decimali dei sondaggi, le famiglie e le imprese italiane affogano tra bollette, tasse e stazioni fuori controllo. Con Futuro Nazionale chiediamo tre cose immediate in Manovra: stop a saldo e acconto per le Partite IVA, Energia Sovrana senza follie Green UE e Mutuo Tricolore azzerato per i giovani italiani che fanno figli.»`;
  }
  return `${prefix}«Mentre nei palazzi romani misurano i decimali dei sondaggi, le famiglie e le imprese italiane affogano tra bollette, tasse e stazioni fuori controllo. Con Futuro Nazionale chiediamo tre cose immediate: stop a saldo e acconto per le Partite IVA, Energia Sovrana senza follie Green UE e Mutuo Tricolore azzerato per i giovani italiani che fanno figli.»`;
}

function chapterLine(num: number): string {
  const ch = BIP_CHAPTERS.find((c) => c.num === num);
  if (!ch) return `Cap. ${num}`;
  return `Cap. ${ch.num} ${ch.title} (${ch.pages})`;
}

export function buildExecutiveStrategicBriefing(input: {
  startPct: number;
  evidence: GrowthEvidence;
  projection: HorizonProjection;
  abstentionShare: number;
  scenarioRows?: {
    regione: Region;
    preferenze: number;
    tipo_preferenze: "osservato" | "ricostruito";
    iscritti: number;
  }[];
}): ExecutiveStrategicBriefing {
  const { evidence, projection } = input;
  const cause = causeNoteForWindow(evidence.slopeTo ?? undefined);
  const prefs = europeanPreferences();
  const sanita = NATIONAL_FABBISOGNI_BENCHMARKS.sanita;
  const famiglie = NATIONAL_FABBISOGNI_BENCHMARKS.famiglie;
  const lavoro = NATIONAL_FABBISOGNI_BENCHMARKS.lavoro;
  const trends = [...BIP_FLAGSHIP_TREND_TEMPLATES].sort((a, b) => b.fixedSurgePct - a.fixedSurgePct);
  const topTrends = trends.slice(0, 3);
  const activeMonths = projection.timeline.filter((item) => item.inSelectedWindow);
  const stage = activeMonths[0];
  const abstentionPct = Math.round(input.abstentionShare * 100);
  const falling = projection.deltaPp < 0;

  const demoscopia: WeightedFactorRow = {
    id: "demoscopia",
    name: "Dinamica dei sondaggi e competizione",
    weightPct: 35,
    impactPp: projection.slopePp,
    status: statusFromPp(projection.slopePp),
    evidence: [
      `Consenso di partenza ${input.startPct.toFixed(2).replace(".", ",")}%. `,
      `Pendenza della serie ${evidence.slopePpPerMonth.toFixed(2).replace(".", ",")} punti al mese`,
      evidence.slopeFrom && evidence.slopeTo ? ` tra ${evidence.slopeFrom} e ${evidence.slopeTo}` : "",
      `. In questo lasso il momentum filtrato (Kalman con effetto istituto e rientro al livello misurato) vale ${projection.slopePp.toFixed(2).replace(".", ",")} punti; se gli ultimi 15 giorni sono stabili il calo non viene proiettato.`,
      ` Gli ex-astenuti pesano ${abstentionPct}% nel parametro di affluenza passato al modello.`,
      cause ? ` ${cause.text}` : "",
      prefs
        ? ` Il nucleo di preferenze europee in catalogo è ${prefs.n.toLocaleString("it-IT")} (${prefs.source}): sotto il 6,8% il modello attenua i colpi negativi, non li cancella.`
        : " Sotto il 6,8% il modello attenua i colpi negativi, non li cancella.",
    ].join(""),
    sourceLabel: "Misurato · Supermedia e sondaggi dei singoli istituti. Stima · fattore 1 del modello v4.0.",
  };

  const economia: WeightedFactorRow = {
    id: "economia",
    name: "Congiuntura, bollette e costo della vita",
    weightPct: 20,
    impactPp: null,
    status: "NEUTRO",
    evidence: [
      `Sovraccarico del costo abitativo ${String(famiglie.sov).replace(".", ",")}% (benchmark nazionale).`,
      ` ${trends.find((t) => t.slug === "mutuo-prima-casa-under-35")?.datoBase ?? ""}`,
      ` ${trends.find((t) => t.slug === "bollette-oneri-sistema")?.datoBase ?? ""}`,
      " Scheda, non una misura del giorno.",
    ].join(""),
    sourceLabel: "Scheda di catalogo. Contesto macro, non sommato al saldo.",
  };

  const stampa: WeightedFactorRow = {
    id: "stampa",
    name: "Agenda, temi posseduti e titoli",
    weightPct: 15,
    impactPp: projection.newsPp,
    status: statusFromPp(projection.newsPp),
    evidence: [
      headlineAccount(evidence.newsHeadlines, evidence.newsScore),
      ` Segno dalle parole del titolo: ${evidence.newsScore.toFixed(2).replace(".", ",")}.`,
      ` In questo lasso il fattore agenda vale ${projection.newsPp.toFixed(2).replace(".", ",")} punti: salienza Eurobarometro di sicurezza, fisco, potere d'acquisto e sanità, corretta dai titoli.`,
      " Rispondere a un titolo sul calo produce un altro titolo sul calo.",
    ].join(""),
    sourceLabel: "Stima · Eurobarometro 104 e parole dei titoli, non un giudizio sul pezzo.",
  };

  const agenda: WeightedFactorRow = {
    id: "agenda",
    name: "Ciclo elettorale e calendario",
    weightPct: 15,
    impactPp: projection.seasonalEventPp,
    status: statusFromPp(projection.seasonalEventPp),
    evidence: activeMonths.length
      ? activeMonths
          .map(
            (item) =>
              `${item.monthShort}: ${item.ordinary.title} (${item.ordinary.sourceLabel}). ${item.ordinary.why}`,
          )
          .join(" ")
      : "Nessun mese di calendario pesa in questo lasso.",
    sourceLabel: stage?.ordinary.kind === "calendario" ? "Misurato · fonte normativa del mese." : "Stima · ipotesi di calendario.",
  };

  const sociale: WeightedFactorRow = {
    id: "sociale",
    name: "Sicurezza, carceri e servizi",
    weightPct: 10,
    impactPp: null,
    status: sanita.stress >= 55 || famiglie.stress >= 55 ? "CRITICO" : "NEUTRO",
    evidence: [
      `Attesa specialistica di benchmark: ${sanita.gg} giorni. Rinuncia alle cure: ${String(sanita.rinuncia).replace(".", ",")}%.`,
      ` Occupazione 20–64 anni: ${String(lavoro.occ).replace(".", ",")}%.`,
      ` ${trends.find((t) => t.slug === "baby-gang-legittima-difesa")?.datoBase ?? ""}`,
      ` ${trends.find((t) => t.slug === "erp-msna-comuni")?.datoBase ?? ""}`,
      " Scheda, non una rilevazione di questa settimana.",
    ].join(""),
    sourceLabel: "Scheda di catalogo. Contesto macro, non sommato al saldo.",
  };

  const domanda: WeightedFactorRow = {
    id: "domanda",
    name: "Bacini, rete e istituzioni",
    weightPct: 5,
    impactPp: projection.bipPp,
    status: statusFromPp(projection.bipPp, projection.bipPp === 0),
    evidence: [
      `Bacini contendibili FdI/Lega, rete dei tesserati e magnete istituzionale valgono ${projection.bipPp.toFixed(2).replace(".", ",")} punti in questo lasso.`,
      evidence.bipLabels.length === 0
        ? " Gap di trasmissione: le schede di domanda (non misure Google del giorno) indicano ricerche su mutuo, bollette, sicurezza e case popolari, ma i titoli in finestra non nominano una misura."
        : ` I titoli agganciano ${evidence.bipLabels[0]}.`,
      ` Schede in catalogo: ${topTrends.map((t) => `${t.exactQuery} +${t.fixedSurgePct}%`).join("; ")}.`,
    ].join(""),
    sourceLabel: "Stima · fattori 3, 4 e 5 del modello v4.0. Scheda · percentuali di ricerca del catalogo, non Google di oggi.",
  };

  const macroFactors = [demoscopia, economia, stampa, agenda, sociale, domanda];

  const pct = (n: number) => n.toFixed(2).replace(".", ",");
  const sintesiEsecutiva = [
    `In ${projection.label} il consenso misurato di partenza, ${pct(input.startPct)}%, arriva in stima a ${pct(projection.centralPct)}% (${pct(projection.deltaPp)} punti).`,
    ` Di questi, ${pct(projection.slopePp)} punti sono il momentum filtrato della serie.`,
    ` Il resto pesa ${pct(projection.newsPp)} punti dall'agenda dei temi, ${pct(projection.seasonalEventPp)} dal ciclo elettorale e ${pct(projection.bipPp)} da bacini, rete e istituzioni.`,
  ].join("");

  const ipsos = FLUSSI_MATRICES.find((matrix) => matrix.id === "ipsos_luglio_2026");
  const sky = FLUSSI_MATRICES.find((matrix) => matrix.id === "skytg24_ottobre_2026");
  const latency = `Lontano dalle urne il bacino di ex-astenuti va in latenza: ${ipsos ? `${shareIt(ipsos.quotes.ast)}% nella lettura ${ipsos.title}` : `${abstentionPct}%`}${sky ? ` e ${shareIt(sky.quotes.ast)}% in ${sky.title}` : ""}. Questo calcolo usa il ${abstentionPct}% della matrice attiva.`;
  const tv =
    stage && cause
      ? ` Durante «${stage.ordinary.title}» lo spazio televisivo si comprime sulla maggioranza, e le fonti del periodo leggono anche un contenimento di Fratelli d'Italia. I pezzi stanno nella scheda demoscopica.`
      : stage
        ? ` Il calendario di questo lasso è «${stage.ordinary.title}».`
        : cause
          ? " Le fonti del periodo leggono meno visibilità e un contenimento di Fratelli d'Italia. I pezzi stanno nella scheda demoscopica."
          : "";
  const program =
    evidence.bipLabels.length === 0
      ? ` I titoli in finestra parlano di sondaggi, non delle proposte economiche e securitarie. Bacini, rete e istituzioni valgono comunque ${pct(projection.bipPp)} punti.`
      : ` I titoli agganciano già «${evidence.bipLabels[0]}»; bacini, rete e istituzioni valgono ${pct(projection.bipPp)} punti.`;

  const anatomiaDelMovimento = falling
    ? [latency, tv, program].join("")
    : [
        "Il movimento è fermo o verso l'alto.",
        ` Il momentum contribuisce ${pct(projection.slopePp)} punti, l'agenda ${pct(projection.newsPp)}, il ciclo elettorale ${pct(projection.seasonalEventPp)}, bacini, rete e istituzioni ${pct(projection.bipPp)}.`,
        " Si tiene la frase sulla misura già nei titoli. Riaprire il solo discorso sul sondaggio rimette il frame sulla rilevazione.",
      ].join("");

  const analisiRischioOpportunita = `Se non cambia il frame, la traiettoria resta verso ${projection.centralPct.toFixed(2).replace(".", ",")}% e la fascia 80% scende fino a ${projection.bandLowPct.toFixed(2).replace(".", ",")}%. La fascia somma l'incertezza dei sondaggi, quella storica e quella dei fattori. Se le misure B.I.P. entrano nei titoli, agenda (oggi ${projection.newsPp.toFixed(2).replace(".", ",")}) e bacini contendibili possono salire: il tetto alto di modello è ${projection.bandHighPct.toFixed(2).replace(".", ",")}%, non un voto promesso.`;

  const regolaAurea = [
    "Non commentare il sondaggio e non rispondere alle polemiche interne: quelle parole tengono acceso il titolo negativo, e il residuo si dimezza solo se non viene rinfocolato.",
    ` Spostare il discorso su ciò che le schede di domanda mettono in cima: ${topTrends.map((t) => t.exactQuery).join("; ")}.`,
    " Sono schede di catalogo, non la classifica Google di stamattina.",
  ].join("");

  const atti: BipAct[] = topTrends.slice(0, 3).map((t) => {
    const cited = /Cap\.\s*(\d+)/.exec(t.soluzioneBip);
    const splitAt = t.soluzioneBip.indexOf(":");
    const title = (splitAt >= 0 ? t.soluzioneBip.slice(0, splitAt) : t.soluzioneBip).trim();
    const detail = splitAt >= 0 ? t.soluzioneBip.slice(splitAt + 1).trim() : "";
    return {
      title,
      chapter: cited ? chapterLine(Number(cited[1])) : t.pillarLabel,
      body: `${detail}${detail ? " " : ""}Dato di scheda: ${t.datoBase}`,
      ente: t.enteCompetente,
      tempi: t.tempiAttuazione,
      kind: "scheda" as const,
    };
  });

  const dichiarazione = spokenDeclaration(stage?.ordinary.title ?? null);

  const byPermeabilita = REGIONS.map((regione) => ({
    regione,
    score: getRegionalPartyHistory(regione).permeabilitaVannacciScore,
    label: getRegionalPartyHistory(regione).permeabilitaLabel,
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const direttrici: TerritoryDirective[] = byPermeabilita.map((row) => {
    const square = SQUARE[row.regione];
    const history = getRegionalPartyHistory(row.regione);
    const scenario = input.scenarioRows?.find((item) => item.regione === row.regione);
    return {
      region: row.regione,
      basin: row.label,
      permeabilita: row.score,
      piazza: square?.piazza ?? "Nessuna piazza di scheda per questa regione.",
      leva: square?.leva ?? "Si usano le tre leve nazionali del mese.",
      fdiPct: history.fdiPct,
      legaPct: history.legaPct,
      cdxPct: Math.round((history.fdiPct + history.legaPct) * 10) / 10,
      pdPct: history.pdPct,
      preferenze: scenario?.preferenze ?? null,
      preferenzeTipo: scenario?.tipo_preferenze ?? null,
      iscritti: scenario?.iscritti ?? null,
    };
  });

  return {
    macroFactors,
    causalDiagnosis: {
      sintesiEsecutiva,
      anatomiaDelMovimento,
      analisiRischioOpportunita,
    },
    remediationPlan: {
      regolaAurea,
      atti,
      dichiarazione,
      direttrici,
    },
  };
}
