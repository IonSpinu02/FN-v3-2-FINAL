import type { Region } from "./constants";

/** Sei assi B.I.P. — stessa copertura tematica del vecchio radar Google News. */
export function tavilyQueriesForTerritory(
  region: Region | "NAZIONALE",
): string[] {
  const place = region === "NAZIONALE" ? "Italia" : region;
  return [
    `${place} baby gang daspo occupazione abusiva degrado urbano stazione spaccio sicurezza`,
    `${place} MSNA decreto flusso case popolari sbarchi carceri San Vittore sovraffollamento`,
    `${place} oneri di sistema bollette case green euro 5 Fit for 55 mutuo prima casa`,
    `${place} saldo e acconto CRIF partita IVA cinghiali fotovoltaico Po agricoltori sottocosto`,
    `${place} liste d'attesa CUP sanitario pronto soccorso legge 38 truffe over 65 pensione minima sanità`,
    `${place} HVO pendolari ritardi treni legittima difesa rapina furto trasporti`,
  ];
}
