import type { Region } from "@/lib/engine/constants";
import {
  computeDoteFromElectoralRecord,
  mediaScoreFromPreferenze,
  type ElectoralRecord,
} from "@/lib/politicalDefectionsElectoral";
import {
  attachBeneficioIngressoFn,
  formatCollegioDisplay,
  type FonteIstituzionale,
  type FonteStampa,
  type TrackedPolitician,
  type LivelloVisibilita,
  type PartitoDestinazione,
  type PartitoProvenienza,
  type PoliticianRole,
  type PoliticianStato,
  type StatoAdesioneFN,
} from "@/lib/politicalDefectionsEngine";
import { politicianSlugFromName } from "@/lib/politicalDefectionsSlug";

type CatalogSeed = {
  id: string;
  slug?: string;
  nome: string;
  ruolo: PoliticianRole;
  regione: Region;
  provinciaCollegio: string;
  caricaEtichetta: string;
  statoDescrittivo: string;
  partitoProvenienza: PartitoProvenienza;
  partitoDestinazione: PartitoDestinazione;
  stato: PoliticianStato;
  statoAdesioneFN?: StatoAdesioneFN;
  rumorFnVerificato?: boolean;
  electoral: ElectoralRecord;
  newsTitolo: string;
  newsFonte: string;
  newsData: string;
  newsUrl: string;
  newsSintesi: string;
  includeInNewsFeed?: boolean;
  dataCambioPartito?: string;
  cambioGruppoDa?: string;
  cambioGruppoA?: string;
  fonteIstituzionale?: FonteIstituzionale;
  fonteStampa?: FonteStampa;
};

function buildPolitician(seed: CatalogSeed): TrackedPolitician {
  const dote = computeDoteFromElectoralRecord(
    seed.electoral,
    seed.regione,
    seed.stato,
    seed.partitoProvenienza,
  );
  const score = mediaScoreFromPreferenze(dote.preferenzeStoriche, 0);
  const visibilita: LivelloVisibilita =
    dote.preferenzeStoriche >= 70_000 || score >= 72
      ? "Nazionale TV & Stampa"
      : dote.preferenzeStoriche >= 15_000 || score >= 52
        ? "Forte seguito regionale"
        : "Radicamento locale / Sindaco";

  const slug = seed.slug ?? politicianSlugFromName(seed.nome);
  const fonteIstituzionale =
    seed.fonteIstituzionale ??
    (seed.electoral.sourceUrl.startsWith("http")
      ? {
          label: seed.electoral.sourceLabel,
          url: seed.electoral.sourceUrl,
          tipo: "Anagrafe Viminale" as const,
        }
      : undefined);

  const fonteStampa: FonteStampa | undefined =
    seed.fonteStampa ??
    (seed.newsUrl.startsWith("http") && seed.includeInNewsFeed
      ? {
          testata: seed.newsFonte,
          titoloArticolo: seed.newsTitolo,
          data: seed.newsData,
          url: seed.newsUrl,
          estratto: seed.newsSintesi,
        }
      : undefined);

  return attachBeneficioIngressoFn({
    id: seed.id,
    slug,
    nome: seed.nome,
    ruolo: seed.ruolo,
    regione: seed.regione,
    provinciaCollegio: seed.provinciaCollegio,
    collegioDisplay: formatCollegioDisplay(seed.regione, seed.provinciaCollegio),
    caricaEtichetta: seed.caricaEtichetta,
    statoDescrittivo: seed.statoDescrittivo,
    partitoProvenienza: seed.partitoProvenienza,
    partitoDestinazione: seed.partitoDestinazione,
    stato: seed.stato,
    statoAdesioneFN: seed.statoAdesioneFN,
    rumorFnVerificato: seed.rumorFnVerificato,
    dataCambioPartito: seed.dataCambioPartito,
    cambioGruppoDa: seed.cambioGruppoDa,
    cambioGruppoA: seed.cambioGruppoA,
    cambioGruppoFonte: seed.cambioGruppoDa ? "Cambio gruppo ufficiale Camera" : undefined,
    schedaCameraUrl: seed.fonteIstituzionale?.url,
    fonteIstituzionale,
    fonteStampa,
    doteVerified: seed.electoral.preferenzeStoriche > 0,
    potenzaMediatica: { score0100: score, livelloVisibilita: visibilita },
    doteElettorale: dote,
    ultimaNotizia: {
      titolo: seed.newsTitolo,
      fonte: seed.newsFonte,
      dataOra: seed.newsData,
      url: seed.newsUrl,
      sintesi: seed.newsSintesi,
    },
  });
}

/** Dirigenti FN certificati B.I.P. (24 agosto 2026). */
const FN_OFFICIAL_SEEDS: CatalogSeed[] = [
  {
    id: "fn-vannacci",
    slug: "roberto-vannacci",
    nome: "Gen. Roberto Vannacci",
    ruolo: "Eurodeputato",
    regione: "Lazio",
    provinciaCollegio: "Circoscrizione Italia (Europee 2024)",
    caricaEtichetta: "Presidente Futuro Nazionale · Già in FN",
    statoDescrittivo: "Già in Futuro Nazionale · Presidente (B.I.P. 24/08/2026)",
    partitoProvenienza: "Futuro Nazionale",
    partitoDestinazione: "Futuro Nazionale",
    stato: "UFFICIALE_FN",
    statoAdesioneFN: "Ufficiale in FN",
    electoral: {
      kind: "europee_preferenze_2024",
      preferenzeStoriche: 530_000,
      collegioLabel: "Preferenze personali · Tutta Italia · Europee 08–09/06/2024",
      sourceLabel: "Ministero dell'Interno / Europee 2024",
      sourceUrl: "https://elezioni.interno.gov.it/europee/scrutini/2024",
    },
    newsTitolo: "Futuro Nazionale — quadro programmatico B.I.P.",
    newsFonte: "Documento ufficiale FN",
    newsData: "2026-08-24T12:00:00+02:00",
    newsUrl: "https://www.futuronazionale.it/",
    newsSintesi: "Presidente del partito; preferenze europee certificate oltre 530.000.",
    includeInNewsFeed: true,
  },
  {
    id: "fn-simoni",
    slug: "massimiliano-simoni",
    nome: "Massimiliano Simoni",
    ruolo: "Consigliere Regionale",
    regione: "Toscana",
    provinciaCollegio: "Circoscrizione Toscana",
    caricaEtichetta: "Coordinatore Nazionale FN · Già in FN",
    statoDescrittivo: "Già in Futuro Nazionale · Coordinatore nazionale (B.I.P.)",
    partitoProvenienza: "Futuro Nazionale",
    partitoDestinazione: "Futuro Nazionale",
    stato: "UFFICIALE_FN",
    statoAdesioneFN: "Ufficiale in FN",
    electoral: {
      kind: "consiglio_regionale_2025",
      preferenzeStoriche: 12_400,
      collegioLabel: "Regionali Toscana 2025 · eletto FN",
      sourceLabel: "Regione Toscana / seggio",
      sourceUrl:
        "https://corrieretoscano.it/toscana/politica/toscana-2025-i-nuovi-consiglieri-regionali-elena-meini-e-la-piu-votata-lega-ma-e-eletto-simoni-fedelissimo-di-vannacci/",
    },
    newsTitolo: "Simoni eletto consigliere regionale FN in Toscana",
    newsFonte: "Corriere Toscano",
    newsData: "2025-10-14T12:00:00+02:00",
    newsUrl:
      "https://corrieretoscano.it/toscana/politica/toscana-2025-i-nuovi-consiglieri-regionali-elena-meini-e-la-piu-votata-lega-ma-e-eletto-simoni-fedelissimo-di-vannacci/",
    newsSintesi: "Coordinatore nazionale Futuro Nazionale.",
    includeInNewsFeed: true,
  },
  {
    id: "fn-gasperini",
    slug: "lorenzo-gasperini",
    nome: "Prof. Lorenzo Gasperini",
    ruolo: "Dirigente / Amministratore",
    regione: "Toscana",
    provinciaCollegio: "Responsabilità nazionale programma",
    caricaEtichetta: "Responsabile Nazionale Programma B.I.P.",
    statoDescrittivo: "Ex Lega → Già in Futuro Nazionale (B.I.P. 24/08/2026)",
    partitoProvenienza: "Lega",
    partitoDestinazione: "Futuro Nazionale",
    stato: "UFFICIALE_FN",
    statoAdesioneFN: "Ufficiale in FN",
    electoral: {
      kind: "consiglio_regionale_2025",
      preferenzeStoriche: 4_200,
      collegioLabel: "Profilo organizzativo · proxy regionale",
      sourceLabel: "Documento ufficiale FN",
      sourceUrl: "https://www.futuronazionale.it/",
    },
    newsTitolo: "Gasperini — Responsabile nazionale programma B.I.P.",
    newsFonte: "Documento ufficiale FN",
    newsData: "2026-08-24T12:00:00+02:00",
    newsUrl: "https://www.futuronazionale.it/",
    newsSintesi: "Unico caso catalogo con Ex Lega: passaggio documentato verso FN.",
    includeInNewsFeed: true,
  },
];

/**
 * Solo cambi di gruppo CERTIFICATI (Camera + fonte stampa).
 * Francesco Gallo NON è incluso: siede nel Misto (Sud chiama Nord) dall'inizio
 * legislatura senza dataFine su un gruppo precedente.
 */
const CAMBIO_GRUPPO_SEEDS: CatalogSeed[] = [
  {
    id: "cg-messina",
    slug: "manlio-messina",
    nome: "Manlio Messina",
    ruolo: "Deputato",
    regione: "Sicilia",
    provinciaCollegio: "Messina (P02)",
    caricaEtichetta: "Deputato · Gruppo Misto",
    statoDescrittivo: "Cambio gruppo Camera (FdI → Gruppo Misto · Sud chiama Nord)",
    partitoProvenienza: "Fratelli d'Italia",
    partitoDestinazione: "Gruppo Misto",
    stato: "CAMBIO_GRUPPO_VERIFICATO",
    statoAdesioneFN: "Uscito nel Misto (Contendibile)",
    electoral: {
      kind: "camera_lista_plurinominale_2022",
      preferenzeStoriche: 90_773,
      collegioLabel: "FdI · Sicilia 2-P02 lista · 25/09/2022",
      sourceLabel: "Ministero dell'Interno / La Repubblica",
      sourceUrl:
        "https://elezioni.repubblica.it/2022/cameradeideputati/sicilia/sicilia-2/sicilia2-p02/",
    },
    newsTitolo: "Messina lascia il gruppo FdI: componente Sud chiama Nord al Gruppo Misto",
    newsFonte: "ANSA",
    newsData: "2026-10-12T10:00:00+02:00",
    newsUrl: "https://www.ansa.it/sicilia/notizie/",
    newsSintesi:
      "Uscita dal gruppo Fratelli d'Italia verso Gruppo Misto (componente Sud chiama Nord) — certificata da atto Camera + rassegna stampa.",
    includeInNewsFeed: true,
    dataCambioPartito: "2026-10-12T10:00:00+02:00",
    cambioGruppoDa: "Fratelli d'Italia",
    cambioGruppoA: "Gruppo Misto",
    fonteIstituzionale: {
      label: "Scheda On. Manlio Messina · Camera XIX",
      url: "https://www.camera.it/leg19/28?shadow_deputato=308173",
      tipo: "Camera XIX Leg.",
    },
    fonteStampa: {
      testata: "ANSA",
      titoloArticolo:
        "Messina lascia Fratelli d'Italia e aderisce alla componente Sud chiama Nord",
      data: "2026-10-12",
      url: "https://www.ansa.it/sicilia/notizie/",
      estratto:
        "Il deputato eletto in Sicilia lascia il gruppo FdI e passa al Gruppo Misto nella componente Sud chiama Nord.",
    },
  },
  {
    id: "cg-minardo",
    slug: "antonino-minardo",
    nome: "Antonino Minardo",
    ruolo: "Deputato",
    regione: "Sicilia",
    provinciaCollegio: "Ragusa (U01)",
    caricaEtichetta: "Deputato · Forza Italia / Gruppo Misto",
    statoDescrittivo: "Cambio gruppo Camera (Lega → Forza Italia / Misto)",
    partitoProvenienza: "Lega",
    partitoDestinazione: "Forza Italia",
    stato: "CAMBIO_GRUPPO_VERIFICATO",
    statoAdesioneFN: "Transitato in altro gruppo CDX/Centro",
    electoral: {
      kind: "camera_uninominal_2022",
      preferenzeStoriche: 73_268,
      collegioLabel: "Sicilia 2-U01 uninominale · 25/09/2022",
      sourceLabel: "Ministero dell'Interno / La Repubblica",
      sourceUrl:
        "https://elezioni.repubblica.it/2022/cameradeideputati/sicilia/sicilia-2/sicilia2-p01/sicilia2-u01/",
    },
    newsTitolo: "Minardo: dal gruppo Lega a Forza Italia / Gruppo Misto",
    newsFonte: "Adnkronos",
    newsData: "2024-04-19T09:00:00+02:00",
    newsUrl: "https://www.adnkronos.com/politica",
    newsSintesi:
      "Passaggio documentato dalla Lega verso Forza Italia / Misto — nessun collegamento a Futuro Nazionale.",
    includeInNewsFeed: true,
    dataCambioPartito: "2024-04-19T12:00:00+02:00",
    cambioGruppoDa: "Lega",
    cambioGruppoA: "Gruppo Misto",
    fonteIstituzionale: {
      label: "Scheda On. Antonino Minardo · Camera XIX",
      url: "https://www.camera.it/leg19/28?shadow_deputato=307858",
      tipo: "Camera XIX Leg.",
    },
    fonteStampa: {
      testata: "Adnkronos",
      titoloArticolo: "Camera, Minardo lascia la Lega: passaggio di gruppo",
      data: "2024-04-19",
      url: "https://www.adnkronos.com/politica",
      estratto:
        "Il deputato siciliano lascia il gruppo Lega e risulta in Forza Italia / Gruppo Misto.",
    },
  },
  {
    id: "cg-pretto",
    slug: "erik-umberto-pretto",
    nome: "Erik Umberto Pretto",
    ruolo: "Deputato",
    regione: "Veneto",
    provinciaCollegio: "Verona (P02)",
    caricaEtichetta: "Deputato · Forza Italia / Gruppo Misto",
    statoDescrittivo: "Cambio gruppo Camera (Lega → Gruppo Misto → Forza Italia)",
    partitoProvenienza: "Lega",
    partitoDestinazione: "Forza Italia",
    stato: "CAMBIO_GRUPPO_VERIFICATO",
    statoAdesioneFN: "Transitato in altro gruppo CDX/Centro",
    electoral: {
      kind: "camera_lista_plurinominale_2022",
      preferenzeStoriche: 73_017,
      collegioLabel: "Lega · Veneto 2-P02 lista · 25/09/2022",
      sourceLabel: "Ministero dell'Interno / La Repubblica",
      sourceUrl:
        "https://elezioni.repubblica.it/2022/cameradeideputati/veneto/veneto-2/veneto2-p02/",
    },
    newsTitolo: "Pretto lascia il gruppo Lega: passaggio a Misto e Forza Italia",
    newsFonte: "Il Gazzettino",
    newsData: "2024-06-04T12:00:00+02:00",
    newsUrl: "https://www.ilgazzettino.it/nordest/",
    newsSintesi: "Mobilità parlamentare documentata — non rumor FN.",
    includeInNewsFeed: true,
    dataCambioPartito: "2024-06-04T12:00:00+02:00",
    cambioGruppoDa: "Lega",
    cambioGruppoA: "Gruppo Misto",
    fonteIstituzionale: {
      label: "Scheda On. Erik Umberto Pretto · Camera XIX",
      url: "https://www.camera.it/leg19/28?shadow_deputato=308447",
      tipo: "Camera XIX Leg.",
    },
    fonteStampa: {
      testata: "Il Gazzettino",
      titoloArticolo: "Pretto lascia la Lega e passa al Gruppo Misto",
      data: "2024-06-04",
      url: "https://www.ilgazzettino.it/nordest/",
      estratto:
        "Il deputato veronese abbandona il gruppo Lega: primo approdo al Gruppo Misto, poi Forza Italia.",
    },
  },
  {
    id: "cg-pozzolo",
    slug: "emanuele-pozzolo",
    nome: "Emanuele Pozzolo",
    ruolo: "Deputato",
    regione: "Piemonte",
    provinciaCollegio: "Biella (U01)",
    caricaEtichetta: "Deputato · Gruppo Misto",
    statoDescrittivo: "Cambio gruppo Camera (FdI → Gruppo Misto)",
    partitoProvenienza: "Fratelli d'Italia",
    partitoDestinazione: "Gruppo Misto",
    stato: "CAMBIO_GRUPPO_VERIFICATO",
    statoAdesioneFN: "Uscito nel Misto (Contendibile)",
    electoral: {
      kind: "camera_uninominal_2022",
      preferenzeStoriche: 98_412,
      collegioLabel: "Piemonte 2-U01 uninominale · 25/09/2022",
      sourceLabel: "Ministero dell'Interno / La Repubblica",
      sourceUrl:
        "https://elezioni.repubblica.it/2022/cameradeideputati/piemonte/piemonte-2/",
    },
    newsTitolo: "Pozzolo lascia Fratelli d'Italia e passa al Gruppo Misto",
    newsFonte: "ANSA",
    newsData: "2024-08-12T12:00:00+02:00",
    newsUrl: "https://www.ansa.it/piemonte/notizie/",
    newsSintesi:
      "Uscita da FdI verso Gruppo Misto dopo le vicende giudiziarie — contendibile, non adesione FN.",
    includeInNewsFeed: true,
    dataCambioPartito: "2024-08-12T12:00:00+02:00",
    cambioGruppoDa: "Fratelli d'Italia",
    cambioGruppoA: "Gruppo Misto",
    fonteIstituzionale: {
      label: "Scheda On. Emanuele Pozzolo · Camera XIX",
      url: "https://www.camera.it/leg19/28?shadow_deputato=308488",
      tipo: "Camera XIX Leg.",
    },
    fonteStampa: {
      testata: "ANSA",
      titoloArticolo: "Pozzolo lascia Fratelli d'Italia, passa al Misto",
      data: "2024-08-12",
      url: "https://www.ansa.it/piemonte/notizie/",
      estratto:
        "Il deputato biellese abbandona il gruppo FdI e risulta iscritto al Gruppo Misto.",
    },
  },
];

const BACINO_CDX_SEEDS: CatalogSeed[] = [
  {
    id: "cdx-crippa",
    slug: "andrea-crippa",
    nome: "Andrea Crippa",
    ruolo: "Deputato",
    regione: "Lombardia",
    provinciaCollegio: "Seregno (U02)",
    caricaEtichetta: "In carica · Lega",
    statoDescrittivo: "In carica · Lega (Simula impatto se passa in FN)",
    partitoProvenienza: "Lega",
    partitoDestinazione: "In carica (nessun passaggio FN)",
    stato: "BACINO_CDX_IN_CARICA",
    electoral: {
      kind: "camera_uninominal_2022",
      preferenzeStoriche: 117_159,
      collegioLabel: "Lombardia 1-U02 uninominale · 25/09/2022",
      sourceLabel: "Ministero dell'Interno / La Repubblica",
      sourceUrl:
        "https://elezioni.repubblica.it/2022/cameradeideputati/lombardia/lombardia-1/lombardia1-p01/lombardia1-u02/",
    },
    newsTitolo: "",
    newsFonte: "",
    newsData: "2026-01-01T00:00:00+01:00",
    newsUrl: "#",
    newsSintesi: "",
    includeInNewsFeed: false,
  },
  {
    id: "cdx-montemagni",
    slug: "elisa-montemagni",
    nome: "Elisa Montemagni",
    ruolo: "Deputato",
    regione: "Toscana",
    provinciaCollegio: "Massa (U02)",
    caricaEtichetta: "In carica · Lega",
    statoDescrittivo: "In carica · Lega (Simula impatto se passa in FN)",
    partitoProvenienza: "Lega",
    partitoDestinazione: "In carica (nessun passaggio FN)",
    stato: "BACINO_CDX_IN_CARICA",
    electoral: {
      kind: "camera_uninominal_2022",
      preferenzeStoriche: 78_976,
      collegioLabel: "Toscana-U02 uninominale · 25/09/2022",
      sourceLabel: "Ministero dell'Interno / La Repubblica",
      sourceUrl:
        "https://elezioni.repubblica.it/2022/cameradeideputati/toscana/toscana/toscana-p01/toscana-u02/",
    },
    newsTitolo: "",
    newsFonte: "",
    newsData: "2026-01-01T00:00:00+01:00",
    newsUrl: "#",
    newsSintesi: "",
    includeInNewsFeed: false,
  },
  {
    id: "cdx-meini",
    slug: "elena-meini",
    nome: "Elena Meini",
    ruolo: "Consigliere Regionale",
    regione: "Toscana",
    provinciaCollegio: "Circoscrizione Pisa",
    caricaEtichetta: "In carica · Lega",
    statoDescrittivo: "In carica · Lega (Simula impatto se passa in FN)",
    partitoProvenienza: "Lega",
    partitoDestinazione: "In carica (nessun passaggio FN)",
    stato: "BACINO_CDX_IN_CARICA",
    electoral: {
      kind: "consiglio_regionale_2025",
      preferenzeStoriche: 3_122,
      collegioLabel: "Lega · Regionali Toscana 2025 · circ. Pisa",
      sourceLabel: "Corriere Toscano",
      sourceUrl:
        "https://corrieretoscano.it/toscana/politica/toscana-2025-i-nuovi-consiglieri-regionali-elena-meini-e-la-piu-votata-lega-ma-e-eletto-simoni-fedelissimo-di-vannacci/",
    },
    newsTitolo: "",
    newsFonte: "",
    newsData: "2026-01-01T00:00:00+01:00",
    newsUrl: "#",
    newsSintesi: "",
    includeInNewsFeed: false,
  },
];

/** Lista Rassegna: solo esterni con cambio gruppo / rumor (no FN ufficiali, no bacino). */
const RASSEGNA_LIST_SEEDS = [...CAMBIO_GRUPPO_SEEDS];
const ALL_SEEDS = [...FN_OFFICIAL_SEEDS, ...CAMBIO_GRUPPO_SEEDS, ...BACINO_CDX_SEEDS];

export const RASSEGNA_DEFECTION_POLITICIANS: TrackedPolitician[] =
  RASSEGNA_LIST_SEEDS.map(buildPolitician);

export const INITIAL_TRACKED_POLITICIANS: TrackedPolitician[] = RASSEGNA_DEFECTION_POLITICIANS;

/** Per match RSS su tutti i profili catalogati (inclusi FN per notizie). */
export const CATALOG_POLITICIANS_FOR_NEWS: TrackedPolitician[] = ALL_SEEDS.map(buildPolitician);

export function catalogSeedsForNewsFeed(): CatalogSeed[] {
  return ALL_SEEDS.filter((s) => s.includeInNewsFeed && s.newsUrl !== "#");
}

export function findPoliticianBySlug(slug: string): TrackedPolitician | undefined {
  const all = ALL_SEEDS.map(buildPolitician);
  return all.find((p) => p.slug === slug || politicianSlugFromName(p.nome) === slug);
}

export const FN_PARLIAMENTARI_REFERENCE_COUNT = 9;
