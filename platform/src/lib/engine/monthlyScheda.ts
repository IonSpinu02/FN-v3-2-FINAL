import type { Region } from "./constants";
import type { ScenarioResult } from "./types";
import type {
  FabbisogniRegione,
  OsservatorioEvento,
  PrioritaDichiarateRilevazione,
  SchedaMensileRiga,
} from "./osservatorioTypes";
import { pct } from "@/lib/format";

export function buildMonthlyScheda(
  regione: Region,
  scenario: ScenarioResult,
  fabbisogni: FabbisogniRegione | undefined,
  events: OsservatorioEvento[],
  trendsNote: string,
  prioritaRilevazione?: PrioritaDichiarateRilevazione,
  monthlyNote?: string,
): SchedaMensileRiga[] {
  const row = scenario.righe.find((r) => r.regione === regione);
  const stima = row ? pct(row.stima) : "n/d";

  const eventiRegione = events.filter(
    (e) => !e.regione || e.regione === regione,
  );

  const fabOggettivi = fabbisogni?.indicatori.filter((i) => i.valore != null)
    .length
    ? `${fabbisogni.indicatori.filter((i) => i.valore != null).length} indicatori popolati`
    : "Da popolare per tema (ISTAT BesT / AGENAS / OpenCivitas)";

  const priorita = fabbisogni?.prioritaDichiarate;
  let prioritaStato =
    priorita?.stato === "non_rilevato"
      ? "Non ancora rilevate"
      : priorita?.nota ?? "Parziale";
  let prioritaNota =
    priorita?.nota ?? "Indagine rappresentativa necessaria";
  if (prioritaRilevazione) {
    prioritaStato = `Rilevato (N=${prioritaRilevazione.campioneN}, ±${prioritaRilevazione.margineIncertezzaPct} pp)`;
    prioritaNota = `Metodo: ${prioritaRilevazione.metodoSelezione}; MR ${prioritaRilevazione.mancataRispostaPct}%`;
  }

  return [
    {
      dimensione: "Scenario elettorale (Modulo A)",
      indicatoreStato: stima,
      nota: "Output modello territoriale; non sondaggio regionale campionario",
    },
    {
      dimensione: "Fabbisogni oggettivi (Modulo B)",
      indicatoreStato: fabOggettivi,
      nota: "Periodi distinti per indicatore; vedi metadati fonte",
    },
    {
      dimensione: "Priorità dichiarate (Modulo B)",
      indicatoreStato: prioritaStato,
      nota: prioritaNota,
    },
    {
      dimensione: "Eventi (Modulo C)",
      indicatoreStato:
        eventiRegione.length > 0
          ? `${eventiRegione.length} episodi in registro`
          : "Registro da compilare",
      nota: "Date e fonti verificate; no giudizio automatico sul segno politico",
    },
    {
      dimensione: "Google Trends",
      indicatoreStato: trendsNote || "Serie da acquisire",
      nota: "Indice relativo 0–100; non intenzioni di voto",
    },
    {
      dimensione: "Impatto sul voto",
      indicatoreStato: "Non stimabile oggi",
      nota: "Servono sondaggi comparabili pre/post e controllo fattori concorrenti",
    },
    ...(monthlyNote
      ? [
          {
            dimensione: "Nota analitica mensile",
            indicatoreStato: monthlyNote.slice(0, 120),
            nota: monthlyNote.length > 120 ? `${monthlyNote.slice(0, 200)}…` : "",
          },
        ]
      : []),
  ];
}
