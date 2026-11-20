import { PRIMARY_SOCIAL_ISSUE } from "@/lib/engine/exposurePriorityEngine";
import { REGIONS, type Region } from "@/lib/engine/constants";
import { getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import { cockpitTierForRegion } from "@/lib/osservatorioCockpitTiers";
import type { DossierRegionPriority } from "@/lib/export/dossierTypes";
import { sanitizeDossierPublicText } from "@/lib/export/pdfSafeText";

/**
 * Leva B.I.P. concreta per regione: codice + nome soluzione (ASCII-safe " - ").
 * Mai tutte BIP.13-SAN.
 */
function bipLeverForRegion(regione: Region, issueLabel: string): string {
  switch (regione) {
    case "Sicilia":
      return "BIP.07 / BIP.09-TR - Presidio confini marittimi, rimpatri & Continuità trasporti";
    case "Liguria":
      return "BIP.09-TR / BIP.13-CV - Nodi portuali, collegamenti e casa sulla costa";
    case "Molise":
    case "Basilicata":
    case "Valle d'Aosta":
      return "BIP.13-SAN / BIP.09-TR - Liste d'attesa, presidi sanitari aree interne e collegamenti";
    case "Emilia-Romagna":
      return "BIP.09-EN / BIP.02 - Taglio oneri energia PMI, fisco e tutela manifattura";
    case "Toscana":
      return "BIP.13-SAN / BIP.13-CV - Liste d'attesa e accesso alla casa";
    default:
      break;
  }
  const label = issueLabel.toLowerCase();

  if (/energia|bollett|fisco|p\.?\s*iva|pmi|furti in abit/.test(label)) {
    if (regione === "Veneto") {
      return "BIP.09-EN / BIP.02 - Taglio oneri bollette & Stop saldo-acconto P.IVA";
    }
    return "BIP.02 - Tutela P.IVA & Filiera Italia";
  }
  if (/liste d'attesa|sanit|dissesto|mobilità sanitaria|disoccupaz/.test(label)) {
    return "BIP.13-SAN - Piano abbattimento liste d'attesa";
  }
  if (/mutui|affitti|abitativ|nodi ferroviari|degrado nodi/.test(label)) {
    return "BIP.13-CV - Mutuo Tricolore & Case popolari";
  }
  if (/balcan|msna|migrat|sbarchi|flussi|ong/.test(label)) {
    return "BIP.07 - Presidio confini & Rotta Balcanica";
  }
  if (/stazion|carcer|san vittore|furti|sicur/.test(label)) {
    return "BIP.07 - Presidio militare stazioni & Piano carceri";
  }
  if (/auto|industria|cassa integrazione|filiera|green/.test(label)) {
    return "BIP.02 - Tutela filiera auto & Stop euro-follie";
  }
  if (/trasporti|continuità|agricol/.test(label)) {
    return "BIP.09-TR - Ferrovia utile & Continuità territoriale";
  }

  switch (regione) {
    case "Veneto":
      return "BIP.09-EN / BIP.02 - Taglio oneri bollette & Stop saldo-acconto P.IVA";
    case "Calabria":
    case "Abruzzo":
      return "BIP.13-SAN - Piano abbattimento liste d'attesa";
    case "Lazio":
      return "BIP.13-CV - Mutuo Tricolore & Case popolari";
    case "Friuli-Venezia Giulia":
      return "BIP.07 - Presidio confini & Rotta Balcanica";
    case "Lombardia":
      return "BIP.07 - Presidio militare stazioni & Piano carceri";
    case "Piemonte":
      return "BIP.02 - Tutela filiera auto & Stop euro-follie";
    case "Puglia":
      return "BIP.07 - Presidio confini, sicurezza agricola e sanità";
    default:
      return "BIP.02 - Tutela P.IVA & Filiera Italia";
  }
}

function bandRank(roleLabel: string): number {
  if (roleLabel.includes("Verde")) return 0;
  if (roleLabel.includes("Espansione")) return 1;
  return 2;
}

function roleLabelFor(region: Region): string {
  const tier = cockpitTierForRegion(region);
  if (tier === "verde") return "Priorità Alta / Fascia Verde";
  if (tier === "giallo") return "Espansione / Fascia Contendibile";
  return "Presidio Territoriale";
}

/**
 * Classifica completa delle 20 regioni, ordinate per potenziale di bacino.
 * Non tronca alle sole 8 prioritarie del grafo.
 */
export function buildDossierRegionPriorities(
  prioritaTop: Array<{
    regione: string;
    affinita?: number;
    fnPct?: number;
    sharePct?: number | null;
    tier?: string;
  }>,
): DossierRegionPriority[] {
  const byName = new Map<string, (typeof prioritaTop)[number]>();
  for (const row of prioritaTop) {
    const prev = byName.get(row.regione);
    byName.set(row.regione, {
      ...prev,
      ...row,
      affinita: row.affinita ?? prev?.affinita,
      fnPct: row.fnPct ?? prev?.fnPct,
      sharePct: row.sharePct ?? prev?.sharePct,
      tier: row.tier ?? prev?.tier,
    });
  }
  const rows = REGIONS.map((regione) => {
    const known = byName.get(regione);
    const hist = getRegionalPartyHistory(regione);
    const affinity =
      typeof known?.affinita === "number" && Number.isFinite(known.affinita)
        ? known.affinita
        : hist.permeabilitaVannacciScore;
    const rawShare = known?.fnPct ?? known?.sharePct;
    const sharePct = typeof rawShare === "number" && Number.isFinite(rawShare) ? rawShare : 0;
    const issue = PRIMARY_SOCIAL_ISSUE[regione];
    const emergency = issue?.label ?? `Priorità territoriale in ${regione}`;
    return {
      regione,
      affinity,
      sharePct,
      shareNote: "stima modellata dal dato nazionale",
      emergency: sanitizeDossierPublicText(emergency),
      levaBip: sanitizeDossierPublicText(bipLeverForRegion(regione, emergency)),
      roleLabel: roleLabelFor(regione),
      score: affinity,
    };
  });
  rows.sort(
    (a, b) =>
      bandRank(a.roleLabel) - bandRank(b.roleLabel) ||
      b.affinity - a.affinity ||
      a.regione.localeCompare(b.regione, "it"),
  );
  return rows;
}
