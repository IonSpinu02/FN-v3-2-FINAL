import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/engine/constants";
import { FORECAST_V4_MODEL_ID, type ForecastHorizonResult, type ForecastScenarioId, type ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, macroAreaOf, type BackcastRegionInput } from "@/lib/engine/strategicBackcastEngine";
import { generateStrategicRoadmap } from "@/lib/ai/strategicRoadmapAiGenerator";
import { containsCredibilityBanned } from "@/lib/ai/strategicRoadmapSanitizer";

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
  return {
    modelId: FORECAST_V4_MODEL_ID,
    asOf: "2026-11-11",
    startPct: 6.62,
    startSource: "input",
    diagnostics: {} as ForecastV4Result["diagnostics"],
    scenarios: { passivo: make("passivo", 6.8), base: make("base", 7.1), offensiva: make("offensiva", 7.52) },
    base: make("base", 7.1),
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

const backcast = computeStrategicBackcast({
  forecast: model(),
  targetPct: 12,
  horizonDays: 360,
  regions: regions(),
  currentMembers: 156_456,
  currentCommittees: 1_800,
  totalValidVoters: 23_257_062,
  seed: 8,
});

describe("generateStrategicRoadmap", () => {
  it("usa il fallback deterministico senza API key e conserva i voti del backcast", async () => {
    const prev = {
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    };
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await generateStrategicRoadmap({ targetPct: 12, horizonDays: 360, backcast });
      expect(result.provider).toBe("none");
      expect(result.roadmap.generatedBy).toBe("DETERMINISTIC_ENGINE");
      expect(result.usedCombinatorialFallback).toBe(true);
      expect(result.roadmap.stages[3]!.cumulativeVotesTarget).toBeGreaterThan(0);
      const lastVotes = result.roadmap.stages.reduce((sum, stage) => sum + stage.stageVotesDelta, 0);
      expect(lastVotes).toBe(result.roadmap.stages[3]!.cumulativeVotesTarget);
      expect(containsCredibilityBanned(JSON.stringify(result.roadmap))).toBe(false);
    } finally {
      if (prev.openai) process.env.OPENAI_API_KEY = prev.openai;
      if (prev.gemini) process.env.GEMINI_API_KEY = prev.gemini;
      if (prev.anthropic) process.env.ANTHROPIC_API_KEY = prev.anthropic;
    }
  });

  it("fonde la narrativa AI mock mantenendo i numeri dello scheletro", async () => {
    const prev = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    };
    // Mock via OpenAI fetch: Anthropic usa l'SDK e non è iniettabile con fetchImpl.
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const skeletonVotes = (
      await generateStrategicRoadmap({
        targetPct: 12,
        horizonDays: 360,
        backcast,
        fetchImpl: (async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
            status: 500,
          })) as typeof fetch,
      })
    ).roadmap.stages.map((stage) => stage.cumulativeVotesTarget);

    const aiPayload = {
      executiveThesis: "Tesi AI di prova per convertire notorietà in struttura. IPOTESI.",
      keyBottleneckResolution: "Il collo di bottiglia è la rete dei rappresentanti di lista. IPOTESI.",
      stages: [1, 2, 3, 4].map((stageId) => ({
        stageId,
        label: `Tappa AI ${stageId}`,
        focus: `Focus operativo distinto della tappa ${stageId} sui fronti prioritari.`,
        strategicRationale: {
          whyNow: `Perche ora nella tappa ${stageId}: finestra temporale critica per fissare il messaggio.`,
          voterPsychologyMechanism: `Meccanismo di conversione tappa ${stageId}: dalla simpatia passiva alla scheda tramite presenza locale.`,
          structuralObjective: `Collo di bottiglia tappa ${stageId}: trasformare audience in comitati e amministratori.`,
        },
        places: [
          {
            region: "Lombardia",
            place: "Milano Porta Garibaldi",
            kind: "Stazione e sicurezza",
            rationale: "Nodo ad alta densità di passaggio e sicurezza urbana.",
            socialPainPoint: "Pressione sicurezza urbana sul nodo di transito.",
            tacticalActionOnSite: "Sopralluogo e punto stampa con commercianti.",
          },
          {
            region: "Veneto",
            place: "Padova stazione",
            kind: "Stazione e sicurezza",
            rationale: "Presidio di ingresso sulla dorsale nord-est.",
            socialPainPoint: "Ordine pubblico e pendolarismo.",
            tacticalActionOnSite: "Briefing locale e gazebo fisso.",
          },
        ],
        detailedMoves: [
          {
            lane: "Aria",
            headline: `Dossier aria tappa ${stageId}`,
            whatToDo: `Azione aria distinta per la tappa ${stageId} sul tema sicurezza con dossier documentato.`,
            whyItWorks: `Perche sposta voti nella tappa ${stageId}: collega il disagio percepito a una proposta concreta.`,
            expectedFriction: `Attrito mediatico tappa ${stageId}: rispondere con dati locali e tono istituzionale.`,
          },
          {
            lane: "Terra",
            headline: `Presidi terra tappa ${stageId}`,
            whatToDo: `Azione terra distinta per la tappa ${stageId} con comitati mirati e tavoli di categoria.`,
            whyItWorks: `La prossimita riduce l'ansia del voto fuori dal voto utile nella tappa ${stageId}.`,
            expectedFriction: `Carenza di quadri: reclutare delegati dai tavoli entro tre settimane.`,
          },
          {
            lane: "Istituzioni",
            headline: `Patti civici tappa ${stageId}`,
            whatToDo: `Azione istituzioni distinta per la tappa ${stageId} con liste civiche e amministratori.`,
            whyItWorks: `Il garante locale legittima la scheda nella tappa ${stageId}.`,
            expectedFriction: `Pressione coalizionale sugli amministratori: patti su dossier concreti.`,
          },
        ],
        interferenceMatrix: {
          socialDiscontentVector: `Disagio sociale prioritario nella tappa ${stageId} da presidiare con dati territoriali.`,
          otherPartiesMoves: `Contromossa tappa ${stageId}: anticipare il framing del voto inutile con presenza e numeri.`,
          eventsAndProtests: `Posizionamento su eventi e piazze rilevanti nella tappa ${stageId}.`,
          internationalAndEuFactor: `Tradurre variabili UE/energia in proposta nazionale nella tappa ${stageId}.`,
          contingencyPlaybook: `Piano B tappa ${stageId}: dossier lampo e tre uscite locali entro 48 ore.`,
        },
      })),
    };

    try {
      const result = await generateStrategicRoadmap({
        targetPct: 12,
        horizonDays: 360,
        backcast,
        fetchImpl: (async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiPayload) } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch,
      });
      expect(result.provider).toBe("openai");
      expect(result.roadmap.generatedBy).toBe("AI_MODEL");
      expect(result.roadmap.executiveThesis).toMatch(/Tesi AI/);
      expect(result.roadmap.stages[0]!.label).toBe("Tappa AI 1");
      expect(result.roadmap.stages.map((stage) => stage.cumulativeVotesTarget)).toEqual(skeletonVotes);
      expect(containsCredibilityBanned(JSON.stringify(result.roadmap))).toBe(false);
    } finally {
      if (prev.anthropic) process.env.ANTHROPIC_API_KEY = prev.anthropic;
      else delete process.env.ANTHROPIC_API_KEY;
      if (prev.openai) process.env.OPENAI_API_KEY = prev.openai;
      else delete process.env.OPENAI_API_KEY;
      if (prev.gemini) process.env.GEMINI_API_KEY = prev.gemini;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it("ripara un JSON AI con virgola mancante tra elementi dell'array", async () => {
    const prev = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const broken = `{
      "executiveThesis": "Tesi riparata dal parser nonostante la virgola mancante. IPOTESI.",
      "keyBottleneckResolution": "Il collo di bottiglia resta la rete territoriale. IPOTESI.",
      "stages": [
        { "stageId": 1, "label": "Tappa riparata 1", "focus": "Focus operativo distinto dopo la riparazione del JSON." }
        { "stageId": 2, "label": "Tappa riparata 2", "focus": "Seconda tappa comunque leggibile dopo la virgola inserita." }
      ]
    }`;
    try {
      const result = await generateStrategicRoadmap({
        targetPct: 12,
        horizonDays: 360,
        backcast,
        fetchImpl: (async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: broken } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch,
      });
      expect(result.provider).toBe("openai");
      expect(result.usedCombinatorialFallback).toBeFalsy();
      expect(result.roadmap.generatedBy).toBe("AI_MODEL");
      expect(result.roadmap.executiveThesis).toMatch(/Tesi riparata/);
      expect(result.roadmap.stages[0]!.label).toBe("Tappa riparata 1");
      expect(result.roadmap.stages).toHaveLength(4);
    } finally {
      if (prev.anthropic) process.env.ANTHROPIC_API_KEY = prev.anthropic;
      else delete process.env.ANTHROPIC_API_KEY;
      if (prev.openai) process.env.OPENAI_API_KEY = prev.openai;
      else delete process.env.OPENAI_API_KEY;
      if (prev.gemini) process.env.GEMINI_API_KEY = prev.gemini;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it("ripara un array chiuso con la graffa e una virgoletta interna", async () => {
    const prev = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const broken = `{
      "executiveThesis": "Tesi con citazione "voto utile" ancora valida. IPOTESI.",
      "keyBottleneckResolution": "Il collo di bottiglia resta la presenza territoriale. IPOTESI.",
      "stages": [
        { "stageId": 1, "label": "Tappa graffa", "focus": "Focus operativo dopo la chiusura corretta dell'array." }
      }
    }`;
    const closedWrong = broken.replace("]\n    }", "}");
    try {
      const result = await generateStrategicRoadmap({
        targetPct: 12,
        horizonDays: 360,
        backcast,
        fetchImpl: (async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: closedWrong } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch,
      });
      expect(result.usedCombinatorialFallback).toBeFalsy();
      expect(result.roadmap.generatedBy).toBe("AI_MODEL");
      expect(result.roadmap.executiveThesis).toMatch(/voto utile/);
      expect(result.roadmap.stages[0]!.label).toBe("Tappa graffa");
    } finally {
      if (prev.anthropic) process.env.ANTHROPIC_API_KEY = prev.anthropic;
      else delete process.env.ANTHROPIC_API_KEY;
      if (prev.openai) process.env.OPENAI_API_KEY = prev.openai;
      else delete process.env.OPENAI_API_KEY;
      if (prev.gemini) process.env.GEMINI_API_KEY = prev.gemini;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it("ripara chiavi senza virgolette e un JSON troncato", async () => {
    const prev = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const broken = `{
      executiveThesis: "Tesi con chiave nuda riparata dal parser prima del fallback. IPOTESI.",
      keyBottleneckResolution: "Il collo di bottiglia resta la rete. IPOTESI.",
      stages: [
        { stageId: 1, label: "Tappa chiave nuda", focus: "Focus operativo dopo la riparazione delle chiavi." }
      ]
    `;
    try {
      const result = await generateStrategicRoadmap({
        targetPct: 12,
        horizonDays: 360,
        backcast,
        fetchImpl: (async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: broken } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch,
      });
      expect(result.usedCombinatorialFallback).toBeFalsy();
      expect(result.roadmap.generatedBy).toBe("AI_MODEL");
      expect(result.roadmap.executiveThesis).toMatch(/chiave nuda/);
      expect(result.roadmap.stages[0]!.label).toBe("Tappa chiave nuda");
    } finally {
      if (prev.anthropic) process.env.ANTHROPIC_API_KEY = prev.anthropic;
      else delete process.env.ANTHROPIC_API_KEY;
      if (prev.openai) process.env.OPENAI_API_KEY = prev.openai;
      else delete process.env.OPENAI_API_KEY;
      if (prev.gemini) process.env.GEMINI_API_KEY = prev.gemini;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it("ripara chiavi con apici singoli e identificatori non quotati in profondità", async () => {
    const prev = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const padding = '{"k":"v"},'.repeat(500);
    const broken = `{
      'executiveThesis': "Tesi con chiavi in apici e padding lungo. IPOTESI.",
      'keyBottleneckResolution': "Collo di bottiglia rete. IPOTESI.",
      'metaPadding': [${padding.slice(0, -1)}],
      'stages': [
        { 'stageId': 1, 'label': "Tappa apici", 'focus': "Focus dopo riparazione chiavi in apici." }
      ]
    }`;
    try {
      const result = await generateStrategicRoadmap({
        targetPct: 12,
        horizonDays: 360,
        backcast,
        fetchImpl: (async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: broken } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })) as typeof fetch,
      });
      expect(result.usedCombinatorialFallback).toBeFalsy();
      expect(result.roadmap.generatedBy).toBe("AI_MODEL");
      expect(result.roadmap.executiveThesis).toMatch(/apici/);
      expect(result.roadmap.stages[0]!.label).toBe("Tappa apici");
    } finally {
      if (prev.anthropic) process.env.ANTHROPIC_API_KEY = prev.anthropic;
      else delete process.env.ANTHROPIC_API_KEY;
      if (prev.openai) process.env.OPENAI_API_KEY = prev.openai;
      else delete process.env.OPENAI_API_KEY;
      if (prev.gemini) process.env.GEMINI_API_KEY = prev.gemini;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it("usa Claude Sonnet 5.5 come modello Anthropic di default", async () => {
    const { roadmapAnthropicModel } = await import("@/lib/ai/strategicRoadmapAiGenerator");
    const prev = process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_MODEL;
    expect(roadmapAnthropicModel()).toBe("claude-sonnet-5-5");
    if (prev) process.env.ANTHROPIC_MODEL = prev;
  });
});
