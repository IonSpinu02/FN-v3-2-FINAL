import { describe, expect, it } from "vitest";
import { loadJson } from "./loadData";
import { computeIstituzioniDelta, aggregateFnPresences } from "./localInstitutions";
import type { FnConfig } from "./types";
import type { LocalRegistryEntry } from "./localiTypes";

describe("localInstitutions", () => {
  const cfg = loadJson<FnConfig>("config_v3_2.json");

  it("aggregateFnPresences conta solo partito_fn", () => {
    const entries: LocalRegistryEntry[] = [
      {
        id: "1",
        comune: "A",
        regione: "Lazio",
        carica: "com",
        partito_fn: true,
      },
      {
        id: "2",
        comune: "B",
        regione: "Lazio",
        carica: "com",
        partito_fn: false,
      },
    ];
    const agg = aggregateFnPresences(entries);
    expect(agg.Lazio.com).toBe(1);
  });

  it("registry allineato al config (conteggi regionali) → delta vuoto", () => {
    const entries: LocalRegistryEntry[] = [];
    let i = 0;
    for (const [carica, map] of Object.entries(cfg.presenze_istituzionali)) {
      for (const [regione, n] of Object.entries(map ?? {})) {
        for (let k = 0; k < (n as number); k++) {
          entries.push({
            id: `sync-${i++}`,
            comune: `Comune ${i}`,
            regione: regione as LocalRegistryEntry["regione"],
            carica: carica as LocalRegistryEntry["carica"],
            partito_fn: true,
          });
        }
      }
    }
    const { istituzioniDelta, summary } = computeIstituzioniDelta(cfg, entries);
    expect(summary.hasChanges).toBe(false);
    expect(istituzioniDelta).toBeUndefined();
  });

  it("ingresso FN extra in Lombardia → delta positivo com", () => {
    const base: LocalRegistryEntry[] = [];
    let i = 0;
    for (const [carica, map] of Object.entries(cfg.presenze_istituzionali)) {
      for (const [regione, n] of Object.entries(map ?? {})) {
        for (let k = 0; k < (n as number); k++) {
          base.push({
            id: `b-${i++}`,
            comune: `C${i}`,
            regione: regione as LocalRegistryEntry["regione"],
            carica: carica as LocalRegistryEntry["carica"],
            partito_fn: true,
          });
        }
      }
    }
    base.push({
      id: "extra-lom-com",
      comune: "Nuovo Comune FN",
      regione: "Lombardia",
      carica: "com",
      partito_fn: true,
    });
    const { istituzioniDelta, summary } = computeIstituzioniDelta(cfg, base);
    expect(summary.hasChanges).toBe(true);
    expect(istituzioniDelta?.Lombardia?.com).toBe(1);
  });
});
