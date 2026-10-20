import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { REGIONS } from "./constants";
import { validateFabbisogniCatalog } from "./fabbisogniCatalogValidate";
import type { FabbisogniCatalogFile } from "./osservatorioTypes";

const dataDir = path.join(process.cwd(), "data");

describe("fabbisogni_catalog.json", () => {
  const catalog = JSON.parse(
    readFileSync(path.join(dataDir, "fabbisogni_catalog.json"), "utf8"),
  ) as FabbisogniCatalogFile;

  it("contiene tutte le 20 regioni con metadati completi", () => {
    expect(validateFabbisogniCatalog(catalog)).toEqual([]);
    for (const r of REGIONS) {
      expect(catalog.regions[r]?.indicatori.length).toBeGreaterThanOrEqual(4);
    }
  });
});
