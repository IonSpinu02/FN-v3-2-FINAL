import {
  buildConsensusDriversFromLive,
  buildDeterministicConsensusExplanation,
  cleanNewsItem,
  generateConsensusExplanation,
  polishPublicProse,
} from "@/lib/ai/consensusExplanationAgent";
import { resolveConsensoLiveContext } from "@/lib/engine/consensoLiveContext";
import { buildLiveConsensoPayload } from "@/lib/engine/liveConsensoService";
import { formatDateIt } from "@/lib/export/pdfSafeText";
import type { DossierMovementWhy } from "@/lib/export/dossierTypes";
import { sanitizeDossierPublicText } from "@/lib/export/pdfSafeText";

function capitalizeSentence(text: string): string {
  const t = sanitizeDossierPublicText(polishPublicProse(text));
  if (!t) return t;
  const out = t.charAt(0).toLocaleUpperCase("it-IT") + t.slice(1);
  return /[.!?…]$/.test(out) ? out : `${out}.`;
}

/**
 * Stessa catena del popup «Perché il consenso è salito/sceso»:
 * live consenso → driver → explanation (cache/AI/fallback deterministico).
 */
export async function resolveDossierMovementWhy(): Promise<DossierMovementWhy> {
  const ctx = await resolveConsensoLiveContext();
  const releases = ctx.pollReleases ?? [];
  const live = buildLiveConsensoPayload("auto", {
    pollReleases: releases,
    supermediaSeries: ctx.supermediaSeries,
    feedSyncedAt: ctx.feedSyncedAt ?? undefined,
  });
  const brief = live.movementBrief;
  const drivers = buildConsensusDriversFromLive(live, releases);
  let explanation = buildDeterministicConsensusExplanation(drivers);
  try {
    explanation = await generateConsensusExplanation(drivers);
  } catch {
    // Mantieni il fallback deterministico: il PDF non deve fallire.
  }

  const ui = explanation.uiBlocks;
  const plainWhy = capitalizeSentence(
    explanation.plainWhy || ui?.plainWhy || explanation.paragraph,
  );
  const pollstersNote = capitalizeSentence(
    ui?.pollstersNote ||
      "In questa finestra le stime dei sondaggisti vanno lette insieme al quadro pubblico.",
  );
  const teamAction = capitalizeSentence(
    ui?.teamDirective ||
      "Insistere in TV e sui social su sicurezza, bollette e tasse, lavorando su elettori delusi del centrodestra e sull’astensione.",
  );

  const rawFacts = ui?.newsBullets?.length
    ? ui.newsBullets.map((n) => ({
        badge: n.badge || n.sourceDate || "Stampa",
        text: n.text || n.summary || "",
      }))
    : drivers.politicalNews.slice(0, 4).map((n) => cleanNewsItem(n));

  const factsBullets = rawFacts
    .slice(0, 5)
    .map((n) => ({
      badge: sanitizeDossierPublicText(
        n.badge.replace(/^fonte\s*[-–—:]\s*/i, ""),
      ),
      text: capitalizeSentence(n.text),
    }))
    .filter((n) => n.text.length > 2);

  const polls = (brief?.inputs?.length
    ? brief.inputs
    : drivers.recentPolls.map((p) => ({
        institute: p.institute,
        fieldEnd: p.fieldEnd,
        fnPct: p.fnPct,
        weight: 1,
      }))
  ).slice(0, 6);

  const paragraph = sanitizeDossierPublicText(
    polishPublicProse(
      [plainWhy, pollstersNote, `Cosa fare ora (Team FN): ${teamAction}`]
        .filter(Boolean)
        .join(" "),
    ),
  );

  return {
    headline: sanitizeDossierPublicText(explanation.headline),
    pct: brief?.pct ?? drivers.currentConsensus,
    previousPct: brief?.previousPct ?? drivers.previousReferenceValue,
    previousIsoDate:
      brief?.previousIsoDate ?? drivers.previousReferenceDate ?? null,
    deltaPp: brief?.deltaPp ?? drivers.deltaPp,
    supermediaPct: brief?.benchmarkPct ?? drivers.supermediaValue,
    gapPp: brief?.gapPp ?? drivers.scarto,
    paragraph,
    plainWhy,
    factsBullets,
    pollstersNote,
    teamAction,
    disclaimer: sanitizeDossierPublicText(polishPublicProse(explanation.disclaimer)),
    sources: (explanation.citedSources.length
      ? explanation.citedSources
      : brief?.sources ?? []
    )
      .slice(0, 6)
      .map((s) => ({
        label: sanitizeDossierPublicText(
          s.label.replace(/^fonte\s*[-–—:]\s*/i, ""),
        ),
        url: "url" in s ? s.url : undefined,
      })),
    polls: polls.map((p) => {
      // Stessa regola della tabella Pagina 9: publishedAt se disponibile, altrimenti fieldEnd.
      const match =
        releases.find(
          (r) =>
            r.institute === p.institute &&
            (r.fieldEnd === p.fieldEnd || r.publishedAt?.slice(0, 10) === p.fieldEnd),
        ) ??
        drivers.recentPolls.find(
          (r) => r.institute === p.institute && r.fieldEnd === p.fieldEnd,
        );
      const iso = (match?.publishedAt ?? match?.fieldEnd ?? p.fieldEnd).slice(0, 10);
      return {
        institute: sanitizeDossierPublicText(p.institute),
        dateDisplay: formatDateIt(iso, "short"),
        pct: p.fnPct,
      };
    }),
  };
}
