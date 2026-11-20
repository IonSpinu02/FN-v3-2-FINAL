import { decodeRssPlainText } from "@/lib/engine/newsIngest";
import {
  CATALOG_POLITICIANS_FOR_NEWS,
  findPoliticianBySlug,
  RASSEGNA_DEFECTION_POLITICIANS,
} from "@/lib/politicalDefectionsCatalog";
import {
  isDefectionNewsRelevant,
  matchPoliticianFromText,
  type DefectionNewsItem,
} from "@/lib/politicalDefectionsEngine";
import { extractFonte, searchDefectionSources } from "@/lib/politicalDefectionsLiveRss";
import { politicianSlugFromName } from "@/lib/politicalDefectionsSlug";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function searchCatalog(q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const pool = [...RASSEGNA_DEFECTION_POLITICIANS, ...CATALOG_POLITICIANS_FOR_NEWS];
  const seen = new Set<string>();
  const hits = [];
  for (const p of pool) {
    if (seen.has(p.id)) continue;
    const blob = `${p.nome} ${p.regione} ${p.collegioDisplay} ${p.partitoProvenienza} ${p.slug ?? ""}`.toLowerCase();
    if (
      blob.includes(needle) ||
      politicianSlugFromName(p.nome).includes(needle) ||
      (p.slug && p.slug.includes(needle))
    ) {
      seen.add(p.id);
      hits.push(p);
    }
  }
  return hits.slice(0, 12);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json(
      { error: "Parametro q obbligatorio (min 2 caratteri)." },
      { status: 400 },
    );
  }

  const bySlug = findPoliticianBySlug(q) ?? findPoliticianBySlug(politicianSlugFromName(q));
  const catalogHits = bySlug ? [bySlug, ...searchCatalog(q).filter((p) => p.id !== bySlug.id)] : searchCatalog(q);

  const { rows, tavily } = await searchDefectionSources(q);
  const seenLinks = new Set<string>();
  const liveSources: DefectionNewsItem[] = [];
  for (const row of rows) {
    const titolo = decodeRssPlainText(row.titolo.trim());
    const sintesi = decodeRssPlainText(row.snippet.trim() || titolo);
    if (seenLinks.has(row.link) || !isDefectionNewsRelevant(titolo, sintesi, row.link)) continue;
    seenLinks.add(row.link);
    const matched =
      matchPoliticianFromText(titolo, sintesi, catalogHits) ??
      matchPoliticianFromText(titolo, sintesi, CATALOG_POLITICIANS_FOR_NEWS);
    liveSources.push({
      id: `verify-${row.link.slice(-28)}`,
      titolo,
      fonte: extractFonte(row.link, row.fonteFallback),
      dataOra: row.pubDate ?? new Date().toISOString(),
      url: row.link,
      sintesi,
      politicianId: matched?.id ?? null,
      statoNotizia: "CAMBIO GRUPPO",
      partitoProvenienza: matched?.partitoProvenienza,
    });
  }

  return NextResponse.json({
    query: q,
    catalog: catalogHits.map((p) => ({
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      ruolo: p.ruolo,
      regione: p.regione,
      collegioDisplay: p.collegioDisplay,
      daPartito: p.cambioGruppoDa ?? p.partitoProvenienza,
      aPartito: p.cambioGruppoA ?? p.partitoDestinazione,
      statoAdesioneFN: p.statoAdesioneFN,
      dataCambio: p.dataCambioPartito,
      fonteIstituzionale: p.fonteIstituzionale,
      fonteStampa: p.fonteStampa,
      beneficio: {
        voti:
          p.beneficioIngressoFn?.votiPortatiStimati ?? p.doteElettorale.votiPortatiStimati,
        pp: p.beneficioIngressoFn?.crescitaRegionePp ?? p.doteElettorale.impattoRegionePp,
      },
    })),
    liveSources: liveSources.slice(0, 20),
    meta: { sources: "google-news-rss+tavily-giornaliero", tavily },
  });
}
