import { describe, expect, it } from "vitest";
import { basinTotalsForDisplay } from "@/components/obiettivo/goalCharts";
import type { StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";

function stubResult(basins: StrategicBackcastResult["regions"][0]["basins"]): StrategicBackcastResult {
  return {
    regions: [{ basins } as StrategicBackcastResult["regions"][0]],
  } as StrategicBackcastResult;
}

describe("basinTotalsForDisplay", () => {
  it("scala i quattro bacini sul totale Oggi→Target", () => {
    const result = stubResult({
      delusi_coalizione: 100,
      astensione_recuperabile: 50,
      voto_tematico_ponte: 150,
      radicamento_civico_eletti: 200,
    });
    const scaled = basinTotalsForDisplay(result, 884_000);
    const sum = Object.values(scaled).reduce((acc, value) => acc + value, 0);
    expect(sum).toBe(884_000);
  });
});
