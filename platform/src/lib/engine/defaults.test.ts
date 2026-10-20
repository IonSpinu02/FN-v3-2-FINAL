import { describe, expect, it } from "vitest";
import {
  isOfficialParams,
  OFFICIAL_FLUSSI,
  OFFICIAL_PESI,
  OFFICIAL_S,
} from "./defaults";

describe("isOfficialParams", () => {
  it("golden ufficiale senza override", () => {
    expect(isOfficialParams(OFFICIAL_S, OFFICIAL_PESI)).toBe(true);
    expect(
      isOfficialParams(OFFICIAL_S, OFFICIAL_PESI, OFFICIAL_FLUSSI),
    ).toBe(true);
  });

  it("false se flussi_ipsos diversi", () => {
    expect(
      isOfficialParams(OFFICIAL_S, OFFICIAL_PESI, {
        FdI: 0.5,
        Lega: 0.25,
        ast: 0.25,
      }),
    ).toBe(false);
  });

  it("false se istituzioniDelta non zero", () => {
    expect(
      isOfficialParams(OFFICIAL_S, OFFICIAL_PESI, OFFICIAL_FLUSSI, {
        Lombardia: { sind: 1 },
      }),
    ).toBe(false);
  });
});
