import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatApproximateVotes,
  hasUnitVotePrecision,
} from "@/lib/formatApproximateVotes";
import {
  classifyBipAlignedIssue,
  classifyIssueCategory,
} from "@/lib/engine/territoryIssuesEngine";
import {
  sanitizeOsservatorioNewsItem,
  shouldAbstainFromOsservatorio,
} from "@/lib/engine/osservatorioNewsSanitizer";
import { filterTerritoryIssuesPayload } from "@/lib/engine/territoryIssuesReadFilter";
import type { TerritoryIssue } from "@/lib/engine/territoryIssuesTypes";
import {
  beneficioFnFromPolitician,
  detectExternalPartyDestination,
  isExplicitFnDestinationNews,
  newsStatoFromPolitician,
  type TrackedPolitician,
} from "@/lib/politicalDefectionsEngine";

const CRISTINA_SVEZIA =
  "Cristina di Svezia, la regina che fece di Roma la capitale della cultura";

const RIZZO_IPPOLITO =
  "Rizzo arruola gli scontenti, per Torino l'ex Pd Ippolito";

describe("C08 — astensione culturale Osservatorio (pipeline completo)", () => {
  it("scarta Cristina di Svezia / capitale della cultura (no caro-vita)", () => {
    expect(shouldAbstainFromOsservatorio(CRISTINA_SVEZIA)).toBe(true);
    expect(classifyIssueCategory(CRISTINA_SVEZIA, "")).toBeNull();
    expect(classifyBipAlignedIssue(CRISTINA_SVEZIA, "")).toBeNull();
    const sanitized = sanitizeOsservatorioNewsItem({ title: CRISTINA_SVEZIA });
    expect(sanitized.ok).toBe(false);
    expect(sanitized.reason).toMatch(/cultural|socioeconomic|soft_promo/i);
  });

  it("rimuove Cristina anche da payload cache già materializzato come COSTO_VITA", () => {
    const dirty: TerritoryIssue = {
      id: "dirty-cristina",
      regione: "Lazio",
      provinciaComune: "Roma",
      categoria: "COSTO_VITA",
      titoloProblema: CRISTINA_SVEZIA,
      sintesiLamentela: "capitale della cultura",
      canaleVirale: "ANSA",
      visualizzazioniStimate: "",
      impattoScore: 80,
      datoUfficialeModuloB: "emergenza abitativa Lazio",
      azionePoliticaConsigliata: { doveAndare: "x", cosaDire: "y" },
      sourceUrl: "https://www.ansa.it/lazio/notizie/cultura/cristina.html",
      pubDate: new Date().toISOString(),
      live: true,
      contentSource: "live",
    };
    const cleaned = filterTerritoryIssuesPayload({
      region: "Lazio",
      category: null,
      issues: [dirty],
      liveNews: [dirty],
      fetchedAt: new Date().toISOString(),
      liveCount: 1,
      catalogCount: 0,
    });
    expect(cleaned.issues).toHaveLength(0);
    expect(cleaned.liveNews).toHaveLength(0);
  });
});

describe("C12 — movimento esterno a FN senza beneficio voti", () => {
  it("etichetta Rizzo/Ippolito come movimento altri partiti senza voti FN", () => {
    expect(isExplicitFnDestinationNews(RIZZO_IPPOLITO, "")).toBe(false);
    expect(detectExternalPartyDestination(RIZZO_IPPOLITO, "")).toBe(true);
    expect(newsStatoFromPolitician(null, RIZZO_IPPOLITO, "")).toBe(
      "MOVIMENTO ALTRI PARTITI (Esterno a FN)",
    );
    expect(newsStatoFromPolitician(null, RIZZO_IPPOLITO, "")).not.toBe(
      "PASSAGGIO UFFICIALE",
    );

    const fakePol = {
      nome: "Ippolito",
      ruolo: "Consigliere Regionale",
      stato: "UFFICIALE_FN",
      partitoDestinazione: "Futuro Nazionale",
      beneficioIngressoFn: {
        votiPortatiStimati: 254_400,
        crescitaRegionePp: 0.94,
      },
      doteElettorale: {
        votiPortatiStimati: 254_400,
        impattoRegionePp: 0.94,
      },
    } as unknown as TrackedPolitician;

    expect(newsStatoFromPolitician(fakePol, RIZZO_IPPOLITO, "ex Pd")).toBe(
      "MOVIMENTO ALTRI PARTITI (Esterno a FN)",
    );
    expect(beneficioFnFromPolitician(fakePol, RIZZO_IPPOLITO, "ex Pd")).toBeUndefined();
  });
});

describe("C04 — voti previsionali arrotondati indicativi", () => {
  it("non mostra mai precisione all'unità (+151.171)", () => {
    const samples = [151_171, 19_734, 4_651, 254_400, 1];
    for (const n of samples) {
      const label = formatApproximateVotes(n);
      expect(label).toMatch(/^circa \+/);
      expect(hasUnitVotePrecision(label)).toBe(false);
      expect(label).not.toMatch(/\+151\.171/);
      expect(label).not.toMatch(/\+19\.734/);
      expect(label).not.toMatch(/\+4\.651/);
    }
    expect(formatApproximateVotes(151_171)).toMatch(/150\.000/);
    expect(formatApproximateVotes(4_651)).toMatch(/5\.000|4\.500/);
    expect(formatApproximateVotes(19_734)).toMatch(/20\.000/);
  });
});

describe("UI — nessuna etichetta Conv.% o Interesse Google (30G)", () => {
  it("non contiene stringhe proibite nei componenti src/components", () => {
    const root = path.join(process.cwd(), "src", "components");
    const files: string[] = [];
    function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(name)) files.push(full);
      }
    }
    walk(root);
    const banned = [/Conv\.\s*\d/, /Interesse Google \(30[gG]\)/, /Cosa cercano su Google/];
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const re of banned) {
        if (re.test(text)) hits.push(`${path.relative(root, file)} · ${re}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
