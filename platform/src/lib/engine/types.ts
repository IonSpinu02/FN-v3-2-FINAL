import type { Region } from "./constants";

export interface FnConfig {
  titolo?: string;
  data_base?: string;
  italia_2024: { elettori: number; votanti: number };
  affluenza_percento: Record<Region, number>;
  preferenze_totali: number;
  preferenze_circoscrizione: Record<string, number>;
  preferenze_regionali_osservate: Partial<Record<Region, number>>;
  iscritti_regione: Record<Region, number>;
  iscritti_totali_dichiarati: number;
  comitati: number;
  presenze_istituzionali: Record<string, Partial<Record<Region, number>>>;
  sondaggio_nazionale: number;
  pesi: { flussi: number; pref: number; isc: number; ist: number };
  flussi_ipsos: { FdI: number; Lega: number; ast: number };
  punteggi_cariche: Record<string, number>;
  lambda_istituzionale: number;
  monte_carlo: {
    simulazioni: number;
    seme: number;
    concentrazione_dirichlet: number;
    sd_sondaggio: number;
  };
}

export interface EuRegion {
  valid: number;
  FdI: number;
  Lega: number;
}

export interface ScenarioRow {
  regione: Region;
  validi2024: number;
  FdI2024: number;
  Lega2024: number;
  affluenza2024: number;
  elettori_ricostruiti: number;
  astenuti_ricostruiti: number;
  preferenze: number;
  tipo_preferenze: "osservato" | "ricostruito";
  iscritti: number;
  presenze: number;
  punti_istituzionali: number;
  q: number;
  f: number;
  v: number;
  s: number;
  m: number;
  p: number;
  w: number;
  b: number;
  stima: number;
  benchmark: number;
  voti_di_scenario: number;
  lo10: number;
  hi90: number;
  min_pesi: number;
  max_pesi: number;
}

export interface ScenarioResult {
  metadati: {
    titolo: string;
    data: string;
    fonte: string;
    predizione_validata: boolean;
    diagnostica: string;
    seme: number;
    simulazioni: number;
  };
  parametri: {
    S: number;
    pesi: FnConfig["pesi"];
    lambda: number;
    iscritti_totali_dichiarati: number;
    iscritti_attribuiti: number;
    comitati: number;
    validi2024: number;
    nazionale2024: FnConfig["italia_2024"];
    affluenza_regionali_elettori_ricostruiti: boolean;
  };
  metriche: {
    H: Record<string, number>;
    KL: Record<string, number>;
    JS: Record<string, number>;
    correlazioni_indici: Record<string, Record<string, number | null>>;
    intervallo_H_sensibilita: [number, number];
    differenze_max_scenario_benchmark_punti: number;
    differenza_media_ponderata_scenario_benchmark_punti: number;
    stabilita: Record<string, Record<Region, number>>;
  };
  righe: ScenarioRow[];
  validazione_predittiva: Record<string, unknown>;
}
