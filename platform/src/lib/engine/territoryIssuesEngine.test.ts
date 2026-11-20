import { describe, expect, it } from "vitest";
import {
  canEmbedIssueArticleUrl,
  classifyBipAlignedIssue,
  classifyIssueCategory,
  isSportOrOffTopicBlocked,
  normalizeTerritoryQueryRegion,
  dedupeIssues,
  storyDedupeKey,
  unionTerritoryIssueFeeds,
} from "./territoryIssuesEngine";
import type { TerritoryIssue } from "./territoryIssuesTypes";
import {
  catalogIssuesForRegion,
  electoralThemesForRegion,
  structuralPillarIssuesForRegion,
} from "./territoryIssuesCatalog";
import { REGIONAL_ELECTORAL_CATS } from "./territoryIssuesTypes";
import { officialModuloBLine } from "./territoryIssueContext";

describe("territoryIssuesEngine", () => {
  it("normalizes region query", () => {
    expect(normalTerritoryQueryRegion("lazio")).toBe("Lazio");
    expect(normalTerritoryQueryRegion("NAZIONALE")).toBe("NAZIONALE");
    expect(normalTerritoryQueryRegion(null)).toBe("NAZIONALE");
  });

  it("classifies sanita headlines only when B.I.P.-aligned", () => {
    expect(
      classifyIssueCategory(
        "Code al Pronto Soccorso: cittadini in protesta",
        "liste d'attesa chirurgia CUP visite specialistiche",
      ),
    ).toBe("SANITA");
    expect(
      classifyIssueCategory("Congresso PD: candidatura alla segreteria", "raccolta firme"),
    ).toBeNull();
  });

  it("blocks Google News URLs from iframe embed", () => {
    expect(
      canEmbedIssueArticleUrl(
        "https://news.google.com/rss/articles/CBMiabc123?oc=5&hl=it&gl=IT&ceid=IT:it",
      ),
    ).toBe(false);
    expect(canEmbedIssueArticleUrl("https://www.corriere.it/esempio")).toBe(true);
  });

  it("classifies caro gasolio agricolo as TERRITORIO when B.I.P. agricoltura match", () => {
    expect(
      classifyIssueCategory(
        "Prezzo latte sotto costi produzione: appello Coldiretti",
        "vendita sottocosto campi e raccolto",
        { relaxed: true },
      ),
    ).toBe("TERRITORIO");
  });

  it("catalog returns 6 macro-temi per region", () => {
    const lazio = catalogIssuesForRegion("Lazio");
    expect(lazio).toHaveLength(6);
    expect(lazio.map((i) => i.categoria).sort()).toEqual(
      [...REGIONAL_ELECTORAL_CATS].sort(),
    );
    expect(lazio.every((i) => i.azionePoliticaConsigliata.doveAndare.length > 10)).toBe(
      true,
    );
  });

  it("blocca congressi di partito e cronaca mondana", () => {
    expect(
      isSportOrOffTopicBlocked(
        "Garavaglia raggiunge le firme per la candidatura al congresso della Lega",
        "raccolta firme",
      ),
    ).toBe(true);
    expect(
      isSportOrOffTopicBlocked("Alla Scala salta la prima del Faust", "opera"),
    ).toBe(true);
  });

  it("blocca falsi positivi sportivi (Il Lombardia / tuttobici)", () => {
    expect(
      isSportOrOffTopicBlocked(
        "L'APPELLO PER LA SICUREZZA LANCIATO DAL 'LOMBARDIA' MERITA RISPOSTA",
        "Gara ciclistica",
        "https://www.tuttobiciweb.it/articolo",
      ),
    ).toBe(true);
    expect(
      classifyIssueCategory(
        "L'APPELLO PER LA SICUREZZA LANCIATO DAL 'LOMBARDIA' MERITA RISPOSTA",
        "tuttobiciweb",
      ),
    ).toBeNull();
  });

  it("accetta solo feed RSS mappati a emergenza B.I.P.", () => {
    expect(
      classifyBipAlignedIssue(
        "Baby gang in stazione: daspo e degrado urbano",
        "occupazione abusiva sgombero",
      )?.emergency.id,
    ).toBe("E01_BABY_GANG_DEGRADO");
    expect(
      classifyBipAlignedIssue("Teatro alla Scala: prima del Faust", "spettacolo"),
    ).toBeNull();
  });

  it("strip titolo notizia da suffissi B.I.P.", async () => {
    const { stripBipFromIssueTitle } = await import("./bipProblemRadar");
    expect(
      stripBipFromIssueTitle(
        "San Vittore >200%: emergenza lombarda [B.I.P. Cap. 5-8]",
      ),
    ).toBe("San Vittore >200%: emergenza lombarda");
    const { cleanIssueHeadline } = await import("./territoryIssuesEngine");
    expect(
      cleanIssueHeadline("Caro energia (B.I.P. Cap. 9) — fit for 55"),
    ).toBe("Caro energia — fit for 55");
  });

  it("storyDedupeKey unifica stessa notizia con URL o titolo diversi", () => {
    const headline = "Baby gang in stazione centrale";
    const a = storyDedupeKey({
      id: "1",
      titoloProblema: headline,
      sourceUrl: "https://news.google.com/rss/articles/ABC123",
    } as TerritoryIssue);
    const b = storyDedupeKey({
      id: "2",
      titoloProblema: headline,
      sourceUrl: "https://news.google.com/rss/articles/ABC123?hl=it",
    } as TerritoryIssue);
    expect(a).toBe(b);
    expect(a.startsWith("title:")).toBe(true);
    expect(dedupeIssues([
      { id: "1", titoloProblema: "X", sourceUrl: "https://a.it/1" } as TerritoryIssue,
      { id: "2", titoloProblema: "X", sourceUrl: "https://a.it/1" } as TerritoryIssue,
    ])).toHaveLength(1);
    const lombardiaHeadline =
      "San Vittore >200%, MSNA sui Comuni e degrado stazioni: tripla emergenza lombarda";
    expect(
      dedupeIssues([
        {
          id: "1",
          titoloProblema: lombardiaHeadline,
          sourceUrl: "https://news.google.com/rss/articles/AAA",
        } as TerritoryIssue,
        {
          id: "2",
          titoloProblema: lombardiaHeadline,
          sourceUrl: "https://news.google.com/rss/articles/BBB",
        } as TerritoryIssue,
      ]),
    ).toHaveLength(1);
  });

  it("unionTerritoryIssueFeeds unisce card e lista live senza duplicati", () => {
    const base = (id: string, url: string, title: string): TerritoryIssue => ({
      id,
      regione: "Lombardia",
      provinciaComune: "Milano",
      categoria: "LAVORO",
      titoloProblema: title,
      sintesiLamentela: "s",
      canaleVirale: "x",
      visualizzazioniStimate: "x",
      impattoScore: 80,
      datoUfficialeModuloB: "d",
      azionePoliticaConsigliata: { doveAndare: "a", cosaDire: "b" },
      sourceUrl: url,
      pubDate: null,
      contentSource: "live",
    });
    const cards = [base("1", "https://a.it/1", "Titolo A")];
    const extra = [
      base("2", "https://a.it/2", "Titolo B"),
      base("1-dup", "https://a.it/1", "Titolo A live"),
    ];
    const merged = unionTerritoryIssueFeeds(cards, extra);
    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.titoloProblema)).toContain("Titolo B");
  });

  it("Lombardia: 6 temi elettorali, no GRA, occupazione 71,4%", () => {
    const themes = electoralThemesForRegion("Lombardia");
    expect(themes).toHaveLength(6);
    const pillars = structuralPillarIssuesForRegion("Lombardia");
    expect(pillars).toHaveLength(4);
    const tr = themes.find((p) => p.categoria === "TRASPORTI")!;
    expect(tr.provinciaComune).toContain("Passante Ferroviario");
    expect(tr.provinciaComune).not.toMatch(/\bGRA\b/);
    expect(officialModuloBLine("Lombardia", "LAVORO")).toContain("71,4%");
  });

  it("ANTI-REGRESSIONE: sfratto anziani/donne a Napoli ≠ SICUREZZA / imputabilità / Polfer", async () => {
    const title =
      "Anziani e donne sotto sgombero a Napoli, 'non ributtateci in strada' — Manifestazione e appello all'ordine religioso proprietario dell'immobile";
    const snippet =
      "Appello all'ordine religioso proprietario dell'immobile: famiglie e anziani chiedono di non finire in strada dopo lo sfratto.";

    const aligned = classifyBipAlignedIssue(title, snippet);
    expect(aligned).not.toBeNull();
    expect(aligned!.category).toBe("COSTO_VITA");
    expect(aligned!.category).not.toBe("SICUREZZA");
    expect(aligned!.emergency.id).toBe("E13_EMERGENZA_ABITATIVA");

    expect(classifyIssueCategory(title, snippet)).toBe("COSTO_VITA");

    const { matchExactBipSubDossier } = await import("./bipSubDossierMatch");
    const dossier = matchExactBipSubDossier(title, snippet, "COSTO_VITA");
    expect(dossier.id).toBe("BIP_FAM_07");
    expect(dossier.pressDeclaration.toLowerCase()).not.toMatch(/imputabilit/);
    expect(dossier.provvedimentoAtto.toLowerCase()).not.toMatch(/imputabilit/);
    expect(dossier.pressDeclaration.toLowerCase()).toMatch(/erp|abitativ|anzian/);

    const { staffBipLeverForCategory } = await import("./osservatorioStaffBipLevers");
    const lever = staffBipLeverForCategory("COSTO_VITA", `${title} ${snippet}`);
    expect(lever.measure.toLowerCase()).not.toMatch(/imputabilit|daspo|polfer|forze armate/);
    expect(lever.declaration("Campania").toLowerCase()).not.toMatch(/imputabilit|polfer/);
    expect(lever.badge.toLowerCase()).toMatch(/casa|abitativ|erp|famigl/);

    const {
      fieldActionWhereForIssue,
      fieldStakeholdersForIssue,
      provvedimentoForIssue,
      pressDeclarationForIssue,
    } = await import("./territoryIssueAnalyzeCopy");
    const issue = {
      categoria: "COSTO_VITA" as const,
      titoloProblema: title,
      sintesiLamentela: snippet,
      provinciaComune: "Napoli",
      regione: "Campania" as const,
      azionePoliticaConsigliata: { doveAndare: "", cosaDire: "" },
    };
    const dove = fieldActionWhereForIssue(issue);
    expect(dove.toLowerCase()).toMatch(/stabile|assessorato|prefettura|inquilin/);
    expect(dove.toLowerCase()).not.toMatch(/stazione fs|polfer/);
    expect(fieldStakeholdersForIssue(issue).toLowerCase()).not.toMatch(/polfer/);
    const press = pressDeclarationForIssue(issue, "Campania");
    expect(press).toMatch(/^«/);
    expect(press).not.toMatch(/^["“].*«/);
    expect(press.toLowerCase()).not.toMatch(/imputabilit|polfer|daspo urbano/);
    const prov = provvedimentoForIssue(issue);
    expect(prov.interventoImmediato.toLowerCase()).toMatch(/24|72|prefettur|allogg/);
    expect(prov.riformaStrutturale.toLowerCase()).toMatch(/erp|abitativ/);
    expect(prov.riformaStrutturale.toLowerCase()).not.toMatch(/imputabilit/);

    const { bipStructuralDatoForCategory } = await import("./bipProblemRadar");
    const dato = bipStructuralDatoForCategory("Campania", "COSTO_VITA");
    expect(dato).toMatch(/\d/);
    expect(dato.toLowerCase()).not.toMatch(/baby gang/);
  });

  it("sgombero criminale / centri sociali resta SICUREZZA", () => {
    const aligned = classifyBipAlignedIssue(
      "Sgombero campo abusivo e centri sociali a Milano",
      "Degrado, spaccio e occupazione abusiva in periferia",
    );
    expect(aligned?.category).toBe("SICUREZZA");
    expect(aligned?.emergency.id).toBe("E01_BABY_GANG_DEGRADO");
  });
});

function normalTerritoryQueryRegion(raw: string | null) {
  return normalizeTerritoryQueryRegion(raw);
}
