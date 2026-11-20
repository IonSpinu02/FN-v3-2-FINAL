import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/engine/constants";
import { FORECAST_V4_MODEL_ID, type ForecastHorizonResult, type ForecastScenarioId, type ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, macroAreaOf, type BackcastRegionInput } from "@/lib/engine/strategicBackcastEngine";
import { buildOperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";
import {
  consensoObservationVariance,
  monitorRoute,
  normalCdf,
  planCorridorAt,
  type ConsensoObservation,
  type MonitorRoute,
  type NetworkObservation,
  type RouteLedger,
} from "@/lib/engine/routeMonitoringEngine";

function horizon(key: "d30" | "d90" | "d180", central: number): ForecastHorizonResult {
  return {
    key,
    label: key,
    days: key === "d30" ? 30 : key === "d90" ? 90 : 180,
    startPct: 6.62,
    centralPct: central,
    deltaPp: central - 6.62,
    lo10Pct: central - 0.3,
    hi90Pct: central + 0.4,
    sigma: { poll: 0.1, hist: 0.1, model: 0.1, total: 0.2 },
    factors: [],
    uncertaintyNote: "",
    uncertaintyPlain: "",
  };
}

function model(): ForecastV4Result {
  const make = (id: ForecastScenarioId, central: number) => ({
    id,
    label: id,
    tagline: id,
    horizons: (["d30", "d90", "d180"] as const).map((key) => horizon(key, central)),
  });
  const passivo = make("passivo", 6.8);
  const base = make("base", 7.1);
  const offensiva = make("offensiva", 7.52);
  return {
    modelId: FORECAST_V4_MODEL_ID,
    asOf: "2026-11-11",
    startPct: 6.62,
    startSource: "input",
    diagnostics: {} as ForecastV4Result["diagnostics"],
    scenarios: { passivo, base, offensiva },
    base,
  };
}

function regions(): BackcastRegionInput[] {
  return REGIONS.map((region) => ({
    region,
    validVoters: region === "Lombardia" ? 4_200_000 : 1_000_000,
    currentSharePct: 6.62,
    priority: 70,
    affinity: 74,
    macroArea: macroAreaOf(region),
    cdxSharePct: 46,
    abstentionPct: 18,
    themePressure: 0.62,
    members: 2000,
    committees: 30,
    localElected: 6,
  }));
}

const plan = computeStrategicBackcast({
  forecast: model(),
  targetPct: 12,
  horizonDays: 360,
  regions: regions(),
  currentMembers: 156_456,
  currentCommittees: 1_800,
  totalValidVoters: 23_257_062,
  seed: 8,
});
const roadmap = buildOperationalRoadmap(plan, 360);
const route: MonitorRoute = {
  targetPct: 12,
  horizonDays: 360,
  activatedAt: "2026-01-01T09:00:00.000Z",
  baselinePctAtActivation: plan.currentPct,
  baselineNetwork: { committees: 1800, members: 156_456, elected: 100 },
};

function dateOf(day: number): string {
  return new Date(Date.UTC(2026, 0, 1) + day * 86_400_000).toISOString().slice(0, 10);
}
function nowAt(day: number): Date {
  return new Date(Date.UTC(2026, 0, 1, 12) + day * 86_400_000);
}
function supermedia(day: number, pct: number): ConsensoObservation {
  return { id: `s${day}`, date: dateOf(day), pct, source: "supermedia" };
}
function rete(day: number, share: number): NetworkObservation {
  const frac = (total: number) => Math.round(total * (day / 360) * share);
  return {
    id: `r${day}`,
    date: dateOf(day),
    committees: 1800 + frac(plan.network.deltaCommittees),
    members: 156_456 + frac(plan.network.deltaMembers),
    elected: 100 + frac(plan.network.electedTarget),
  };
}
function onPlan(days: number[], bias = 0): ConsensoObservation[] {
  return days.map((day) => supermedia(day, planCorridorAt(plan, day).expected + bias));
}
function run(ledger: RouteLedger, day: number) {
  return monitorRoute({ route, plan, roadmap, ledger, now: nowAt(day) });
}
const DAYS = [10, 25, 40, 55, 70, 85];

describe("monitorRoute", () => {
  it("senza dati non emette un giudizio ma chiede le rilevazioni", () => {
    const report = run({ consenso: [], rete: [] }, 40);
    expect(report.consenso.status).toBe("NESSUN_DATO");
    expect(report.diagnosis.code).toBe("DATI_INSUFFICIENTI");
    expect(report.alerts.some((alert) => alert.code === "NESSUN_CONSENSO")).toBe(true);
    expect(report.epistemic).toEqual({ observations: "MISURATO", levelEstimate: "STIMA MODELLO", plan: "IPOTESI" });
  });

  it("non reagisce a un solo sondaggio rumoroso", () => {
    const expected = planCorridorAt(plan, 60).expected;
    const poll: ConsensoObservation = { id: "p", date: dateOf(60), pct: expected - 0.7, n: 1000, source: "sondaggio" };
    const report = run({ consenso: [poll], rete: [] }, 60);
    expect(report.consenso.status).not.toBe("DA_ACCELERARE");
    expect(report.consenso.levelSd).toBeGreaterThan(0.4);
  });

  it("riconosce un consenso fermo sotto il piano dopo molte misure", () => {
    const flat = DAYS.map((day) => supermedia(day, plan.currentPct));
    const report = run({ consenso: flat, rete: [] }, 85);
    expect(report.consenso.status).toBe("DA_ACCELERARE");
    expect(report.consenso.probBelowMin).toBeGreaterThan(0.8);
    expect(report.consenso.gapToExpectedPp).toBeLessThan(-0.3);
    expect(report.alerts.some((alert) => alert.code === "SOTTO_CORRIDOIO")).toBe(true);
  });

  it("classifica in rotta e in anticipo seguendo il piano", () => {
    expect(run({ consenso: onPlan(DAYS), rete: [] }, 85).consenso.status).toBe("IN_ROTTA");
    expect(run({ consenso: onPlan(DAYS, 0.9), rete: [] }, 85).consenso.status).toBe("IN_ANTICIPO");
  });

  it("stima la pendenza di una crescita regolare", () => {
    const linear = [5, 15, 25, 35, 45, 55, 65, 75].map((day) => supermedia(day, plan.currentPct + day * 0.02));
    const report = run({ consenso: linear, rete: [] }, 75);
    expect(report.consenso.slopePpPerMonth).toBeGreaterThan(0.45);
    expect(report.consenso.slopePpPerMonth).toBeLessThan(0.75);
    expect(report.consenso.levelPct).toBeCloseTo(plan.currentPct + 75 * 0.02, 0);
  });

  it("la probabilità di raggiungere il traguardo cresce con il consenso osservato", () => {
    const low = run({ consenso: onPlan(DAYS, -0.6), rete: [] }, 85).consenso.probReachTarget;
    const mid = run({ consenso: onPlan(DAYS), rete: [] }, 85).consenso.probReachTarget;
    const high = run({ consenso: onPlan(DAYS, 0.9), rete: [] }, 85).consenso.probReachTarget;
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
    for (const value of [low, mid, high]) expect(value).toBeGreaterThanOrEqual(0);
  });

  it("distingue conversione lenta, ritardo di esecuzione e vento esterno", () => {
    const behind = DAYS.map((day) => supermedia(day, plan.currentPct));
    const conversion = run({ consenso: behind, rete: [rete(85, 1)] }, 85);
    expect(conversion.diagnosis.code).toBe("CONVERSIONE_LENTA");
    expect(conversion.weeklyOrders[0]).toMatch(/Non aumentare i volumi/);

    const execution = run({ consenso: behind, rete: [rete(85, 0.3)] }, 85);
    expect(execution.diagnosis.code).toBe("ESECUZIONE_IN_RITARDO");
    expect(execution.network.some((kpi) => kpi.status === "CRITICO")).toBe(true);

    const wind = run({ consenso: onPlan(DAYS, 0.9), rete: [rete(85, 0.3)] }, 85);
    expect(wind.diagnosis.code).toBe("VENTO_ESTERNO");

    const fine = run({ consenso: onPlan(DAYS), rete: [rete(85, 1)] }, 85);
    expect(fine.diagnosis.code).toBe("PIANO_IN_LINEA");
  });

  it("valuta le tappe: chiusa, in corso, futura", () => {
    const report = run({ consenso: onPlan(DAYS), rete: [rete(85, 1)] }, 85);
    expect(report.currentStageId).toBe(2);
    expect(report.gates.map((gate) => gate.state)).toEqual(["CHIUSA", "IN_CORSO", "FUTURA", "FUTURA"]);
    expect(report.gates[3]!.verdict).toBe("DA_VALUTARE");
    const late = run({ consenso: DAYS.map((day) => supermedia(day, plan.currentPct)), rete: [rete(85, 0.2)] }, 120);
    expect(late.gates[1]!.verdict).toBe("A_RISCHIO");
  });

  it("segnala dato vecchio e orizzonte concluso", () => {
    const stale = run({ consenso: onPlan([5, 10]), rete: [] }, 80);
    expect(stale.alerts.some((alert) => alert.code === "DATO_VECCHIO")).toBe(true);
    const done = run({ consenso: onPlan([300, 340, 359]), rete: [] }, 400);
    expect(done.diagnosis.code).toBe("ORIZZONTE_CONCLUSO");
  });

  it("ignora rilevazioni precedenti all'attivazione", () => {
    const report = run({ consenso: [supermedia(-5, 9.9), ...onPlan(DAYS)], rete: [] }, 85);
    expect(report.consenso.observations).toBe(DAYS.length);
    expect(report.consenso.status).toBe("IN_ROTTA");
  });

  it("calcola i ritmi richiesti e segnala la capacità insufficiente", () => {
    const report = run({ consenso: onPlan(DAYS), rete: [rete(85, 0.4)] }, 85);
    for (const kpi of report.network) {
      expect(kpi.actual).not.toBeNull();
      expect(kpi.requiredMonthly).toBeGreaterThanOrEqual(0);
      expect(kpi.planned).toBeGreaterThanOrEqual(0);
    }
    const stuck = monitorRoute({
      route: { ...route, horizonDays: 360 },
      plan,
      roadmap,
      ledger: { consenso: onPlan(DAYS), rete: [rete(5, 0)] },
      now: nowAt(340),
    });
    expect(stuck.network.some((kpi) => !kpi.recoverable)).toBe(true);
    expect(stuck.alerts.some((alert) => alert.code.startsWith("CAPACITA_"))).toBe(true);
  });
});

describe("modello di rumore delle rilevazioni", () => {
  it("un campione più grande riduce la varianza e la supermedia è fissa", () => {
    const small = consensoObservationVariance({ pct: 7, n: 500, source: "sondaggio" });
    const large = consensoObservationVariance({ pct: 7, n: 3000, source: "sondaggio" });
    expect(large).toBeLessThan(small);
    expect(consensoObservationVariance({ pct: 7, source: "supermedia" })).toBeCloseTo(0.0625, 6);
    expect(Math.sqrt(consensoObservationVariance({ pct: 7, n: 1000, source: "sondaggio" }))).toBeGreaterThan(0.8);
  });

  it("la funzione di ripartizione normale è corretta nei punti noti", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.28)).toBeCloseTo(0.1, 2);
  });
});
