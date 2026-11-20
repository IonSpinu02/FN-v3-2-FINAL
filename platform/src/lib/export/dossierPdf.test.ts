import { describe, expect, it } from "vitest";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import {
  computeForecastV4,
  forecastHorizon,
  staticForecastPolls,
  staticForecastRegions,
  type ForecastPoll,
} from "@/lib/engine/forecastEngineV4";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { buildComputationId } from "@/lib/engine/computationFingerprint";
import { BIP_FN_PROMISES_CATALOG } from "@/lib/bipProgramCatalog";
import {
  buildStrategicDossierPayload,
  formatDossierFilename,
} from "@/lib/export/buildDossierPayload";
import { assertBipIdsValid } from "@/lib/export/matchNewsToBip";
import {
  sanitizeCardText,
  sanitizeSourceDateLabel,
  StrategicDossierPdfDocument,
} from "@/lib/export/StrategicDossierPdfDocument";
import {
  preferCompleteNews,
  preferCompletePolls,
} from "@/lib/export/resolveDossierExportInput";
import {
  formatDateIt,
  pdfSafeText,
  pdfSignedPp,
  sanitizeDossierPublicText,
} from "@/lib/export/pdfSafeText";
import { hasUnitVotePrecision } from "@/lib/formatApproximateVotes";
import { formatDecimalIt } from "@/lib/formatIt";

function buildThirtyTwoPolls(): ForecastPoll[] {
  const seed = staticForecastPolls();
  const institutes = [
    "SWG",
    "Ipsos",
    "Eumetra",
    "Piepoli",
    "EMG",
    "Noto",
    "Only Numbers",
    "Termometro",
  ];
  const out: ForecastPoll[] = seed.map((p) => ({ ...p }));
  let i = 0;
  while (out.length < 32) {
    const day = 20 - Math.floor(i / institutes.length);
    const month = day > 0 ? 10 : 9;
    const d = day > 0 ? day : 30 + day;
    const iso = `2026-${String(month).padStart(2, "0")}-${String(Math.max(1, d)).padStart(2, "0")}`;
    out.push({
      id: `synth-${out.length}`,
      institute: institutes[i % institutes.length]!,
      fieldEnd: iso,
      publishedAt: iso,
      fnPct: 5.5 + ((i * 17) % 25) / 10,
    });
    i += 1;
  }
  return out.slice(0, 32);
}

describe("pulizia schede Pagina 6", () => {
  it("corregge anni fuori range e i punti doppi", () => {
    expect(sanitizeSourceDateLabel("pmi.it · Novembre 2028")).toBe("pmi.it · Novembre 2026");
    expect(sanitizeSourceDateLabel("unidprofessional.com · Novembre 2020")).toBe(
      "unidprofessional.com · Novembre 2026",
    );
    expect(sanitizeSourceDateLabel("Sky TG24 · Novembre 2026")).toBe("Sky TG24 · Novembre 2026");
    expect(sanitizeCardText("omiut Novembre 2028")).toBe("pmi.it Novembre 2026");
    expect(sanitizeCardText("accesso alla prima casa..")).toBe("accesso alla prima casa.");
    expect(sanitizeCardText("accesso alla prima casa…")).toBe("accesso alla prima casa.");
    expect(sanitizeCardText("Legge 38/2010 cure palliative")).toContain("38/2010");
    expect(sanitizeCardText("perch potrebbe salire")).toContain("perché potrebbe");
    expect(sanitizeCardText("perché potrebbe")).toBe("perché potrebbe");
    expect(sanitizeDossierPublicText("Prefeture")).toBe("Prefetture");
  });
});

describe("Dossier Strategico PDF", () => {
  const polls32 = buildThirtyTwoPolls();
  const v4Input = {
    regions: staticForecastRegions(6.59),
    polls: polls32,
    history: FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
      isoDate: p.isoDate,
      pct: p.pct,
    })),
    newsHeadlines: [
      "Manovra: pressione fiscale sulle Partite IVA — Sole 24 Ore",
      "Bollette in aumento per le imprese del Nord — Sole 24 Ore",
      "Liste d'attesa infinite in Calabria — Ansa",
      "Sicurezza stazioni: allarme a Milano — Corriere",
      "Mutui e caro-casa sulle famiglie giovani — Facile.it",
      "Manovra bis: ancora tasse sul ceto medio — Repubblica",
      "Ancora Manovra: emendamenti fisco in Senato — Ansa",
    ],
  };
  const v4 = computeForecastV4(v4Input);

  it("buildStrategicDossierPayload: numeri chiari, zero gergo, sezioni e quadratura", () => {
    const payload = buildStrategicDossierPayload({
      v4,
      v4Input,
      newsHeadlines: v4Input.newsHeadlines,
      horizonKey: "d180",
      scenarioMode: "base",
    });

    const { computationId } = buildComputationId({
      v4,
      v4Input,
      horizonKey: "d180",
      scenarioMode: "base",
      newsHeadlines: v4Input.newsHeadlines,
    });
    expect(payload.meta.computationId).toBe(computationId);
    expect(payload.meta.computationRef).toMatch(/^Codice verifica calcolo: #/);
    expect(payload.meta.verificationCode).toMatch(/^[a-f0-9]{6}$/i);
    expect(payload.meta.startDateDisplay).toMatch(/[a-z]+ \d{4}/i);
    expect(payload.meta.endDateDisplay).toMatch(/[a-z]+ \d{4}/i);
    expect(payload.meta.startDateDisplay).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.meta.votesBaseNote).toMatch(
      /Stima voti calcolata su circa 23 milioni di voti validi \(ogni 1% equivale a circa 230\.000 voti, ipotesi affluenza 50%\)\./,
    );
    expect(payload.meta.votesBaseNote).not.toMatch(/[≈~]/);

    expect(payload.consenso.s0Pct).toBeCloseTo(v4.startPct, 5);
    const base180 = forecastHorizon(v4, "base", "d180");
    const off180 = forecastHorizon(v4, "offensiva", "d180");
    const row = payload.consenso.horizons.find((h) => h.horizonKey === "d180")!;
    expect(row.basePct).toBeCloseTo(base180.centralPct, 5);
    expect(row.offensivaPct).toBeCloseTo(off180.centralPct, 5);
    expect(row.deltaBaseVsOggiPp).toBeCloseTo(base180.deltaPp, 5);
    const mom = base180.factors.find((f) => f.id === "momentum")?.pp ?? 0;
    expect(row.pollsAlonePct).toBeCloseTo(v4.startPct + mom, 5);
    expect(row.growthBaseLabel).toMatch(/circa/i);
    expect(hasUnitVotePrecision(row.votesBaseHint)).toBe(false);

    expect(payload.ordineOperativo.region.length).toBeGreaterThan(2);
    expect(payload.ordineOperativo.fork).toMatch(/^Stima\./);
    expect(payload.ordineOperativo.frase.length).toBeGreaterThan(12);
    expect(payload.consenso.kpiExplain).toHaveLength(3);
    expect(payload.consenso.kpiExplain[0]).toMatch(/Consenso attuale/i);
    expect(payload.consenso.kpiExplain[1]).toMatch(/Tendenza soli sondaggi/i);
    expect(payload.consenso.kpiExplain[2]).toMatch(/Scenario Base/i);
    expect(payload.consenso.movementWhy.headline).toMatch(
      /PERCHÉ IL CONSENSO È (SALITO|SCESO|STABILE)/i,
    );
    expect(payload.consenso.movementWhy.paragraph.length).toBeGreaterThan(40);
    expect(payload.consenso.movementWhy.plainWhy.length).toBeGreaterThan(40);
    expect(payload.consenso.movementWhy.plainWhy).not.toMatch(
      /same-institute|house-effect|decompressione metodologica|forbice metodologica/i,
    );
    expect(payload.consenso.movementWhy.pollstersNote.length).toBeGreaterThan(10);
    expect(payload.consenso.movementWhy.teamAction.length).toBeGreaterThan(10);
    expect(payload.consenso.movementWhy.disclaimer.length).toBeGreaterThan(20);

    // Chart: no consecutive duplicate month labels (empty string allowed)
    const labels = payload.fattori.chart.map((p) => p.label);
    for (let i = 1; i < labels.length; i++) {
      if (!labels[i] || !labels[i - 1]) continue;
      if (labels[i] === "OGGI" || labels[i - 1] === "OGGI") continue;
      expect(labels[i]).not.toBe(labels[i - 1]);
    }

    // 7 fattori + equazione totale (niente doppio segno + +)
    expect(payload.fattori.rows).toHaveLength(7);
    expect(payload.fattori.totalEquation).toMatch(/Scenario Base Maggio/i);
    expect(payload.fattori.totalEquation).not.toMatch(/\+\s*\+/);
    expect(payload.fattori.rows[0]!.explanation).toMatch(/zoccolo duro/i);
    expect(payload.fattori.rows[0]!.explanation).not.toMatch(/^Dato osservato:/i);
    for (const f of payload.fattori.rows) {
      expect(hasUnitVotePrecision(f.votesHint)).toBe(false);
      expect(f.explanation.length).toBeGreaterThan(20);
      expect(f.explanation).not.toMatch(/^Dato \+ Ipotesi:/i);
    }
    const zoccoloAtteso = formatDecimalIt(v4.diagnostics.levelPct, 1);
    const softFloorWrong = formatDecimalIt(v4.diagnostics.softFloorPct, 2);
    expect(payload.fattori.rows.some((f) => /6,80%/.test(f.explanation))).toBe(
      false,
    );
    expect(payload.fattori.rows[0]!.explanation).toContain(
      `zoccolo duro strutturale stimato intorno al ${zoccoloAtteso}%`,
    );
    expect(payload.fattori.rows[0]!.explanation).not.toContain(
      `stimato intorno al ${softFloorWrong}%`,
    );

    const pollsCov =
      payload.meta.coverage.sources.find((s) => s.sourceKey === "polls")
        ?.itemsAccepted ?? 0;
    expect(pollsCov).toBe(32);
    expect(payload.consenso.polls.length).toBeLessThanOrEqual(8);
    expect(payload.consenso.polls[0]!.dateDisplay).toMatch(/\d+ [a-z]{3} \d{4}/i);
    expect(payload.consenso.polls[0]!.scartoLabel).toMatch(/media/i);

    expect(payload.cabina.reliabilityBox).toMatch(/Verifica storica a 30 giorni/i);
    expect(payload.cabina.reliabilityBox).not.toMatch(
      /Verifica storica a 30 giorni non disponibile/i,
    );
    expect(payload.cabina.reliabilityBox).not.toMatch(/\bV4\b/);
    expect(payload.cabina.reliabilityBox).not.toMatch(
      /computationId|soft-floor|walk-forward|linea di fondo filtrata|riferimento statico/i,
    );
    expect(payload.cabina.reliabilityBox).toMatch(
      /zoccolo duro strutturale|ipotesi di consenso fermo|Elaborazione automatica/i,
    );

    const negFactor = payload.fattori.rows.find((r) => r.pp180 < 0 || r.pp30 < 0);
    if (negFactor) {
      const signed = pdfSignedPp(
        negFactor.pp30 < 0 ? negFactor.pp30 : negFactor.pp180,
      );
      expect(signed.startsWith("-")).toBe(true);
      expect(signed).not.toMatch(/[\u2212]/);
    }
    expect(pdfSafeText("−0,79 → Δ ≥")).toBe("-0,79 -> Var. >=");
    expect(sanitizeDossierPublicText("MSNA e ERP")).toMatch(
      /minori stranieri non accompagnati.*case popolari/,
    );
    expect(sanitizeDossierPublicText("MSNA e ERP")).not.toMatch(
      /case popolari \(case popolari/,
    );
    expect(
      sanitizeDossierPublicText(
        "case popolari (ERP) e ancora ERP e case popolari (case popolari (ERP))",
      ),
    ).not.toMatch(/case popolari \(case popolari/);
    expect(sanitizeDossierPublicText("$3^{\\circ}$")).toBe("3°");
    expect(formatDateIt("2026-11-10", "long")).toBe("10 novembre 2026");
    expect(pdfSafeText("BIP.13-CV · CARO-VITA")).toMatch(/BIP\.13-CV - CARO-VITA/);
    expect(pdfSafeText("BIP.13-CVCARO-VITA")).toMatch(/BIP\.13-CV - CARO/);

    expect(payload.cabina.regions.length).toBe(20);
    expect(payload.cabina.regions.slice(0, 8).every((r) => r.roleLabel.includes("Verde"))).toBe(true);
    const sicilia = payload.cabina.regions.find((r) => r.regione === "Sicilia");
    const liguria = payload.cabina.regions.find((r) => r.regione === "Liguria");
    const emilia = payload.cabina.regions.find((r) => r.regione === "Emilia-Romagna");
    const toscana = payload.cabina.regions.find((r) => r.regione === "Toscana");
    expect(sicilia?.levaBip).not.toMatch(/Balcan/i);
    expect(sicilia?.levaBip).toMatch(/BIP\.07/);
    expect(liguria?.levaBip).toMatch(/BIP\.09-TR/);
    expect(liguria?.levaBip).not.toMatch(/Balcan/i);
    expect(emilia?.emergency).toMatch(/energia|PMI|idrogeolog/i);
    expect(emilia?.levaBip).toMatch(/BIP\.09-EN/);
    expect(toscana?.emergency).not.toBe(
      payload.cabina.regions.find((r) => r.regione === "Lazio")?.emergency,
    );
    for (const name of ["Molise", "Basilicata", "Valle d'Aosta"] as const) {
      expect(payload.cabina.regions.find((r) => r.regione === name)?.levaBip).toMatch(/BIP\.13-SAN/);
    }
    expect(new Set(payload.cabina.regions.map((r) => r.regione)).size).toBe(20);
    for (const r of payload.cabina.regions) {
      expect(r.regione.length).toBeGreaterThan(2);
      expect(Number.isFinite(r.affinity)).toBe(true);
      expect(Number.isFinite(r.sharePct)).toBe(true);
      expect(r.emergency.length).toBeGreaterThan(8);
      expect(r.levaBip.length).toBeGreaterThan(8);
      expect(r.roleLabel.length).toBeGreaterThan(8);
      expect(r.roleLabel).toMatch(/Priorità Alta|Espansione|Presidio/);
    }
    expect(payload.cabina.tesiParagraphs.join(" ")).toMatch(/20 regioni/);
    expect(payload.cabina.regionsSubtitle).toMatch(/Stima FN locale/i);
    const levers = new Set(
      payload.cabina.regions.map(
        (r) => r.levaBip.split(/\s[-/]\s/)[0] ?? r.levaBip,
      ),
    );
    expect(levers.size).toBeGreaterThanOrEqual(4);
    expect(
      payload.cabina.regions.every((r) => r.levaBip.includes("BIP.13-SAN")),
    ).toBe(false);
    for (const r of payload.cabina.regions) {
      expect(r.levaBip).not.toMatch(/CVCARO/);
      expect(r.levaBip).toMatch(/BIP\.\d/);
      expect(r.levaBip.length).toBeGreaterThan(12);
    }
    const emergencies = new Set(payload.cabina.regions.map((r) => r.emergency));
    expect(emergencies.size).toBeGreaterThanOrEqual(4);

    expect(payload.newsBip.length).toBe(5);
    expect(assertBipIdsValid(payload.newsBip)).toBe(true);
    const bipCodes = new Set(payload.newsBip.map((c) => c.codiceBip));
    expect(bipCodes.size).toBeGreaterThanOrEqual(4);
    const risks = payload.newsBip.map((c) => c.rischioOpportunitaConsenso);
    expect(new Set(risks).size).toBe(risks.length);
    const catalogIds = new Set(BIP_FN_PROMISES_CATALOG.map((b) => b.id));
    for (let i = 0; i < payload.newsBip.length; i++) {
      const card = payload.newsBip[i]!;
      expect(catalogIds.has(card.codiceBip)).toBe(true);
      expect(card.testata).not.toMatch(
        /Fonte da titolo|Fonte non indicata|data non indicata/i,
      );
      expect(card.rischioOpportunitaConsenso).not.toMatch(/«|»/);
      expect(card.fronteLabel.startsWith(`${i + 1}.`)).toBe(true);
      expect(card.dataPubblicazione).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(card.azioneRimedioBip).not.toMatch(/^BIP\./);
      expect(card.titoloBip).not.toMatch(/CVCARO/);
      expect(card.codiceBip).not.toMatch(/CVCARO/);
      expect(
        sanitizeDossierPublicText(`${card.codiceBip} - ${card.titoloBip}`),
      ).not.toMatch(/CVCARO/);
      expect(card.rischioOpportunitaConsenso).not.toMatch(
        /case popolari \(case popolari/,
      );
    }
    expect(payload.newsBip.map((c) => Number(c.fronteLabel.match(/^(\d+)/)?.[1]))).toEqual([
      1, 2, 3, 4, 5,
    ]);

    // Anti-regressione testi Sezione 5
    const tesiBlob = payload.cabina.tesiParagraphs.join(" ");
    expect(tesiBlob).not.toMatch(/32\.560|27\.908/);
    expect(tesiBlob).not.toMatch(/zoccolo duro[^\n]{0,60}6,80%/);
    expect(tesiBlob).toContain(
      `zoccolo duro strutturale stimato intorno al ${zoccoloAtteso}%`,
    );
    expect(tesiBlob).not.toContain(
      `zoccolo duro strutturale stimato intorno al ${softFloorWrong}%`,
    );
    expect(tesiBlob).not.toMatch(/case popolari \(case popolari/);
    expect(tesiBlob).not.toMatch(/circa\s+circa/i);
    expect(JSON.stringify(payload)).not.toMatch(/\+\s*\+/);
    expect(JSON.stringify(payload)).not.toMatch(/CVCARO/);
    expect(JSON.stringify(payload)).not.toMatch(/case popolari \(case popolari/);
    expect(JSON.stringify(payload)).not.toMatch(/circa\s+circa/i);
    expect(JSON.stringify(payload)).not.toMatch(
      /piu'|sanita'|attivita'|opportunita'|velocita'|gia'|ricettivita'|priorita'/i,
    );
    expect(payload.meta.coverage.news.considered).toBeGreaterThan(0);
    expect(payload.meta.coverage.sources.find((s) => s.sourceKey === "polls")?.itemsAccepted ?? 0).toBeGreaterThanOrEqual(30);

    expect(payload.cabina.draftComms.join(" ")).not.toMatch(/ORGANIZZAZIONE|\.\./i);
    expect(payload.cabina.draftTitles[0]).toMatch(/sondaggi/i);
    expect(payload.cabina.draftTitles[1]).toMatch(/Manovra|bollette/i);
    expect(payload.cabina.tesiParagraphs).toHaveLength(3);
    expect(formatDossierFilename(payload.meta.generatedAtISO)).toMatch(
      /^Dossier_Strategico_FN_\d{4}-\d{2}-\d{2}_\d{4}\.pdf$/,
    );
  });

  it("preferComplete* non accetta snippet da card Scenario (7 polls / 0 news)", () => {
    const full = buildThirtyTwoPolls();
    const thin = full.slice(0, 7);
    expect(preferCompletePolls(full, thin).length).toBeGreaterThanOrEqual(30);
    expect(preferCompletePolls(thin, thin).length).toBe(thin.length);
    expect(
      preferCompleteNews(
        ["a".repeat(20), "b".repeat(20), "c".repeat(20), "d".repeat(20), "e".repeat(20)],
        [],
      ),
    ).toHaveLength(5);
    expect(preferCompleteNews([], []).length).toBeGreaterThanOrEqual(5);
    expect(
      preferCompleteNews([], ["x".repeat(20), "y".repeat(20), "z".repeat(20), "w".repeat(20), "v".repeat(20)]),
    ).toHaveLength(5);

    // Simula export da card: polls=7, news=[]. Il builder deve comunque produrre notizie e, se i 32 sono nel v4Input, coverage >=30.
    const v4Thin = computeForecastV4({
      regions: staticForecastRegions(6.59),
      polls: thin,
      history: FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
        isoDate: p.isoDate,
        pct: p.pct,
      })),
      newsHeadlines: [],
    });
    // Dopo resolve server-side i polls completi entrano in v4Input: qui verifichiamo il builder con input già arricchito.
    const v4Full = computeForecastV4({
      regions: staticForecastRegions(6.59),
      polls: full,
      history: FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
        isoDate: p.isoDate,
        pct: p.pct,
      })),
      newsHeadlines: [],
    });
    const fromCard = buildStrategicDossierPayload({
      v4: v4Full,
      v4Input: {
        regions: staticForecastRegions(6.59),
        polls: preferCompletePolls(full, thin),
        history: FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
          isoDate: p.isoDate,
          pct: p.pct,
        })),
        newsHeadlines: [],
      },
      newsHeadlines: [],
      horizonKey: "d180",
    });
    expect(
      fromCard.meta.coverage.sources.find((s) => s.sourceKey === "polls")
        ?.itemsAccepted ?? 0,
    ).toBeGreaterThanOrEqual(30);
    expect(fromCard.meta.coverage.news.considered).toBeGreaterThan(0);
    expect(fromCard.newsBip.length).toBe(5);
    expect(JSON.stringify(fromCard)).not.toMatch(/circa\s+circa/i);
    expect(JSON.stringify(fromCard)).not.toMatch(
      /piu'|sanita'|attivita'|opportunita'|velocita'|gia'|ricettivita'/i,
    );
    // Thin-only non deve essere preferito ai 32
    expect(preferCompletePolls(full, thin)).toEqual(full);
    void v4Thin;
  });

  it("sanitize collassa circa circa e ripristina accenti", () => {
    expect(sanitizeDossierPublicText("circa circa circa +33.000 voti")).toBe(
      "circa +33.000 voti",
    );
    expect(sanitizeDossierPublicText("piu' sanita' attivita' opportunita'")).toMatch(
      /più sanità attività opportunità/,
    );
    expect(sanitizeDossierPublicText("gia' ricettivita' velocita'")).toMatch(
      /già ricettività velocità/,
    );
  });

  it("renderToBuffer produce un PDF con firma %PDF- e segni meno ASCII", async () => {
    const payload = buildStrategicDossierPayload({
      v4,
      v4Input,
      newsHeadlines: v4Input.newsHeadlines,
      horizonKey: "d90",
    });
    const inputSnapshot = JSON.stringify(payload);
    const buffer = await renderToBuffer(
      React.createElement(StrategicDossierPdfDocument, {
        data: payload,
      }) as unknown as React.ReactElement<DocumentProps>,
    );
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(JSON.stringify(payload)).toBe(inputSnapshot);
    const head = Buffer.from(buffer.subarray(0, 8)).toString("utf8");
    expect(head.startsWith("%PDF-")).toBe(true);

    const sampleNeg = payload.fattori.rows
      .flatMap((r) => [r.pp30, r.pp90, r.pp180])
      .find((n) => n < -0.01);
    expect(sampleNeg).toBeDefined();
    const token = pdfSignedPp(sampleNeg!);
    expect(token.startsWith("-")).toBe(true);
    expect(token).not.toMatch(/[\u2212]/);
    expect(pdfSafeText(`Var. ${token}`)).toContain("-");
  }, 60_000);
});
