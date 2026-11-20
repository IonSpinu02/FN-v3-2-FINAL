import { describe, expect, it } from "vitest";
import {
  computeForecastV4,
  forecastHorizon,
  staticForecastRegions,
  type ForecastHorizonKey,
} from "@/lib/engine/forecastEngineV4";
import { formatDecimalIt } from "@/lib/formatIt";
import {
  buildPoliticalKnowledgeGraph,
  graphSummaryForPrompt,
  queryGraphNodes,
} from "@/lib/ai/politicalKnowledgeGraph";
import {
  createStrategistToolContext,
  executeStrategistTool,
} from "@/lib/ai/strategistTools";
import {
  BRIEFING_SCHEMA_VERSION,
  anthropicConfigured,
  buildDeterministicBriefing,
  buildSystemPrompt,
  isExtendedBriefingTesi,
  sanitizePublicStrategistText,
} from "@/lib/ai/strategistAgent";

describe("politicalKnowledgeGraph + strategist", () => {
  const v4Input = { regions: staticForecastRegions(6.59) };
  const v4 = computeForecastV4(v4Input);
  const graph = buildPoliticalKnowledgeGraph({ v4, v4Input, horizonKey: "d180" });

  it("builds ForecastState, 20 Region, BipMeasure, Organization, Calendar", () => {
    expect(queryGraphNodes(graph, { type: "ForecastState" }).length).toBeGreaterThan(0);
    expect(queryGraphNodes(graph, { type: "Region" }).filter((n) => n.id.startsWith("region:")).length).toBe(20);
    expect(queryGraphNodes(graph, { type: "BipMeasure" }).length).toBeGreaterThan(5);
    expect(queryGraphNodes(graph, { type: "Organization" }).length).toBe(1);
    expect(queryGraphNodes(graph, { type: "Calendar" }).length).toBe(1);
  });

  it("exposes epistemology numbers in prompt summary", () => {
    const text = graphSummaryForPrompt(graph);
    expect(text).toMatch(/TENDENZA SOLI SONDAGGI/);
    expect(text).toMatch(/SCENARIO BASE CONDIZIONATO/);
    expect(text).toMatch(/EPISTEMOLOGIA/);
    expect(text).toMatch(/ORIZZONTE ATTIVO/);
  });

  it("deterministic briefing has 4 priorities and conditional thesis", () => {
    const briefing = buildDeterministicBriefing(graph);
    expect(briefing.source).toBe("deterministic_fallback");
    expect(briefing.priorita).toHaveLength(4);
    expect(briefing.tesi).toMatch(/condizionat|ipotetic|scenari di lavoro/i);
    expect(briefing.markdown).toMatch(/Priorità strategiche/);
    expect(BRIEFING_SCHEMA_VERSION).toBe("v3_5_portaborse");
    expect(isExtendedBriefingTesi(briefing.tesi)).toBe(true);
    expect(isExtendedBriefingTesi("Orizzonte corto.")).toBe(false);
    const paragraphs = briefing.tesi.split(/\n\s*\n/).filter((p) => p.trim());
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    const words = briefing.tesi.trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(160);
    expect(words).toBeLessThanOrEqual(320);
    const p1 = briefing.priorita[0]!;
    expect(p1.azione).toMatch(/\d\.\d{3} comitati|\d{1,3}\.\d{3} comitati/);
    expect(briefing.priorita[2]!.levaBip).toMatch(/ISTITUZIONI & TERRITORIO/i);
  });

  it("system prompt enables ephemeral cache blocks", () => {
    const { system } = buildSystemPrompt(graph);
    expect(system).toHaveLength(2);
    expect(system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(system[1]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("system prompt definisce il ruolo di portaborse di Vannacci", () => {
    const text = buildSystemPrompt(graph).system[0]?.text ?? "";
    expect(text).toMatch(/portaborse virtuale di Roberto Vannacci/i);
    expect(text).toMatch(/Parla «a» lui/i);
    expect(text).not.toMatch(/Consigliere Strategico Capo/i);
  });

  it("su Maggio (180g) non invita a trattarlo come sfondo; su 30/90 sì", () => {
    const g180 = buildPoliticalKnowledgeGraph({ v4, v4Input, horizonKey: "d180" });
    const g30 = buildPoliticalKnowledgeGraph({ v4, v4Input, horizonKey: "d30" });
    const prompt180 = buildSystemPrompt(g180).system[0]?.text ?? "";
    const prompt30 = buildSystemPrompt(g30).system[0]?.text ?? "";
    expect(prompt180).toMatch(/già Maggio 2027/i);
    expect(prompt180).not.toMatch(/è solo traguardo di sfondo/i);
    expect(prompt30).toMatch(/solo traguardo di sfondo/i);
    expect(prompt180).toMatch(/LINGUAGGIO PUBBLICO/i);
    expect(buildDeterministicBriefing(g180).tesi).not.toMatch(
      /Base di sfondo|solo come sfondo|è solo sfondo/i,
    );
    expect(buildDeterministicBriefing(g30).tesi).toMatch(/Base di sfondo|sfondo/i);
  });

  it("sanitizePublicStrategistText rimuove sigle interne", () => {
    expect(
      sanitizePublicStrategistText(
        "Su d180 le emergenze del grafo restano aperte contro flat.",
      ),
    ).toBe(
      "Su a Maggio le emergenze territoriali rilevate restano aperte contro l'ipotesi di consenso fermo.",
    );
    expect(sanitizePublicStrategistText("orizzonte d30 e d90")).toBe(
      "orizzonte a 30 giorni e a 90 giorni",
    );
  });

  it("tools e auto-cache espongono breakpoint Anthropic (tools@1h + auto@5m)", async () => {
    const { STRATEGIST_TOOLS } = await import("@/lib/ai/strategistTools");
    const { STRATEGIST_AUTO_CACHE } = await import("@/lib/ai/strategistAgent");
    const last = STRATEGIST_TOOLS[STRATEGIST_TOOLS.length - 1] as {
      cache_control?: { type: string; ttl?: string };
    };
    expect(last.cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    expect(STRATEGIST_AUTO_CACHE).toEqual({ type: "ephemeral" });
    // Budget: 1 tools + 2 system + 1 auto = 4 (limite API).
    const { system } = buildSystemPrompt(graph);
    const explicit =
      (last.cache_control ? 1 : 0) +
      system.filter((b) => b.cache_control).length;
    expect(explicit).toBeLessThanOrEqual(3);
  });

  it("simulate_what_if_scenario returns V4 numbers without inventing", () => {
    const ctx = createStrategistToolContext({ v4, v4Input, horizonKey: "d180" });
    const { result } = executeStrategistTool(
      "simulate_what_if_scenario",
      { scenario: "base", horizon: "d180", deltaComitati: 100 },
      ctx,
    );
    const row = result as { centralPct: number; nota: string };
    expect(Number.isFinite(row.centralPct)).toBe(true);
    expect(row.nota).toMatch(/condizionata/i);
  });

  it("simulate_what_if_scenario tollera v4Input serializzato (Date → string)", () => {
    const liveInput = {
      asOf: new Date("2026-11-06T12:00:00Z"),
      regions: staticForecastRegions(6.59),
      networkDelta: { comitati: 0, tesserati: 0 },
    };
    const serializedInput = JSON.parse(JSON.stringify(liveInput)) as typeof liveInput;
    expect(typeof serializedInput.asOf).toBe("string");
    const liveV4 = computeForecastV4(liveInput);
    const ctx = createStrategistToolContext({
      v4: liveV4,
      v4Input: serializedInput,
      horizonKey: "d180",
    });
    const { result } = executeStrategistTool(
      "simulate_what_if_scenario",
      { scenario: "offensiva", horizon: "d90", deltaComitati: 50, deltaTesserati: 5_000 },
      ctx,
    );
    const row = result as { centralPct: number; deltaPp: number; error?: string };
    expect(row.error).toBeUndefined();
    expect(Number.isFinite(row.centralPct)).toBe(true);
    expect(Number.isFinite(row.deltaPp)).toBe(true);
  });

  it("get_region_deep_dive resolves Veneto", () => {
    const ctx = createStrategistToolContext({ v4, v4Input });
    const { result } = executeStrategistTool(
      "get_region_deep_dive",
      { region: "Veneto" },
      ctx,
    );
    const row = result as { regione: string; affinitaBacino: number };
    expect(row.regione).toBe("Veneto");
    expect(row.affinitaBacino).toBeGreaterThan(0);
  });

  it("anthropicConfigured is boolean (no crash without key)", () => {
    expect(typeof anthropicConfigured()).toBe("boolean");
  });

  it("briefing tesi/priorità cambiano con horizonDays 30/90/180", () => {
    const keys: ForecastHorizonKey[] = ["d30", "d90", "d180"];
    const briefings = keys.map((horizonKey) => {
      const g = buildPoliticalKnowledgeGraph({ v4, v4Input, horizonKey });
      const briefing = buildDeterministicBriefing(g);
      const base = forecastHorizon(v4, "base", horizonKey);
      const off = forecastHorizon(v4, "offensiva", horizonKey);
      const pass = forecastHorizon(v4, "passivo", horizonKey);
      const basePct = formatDecimalIt(base.centralPct, 2);
      const offPct = formatDecimalIt(off.centralPct, 2);
      const passPct = formatDecimalIt(pass.centralPct, 2);
      expect(g.summary.horizonDays).toBe(
        horizonKey === "d30" ? 30 : horizonKey === "d90" ? 90 : 180,
      );
      expect(briefing.inputSummary.horizonDays).toBe(g.summary.horizonDays);
      expect(briefing.tesi).toContain(`${basePct}%`);
      expect(briefing.tesi).toContain(`${offPct}%`);
      expect(briefing.tesi).toContain(`${passPct}%`);
      expect(briefing.tesi).toMatch(
        horizonKey === "d30"
          ? /30 giorni|Manovra/i
          : horizonKey === "d90"
            ? /90 giorni|febbraio|consolidamento/i
            : /Maggio|180 giorni|mobilitazione/i,
      );
      return briefing;
    });

    expect(briefings[0]!.tesi).not.toBe(briefings[1]!.tesi);
    expect(briefings[1]!.tesi).not.toBe(briefings[2]!.tesi);
    expect(briefings[0]!.tesi).not.toBe(briefings[2]!.tesi);

    const p30 = briefings[0]!.priorita.map((p) => p.azione).join("|");
    const p90 = briefings[1]!.priorita.map((p) => p.azione).join("|");
    const p180 = briefings[2]!.priorita.map((p) => p.azione).join("|");
    expect(p30).not.toBe(p90);
    expect(p90).not.toBe(p180);
    expect(p30).not.toBe(p180);
    expect(p30).toMatch(/Manovra|Bilancio/i);
    expect(p90).toMatch(/post-Manovra|sedi|eletti|Sanità/i);
    expect(p180).toMatch(/mobilitazione|porta-a-porta|astenuti|aspettative/i);
  });
});
