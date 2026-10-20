import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { REGIONS } from "./constants";
import { buildMonthlyScheda } from "./monthlyScheda";
import type { FabbisogniCatalogFile } from "./osservatorioTypes";
import type { ScenarioResult } from "./types";

const dataDir = path.join(process.cwd(), "data");

describe("buildMonthlyScheda", () => {
  const scenario = JSON.parse(
    readFileSync(path.join(dataDir, "risultati_v3_2.json"), "utf8"),
  ) as ScenarioResult;
  const catalog = JSON.parse(
    readFileSync(path.join(dataDir, "fabbisogni_catalog.json"), "utf8"),
  ) as FabbisogniCatalogFile;

  for (const regione of REGIONS) {
    it(`genera scheda per ${regione}`, () => {
      const scheda = buildMonthlyScheda(
        regione,
        scenario,
        catalog.regions[regione],
        [],
        "",
      );
      expect(scheda.length).toBeGreaterThanOrEqual(6);
      expect(scheda[0]!.dimensione).toContain("Modulo A");
    });
  }
});
