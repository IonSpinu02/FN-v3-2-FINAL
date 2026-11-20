import { describe, expect, it } from "vitest";
import {
  buildConsensusDriversInput,
  buildDeterministicConsensusExplanation,
  explanationHashOf,
  type ConsensusNewsItem,
} from "@/lib/ai/consensusExplanationAgent";
import type { PollRelease } from "@/lib/engine/pollTypes";

const baseReleases: PollRelease[] = [
  {
    id: "swg-2026-11-02",
    institute: "SWG",
    fieldEnd: "2026-11-02",
    publishedAt: "2026-11-02",
    fnPct: 5.8,
  },
  {
    id: "ipsos-2026-10-29",
    institute: "Ipsos",
    fieldEnd: "2026-10-29",
    publishedAt: "2026-10-31",
    fnPct: 7.9,
  },
  {
    id: "eumetra-2026-10-28",
    institute: "Eumetra",
    fieldEnd: "2026-10-28",
    publishedAt: "2026-10-28",
    fnPct: 6.5,
  },
  {
    id: "piepoli-2026-10-27",
    institute: "Piepoli",
    fieldEnd: "2026-10-27",
    publishedAt: "2026-10-27",
    fnPct: 6.5,
  },
  {
    id: "swg-2026-10-26",
    institute: "SWG",
    fieldEnd: "2026-10-26",
    publishedAt: "2026-10-26",
    fnPct: 5.6,
  },
  {
    id: "emg-2026-10-20",
    institute: "EMG",
    fieldEnd: "2026-10-20",
    publishedAt: "2026-10-22",
    fnPct: 5.6,
  },
];

const news: ConsensusNewsItem[] = [
  {
    id: "n1",
    label: "Corriere · Pagnoncelli, 31 ott",
    url: "https://www.corriere.it/politica/26_ottobre_31/sondaggio-pagnoncelli-vannacci-cala-921bc1e9-787e-4da2-9c1e-b28d12264xlk.shtml",
    date: "2026-10-31",
  },
  {
    id: "n2",
    label: "Libero · Radio Cusano, 29 ott",
    url: "https://www.liberoquotidiano.it/news/politica/49484297/vannacci-dubbi-sospetti-noi-calo-sondaggi-farlocchi/",
    date: "2026-10-29",
  },
];

describe("consensusExplanationAgent", () => {
  it("con delta +0.5 non parla di calo in titolo, paragrafo o disclaimer", () => {
    const drivers = buildConsensusDriversInput({
      currentConsensus: 6.59,
      previousReferenceValue: 6.1,
      previousReferenceDate: "2026-11-02",
      deltaPp: 0.5,
      supermediaValue: 6.59,
      releases: baseReleases,
      politicalNews: news,
      asOf: "2026-11-10",
    });
    expect(drivers.direction).toBe("up");
    const explanation = buildDeterministicConsensusExplanation(drivers);
    const blob = [
      explanation.headline,
      explanation.headlineDirection,
      explanation.plainWhy,
      explanation.paragraph,
      explanation.disclaimer,
    ].join("\n");
    expect(explanation.headlineDirection).toBe("SALITO");
    expect(explanation.headline).toMatch(/SALITO/i);
    expect(blob).not.toMatch(/\bè sceso\b/i);
    expect(blob).not.toMatch(/causato il calo/i);
    expect(explanation.disclaimer).toMatch(/risalita/i);
    expect(explanation.disclaimer).not.toMatch(/\bil calo\b/i);
    expect(explanation.plainWhy).toMatch(/Il consenso sale/i);
    expect(explanation.plainWhy).not.toMatch(
      /stima di piattaforma|effetto composizione|in finestra|Ipotesi di lettura|prova causale/i,
    );
    expect(explanation.paragraph.startsWith(explanation.plainWhy.slice(0, 24))).toBe(true);
    expect(blob).not.toMatch(/same-institute|house-effect|house effect|decompressione metodologica|delta grezzo|forbice metodologica/i);
    expect(explanation.paragraph).not.toMatch(/probabilmente un mix/i);
    expect(explanation.paragraph).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(explanation.uiBlocks?.teamDirective).toMatch(/^[A-ZÀÈÉÌÒÙ]/);
    expect(explanation.uiBlocks?.newsBullets.length).toBeGreaterThan(0);
    expect(explanation.uiBlocks?.newsBullets[0]?.text).toMatch(/^[A-ZÀÈÉÌÒÙ]/);
    expect(explanation.uiBlocks?.newsBullets[0]?.badge).not.toMatch(/^Fonte/i);
  });

  it("se la media sale ma gli stessi istituti scendono, il testo lo dice in italiano semplice", () => {
    const drivers = buildConsensusDriversInput({
      currentConsensus: 6.62,
      previousReferenceValue: 6.1,
      previousReferenceDate: "2026-11-02",
      deltaPp: 0.5,
      releases: [
        {
          id: "youtrend-2026-11-09",
          institute: "YouTrend",
          fieldEnd: "2026-11-09",
          publishedAt: "2026-11-11",
          fnPct: 7.2,
        },
        {
          id: "youtrend-2026-11-02",
          institute: "YouTrend",
          fieldEnd: "2026-11-02",
          publishedAt: "2026-11-02",
          fnPct: 7.0,
        },
        {
          id: "swg-2026-11-10",
          institute: "SWG",
          fieldEnd: "2026-11-10",
          publishedAt: "2026-11-10",
          fnPct: 5.5,
        },
        {
          id: "swg-2026-11-04",
          institute: "SWG",
          fieldEnd: "2026-11-04",
          publishedAt: "2026-11-04",
          fnPct: 5.8,
        },
        {
          id: "on-2026-11-09",
          institute: "Only Numbers",
          fieldEnd: "2026-11-09",
          publishedAt: "2026-11-09",
          fnPct: 6.5,
        },
        {
          id: "on-2026-11-03",
          institute: "Only Numbers",
          fieldEnd: "2026-11-03",
          publishedAt: "2026-11-03",
          fnPct: 6.8,
        },
        {
          id: "piepoli-2026-11-05",
          institute: "Piepoli",
          fieldEnd: "2026-11-05",
          publishedAt: "2026-11-05",
          fnPct: 6.5,
        },
        {
          id: "lab21-2026-11-04",
          institute: "LAB21",
          fieldEnd: "2026-11-04",
          publishedAt: "2026-11-04",
          fnPct: 7.0,
        },
        {
          id: "ipsos-2026-10-29",
          institute: "Ipsos",
          fieldEnd: "2026-10-29",
          publishedAt: "2026-11-02",
          fnPct: 7.9,
        },
      ],
      politicalNews: news,
      asOf: "2026-11-11",
    });
    const text = buildDeterministicConsensusExplanation(drivers).plainWhy;
    expect(text).toMatch(/YouTrend/);
    expect(text).toMatch(/7,2%/);
    expect(text).toMatch(/SWG, sceso dal 5,8% al 5,5%/);
    expect(text).not.toMatch(/Ipsos|LAB21/);
    expect(text).toMatch(/raffreddamento/i);
    expect(text).not.toMatch(
      /stima di piattaforma|effetto composizione|in finestra|Ipotesi di lettura|prova causale/i,
    );
  });

  it("explanationHash cambia se cambia consenso o entra un nuovo sondaggio", () => {
    const base = buildConsensusDriversInput({
      currentConsensus: 6.59,
      previousReferenceValue: 6.1,
      previousReferenceDate: "2026-11-02",
      deltaPp: 0.5,
      releases: baseReleases,
      politicalNews: news,
      asOf: "2026-11-10",
    });
    const hashBase = explanationHashOf(base);

    const bumped = buildConsensusDriversInput({
      currentConsensus: 6.8,
      previousReferenceValue: 6.1,
      previousReferenceDate: "2026-11-02",
      deltaPp: 0.7,
      releases: baseReleases,
      politicalNews: news,
      asOf: "2026-11-10",
    });
    expect(explanationHashOf(bumped)).not.toBe(hashBase);

    const withNewPoll = buildConsensusDriversInput({
      currentConsensus: 6.59,
      previousReferenceValue: 6.1,
      previousReferenceDate: "2026-11-02",
      deltaPp: 0.5,
      releases: [
        {
          id: "swg-2026-11-09",
          institute: "SWG",
          fieldEnd: "2026-11-09",
          publishedAt: "2026-11-09",
          fnPct: 6.0,
        },
        ...baseReleases,
      ],
      politicalNews: news,
      asOf: "2026-11-10",
    });
    expect(explanationHashOf(withNewPoll)).not.toBe(hashBase);
  });

  it("citedSources contiene solo URL presenti nell'input verificato", () => {
    const drivers = buildConsensusDriversInput({
      currentConsensus: 6.59,
      previousReferenceValue: 6.1,
      previousReferenceDate: "2026-11-02",
      deltaPp: 0.5,
      releases: baseReleases,
      politicalNews: news,
      asOf: "2026-11-10",
    });
    const explanation = buildDeterministicConsensusExplanation(drivers);
    const allowed = new Set(drivers.politicalNews.map((n) => n.url));
    expect(explanation.citedSources.length).toBeGreaterThan(0);
    for (const src of explanation.citedSources) {
      expect(allowed.has(src.url)).toBe(true);
      expect(src.url).not.toMatch(/example\.com|fake|hallucin/i);
    }
  });
});
