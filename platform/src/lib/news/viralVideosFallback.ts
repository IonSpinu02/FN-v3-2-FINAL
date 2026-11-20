import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import { extractCommentIntel } from "./viralCommentIntel";
import {
  DISTRESS_PILLARS,
  type DistressPillar,
  type DistressPillarId,
} from "./viralDistressPillars";
import {
  computeViralScore,
  enforceViewsAboveLikes,
  formatViralCount,
} from "./viralMetricsParser";
import { buildVannacciStitchScript } from "./viralVannacciScript";
import type { ViralVideoItem, ViralVideoScope } from "./viralVideoTypes";

type BaseSeed = {
  platform: ViralVideoItem["platform"];
  url: string;
  title: string;
  description: string;
  authorHandle: string;
  authorName: string | null;
  thumbnailUrl: string | null;
  locality: string;
  regione: ViralVideoScope;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  pillarId: DistressPillarId;
  commentBlob: string;
  viewsEstimated?: boolean;
};

function pillarById(id: DistressPillarId): DistressPillar {
  return DISTRESS_PILLARS.find((p) => p.id === id) ?? DISTRESS_PILLARS[4]!;
}

function seedItem(seed: BaseSeed, idx: number): ViralVideoItem {
  const pillar = pillarById(seed.pillarId);
  const intel = extractCommentIntel(seed.commentBlob, pillar.category, seed.locality);
  const scriptRispostaVideo = buildVannacciStitchScript({
    locality: seed.locality,
    title: seed.title,
    pillar,
    topUserComment: intel.topUserComment,
    commentSentiment: intel.commentSentiment,
  });
  const likesCount = seed.likesCount;
  const viewsCount = enforceViewsAboveLikes(seed.viewsCount, likesCount);
  const commentsCount = seed.commentsCount;
  const viralScore = computeViralScore({
    viewsCount,
    likesCount,
    commentsCount,
    salt: seed.url,
  });
  return {
    id: `fallback-${seed.regione}-${idx}`,
    platform: seed.platform,
    url: seed.url,
    title: seed.title,
    description: seed.description,
    authorHandle: seed.authorHandle,
    authorName: seed.authorName,
    thumbnailUrl: seed.thumbnailUrl,
    locality: seed.locality,
    regione: seed.regione,
    viewsCount,
    viewsFormatted: formatViralCount(viewsCount),
    viewsEstimated: seed.viewsEstimated ?? false,
    likesCount,
    likesFormatted: formatViralCount(likesCount),
    commentsCount,
    commentsFormatted: formatViralCount(commentsCount),
    viralScore,
    bipLever: pillar.bipCapRef,
    bipCapRef: pillar.bipCapRef,
    scriptRispostaVideo,
    category: pillar.category,
    distressPillarId: pillar.id,
    distressLabel: pillar.label,
    source: "fallback",
    ...intel,
  };
}

const CITIZEN_SEEDS: BaseSeed[] = [
  {
    platform: "tiktok",
    url: "https://www.tiktok.com/@mamma.caregiver.it/video/1",
    title:
      "Mamma caregiver mostra il taglio delle ore di assistenza al figlio disabile grave: «Per i profughi i fondi ci sono, per mio figlio no»",
    description:
      "Video denuncia di una madre: ore di assistenza tagliate, burocrazia INPS e senso di abbandono.",
    authorHandle: "@mamma.caregiver.it",
    authorName: null,
    thumbnailUrl: null,
    locality: "Italia · Quadro Nazionale",
    regione: "NAZIONALE",
    viewsCount: 980_000,
    likesCount: 72_000,
    commentsCount: 5_400,
    pillarId: "DISABILITA",
    commentBlob:
      "padre.reale1w Siete tutti uguali: per i profughi i fondi ci sono, per i disabili italiani no. Vergogna.",
  },
  {
    platform: "instagram",
    url: "https://www.instagram.com/reel/artigianoF24nov/",
    title:
      "Artigiano veneto mostra in lacrime l'F24 di novembre e la bolletta: «Pago il 60% di tasse per tenere aperta l'officina»",
    description:
      "Partita IVA al collasso: acconti F24, bollette e rischio chiusura del laboratorio.",
    authorHandle: "@officina.veneto",
    authorName: null,
    thumbnailUrl: null,
    locality: "Veneto",
    regione: "Veneto",
    viewsCount: 640_000,
    likesCount: 48_000,
    commentsCount: 3_200,
    pillarId: "TASSE_PIVA",
    commentBlob:
      "artigiano.nord2d Politica alla canna del gas: pensano alle poltrone e abbandonano chi lavora. Andatevene.",
  },
  {
    platform: "youtube_shorts",
    url: "https://www.youtube.com/shorts/psCollasso01",
    title:
      "Notte in Pronto Soccorso: «Dodici ore in corridoio, visita oncologica tra otto mesi»",
    description:
      "Famiglia costretta ad aspettare mesi o indebitarsi nel privato per un esame urgente.",
    authorHandle: "@cronaca.salute",
    authorName: null,
    thumbnailUrl: null,
    locality: "Lombardia",
    regione: "Lombardia",
    viewsCount: 520_000,
    likesCount: 31_000,
    commentsCount: 2_100,
    pillarId: "SANITA",
    commentBlob:
      "paziente.mi1w Liste d'attesa infinite e privati da pagare. Lo Stato non funziona, basta.",
  },
  {
    platform: "tiktok",
    url: "https://www.tiktok.com/@pendolare.mi/video/2",
    title:
      "Pendolare riprende degrado e spaccio fuori stazione: «Non si può più tornare a casa la sera»",
    description:
      "Denuncia quotidiana di chi prende il treno ogni giorno: paura, borseggi, baby gang.",
    authorHandle: "@pendolare.mi",
    authorName: null,
    thumbnailUrl: null,
    locality: "Milano Centrale · Lombardia",
    regione: "Lombardia",
    viewsCount: 1_100_000,
    likesCount: 81_000,
    commentsCount: 6_100,
    pillarId: "SICUREZZA",
    commentBlob:
      "donna.pendolare3d A stazione ho paura ogni sera. La politica pensa alle poltrone e abbandona gli italiani.",
  },
  {
    platform: "tiktok",
    url: "https://www.tiktok.com/@operaio.to/video/3",
    title:
      "Operaio in cassa integrazione: «La fabbrica chiude pezzi, a casa arriva metà stipendio»",
    description:
      "Filiera automotive e manifattura: incertezza, gasolio e regole che strozzano chi produce.",
    authorHandle: "@operaio.to",
    authorName: null,
    thumbnailUrl: null,
    locality: "Torino · Piemonte",
    regione: "Piemonte",
    viewsCount: 410_000,
    likesCount: 27_000,
    commentsCount: 1_800,
    pillarId: "LAVORO",
    commentBlob:
      "operaio.nord1w Chiudono le fabbriche e voi fate i talk show. Fate schifo.",
  },
  {
    platform: "instagram",
    url: "https://www.instagram.com/reel/ztlEuro4/",
    title:
      "Lavoratore multato in ZTL con diesel Euro 4: «Devo solo andare in officina, non sono un criminale»",
    description:
      "ZTL e autovelox come bancomat comunale: multe su chi lavora con auto usata.",
    authorHandle: "@lavoratore.ztl",
    authorName: null,
    thumbnailUrl: null,
    locality: "Roma · Lazio",
    regione: "Lazio",
    viewsCount: 380_000,
    likesCount: 22_000,
    commentsCount: 1_500,
    pillarId: "GREEN_ZTL",
    commentBlob:
      "autista.rm2w Autovelox bancomat e ZTL punitive. Siete tutti uguali.",
  },
];

function regionCitizenSeed(region: Region): ViralVideoItem {
  const pillars = DISTRESS_PILLARS;
  const pillar = pillars[region.length % pillars.length]!;
  const city = region;
  return seedItem(
    {
      platform: "tiktok",
      url: `https://www.tiktok.com/@cittadino.${region.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)}/video/1`,
      title: `Denuncia da ${city}: disagio reale su ${pillar.label.toLowerCase()}`,
      description: `Cittadino comune di ${region} racconta il caso sul territorio — non un comunicato di partito.`,
      authorHandle: `@cittadino.${region.toLowerCase().replace(/[^a-z]/g, "").slice(0, 10)}`,
      authorName: null,
      thumbnailUrl: null,
      locality: `${city} · ${region}`,
      regione: region,
      viewsCount: 220_000 + (region.length * 9_000) % 300_000,
      likesCount: 18_000 + (region.length * 700) % 20_000,
      commentsCount: 900 + (region.length * 40) % 800,
      pillarId: pillar.id,
      commentBlob: `voce.${region.slice(0, 3).toLowerCase()}1w A ${region} pensano alle poltrone e abbandonano gli italiani. Vergogna.`,
      viewsEstimated: true,
    },
    0,
  );
}

export function buildViralFallbackCatalog(scope: ViralVideoScope): ViralVideoItem[] {
  if (scope === "NAZIONALE") {
    return [
      ...CITIZEN_SEEDS.map((s, i) => seedItem(s, i)),
      ...REGIONS.slice(0, 3).map((r) => regionCitizenSeed(r)),
    ].slice(0, 9);
  }
  const local = CITIZEN_SEEDS.filter(
    (s) => s.regione === scope || s.regione === "NAZIONALE",
  ).slice(0, 2);
  return [
    regionCitizenSeed(scope),
    ...local.map((s, i) =>
      seedItem(
        {
          ...s,
          regione: scope,
          locality: `${scope} · territorio`,
          title: s.title.includes(scope) ? s.title : `${s.title} (${scope})`,
        },
        i + 1,
      ),
    ),
  ];
}
