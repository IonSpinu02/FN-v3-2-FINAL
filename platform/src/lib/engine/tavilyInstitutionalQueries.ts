/** Query Tavily per scanner istituzionale Locali / Rassegna feed. */
export function tavilyQueriesForInstitutionalNews(
  comuni: string[],
  keywords: string[],
): string[] {
  const geo =
    comuni.length > 0 ? comuni.slice(0, 5).join(" ") : "Italia comuni";
  const kw =
    keywords.length > 0
      ? keywords.slice(0, 10).join(" ")
      : "sindaco giunta consiglio dimissioni elezioni";
  return [
    `${geo} ${kw} amministrazione comunale consiglio comunale`,
    `${geo} Futuro Nazionale Vannacci passaggio partito politica locale`,
    `Italia ${kw} sindaco assessore cronaca istituzionale ultima settimana`,
  ];
}

export const TAVILY_DEFECTION_NEWS_QUERY = [
  "Italia politica: lascia Lega OR lascia Fratelli d'Italia OR lascia Forza Italia",
  "OR passa al Gruppo Misto OR aderisce a Futuro Nazionale OR passa con Vannacci",
  "OR cambio di casacca OR transfughi parlamentari site:.it",
].join(" ");

/** Domini autorevoli IT per verifica cambi di partito (Tavily include_domains). */
export const TAVILY_DEFECTION_INCLUDE_DOMAINS = [
  "ansa.it",
  "adnkronos.com",
  "camera.it",
  "senato.it",
  "tg24.sky.it",
  "skytg24.it",
  "ilfoglio.it",
  "corriere.it",
  "repubblica.it",
  "ilgazzettino.it",
  "lastampa.it",
  "ilsole24ore.com",
  "agi.it",
] as const;
