import { affinityTransferMultiplier } from "@/lib/politicalDefectionsElectoral";
import type { TrackedPolitician } from "@/lib/politicalDefectionsEngine";

export type DoteScenario = {
  id: "min" | "base" | "max";
  label: string;
  descrizione: string;
  voti: number;
  pp: number;
};

export type PilastroMrImpact = {
  ruolo: string;
  puntiPesoMr: number;
  note: string;
};

export type BacinoScomposizione = {
  recuperoExPartitoPct: number;
  astenutiLocaliPct: number;
  radicamentoAssociativoPct: number;
  note: string;
};

export type AffinitaFnScore = {
  score0100: number;
  motivazione: string;
};

export type NoteTattiche = {
  rischioAttritoBaseLocale: "basso" | "medio" | "alto";
  beneficioFnSintesi: string;
  cautele: string[];
};

export type PoliticianDossierAnalytics = {
  slug: string;
  timeline: { elezione: string; gruppoAttuale: string; dataAtto: string };
  scenari: DoteScenario[];
  pilastroMr: PilastroMrImpact;
  bacino: BacinoScomposizione;
  affinita: AffinitaFnScore;
  capitoliBip: string[];
  tattiche: NoteTattiche;
  probabilitaSoglia3Pct: { prima: number; dopo: number; deltaPp: number };
};

function mrPuntiForRuolo(ruolo: TrackedPolitician["ruolo"]): PilastroMrImpact {
  if (ruolo === "Deputato" || ruolo === "Senatore") {
    return {
      ruolo,
      puntiPesoMr: 5,
      note: "Ingresso parlamentare: +5 punti peso sull'Indice Presenze Istituzionali (m_r) regionale.",
    };
  }
  if (ruolo === "Eurodeputato") {
    return {
      ruolo,
      puntiPesoMr: 4,
      note: "Eurodeputato: +4 punti peso su m_r (visibilità sovranazionale, radicamento più diluito).",
    };
  }
  if (ruolo === "Consigliere Regionale") {
    return {
      ruolo,
      puntiPesoMr: 3,
      note: "Consigliere regionale: +3 punti peso su m_r nella regione di elezione.",
    };
  }
  if (ruolo === "Sindaco") {
    return {
      ruolo,
      puntiPesoMr: 2,
      note: "Sindaco: +2 punti peso su m_r (forte ancoraggio comunale, bacino più stretto).",
    };
  }
  return {
    ruolo,
    puntiPesoMr: 1,
    note: "Profilo organizzativo: +1 punto peso su m_r (impatto istituzionale limitato).",
  };
}

function affinitaScore(p: TrackedPolitician): AffinitaFnScore {
  const mult = affinityTransferMultiplier(p.partitoProvenienza);
  const base = Math.round(Math.min(100, Math.max(8, mult * 78)));
  const motivazione =
    p.partitoProvenienza === "Lega" || p.partitoProvenienza === "Fratelli d'Italia"
      ? `Provenienza ${p.partitoProvenienza}: alta sovrapposizione con i temi B.I.P. (sicurezza, sovranità, lavoro).`
      : p.partitoProvenienza === "Forza Italia" || p.partitoProvenienza === "Lista Civica CDX"
        ? `Provenienza ${p.partitoProvenienza}: affinità moderata; utile su imprese/territorio, meno su remigrazione.`
        : p.partitoProvenienza === "Altri"
          ? "Area politicamente distante (ex M5S/centro-sinistra): beneficio elettorale per FN tipicamente basso o nullo."
          : `Profilo ${p.partitoProvenienza}: affinità da valutare caso per caso sul territorio.`;
  return { score0100: base, motivazione };
}

function bacinoFromProvenienza(p: TrackedPolitician): BacinoScomposizione {
  if (p.partitoProvenienza === "Lega" || p.partitoProvenienza === "Fratelli d'Italia") {
    return {
      recuperoExPartitoPct: 58,
      astenutiLocaliPct: 27,
      radicamentoAssociativoPct: 15,
      note: "Prevalenza recupero da bacino CDX del collegio + mobilitazione astenuti locali.",
    };
  }
  if (p.partitoProvenienza === "Forza Italia" || p.partitoProvenienza === "Lista Civica CDX") {
    return {
      recuperoExPartitoPct: 42,
      astenutiLocaliPct: 33,
      radicamentoAssociativoPct: 25,
      note: "Mix centro-destra moderato e reti associative/categorie produttive.",
    };
  }
  return {
    recuperoExPartitoPct: 22,
    astenutiLocaliPct: 48,
    radicamentoAssociativoPct: 30,
    note: "Trasferimento diretto dal partito di provenienza limitato; più dipendenza da astenuti e reti personali.",
  };
}

function capitoliBipFor(p: TrackedPolitician): string[] {
  const bip = p.beneficioIngressoFn?.affinitaProgrammaticaBip;
  const base = bip ? [bip] : ["Cap. 7 Sicurezza"];
  if (p.regione === "Sicilia" || p.regione === "Calabria" || p.regione === "Campania") {
    base.push("Cap. 5 Remigrazione");
  }
  if (p.partitoProvenienza === "Lega") {
    base.push("Cap. 15 Agricoltura");
  }
  if (p.ruolo === "Deputato" || p.ruolo === "Senatore") {
    base.push("Cap. 2 Lavoro & cuneo fiscale");
  }
  return [...new Set(base)].slice(0, 4);
}

function tatticheFor(p: TrackedPolitician, aff: AffinitaFnScore): NoteTattiche {
  const cautele: string[] = [];
  let rischio: NoteTattiche["rischioAttritoBaseLocale"] = "basso";
  if (aff.score0100 < 45) {
    rischio = "alto";
    cautele.push(
      "Area ideologica distante: rischio di attrito con la base FN locale e beneficio elettorale basso/nullo.",
    );
  } else if (p.statoAdesioneFN === "Transitato in altro gruppo CDX/Centro") {
    rischio = "medio";
    cautele.push(
      "Già transitato in altro gruppo CDX/Centro: contendibilità ridotta; verificare disponibilità reale.",
    );
  } else if (p.statoAdesioneFN === "Uscito nel Misto (Contendibile)") {
    rischio = "medio";
    cautele.push(
      "Nel Misto contendibile: utile finestra di dialogo, ma verificare motivazioni e stabilità locale.",
    );
  }
  if (!p.fonteStampa?.url) {
    cautele.push("Fonte stampa incompleta: non procedere a comunicazione ufficiale senza verifica.");
  }
  const beneficioFnSintesi =
    aff.score0100 >= 70
      ? "Beneficio FN elevato se l'ingresso è accompagnato da comitati locali del collegio."
      : aff.score0100 >= 45
        ? "Beneficio FN moderato: priorità a temi B.I.P. già credibili sul territorio."
        : "Beneficio FN basso o nullo: acquisizione sconsigliata salvo valore simbolico limitato.";
  return { rischioAttritoBaseLocale: rischio, beneficioFnSintesi, cautele };
}

/**
 * Analitiche dossier: 3 scenari dote, impatto m_r, bacino, affinità, cautele.
 */
export function buildPoliticianDossierAnalytics(
  p: TrackedPolitician,
): PoliticianDossierAnalytics {
  const baseVoti =
    p.beneficioIngressoFn?.votiPortatiStimati ?? p.doteElettorale.votiPortatiStimati;
  const basePp =
    p.beneficioIngressoFn?.crescitaRegionePp ?? p.doteElettorale.impattoRegionePp;
  const oggi = p.beneficioIngressoFn?.regioneOggiPct ?? 7.6;
  const dopo = p.beneficioIngressoFn?.regioneDopoPct ?? oggi + basePp;

  const scenari: DoteScenario[] = [
    {
      id: "min",
      label: "Scenario Prudenziale (Min)",
      descrizione: "Solo nucleo fedelissimi / voto d'opinione diretto.",
      voti: Math.max(0, Math.round(baseVoti * 0.45)),
      pp: Math.round(basePp * 0.45 * 100) / 100,
    },
    {
      id: "base",
      label: "Scenario Atteso (Base)",
      descrizione: "Stima centrale voti portati a FN e incremento % regionale.",
      voti: baseVoti,
      pp: basePp,
    },
    {
      id: "max",
      label: "Scenario Massimale (Effetto Traino)",
      descrizione:
        "Impatto se accompagnato da amministratori locali e comitati del collegio.",
      voti: Math.round(baseVoti * 1.55),
      pp: Math.round(basePp * 1.55 * 100) / 100,
    },
  ];

  const affinita = affinitaScore(p);
  const slug = p.slug ?? p.id;

  const sogliaPrima = Math.min(99, Math.round(Math.max(5, (oggi / 3) * 55)));
  const sogliaDopo = Math.min(99, Math.round(Math.max(5, (dopo / 3) * 55)));

  return {
    slug,
    timeline: {
      elezione: p.doteElettorale.fontePreferenze?.split("·")[1]?.trim() || p.collegioDisplay,
      gruppoAttuale: p.cambioGruppoA ?? p.partitoDestinazione,
      dataAtto: p.dataCambioPartito ?? p.ultimaNotizia.dataOra,
    },
    scenari,
    pilastroMr: mrPuntiForRuolo(p.ruolo),
    bacino: bacinoFromProvenienza(p),
    affinita,
    capitoliBip: capitoliBipFor(p),
    tattiche: tatticheFor(p, affinita),
    probabilitaSoglia3Pct: {
      prima: sogliaPrima,
      dopo: sogliaDopo,
      deltaPp: Math.round((dopo - oggi) * 100) / 100,
    },
  };
}
