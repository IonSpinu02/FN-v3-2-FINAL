import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/engine/constants";
import {
  buildTargetedTrendsForTerritory,
  defaultSelectedTrendId,
  filterTrendsByCluster,
  targetedTrendToGoogleTrendsSeries,
  TRENDS_TOPIC_CLUSTERS,
} from "@/lib/googleTrendsIntelligence";
import { REGIONAL_GOOGLE_TRENDS_CATALOG } from "@/lib/googleTrendsRegionalCatalog";

describe("googleTrendsIntelligence", () => {
  it("espone catalogo flagship legacy per compatibilità", () => {
    expect(TRENDS_TOPIC_CLUSTERS.length).toBeGreaterThan(0);
  });

  it("ogni regione ha query exactQuery distinte (6 trend)", () => {
    for (const r of REGIONS) {
      const seeds = REGIONAL_GOOGLE_TRENDS_CATALOG[r];
      expect(seeds.length).toBe(6);
      const queries = seeds.map((s) => s.exactQuery);
      expect(new Set(queries).size).toBe(6);
    }
  });

  it("Lombardia e Lazio non condividono le stesse exactQuery", () => {
    const lomb = buildTargetedTrendsForTerritory("Lombardia").map((t) => t.exactQuery);
    const lazio = buildTargetedTrendsForTerritory("Lazio").map((t) => t.exactQuery);
    expect(lomb).not.toEqual(lazio);
    expect(lomb[0]).toContain("Trenord");
    expect(lazio[0]).toContain("Roma");
  });

  it("genera serie 30d e indici 0-100 per ogni regione", () => {
    for (const r of REGIONS.slice(0, 5)) {
      const items = buildTargetedTrendsForTerritory(r);
      expect(items.length).toBe(6);
      for (const item of items) {
        expect(item.series30d).toHaveLength(30);
        expect(item.currentIndex0100).toBeGreaterThanOrEqual(0);
        expect(item.currentIndex0100).toBeLessThanOrEqual(100);
        expect(item.relatedQueries).toHaveLength(3);
        expect(item.pianoRisoluzione.soluzionePratica.length).toBeGreaterThan(20);
        expect(item.datoOggettivoModuloB).not.toMatch(/focus territoriale/i);
      }
    }
  });

  it("filtra impennate e converte in GoogleTrendsSeries per finestra", () => {
    const items = buildTargetedTrendsForTerritory("Lazio");
    const surges = filterTrendsByCluster(items, "SURGE_ALL");
    expect(surges.length).toBeGreaterThan(0);
    const pick = surges[0]!;
    const series = targetedTrendToGoogleTrendsSeries(pick, "Lazio", 14);
    expect(series.points.length).toBe(14);
    expect(series.query).toBe(pick.exactQuery);
  });

  it("seleziona default trend", () => {
    const items = buildTargetedTrendsForTerritory("NAZIONALE");
    const id = defaultSelectedTrendId(items);
    expect(id).toBeTruthy();
  });
});
