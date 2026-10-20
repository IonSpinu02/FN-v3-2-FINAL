import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REGIONS = [
  "Piemonte",
  "Valle d'Aosta",
  "Liguria",
  "Lombardia",
  "Trentino-Alto Adige",
  "Veneto",
  "Friuli-Venezia Giulia",
  "Emilia-Romagna",
  "Toscana",
  "Umbria",
  "Marche",
  "Lazio",
  "Abruzzo",
  "Molise",
  "Campania",
  "Puglia",
  "Basilicata",
  "Calabria",
  "Sicilia",
  "Sardegna",
];

function slug(region) {
  return region
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function indicator(region, key, tema, indicatore, fonte, extra = {}) {
  const s = slug(region);
  return {
    id: `${s}-${key}`,
    tema,
    indicatore,
    valore: null,
    unita: extra.unita ?? null,
    periodoRiferimento: null,
    metadati: {
      fonte,
      territorio: region,
      popolazioneRiferimento:
        extra.popolazioneRiferimento ?? "Popolazione residente regionale",
      periodoMisurato: extra.periodoMisurato ?? "Anno 2024",
      dataPubblicazione: extra.dataPubblicazione ?? "2025-12",
      metodo:
        extra.metodo ??
        "Dato amministrativo / serie ufficiale (valorizzare da fonte)",
      naturaDato: extra.naturaDato ?? "osservato",
      gradoConfrontabilita:
        extra.gradoConfrontabilita ??
        "Media — verificare omogeneità serie 2021-2024 prima del confronto",
    },
  };
}

function regionBlock(region) {
  return {
    indicatori: [
      indicator(
        region,
        "sanita",
        "Sanità / Accesso alle cure",
        "Tempi di attesa programmata / rinuncia alle cure / mobilità sanitaria (slot AGENAS)",
        "AGENAS / ISTAT BesT 2025",
        {
          popolazioneRiferimento: "Utenti SSN e popolazione assistita",
          metodo: "Dato amministrativo certificato (AGENAS) + indicatori BesT",
          unita: "giorni / %",
        },
      ),
      indicator(
        region,
        "lavoro",
        "Lavoro e Reddito",
        "Tasso di occupazione 20-64 anni e indici di reddito/disparità (BesT)",
        "ISTAT - Rilevazione Forze di Lavoro / BesT",
        {
          popolazioneRiferimento: "Popolazione residente 20-64 anni",
          metodo: "Rilevazione campionaria ISTAT (RFL)",
          unita: "%",
        },
      ),
      indicator(
        region,
        "abitare",
        "Costo dell'abitare e Prezzi",
        "Sovraccarico costo abitazione / indice prezzi al consumo territoriale",
        "ISTAT",
        {
          popolazioneRiferimento: "Famiglie consumatrici (NUTS2)",
          metodo: "Indagine prezzi al consumo / conti economici territoriali",
          unita: "%",
        },
      ),
      indicator(
        region,
        "trasporti",
        "Trasporti e Servizi Locali",
        "Qualità TPL, servizi comunali (OpenCivitas) e qualità ambientale (ARPA)",
        "OpenCivitas / ISTAT / ARPA",
        {
          popolazioneRiferimento: "Residenti e utenza servizi",
          metodo: "Benchmark servizi locali + monitoraggio ambientale",
          unita: "indice / rating",
        },
      ),
    ],
    prioritaDichiarate: {
      stato: "non_rilevato",
      nota: "Non ancora rilevate — Occorre indagine rappresentativa",
    },
  };
}

const regions = {};
for (const r of REGIONS) {
  regions[r] = regionBlock(r);
}

const out = {
  version: 1,
  updatedAt: "2026-10-20",
  regions,
};

const dir = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(dir, "..", "data", "fabbisogni_catalog.json");
writeFileSync(target, JSON.stringify(out, null, 2), "utf8");
console.log("Wrote", target, "regions:", REGIONS.length);
