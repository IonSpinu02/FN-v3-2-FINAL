import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/engine/constants";
import { FORECAST_V4_MODEL_ID, type ForecastHorizonResult, type ForecastScenarioId, type ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, macroAreaOf, type BackcastRegionInput, type HorizonDays, type StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import { ambitionProfile, buildOperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";

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

function planAt(targetPct: number, horizonDays: HorizonDays = 360): StrategicBackcastResult {
  return computeStrategicBackcast({
    forecast: model(),
    targetPct,
    horizonDays,
    regions: regions(),
    currentMembers: 156_456,
    currentCommittees: 1_800,
    totalValidVoters: 23_257_062,
    seed: 8,
  });
}

/** Toglie i numeri così si confronta lo scaffold narrativo, non solo i delta. */
function stripNumbers(text: string): string {
  return text.replace(/\d+([.,]\d+)?/g, "#").replace(/\s+/g, " ").trim();
}

describe("buildOperationalRoadmap", () => {
  it("copre i giorni e usa solo i serbatoi scelti dal solver", () => {
    const banned = [/Conv\.\s*\d/, /Interesse Google \(30[gG]\)/, /Cosa cercano su Google/];
    for (const horizonDays of [30, 90, 180, 360] as const) {
      const plan = planAt(12, horizonDays);
      const roadmap = buildOperationalRoadmap(plan, horizonDays);
      expect(roadmap.epistemic).toBe("IPOTESI");
      expect(roadmap.ambition).toBe(ambitionProfile(plan));
      expect(roadmap.generatedBy).toBe("DETERMINISTIC_ENGINE");
      expect(roadmap.executiveThesis.length).toBeGreaterThan(20);
      expect(roadmap.keyBottleneckResolution.length).toBeGreaterThan(20);
      expect(roadmap.stages[0]?.fromDay).toBe(1);
      expect(roadmap.stages[3]?.toDay).toBe(horizonDays);
      for (let index = 0; index < roadmap.stages.length; index += 1) {
        const stage = roadmap.stages[index]!;
        expect(stage.epistemic).toBe("IPOTESI");
        expect(stage.toDay).toBeGreaterThanOrEqual(stage.fromDay);
        if (index > 0) expect(stage.fromDay).toBe(roadmap.stages[index - 1]!.toDay + 1);
        expect(stage.placesToPresidiate.length).toBeGreaterThanOrEqual(2);
        expect(stage.placesToPresidiate.length).toBeLessThanOrEqual(5);
        expect(stage.concreteActions).toHaveLength(3);
      }
      const chosen = new Set(plan.regions.filter((row) => row.addedVotes > 0).map((row) => row.region));
      const pool = chosen.size > 0 ? chosen : new Set(plan.regions.map((row) => row.region));
      for (const stage of roadmap.stages) {
        for (const place of stage.placesToPresidiate) expect(pool.has(place.region)).toBe(true);
      }
      const text = JSON.stringify(roadmap);
      for (const rule of banned) expect(text).not.toMatch(rule);
    }
    const year = buildOperationalRoadmap(planAt(12, 360), 360);
    expect(year.stages.map((stage) => [stage.fromDay, stage.toDay])).toEqual([
      [1, 60],
      [61, 150],
      [151, 270],
      [271, 360],
    ]);
  });

  it("ruota luoghi e azioni tra le 4 tappe, senza IPOTESI ripetuto in coda alle frasi", () => {
    for (const horizonDays of [90, 360] as const) {
      const plan = planAt(12, horizonDays);
      const roadmap = buildOperationalRoadmap(plan, horizonDays);
      const places = roadmap.stages.flatMap((stage) => stage.placesToPresidiate.map((place) => place.place));
      expect(new Set(places).size).toBe(places.length);
      for (const place of roadmap.stages.flatMap((stage) => stage.placesToPresidiate)) {
        expect(place.rationale.length).toBeGreaterThan(10);
        expect(place.kind.length).toBeGreaterThan(0);
      }
      for (const lane of ["Aria", "Terra", "Istituzioni"] as const) {
        const texts = roadmap.stages.map((stage) => stage.concreteActions.find((action) => action.lane === lane)?.text ?? "");
        expect(new Set(texts).size).toBe(4);
      }
      expect(new Set(roadmap.stages.map((stage) => stage.label)).size).toBe(4);
      for (const stage of roadmap.stages) {
        for (const action of stage.concreteActions) {
          expect(action.text).not.toContain(". IPOTESI.");
          expect(action.text).not.toMatch(/IPOTESI\.?\s*$/);
        }
      }
      const last = roadmap.stages[3];
      const sum = (pick: (stage: (typeof roadmap.stages)[number]) => number) => roadmap.stages.reduce((total, stage) => total + pick(stage), 0);
      expect(sum((stage) => stage.stageCommitteesDelta)).toBe(last.committees);
      expect(sum((stage) => stage.stageMembersDelta)).toBe(last.members);
      expect(sum((stage) => stage.stageOfficialsDelta)).toBe(last.elected);
      expect(sum((stage) => stage.stageVotesDelta)).toBe(last.cumulativeVotesTarget);
      expect(roadmap.stages[0].regions.length).toBeGreaterThan(0);
      expect(roadmap.stages[3].placesToPresidiate.every((place) => place.kind === "Area metropolitana")).toBe(true);
    }
  });

  it("a obiettivi diversi cambia profilo, testi e densità dei posti, non solo i numeri", () => {
    const lowPlan = planAt(8, 360);
    const highPlan = planAt(12, 360);
    const low = buildOperationalRoadmap(lowPlan, 360);
    const high = buildOperationalRoadmap(highPlan, 360);

    expect(ambitionProfile(lowPlan)).toBe("PRESIDIO");
    expect(low.ambition).toBe("PRESIDIO");
    expect(high.ambition).not.toBe("PRESIDIO");
    expect(["SFONDAMENTO", "SHOCK"]).toContain(high.ambition);

    expect(low.stages.map((stage) => stage.label)).not.toEqual(high.stages.map((stage) => stage.label));
    expect(low.stages.map((stage) => stage.focus)).not.toEqual(high.stages.map((stage) => stage.focus));

    const lowScaffold = low.stages.flatMap((stage) => stage.concreteActions.map((action) => stripNumbers(action.text)));
    const highScaffold = high.stages.flatMap((stage) => stage.concreteActions.map((action) => stripNumbers(action.text)));
    expect(lowScaffold).not.toEqual(highScaffold);

    const lowPlaces = low.stages.reduce((sum, stage) => sum + stage.placesToPresidiate.length, 0);
    const highPlaces = high.stages.reduce((sum, stage) => sum + stage.placesToPresidiate.length, 0);
    expect(lowPlaces).toBeLessThan(highPlaces);

    const theme = highPlan.themes[0]?.theme ?? "Sicurezza";
    expect(high.stages.some((stage) => stage.concreteActions.some((action) => action.lane === "Aria" && action.text.includes(theme)))).toBe(true);
    expect(JSON.stringify(high)).not.toMatch(/Energia PMI, Stop Green Deal, Casa\/Mutui/);
  });

  it("le azioni Aria usano i temi del piano, non un elenco economico fisso", () => {
    const plan = planAt(12, 360);
    const roadmap = buildOperationalRoadmap(plan, 360);
    const themes = plan.themes.slice(0, 3).map((row) => row.theme);
    const aria = roadmap.stages.flatMap((stage) => stage.concreteActions.filter((action) => action.lane === "Aria").map((action) => action.text)).join(" ");
    expect(themes.length).toBeGreaterThan(0);
    expect(themes.some((theme) => aria.includes(theme))).toBe(true);
    expect(aria).not.toContain("Stop Green Deal");
  });

  it("Anti-Jargon: nessun gergo tecnico interno e dossier tattico completo per ogni tappa", () => {
    for (const target of [8, 12, 15] as const) {
      const roadmap = buildOperationalRoadmap(planAt(target, 360), 360);
      const text = JSON.stringify(roadmap);
      expect(text.toLowerCase()).not.toMatch(/\bsolver\b/);
      expect(text.toLowerCase()).not.toMatch(/\bbundle\b/);
      expect(text.toLowerCase()).not.toMatch(/massimali mensili/);
      for (const stage of roadmap.stages) {
        expect(stage.strategicRationale.whyNow.length).toBeGreaterThan(40);
        expect(stage.strategicRationale.voterPsychologyMechanism.length).toBeGreaterThan(40);
        expect(stage.strategicRationale.structuralObjective.length).toBeGreaterThan(30);
        expect(stage.detailedMoves).toHaveLength(3);
        for (const move of stage.detailedMoves) {
          expect(move.whyItWorks.length).toBeGreaterThan(30);
          expect(move.whatToDo.length).toBeGreaterThan(40);
          expect(move.expectedFriction.length).toBeGreaterThan(20);
        }
        expect(stage.interferenceMatrix.socialDiscontentVector.length).toBeGreaterThan(30);
        expect(stage.interferenceMatrix.otherPartiesMoves.length).toBeGreaterThan(30);
        expect(stage.interferenceMatrix.eventsAndProtests.length).toBeGreaterThan(20);
        expect(stage.interferenceMatrix.internationalAndEuFactor.length).toBeGreaterThan(20);
        expect(stage.interferenceMatrix.contingencyPlaybook.length).toBeGreaterThan(20);
        for (const place of stage.placesToPresidiate) {
          expect(place.socialPainPoint?.length ?? 0).toBeGreaterThan(10);
          expect(place.tacticalActionOnSite?.length ?? 0).toBeGreaterThan(10);
        }
      }
    }
  });
});
