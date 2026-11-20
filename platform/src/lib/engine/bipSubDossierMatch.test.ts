import { describe, expect, it } from "vitest";
import { matchExactBipSubDossier } from "./bipSubDossierMatch";

describe("matchExactBipSubDossier · SICUREZZA", () => {
  it("distigue legittima difesa da carceri e baby gang", () => {
    const legittima = matchExactBipSubDossier(
      "Sparato al ladro durante rapina in villa",
      "Indagato per eccesso di legittima difesa",
      "SICUREZZA",
    );
    const carceri = matchExactBipSubDossier(
      "Rivolta in carcere di San Vittore",
      "Sovraffollamento e detenuti stranieri",
      "SICUREZZA",
    );
    const babyGang = matchExactBipSubDossier(
      "Baby gang in periferia",
      "Minorenni di 14 anni rapinano commercianti",
      "SICUREZZA",
    );

    expect(legittima.id).toBe("BIP_SEC_01");
    expect(carceri.id).toBe("BIP_SEC_04");
    expect(babyGang.id).toBe("BIP_SEC_03");
    expect(legittima.pressDeclaration).not.toBe(carceri.pressDeclaration);
    expect(legittima.provvedimentoAtto).not.toBe(babyGang.provvedimentoAtto);
  });

  it("non usa sempre il fallback stazioni per temi specifici", () => {
    const spaccio = matchExactBipSubDossier(
      "Piazza di spaccio sotto scuola",
      "Arrestato pusher per cocaina",
      "SICUREZZA",
    );
    expect(spaccio.id).toBe("BIP_SEC_05");
    expect(spaccio.bipReference).toMatch(/Cap\. 7/);
  });
});

describe("matchExactBipSubDossier · altre macro-categorie", () => {
  it("AGRICOLTURA: fauna vs fotovoltaico", () => {
    const fauna = matchExactBipSubDossier(
      "Cinghiali devastano colture",
      "Danni in campagna",
      "TERRITORIO",
    );
    const fv = matchExactBipSubDossier(
      "Fotovoltaico a terra su suolo agricolo",
      "Pannelli solari in campagna",
      "TERRITORIO",
    );
    expect(fauna.id).toMatch(/BIP_AGR/);
    expect(fv.id).toMatch(/BIP_AGR/);
    expect(fauna.id).not.toBe(fv.id);
  });

  it("sfratto anziani/donne → emergenza abitativa, non sgombero penale", () => {
    const d = matchExactBipSubDossier(
      "Anziani e donne sotto sgombero a Napoli, non ributtateci in strada",
      "Appello all'ordine religioso proprietario dell'immobile",
      "SICUREZZA",
    );
    expect(d.id).toBe("BIP_FAM_07");
    expect(d.pressDeclaration.toLowerCase()).not.toMatch(/imputabilit|centri sociali/);
  });
});
