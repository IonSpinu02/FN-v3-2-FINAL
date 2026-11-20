/** Ipotesi pubblicate sul calo di fine ottobre 2026. Non sono una causa dimostrata. */
export const OCTOBER_2026_DROP_NOTE = {
  from: "2026-10-15",
  until: "2026-11-15",
  text: [
    "Probabilmente il consenso è sceso perché Futuro Nazionale ha perso centralità, non per una singola frase.",
    "Il Corriere, sul sondaggio Pagnoncelli del 31 ottobre, legge il calo come effetto di una minore visibilità e del «contenimento a destra» di Giorgia Meloni.",
    "Lo stesso giorno il Corriere di Roma parla di crisi di crescita: il partito fatica a dettare l'agenda, ha liti sui territori e ha rinunciato alle suppletive di Chieti. Gianni Alemanno, in una riunione riportata dal giornale, avverte che rischia di apparire «troppo identitario».",
    "Vannacci, il 29 ottobre a Radio Cusano, dà un'altra spiegazione: meno spazio in televisione e «sondaggi farlocchi».",
  ].join(" "),
  sources: [
    {
      label: "Corriere · Pagnoncelli, 31 ott",
      url: "https://www.corriere.it/politica/26_ottobre_31/sondaggio-pagnoncelli-vannacci-cala-921bc1e9-787e-4da2-9c1e-b28d12264xlk.shtml",
    },
    {
      label: "Corriere Roma · 31 ott",
      url: "https://roma.corriere.it/notizie/politica/26_ottobre_31/vannacci-sondaggi-giu-social-freddi-2aa8a1d6-9d4d-424e-b2e4-ddfe8d4e7xlk.shtml",
    },
    {
      label: "Libero · Radio Cusano, 29 ott",
      url: "https://www.liberoquotidiano.it/news/politica/49484297/vannacci-dubbi-sospetti-noi-calo-sondaggi-farlocchi/",
    },
  ],
};

export function causeNoteForWindow(isoDate: string | undefined) {
  if (!isoDate) return null;
  if (isoDate < OCTOBER_2026_DROP_NOTE.from || isoDate > OCTOBER_2026_DROP_NOTE.until) {
    return null;
  }
  return OCTOBER_2026_DROP_NOTE;
}
