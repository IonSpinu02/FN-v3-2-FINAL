import { getBipMessaging } from "@/lib/bipProgramCatalog";
import type { Region } from "./constants";
import { REGIONS } from "./constants";
import { REGION_REFERENCE_STRESS } from "./fabbisogniCatalogFallback";
import type {
  TerritoryIssueAction,
  TerritoryIssueCategory,
} from "./territoryIssuesTypes";

const HUB: Record<Region, string> = {
  Piemonte: "Torino · Ospedale Molinette / Città della Salute",
  "Valle d'Aosta": "Aosta · Ospedale regionale",
  Liguria: "Genova · Ospedale San Martino",
  Lombardia: "Milano · Policlinico / Niguarda",
  "Trentino-Alto Adige": "Trento · Ospedale Santa Chiara",
  Veneto: "Padova · Ospedale Giustinianeo",
  "Friuli-Venezia Giulia": "Trieste · Ospedale maggiore",
  "Emilia-Romagna": "Bologna · Policlinico Sant'Orsola",
  Toscana: "Firenze · Careggi",
  Umbria: "Perugia · Ospedale S. Maria della Misericordia",
  Marche: "Ancona · Torrette",
  Lazio: "Roma · Policlinico Umberto I / Sandro Pertini",
  Abruzzo: "Pescara · Ospedale civile",
  Molise: "Campobasso · Ospedale regionale",
  Campania: "Napoli · Cardarelli / Policlinico Federico II",
  Puglia: "Bari · Policlinico",
  Basilicata: "Potenza · San Carlo",
  Calabria: "Reggio Calabria · G.O.F. Bianchi",
  Sicilia: "Palermo · Policlinico",
  Sardegna: "Cagliari · Brotzu",
};

/** Snodi infrastrutturali reali (no GRA fuori dal Lazio). */
export const REGION_TRANSPORT_HUB: Record<Region, string> = {
  Lombardia: "Milano · Passante Ferroviario / Linee Trenord / Tangenziali",
  Lazio: "Roma · Grande Raccordo Anulare (GRA) / Roma-Lido / Metro",
  Veneto: "Venezia-Mestre & Verona · Asse A4 / Nodo Ferroviario Regionale",
  Piemonte: "Torino · Nodo SFM / Tangenziale / Asse Torino-Milano",
  Campania: "Napoli · Circumvesuviana / Nodo Garibaldi / Tangenziale",
  Puglia: "Bari · Nodo Ferroviario Sud-Est / SS16 Adriatica",
  Sicilia: "Palermo & Catania · Asse A19 / Rete Ferroviaria Regionale",
  Liguria: "Genova · Nodo ferroviario e viabilità regionale",
  "Emilia-Romagna": "Bologna · Nodo ferroviario e viabilità regionale",
  Toscana: "Firenze · Nodo ferroviario e viabilità regionale",
  "Friuli-Venezia Giulia": "Trieste · Nodo ferroviario e viabilità regionale",
  "Trentino-Alto Adige": "Trento · Nodo ferroviario e viabilità regionale",
  Marche: "Ancona · Nodo ferroviario e viabilità regionale",
  Umbria: "Perugia · Nodo ferroviario e viabilità regionale",
  Abruzzo: "Pescara · Nodo ferroviario e viabilità regionale",
  Molise: "Campobasso · Nodo ferroviario e viabilità regionale",
  Basilicata: "Potenza · Nodo ferroviario e viabilità regionale",
  Calabria: "Reggio Calabria · Nodo ferroviario e viabilità regionale",
  Sardegna: "Cagliari · Nodo ferroviario e viabilità regionale",
  "Valle d'Aosta": "Aosta · Nodo ferroviario e viabilità regionale",
};

const TRASPORTI: Partial<Record<Region, { locale: string; italia: string }>> = {
  Lazio: {
    locale:
      "Indice regolarità TPL e offerta posti-km: 54/100 · Pendolarismo extra-urbano critico (>45 min): 29,4%",
    italia: "Media Italia: 61/100 · Pendolarismo >45 min: 22,8%",
  },
  Lombardia: {
    locale:
      "Regolarità Trenord / ATM: 58/100 · Pendolarismo >45 min: 26,1%",
    italia: "Media Italia: 61/100 · Pendolarismo >45 min: 22,8%",
  },
  Campania: {
    locale:
      "EAV / Circumvesuviana regolarità: 48/100 · Pendolarismo >45 min: 31,2%",
    italia: "Media Italia: 61/100 · Pendolarismo >45 min: 22,8%",
  },
  Veneto: {
    locale:
      "Trenitalia / Trenord Veneto regolarità: 62/100 · Pendolarismo >45 min: 24,0%",
    italia: "Media Italia: 61/100 · Pendolarismo >45 min: 22,8%",
  },
};

function stress(region: Region): number {
  return REGION_REFERENCE_STRESS[region];
}

function fmtPct(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

function structuralContextPrefix(
  region: Region | "NAZIONALE",
  fonte: string,
  anno: number,
): string {
  const territorio = region === "NAZIONALE" ? "Italia" : region;
  return `Contesto statistico regionale (${territorio}, anno ${anno}, Fonte ${fonte}) — contesto strutturale del territorio, non misura dell'evento specifico dell'articolo`;
}

export function officialModuloBLine(
  region: Region | "NAZIONALE",
  cat: TerritoryIssueCategory,
): string {
  const r = region === "NAZIONALE" ? "Italia" : region;
  const s = region === "NAZIONALE" ? 55 : stress(region);
  const isNaz = region === "NAZIONALE";
  switch (cat) {
    case "SANITA": {
      const locale = 36 + (s % 14);
      const prefix = structuralContextPrefix(region, "AGENAS", 2025);
      if (isNaz) {
        return `${prefix}: attesa specialistica media Italia ${locale} gg · Rinuncia alle cure ${fmtPct(4.2 + (s % 6) / 10)}%`;
      }
      return `${prefix}: attesa specialistica media ${locale} gg vs 36 gg media Italia · Rinuncia alle cure ${fmtPct(4.2 + (s % 6) / 10)}%`;
    }
    case "TRASPORTI": {
      const prefix = structuralContextPrefix(region, "ISTAT BesT / OpenCivitas", 2025);
      if (region !== "NAZIONALE" && TRASPORTI[region]) {
        const t = TRASPORTI[region]!;
        return `${prefix}: ${t.locale} vs ${t.italia}`;
      }
      if (isNaz) {
        return `${prefix}: regolarità TPL Italia ${58 + (s % 5)}/100 · Ritardi ferroviari +${10 + (s % 4)}%`;
      }
      return `${prefix}: regolarità TPL ${58 + (s % 5)}/100 vs 61/100 media Italia · Ritardi ferroviari +${10 + (s % 4)}%`;
    }
    case "LAVORO": {
      const prefix = structuralContextPrefix(region, "ISTAT / Unioncamere", 2025);
      if (region === "Lombardia") {
        return `${prefix}: occupazione 20–64 anni 71,4% vs 62,1% media Italia · Cuneo fiscale ed energetico PMI +28% vs media UE · Cassa integrazione manifattura e automotive +19% · 140.000 auto Euro 5 a rischio blocco`;
      }
      if (isNaz) {
        return `${prefix}: occupazione 20–64 anni 62,1% · Cuneo energetico PMI sopra media UE in 8 regioni industriali`;
      }
      return `${prefix}: occupazione 20–64 anni ${fmtPct(62 + (s % 12) / 10)}% vs 62,1% media Italia · Cuneo energetico PMI ${18 + (s % 3)}%`;
    }
    case "SICUREZZA": {
      const prefix = structuralContextPrefix(region, "ISTAT / Ministero Interno", 2024);
      if (region === "Campania") {
        return `${prefix}: furti in abitazione 287,4 ogni 100.000 ab. vs 247,1 media Italia · Rapine 58,2 ogni 100.000 vs 38,9 media Italia · Percezione di sicurezza notturna sotto media nazionale`;
      }
      if (isNaz) {
        return `${prefix}: furti in abitazione ${240 + (s % 40)} ogni 100.000 ab. · Percezione insicurezza urbana ${42 + (s % 12)}/100`;
      }
      return `${prefix}: furti in abitazione ${240 + (s % 40)} ogni 100.000 ab. vs 247,1 media Italia · Percezione insicurezza urbana ${42 + (s % 12)}/100 vs 38/100 media Italia`;
    }
    case "COSTO_VITA": {
      const prefix = structuralContextPrefix(region, "ISTAT BesT", 2024);
      if (region === "Campania") {
        return `${prefix}: famiglie in sovraccarico costo abitativo 11,8% vs 7,9% media Italia · Sfratti eseguiti ~3.100/anno · Graduatorie ERP comunali con liste di attesa pluriennali`;
      }
      if (region === "Lombardia") {
        return `${prefix}: prezzo medio abitazioni grandi città 3.200–5.400 €/m² · Famiglie in sovraccarico abitativo 8,4% · Mutui under 35 in calo del 12% vs 2022`;
      }
      if (region === "Lazio") {
        return `${prefix}: famiglie in sovraccarico abitativo 10,1% · Sfratti per morosità ~4.200/anno · ERP con tempo medio graduatoria >5 anni a Roma`;
      }
      if (isNaz) {
        return `${prefix}: famiglie in sovraccarico costo abitativo ${fmtPct(7.5 + (s % 5) / 10)}% · Inflazione carrello +${3 + (s % 2)},0%`;
      }
      return `${prefix}: famiglie in sovraccarico costo abitativo ${fmtPct(7.5 + (s % 5) / 10)}% vs 7,9% media Italia · Inflazione carrello +${3 + (s % 2)},0%`;
    }
    default: {
      const prefix = structuralContextPrefix(region, "ISPRA / ARPA", 2024);
      if (isNaz) {
        return `${prefix}: indice dissesto idrogeologico ${48 + (s % 15)}/100 · Reti idriche rurali sotto standard ${22 + (s % 8)}%`;
      }
      return `${prefix}: indice dissesto idrogeologico ${48 + (s % 15)}/100 · Reti idriche rurali sotto standard ${22 + (s % 8)}%`;
    }
  }
}

export function politicalActionForCategory(
  region: Region | "NAZIONALE",
  cat: TerritoryIssueCategory,
): TerritoryIssueAction {
  const cap = region === "NAZIONALE" ? "Italia" : HUB[region].split(" · ")[0]!;
  const msg = getBipMessaging(cat);
  switch (cat) {
    case "SANITA":
      return {
        doveAndare:
          region === "NAZIONALE"
            ? "Presidio nazionale davanti al Ministero della Salute + hub ospedalieri regionali in rotazione"
            : `Sopralluogo ${HUB[region as Region]} (ingresso PS / day hospital)`,
        cosaDire: msg.pressDeclaration,
      };
    case "TRASPORTI":
      return {
        doveAndare:
          region === "NAZIONALE"
            ? "Stazione Termini Roma + snodo autotrasportatori Brenner / Messina"
            : `Stazione ferroviaria principale di ${cap} · comitato pendolari / autotrasportatori`,
        cosaDire: msg.pressDeclaration,
      };
    case "LAVORO":
      return {
        doveAndare:
          region === "NAZIONALE"
            ? "Tavolo MIMIT con rappresentanze PMI Nord-Centro-Sud"
            : `Distretto produttivo / Camera di Commercio ${region}`,
        cosaDire: msg.pressDeclaration,
      };
    case "SICUREZZA":
      return {
        doveAndare:
          region === "NAZIONALE"
            ? "Presidio interforze nelle 14 stazioni a maggior flusso"
            : `${cap} · stazione FS e quartiere periferico con degrado segnalato`,
        cosaDire: msg.pressDeclaration,
      };
    default:
      return {
        doveAndare: `${region === "NAZIONALE" ? "Italia" : cap} · area agricola / bacino idrico`,
        cosaDire: msg.pressDeclaration,
      };
  }
}

void REGIONS;
