import { describe, expect, it } from "vitest";
import {
  extractGroupChanges,
  isTrueCameraGroupChange,
} from "@/lib/politicalDefectionsCameraSparql";
import { INITIAL_TRACKED_POLITICIANS } from "@/lib/politicalDefectionsCatalog";
import {
  isDefectionNewsRelevant,
  isForeignEnglishDefectionNoise,
} from "@/lib/politicalDefectionsEngine";
import { buildPoliticianDossierAnalytics } from "@/lib/politicalDefectionsDossier";

describe("SPARQL cambi gruppo — regola Francesco Gallo", () => {
  it("non classifica come cambio chi ha un solo gruppo da inizio legislatura", () => {
    const rows = extractGroupChanges([
      {
        deputato: { value: "http://dati.camera.it/ocd/deputato.rdf/gallo" },
        label: { value: "GALLO Francesco" },
        gr: { value: "Misto (Sud chiama Nord)" },
        start: { value: "20221013" },
        end: { value: "99991231" },
      },
      // Duplicato stessa adesione / componente — ancora un solo gruppo normalizzato
      {
        deputato: { value: "http://dati.camera.it/ocd/deputato.rdf/gallo" },
        label: { value: "GALLO Francesco" },
        gr: { value: "Misto" },
        start: { value: "20221013" },
        end: { value: "99991231" },
      },
    ]);
    expect(rows).toHaveLength(0);
    expect(INITIAL_TRACKED_POLITICIANS.some((p) => /gallo/i.test(p.nome))).toBe(false);
  });

  it("riconosce successione reale tra due gruppi distinti", () => {
    const rows = extractGroupChanges([
      {
        deputato: { value: "http://dati.camera.it/ocd/deputato.rdf/x" },
        label: { value: "MESSINA Manlio" },
        gr: { value: "Fratelli d'Italia" },
        start: { value: "20221013" },
        end: { value: "20261011" },
      },
      {
        deputato: { value: "http://dati.camera.it/ocd/deputato.rdf/x" },
        label: { value: "MESSINA Manlio" },
        gr: { value: "Misto" },
        start: { value: "20261012" },
        end: { value: "99991231" },
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(isTrueCameraGroupChange(rows[0]!)).toBe(true);
    expect(rows[0]!.gruppoDaLabel).toBe("Fratelli d'Italia");
    expect(rows[0]!.gruppoALabel).toBe("Gruppo Misto");
  });
});

describe("Fonti obbligatorie su ogni cambio partito", () => {
  it("ogni profilo ha fonteIstituzionale.url e fonteStampa.url", () => {
    expect(INITIAL_TRACKED_POLITICIANS.length).toBeGreaterThan(0);
    for (const p of INITIAL_TRACKED_POLITICIANS) {
      expect(p.fonteIstituzionale?.url?.startsWith("http")).toBe(true);
      expect(p.fonteStampa?.url?.startsWith("http")).toBe(true);
      expect(p.collegioDisplay).not.toMatch(/collegio da verificare/i);
      expect(p.doteElettorale.votiPortatiStimati).toBeGreaterThan(0);
      expect(p.slug).toBeTruthy();
    }
  });

  it("non ripete voti placeholder identici su più righe", () => {
    const voti = INITIAL_TRACKED_POLITICIANS.map(
      (p) => p.beneficioIngressoFn?.votiPortatiStimati ?? p.doteElettorale.votiPortatiStimati,
    );
    expect(new Set(voti).size).toBe(voti.length);
  });
});

describe("Filtro notizie zero-spazzatura", () => {
  it("scarta articoli in inglese / host esteri", () => {
    expect(
      isForeignEnglishDefectionNoise(
        "Giorgia Meloni's new electoral law would reshape Italian politics",
        "NBC News analysis",
        "https://www.nbcnews.com/politics/meloni-electoral-law",
      ),
    ).toBe(true);
    expect(
      isDefectionNewsRelevant(
        "Giorgia Meloni's new electoral law would reshape Italian politics",
        "Among the dead after the collision",
        "https://www.nbcnews.com/world",
      ),
    ).toBe(false);
  });

  it("accetta solo pattern esplicito di cambio + partito monitorato", () => {
    expect(
      isDefectionNewsRelevant(
        "Il deputato lascia Fratelli d'Italia e passa al Gruppo Misto",
        "Cambio di casacca ufficiale alla Camera",
        "https://www.ansa.it/sito/notizie/politica/articolo.html",
      ),
    ).toBe(true);
    expect(
      isDefectionNewsRelevant(
        "Il governo Meloni discute la legge elettorale in Consiglio",
        "Riunione a Palazzo Chigi su temi istituzionali",
        "https://www.corriere.it/politica/",
      ),
    ).toBe(false);
  });
});

describe("Dossier analitico", () => {
  it("calcola 3 scenari e affinità 0–100", () => {
    const p = INITIAL_TRACKED_POLITICIANS[0]!;
    const d = buildPoliticianDossierAnalytics(p);
    expect(d.scenari).toHaveLength(3);
    expect(d.scenari[0]!.voti).toBeLessThanOrEqual(d.scenari[1]!.voti);
    expect(d.scenari[1]!.voti).toBeLessThanOrEqual(d.scenari[2]!.voti);
    expect(d.affinita.score0100).toBeGreaterThanOrEqual(0);
    expect(d.affinita.score0100).toBeLessThanOrEqual(100);
    expect(d.pilastroMr.puntiPesoMr).toBeGreaterThan(0);
  });
});
