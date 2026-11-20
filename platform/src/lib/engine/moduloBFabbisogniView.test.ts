import { describe, expect, it } from "vitest";
import { buildModuloBViewModel } from "./moduloBFabbisogniView";

describe("moduloBFabbisogniView", () => {
  it("builds 5 objective dimensions for regional mode", () => {
    const m = buildModuloBViewModel({
      mode: "regionale",
      region: "Campania",
      province: "Napoli",
      period: "2024_vs_2023",
      fabbisogni: null,
    });
    expect(m.objectives).toHaveLength(5);
    expect(m.objectives[0]?.title).toMatch(/Accesso alle cure/);
    expect(m.objectives[4]?.title).toMatch(/Ambiente/);
  });

  it("national mode has no survey by default", () => {
    const m = buildModuloBViewModel({
      mode: "nazionale",
      region: "Lazio",
      province: "Tutte le province del Lazio",
      period: "2024_vs_2023",
      fabbisogni: null,
    });
    expect(m.region).toBeNull();
    expect(m.experience.hasSurvey).toBe(false);
  });
});
