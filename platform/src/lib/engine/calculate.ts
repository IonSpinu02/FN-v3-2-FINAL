import { CIRC, REGIONS, type Region, type RegionMap } from "./constants";
import {
  corr,
  entropyH,
  js,
  kl,
  mapFromRecord,
  norm,
  quantile,
} from "./math";
import { PythonRandom } from "./pythonDistributions";
import type { EuRegion, FnConfig, ScenarioResult, ScenarioRow } from "./types";

type Weights = FnConfig["pesi"];

export type InstitutionalRow = {
  dep: number;
  creg: number;
  sind: number;
  com: number;
};

export type CalculateOverrides = {
  S?: number;
  pesi?: Weights;
  flussi_ipsos?: { FdI: number; Lega: number; ast: number };
  istituzioniDelta?: Partial<Record<Region, Partial<InstitutionalRow>>>;
};

function applyIstituzioniDelta(
  cfg: FnConfig,
  delta?: CalculateOverrides["istituzioniDelta"],
): void {
  if (!delta) return;
  const cariche = ["dep", "creg", "sind", "com"] as const;
  for (const [regionKey, rowDelta] of Object.entries(delta)) {
    if (!REGIONS.includes(regionKey as Region)) {
      throw new Error(`Regione non valida in istituzioniDelta: ${regionKey}`);
    }
    const region = regionKey as Region;
    if (!rowDelta) continue;
    for (const carica of cariche) {
      const d = rowDelta[carica];
      if (d === undefined) continue;
      if (!Number.isFinite(d)) {
        throw new Error(`Delta istituzionale non valido: ${region}/${carica}`);
      }
      if (!cfg.presenze_istituzionali[carica]) {
        cfg.presenze_istituzionali[carica] = {};
      }
      const cur = cfg.presenze_istituzionali[carica][region] ?? 0;
      cfg.presenze_istituzionali[carica][region] = Math.max(0, cur + d);
    }
  }
}

export function normalizePesi(p: Weights): Weights {
  const sum = p.flussi + p.pref + p.isc + p.ist;
  if (sum <= 0) throw new Error("Pesi non validi");
  return {
    flussi: p.flussi / sum,
    pref: p.pref / sum,
    isc: p.isc / sum,
    ist: p.ist / sum,
  };
}

function mix(
  alpha: Weights,
  f: RegionMap,
  v: RegionMap,
  s: RegionMap,
  m: RegionMap,
): RegionMap {
  const out = {} as RegionMap;
  for (const r of REGIONS) {
    out[r] =
      alpha.flussi * f[r] +
      alpha.pref * v[r] +
      alpha.isc * s[r] +
      alpha.ist * m[r];
  }
  return out;
}

export function calculate(
  cfg: FnConfig,
  eu: Record<Region, EuRegion>,
  nSim?: number,
  overrides?: CalculateOverrides,
): ScenarioResult {
  const working = structuredClone(cfg);
  if (overrides?.S !== undefined) {
    working.sondaggio_nazionale = overrides.S;
  }
  if (overrides?.pesi !== undefined) {
    working.pesi = normalizePesi(overrides.pesi);
  }
  if (overrides?.flussi_ipsos !== undefined) {
    working.flussi_ipsos = { ...overrides.flussi_ipsos };
  }
  applyIstituzioniDelta(working, overrides?.istituzioniDelta);

  for (const r of REGIONS) {
    if (!(r in working.iscritti_regione)) {
      throw new Error(`Regione mancante in config: ${r}`);
    }
    if (!(r in eu)) throw new Error(`Regione mancante in eu: ${r}`);
  }

  const valid = mapFromRecord(
    Object.fromEntries(REGIONS.map((r) => [r, eu[r].valid])) as Record<
      Region,
      number
    >,
  );
  const fdi = mapFromRecord(
    Object.fromEntries(REGIONS.map((r) => [r, eu[r].FdI])) as Record<
      Region,
      number
    >,
  );
  const lega = mapFromRecord(
    Object.fromEntries(REGIONS.map((r) => [r, eu[r].Lega])) as Record<
      Region,
      number
    >,
  );

  const aff = working.affluenza_percento;
  const nazionale = working.italia_2024;
  const prefOrig = working.preferenze_circoscrizione;
  const prefObs = working.preferenze_regionali_osservate;

  const ratio =
    REGIONS.reduce((s, r) => s + valid[r], 0) / nazionale.votanti;
  const votanti = {} as RegionMap;
  const elettori = {} as RegionMap;
  const ast = {} as RegionMap;
  for (const r of REGIONS) {
    votanti[r] = valid[r] / ratio;
    elettori[r] = votanti[r] / (aff[r] / 100);
    ast[r] = elettori[r] - votanti[r];
  }

  const k =
    working.preferenze_totali /
    Object.values(prefOrig).reduce((a, b) => a + b, 0);
  const pref = {} as RegionMap;
  const prefTipo: Record<Region, "osservato" | "ricostruito"> = {} as Record<
    Region,
    "osservato" | "ricostruito"
  >;

  for (const [circKey, regions] of Object.entries(CIRC)) {
    const totale = prefOrig[circKey] * k;
    const fixed: Partial<Record<Region, number>> = {};
    for (const r of regions) {
      if (prefObs[r] !== undefined) fixed[r] = prefObs[r]!;
    }
    const rest = regions.filter((r) => !(r in fixed));
    const residuo = totale - Object.values(fixed).reduce((a, b) => a + b, 0);
    const legaResto = rest.reduce((s, r) => s + lega[r], 0);
    for (const r of regions) {
      if (r in fixed) {
        pref[r] = fixed[r]!;
        prefTipo[r] = "osservato";
      } else {
        pref[r] = legaResto ? (residuo * lega[r]) / legaResto : 0;
        prefTipo[r] = "ricostruito";
      }
    }
  }

  const iscritti = mapFromRecord(working.iscritti_regione);
  const istit = working.presenze_istituzionali;
  const puntiCarica = working.punteggi_cariche;
  const lam = working.lambda_istituzionale;

  const conti = {} as RegionMap;
  const punti = {} as RegionMap;
  for (const r of REGIONS) {
    let c = 0;
    let p = 0;
    for (const [k, w] of Object.entries(puntiCarica)) {
      const n = istit[k]?.[r] ?? 0;
      c += n;
      p += n * w;
    }
    conti[r] = c;
    punti[r] = p;
  }

  const q = norm(valid);
  const xfd = norm(fdi);
  const xle = norm(lega);
  const xast = norm(ast);

  const flussiSum =
    working.flussi_ipsos.FdI + working.flussi_ipsos.Lega + working.flussi_ipsos.ast;
  const altri = 1 - flussiSum;
  const f = {} as RegionMap;
  for (const r of REGIONS) {
    f[r] =
      working.flussi_ipsos.FdI * xfd[r] +
      working.flussi_ipsos.Lega * xle[r] +
      working.flussi_ipsos.ast * xast[r] +
      altri * q[r];
  }

  const v = norm(pref);
  const s = norm(iscritti);
  const rawM = norm(punti);
  const puntiTot = REGIONS.reduce((sum, r) => sum + punti[r], 0);
  const m = {} as RegionMap;
  for (const r of REGIONS) {
    m[r] = (punti[r] + lam * q[r]) / (puntiTot + lam);
  }

  const w = working.pesi;
  const wSum = w.flussi + w.pref + w.isc + w.ist;
  if (Math.abs(wSum - 1) > 1e-8) throw new Error("Pesi non normalizzati");

  const p = mix(w, f, v, s, m);
  const b = norm(
    mapFromRecord(
      Object.fromEntries(REGIONS.map((r) => [r, fdi[r] + lega[r]])) as Record<
        Region,
        number
      >,
    ),
  );
  const S = working.sondaggio_nazionale;
  const V = REGIONS.reduce((sum, r) => sum + valid[r], 0);

  const alt: Record<string, Weights> = {
    "Pesi uguali": { flussi: 0.25, pref: 0.25, isc: 0.25, ist: 0.25 },
    "Senza istituzioni": { flussi: 0.4, pref: 0.3, isc: 0.3, ist: 0 },
    "Solo flussi": { flussi: 1, pref: 0, isc: 0, ist: 0 },
    "Flussi + preferenze": { flussi: 0.5, pref: 0.5, isc: 0, ist: 0 },
    "Senza preferenze": { flussi: 0.45, pref: 0, isc: 0.35, ist: 0.2 },
  };
  const alts: Record<string, RegionMap> = {};
  for (const [name, a] of Object.entries(alt)) {
    alts[name] = mix(a, f, v, s, m);
  }

  const N = nSim ?? working.monte_carlo.simulazioni;
  const seed = working.monte_carlo.seme;
  const simulations: Record<Region, number[]> = Object.fromEntries(
    REGIONS.map((r) => [r, [] as number[]]),
  ) as Record<Region, number[]>;
  const hs: number[] = [];
  if (N > 0) {
    const rng = new PythonRandom(seed);
    const c = working.monte_carlo.concentrazione_dirichlet;
    const sd = working.monte_carlo.sd_sondaggio;
    const weightValues = [w.flussi, w.pref, w.isc, w.ist];
    const weightKeys: (keyof Weights)[] = ["flussi", "pref", "isc", "ist"];
    for (let i = 0; i < N; i++) {
      const g = weightValues.map((a) => rng.gammavariate(a * c, 1));
      const z = g.reduce((a, b) => a + b, 0);
      const alpha = {} as Weights;
      weightKeys.forEach((key, idx) => {
        alpha[key] = g[idx] / z;
      });
      const pp = mix(alpha, f, v, s, m);
      const SS = Math.max(0.02, rng.gauss(S, sd));
      for (const r of REGIONS) {
        simulations[r].push((SS * pp[r]) / q[r]);
      }
      hs.push(entropyH(pp));
    }
  }
  const hScenario = entropyH(p);

  const ix = {
    flussi: Object.fromEntries(REGIONS.map((r) => [r, f[r] / q[r]])) as RegionMap,
    pref: Object.fromEntries(REGIONS.map((r) => [r, v[r] / q[r]])) as RegionMap,
    isc: Object.fromEntries(REGIONS.map((r) => [r, s[r] / q[r]])) as RegionMap,
    ist: Object.fromEntries(REGIONS.map((r) => [r, m[r] / q[r]])) as RegionMap,
  };
  const correlations: Record<string, Record<string, number | null>> = {};
  for (const a of Object.keys(ix) as (keyof typeof ix)[]) {
    correlations[a] = {};
    for (const bb of Object.keys(ix) as (keyof typeof ix)[]) {
      correlations[a][bb] = corr(ix[a], ix[bb]);
    }
  }

  const rows: ScenarioRow[] = [];
  for (const r of REGIONS) {
    const yp = (S * p[r]) / q[r];
    const yb = (S * b[r]) / q[r];
    const vals = [
      yp,
      ...Object.values(alts).map((aa) => (S * aa[r]) / q[r]),
    ];
    rows.push({
      regione: r,
      validi2024: valid[r],
      FdI2024: fdi[r],
      Lega2024: lega[r],
      affluenza2024: aff[r],
      elettori_ricostruiti: elettori[r],
      astenuti_ricostruiti: ast[r],
      preferenze: pref[r],
      tipo_preferenze: prefTipo[r],
      iscritti: iscritti[r],
      presenze: conti[r],
      punti_istituzionali: punti[r],
      q: q[r],
      f: f[r],
      v: v[r],
      s: s[r],
      m: m[r],
      p: p[r],
      w: p[r] / q[r],
      b: b[r],
      stima: yp,
      benchmark: yb,
      voti_di_scenario: S * p[r] * V,
      lo10: N > 0 ? quantile(simulations[r], 0.1) : yp,
      hi90: N > 0 ? quantile(simulations[r], 0.9) : yp,
      min_pesi: Math.min(...vals),
      max_pesi: Math.max(...vals),
    });
  }

  const pSum = REGIONS.reduce((s, r) => s + p[r], 0);
  if (Math.abs(pSum - 1) > 1e-12) throw new Error("Scenario non normalizzato");
  const votiSum = rows.reduce((s, row) => s + row.voti_di_scenario, 0);
  if (Math.abs(votiSum - S * V) > 1e-4) {
    throw new Error("Voti scenario incoerenti");
  }

  return {
    metadati: {
      titolo: "Scenario territoriale FN v3.2",
      data: "2026-10-18",
      fonte:
        "Dati forniti dal committente e fonti pubbliche (v3.2, audit metodologico e storico mensile)",
      predizione_validata: false,
      diagnostica:
        "Sensibilità e confronti strutturali NON equivalgono ad accuratezza predittiva",
      seme: seed,
      simulazioni: N,
    },
    parametri: {
      S,
      pesi: w,
      lambda: lam,
      iscritti_totali_dichiarati: working.iscritti_totali_dichiarati,
      iscritti_attribuiti: REGIONS.reduce((s, r) => s + iscritti[r], 0),
      comitati: working.comitati,
      validi2024: V,
      nazionale2024: nazionale,
      affluenza_regionali_elettori_ricostruiti: true,
    },
    metriche: {
      H: {
        elettorato: entropyH(q),
        flussi: entropyH(f),
        preferenze: entropyH(v),
        iscritti: entropyH(s),
        istituzioni: entropyH(m),
        istituzioni_grezze: entropyH(rawM),
        scenario: entropyH(p),
        benchmark: entropyH(b),
      },
      KL: {
        scenario: kl(p, q),
        benchmark: kl(b, q),
        iscritti: kl(s, q),
      },
      JS: {
        scenario_benchmark: js(p, b),
        scenario_elettorato: js(p, q),
        iscritti_elettorato: js(s, q),
      },
      correlazioni_indici: correlations,
      intervallo_H_sensibilita:
        N > 0
          ? [quantile(hs, 0.1), quantile(hs, 0.9)]
          : [hScenario, hScenario],
      differenze_max_scenario_benchmark_punti:
        Math.max(
          ...REGIONS.map((r) => Math.abs((S * (p[r] - b[r])) / q[r]) * 100),
        ),
      differenza_media_ponderata_scenario_benchmark_punti:
        REGIONS.reduce(
          (s, r) => s + q[r] * Math.abs((S * (p[r] - b[r])) / q[r]),
          0,
        ) * 100,
      stabilita: Object.fromEntries(
        Object.entries(alts).map(([name, x]) => [
          name,
          Object.fromEntries(
            REGIONS.map((r) => [r, (S * x[r]) / q[r]]),
          ) as Record<Region, number>,
        ]),
      ) as Record<string, Record<Region, number>>,
    },
    righe: rows,
    validazione_predittiva: {
      stato: "IN ATTESA DI ESITI REGIONALI FUTURI COMPARABILI",
      wmae_punti: null,
      benchmark_wmae_punti: null,
      skill_vs_benchmark: null,
      copertura_intervalli: null,
    },
  };
}
