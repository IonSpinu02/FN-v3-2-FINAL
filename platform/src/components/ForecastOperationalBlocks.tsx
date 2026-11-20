"use client";

import { useMemo, useState } from "react";
import type {
  ForecastDiagnostics,
  ForecastFactorId,
  ForecastHorizonKey,
  ForecastHorizonResult,
  ForecastNetworkDelta,
  ForecastScenarioResult,
  ForecastBacktestV4,
  ForecastProvenance,
} from "@/lib/engine/forecastEngineV4";
import { FORECAST_FACTOR_ORDER, factorPp } from "@/lib/engine/forecastEngineV4";
import {
  formatApproximateVotes,
  formatDecimalIt,
  formatPpSignedIt,
  formatPuntiSignedIt,
} from "@/lib/formatIt";
import type { VerdeGainRow } from "@/components/ForecastV4Views";
import { ForecastNetworkWhatIf } from "@/components/ForecastV4Views";
import { ForecastOutlookChart } from "@/components/ForecastPredictiveVisuals";
import type { OutlookSample } from "@/components/ForecastPredictiveVisuals";

function pct(v: number) {
  return `${formatDecimalIt(v, 2)}%`;
}

function votesFromDelta(deltaPp: number, validi: number) {
  return Math.round((deltaPp / 100) * validi);
}

function tone(v: number): "positive" | "negative" | "neutral" {
  if (v > 0.005) return "positive";
  if (v < -0.005) return "negative";
  return "neutral";
}

/** Azioni concrete (nota + briefing Vannacci) — non dipendono dal motore. */
const VOICE_ACTIONS: Record<
  ForecastFactorId,
  { title: string; whyHow: string; action: string }
> = {
  momentum: {
    title: "Sondaggi",
    whyHow:
      "È l’unica voce calcolata solo sui sondaggi (Supermedia e istituti), togliendo il «vizio» di ogni casa di ricerca. Se il calo si è fermato, il modello non trascina una discesa nel futuro; resta però il rientro verso la linea di fondo. Sotto lo zoccolo duro ogni calo rallenta.",
    action:
      "Non farsi trascinare nel commento quotidiano dei decimali dei sondaggi. Concentrarsi sulle leve operative: lì si decide se la previsione si realizza.",
  },
  agenda: {
    title: "Temi e B.I.P.",
    whyHow:
      "Guadagniamo quando si parla dei temi su cui siamo percepiti come più credibili. Il motore incrocia tre dati per i quattro grandi temi: quanto preoccupa gli italiani (Eurobarometro + notizie) × quanto il tema è riconosciuto come nostro × numero di proposte B.I.P. pronte. Sicurezza e Fisco da soli generano oltre i 4/5 di questa crescita.",
    action:
      "Imporre ogni giorno in TV, stampa e social le 3 proposte bandiera del B.I.P.: 1) Imputabilità a 12 anni, Daspo Urbano e Forze Armate nelle stazioni; 2) Stop Saldo-Acconto per le Partite IVA e tetto al contante a 10.000 €; 3) Mutuo Tricolore azzerato al 3° figlio e priorità italiani nelle case popolari.",
  },
  donor: {
    title: "Delusi FdI/Lega",
    whyHow:
      "Chi governa si logora e perde in media 0,64 punti l’anno (di più durante la Legge di Bilancio). Secondo i flussi, il 56% di chi passa a Futuro Nazionale proviene da FdI (31%) e Lega (25%): il motore calcola quindi che raccogliamo quella quota dei voti persi dal Governo, più l’effetto delle tensioni dentro la maggioranza.",
    action:
      "Attaccare frontalmente il Governo durante la Manovra sulle promesse fiscali e identitarie tradite (tasse, mancato taglio accise, pensioni, sicurezza) e inserirsi in ogni scontro tra Lega e FdI.",
  },
  ground: {
    title: "Tesserati e comitati",
    whyHow:
      "Gli studi sul campo dimostrano che il contatto diretto porta in media 1 voto vero ogni 20 conversazioni. Con i tesserati e i comitati di oggi, calcolando pochi contatti in autunno e molti in primavera, il motore traduce quel lavoro in voti reali sulla base dei validi nazionali.",
    action:
      "Attivare i comitati con banchetti e incontri capillari, spingendo soprattutto nelle 8 Regioni Verdi ad alta affinità di bacino: Lombardia, Veneto, Piemonte, Puglia, Calabria, Friuli-Venezia Giulia, Marche, Abruzzo.",
  },
  magnet: {
    title: "Eletti e ingressi",
    whyHow:
      "I nostri eletti portano un bacino elettorale personale. Il motore calcola che una parte di quel bacino non si sia ancora spostata automaticamente su FN e passi gradualmente in circa sei mesi. Se in Rassegna stampa usi «+ Simula» su un ingresso, quei voti entrano qui.",
    action:
      "Mobilitare i nostri eletti nei rispettivi collegi e chiudere l’ingresso di nuovi parlamentari e amministratori locali in uscita da Lega/FdI (simulabili nella Rassegna stampa).",
  },
  cycle: {
    title: "Calendario politico",
    whyHow:
      "Non tutti i mesi sono uguali. Novembre e dicembre sono mesi di Legge di Bilancio (i TG parlano del Governo); gennaio e febbraio servono a posizionare i quadri; da marzo a maggio entra nel vivo la campagna e torna a votare una parte degli astenuti.",
    action:
      "A novembre-dicembre: opposizione dura sulla Manovra fiscale. In inverno: strutturare i candidati sui territori. In primavera: campagna di mobilitazione degli astenuti.",
  },
  bounds: {
    title: "Soglia di smorzamento e tetto",
    whyHow:
      "Ipotesi di smorzamento sotto una soglia indicativa e tetto soft: frena i cali estremi e limita le proiezioni irrealistiche. Non è un pavimento garantito.",
    action:
      "Trattare la soglia come ipotesi di lavoro, non come zoccolo certo da dichiarare in pubblico.",
  },
};

const PROVENANCE_BADGE: Record<ForecastProvenance, string> = {
  dati: "solo dati",
  misto: "dato + ipotesi",
  ipotesi: "ipotesi",
};

const HORIZON_BADGE: Record<ForecastHorizonKey, string> = {
  d30: "TRA 30 GIORNI",
  d90: "TRA 90 GIORNI",
  d180: "MAGGIO 2027 · 180 GIORNI",
};

export type HeroHorizonOption = {
  key: ForecastHorizonKey;
  label: string;
  pct: number;
};

/** Titolo + KPI strip + grafico full-width + attendibilità */
export function ForecastHeroSplit({
  activeKey,
  horizon,
  offensiveHorizon,
  pollsAlonePct,
  validi,
  projection,
  offensiveProjection,
  history,
  asOf,
  threshold,
  backtest,
  horizonOptions,
  onSelectHorizon,
}: {
  activeKey: ForecastHorizonKey;
  horizon: ForecastHorizonResult;
  offensiveHorizon: ForecastHorizonResult;
  pollsAlonePct?: number;
  validi: number;
  projection: OutlookSample[];
  offensiveProjection?: OutlookSample[];
  history: { isoDate: string; pct: number }[];
  asOf: Date;
  threshold?: number;
  backtest?: ForecastBacktestV4 | null;
  horizonOptions: HeroHorizonOption[];
  onSelectHorizon: (key: ForecastHorizonKey) => void;
  onSelectOffensiva?: () => void;
}) {
  const votes = votesFromDelta(horizon.deltaPp, validi);
  const pollsAlone =
    pollsAlonePct ?? horizon.startPct + factorPp(horizon, "momentum");
  const pollsDelta = pollsAlone - horizon.startPct;
  const offDelta = offensiveHorizon.centralPct - horizon.startPct;
  const votesLabel = formatApproximateVotes(votes, {
    suffix: " voti indicativi (condizionato allo scenario)",
  }).replace(/^\+/, "");
  const deltaPts = formatPuntiSignedIt(horizon.deltaPp, 2).replace(" punti", " pt");
  const bandNote =
    activeKey === "d30"
      ? "variabilità da disaccordo istituti, volatilità e ipotesi (riscontrata su 4/5 confronti preliminari a 30g)"
      : `variabilità da disaccordo istituti, volatilità e ipotesi (non calibrata a ${activeKey === "d90" ? "90" : "180"}g)`;

  return (
    <section className="forecast-hero-split" aria-label="Scenario condizionato in primo piano">
      <div className="forecast-reading-intro">
        <div className="forecast-reading-intro-row">
          <div>
            <span>Panoramica</span>
            <h3>Andamento del consenso</h3>
          </div>
          <div className="forecast-horizon-seg" role="group" aria-label="Seleziona orizzonte">
            {horizonOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                aria-pressed={activeKey === opt.key}
                onClick={() => onSelectHorizon(opt.key)}
              >
                <em>{opt.label}</em>
                <strong>{pct(opt.pct)}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="forecast-metric-current">
        <span>Consenso oggi</span>
        <strong className="forecast-kpi-giant">{pct(horizon.startPct)}</strong>
        <small>Punto di partenza osservato</small>
      </div>

      <div className="forecast-metric-estimate">
        <p className="forecast-eyebrow">Scenario base · {HORIZON_BADGE[activeKey]}</p>
        <p className="forecast-hero-pct-number tabular-nums forecast-kpi-giant">
          {formatDecimalIt(horizon.centralPct, 2)}
          <span>%</span>
        </p>
        <span className="forecast-metric-caption">Stima condizionata alle ipotesi</span>
      </div>

      <div className="forecast-metric-change" data-tone={tone(horizon.deltaPp)}>
        <span>Variazione sullo scenario</span>
        <strong className="forecast-kpi-giant forecast-kpi-delta">{deltaPts}</strong>
        <small>{votesLabel}</small>
      </div>

      <div className="forecast-hero-chart">
        <ForecastOutlookChart
          historyLabel="Supermedia osservata"
          projection={projection}
          offensiveProjection={offensiveProjection}
          horizon={horizon}
          history={history}
          asOf={asOf}
          threshold={threshold}
          pollsAlonePct={pollsAlone}
          compactChrome
        />
      </div>

      <div className="forecast-credibility-strip" aria-label="Attendibilità dello scenario">
        <div>
          <p className="forecast-eyebrow">Confronto scenari</p>
          <p>
            Soli sondaggi: <strong>{pct(pollsAlone)}</strong>{" "}
            <span data-tone={tone(pollsDelta)}>
              ({formatPuntiSignedIt(pollsDelta, 2).replace(" punti", " pt")})
            </span>
          </p>
          <p>
            Offensiva: <strong>{pct(offensiveHorizon.centralPct)}</strong>{" "}
            <span data-tone={tone(offDelta)}>
              ({formatPuntiSignedIt(offDelta, 2).replace(" punti", " pt")})
            </span>
          </p>
        </div>
        <div>
          <p className="forecast-eyebrow">Fascia teorica (80%)</p>
          <p>
            <strong>
              {pct(horizon.lo10Pct)} – {pct(horizon.hi90Pct)}
            </strong>
          </p>
          <p className="forecast-credibility-note">{bandNote}</p>
        </div>
        <div>
          <p className="forecast-eyebrow">Verifica storica (30g)</p>
          {backtest && backtest.n > 0 ? (
            <>
              <p>
                <strong>±{formatDecimalIt(backtest.maeV4, 2)} pt</strong> stima vs{" "}
                <strong>±{formatDecimalIt(backtest.maeFlat, 2)} pt</strong> riferimento
                statico
              </p>
              <p className="forecast-credibility-note">
                su {backtest.n} confronti da luglio; 90/180g non verificabili su storico
              </p>
            </>
          ) : (
            <p className="forecast-credibility-note">
              Verifica a 30 giorni non ancora disponibile su questa serie.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** @deprecated — orizzonti nel segmented control dell&apos;hero */
export function ForecastHorizonTappe({
  baseItems,
  activeKey,
  onSelect,
}: {
  baseItems: { key: ForecastHorizonKey; label: string; horizon: ForecastHorizonResult }[];
  offensiveByKey?: Record<ForecastHorizonKey, ForecastHorizonResult>;
  activeKey: ForecastHorizonKey;
  onSelect: (key: ForecastHorizonKey) => void;
  validi?: number;
}) {
  return (
    <div className="sr-only" role="group" aria-label="Orizzonti">
      {baseItems.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={activeKey === item.key}
          onClick={() => onSelect(item.key)}
        >
          {item.label} {pct(item.horizon.centralPct)}
        </button>
      ))}
    </div>
  );
}

/** @deprecated — assorbito nella strip di attendibilità */
export function ForecastKeyMessage(_props: {
  startPct: number;
  momentumPp: number;
  mayBase: ForecastHorizonResult;
  mayOffensiva: ForecastHorizonResult;
  workPp?: number;
}) {
  return null;
}

/** @deprecated Prefer ForecastHeroSplit — kept for residual imports. */
export function ForecastTrajectoryBlock(props: {
  horizon: ForecastHorizonResult;
  projection: OutlookSample[];
  offensiveProjection?: OutlookSample[];
  history: { isoDate: string; pct: number }[];
  asOf: Date;
  threshold?: number;
}) {
  return (
    <ForecastOutlookChart
      historyLabel="Supermedia osservata"
      projection={props.projection}
      offensiveProjection={props.offensiveProjection}
      horizon={props.horizon}
      history={props.history}
      asOf={props.asOf}
      threshold={props.threshold}
      compactChrome
    />
  );
}

function scenarioShortLabel(id: ForecastScenarioResult["id"]): string {
  if (id === "passivo") return "Passivo";
  if (id === "offensiva") return "Offensiva";
  return "Base";
}

/** Zona A · Controlli di simulazione aperti in cima alla tab 02 */
export function ForecastSimControlBar({
  scenarios,
  activeScenario,
  onSelectScenario,
  networkDelta,
  onNetworkDeltaChange,
  diagnostics,
  groundPp,
  simulatedProfiles,
  verdeGains,
  capacityNotes,
}: {
  scenarios: ForecastScenarioResult[];
  activeScenario: ForecastScenarioResult["id"];
  onSelectScenario: (id: ForecastScenarioResult["id"]) => void;
  networkDelta: ForecastNetworkDelta;
  onNetworkDeltaChange: (next: ForecastNetworkDelta) => void;
  diagnostics: ForecastDiagnostics;
  groundPp: number;
  simulatedProfiles: number;
  verdeGains: VerdeGainRow[];
  capacityNotes?: Array<{ label: string; feasible: boolean }>;
}) {
  return (
    <section className="forecast-sim-control-bar" aria-label="Controlli di simulazione">
      <div className="forecast-sim-control-col" data-col="regime">
        <p className="forecast-eyebrow">Scelta regime operativo</p>
        <div className="forecast-regime-pills" role="group" aria-label="Regime operativo">
          {scenarios.map((sc) => {
            const may = sc.horizons[2]!;
            return (
              <button
                key={sc.id}
                type="button"
                className="forecast-regime-pill"
                aria-pressed={activeScenario === sc.id}
                onClick={() => onSelectScenario(sc.id)}
              >
                <strong>
                  {scenarioShortLabel(sc.id)} ({pct(may.centralPct)})
                </strong>
                <span>
                  {pct(sc.horizons[0]!.centralPct)} → {pct(sc.horizons[1]!.centralPct)} →{" "}
                  {pct(may.centralPct)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="forecast-regime-hint">Progressione 30g → 90g → Maggio</p>
        {activeScenario === "offensiva" && verdeGains.length > 0 ? (
          <ul className="forecast-regime-verde" aria-label="Voti indicativi Regioni Verdi">
            {verdeGains.slice(0, 4).map((g) => (
              <li key={g.regione}>
                <span>{g.regione}</span>
                <em>
                  {formatApproximateVotes(g.extraVotes, { suffix: " voti" })} · {pct(g.centralPct)}
                </em>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="forecast-sim-control-col" data-col="network">
        <p className="forecast-eyebrow">Simulatore rete territoriale (What-If)</p>
        <ForecastNetworkWhatIf
          value={networkDelta}
          onChange={onNetworkDeltaChange}
          baseTesserati={diagnostics.tesserati - networkDelta.tesserati}
          baseComitati={diagnostics.comitati - networkDelta.comitati}
          groundPp={groundPp}
          simulatedProfiles={simulatedProfiles}
          stacked
          capacityNotes={capacityNotes}
        />
      </div>
    </section>
  );
}

/** Tabella unica a 7 fattori con fisarmonica */
export function ForecastFactorsUnifiedTable({
  h30,
  h90,
  h180,
}: {
  h30: ForecastHorizonResult;
  h90: ForecastHorizonResult;
  h180: ForecastHorizonResult;
}) {
  const startPct = h180.startPct;
  const maxAbs = useMemo(() => {
    let m = 0.01;
    for (const id of FORECAST_FACTOR_ORDER) {
      m = Math.max(m, Math.abs(factorPp(h180, id)));
    }
    return m;
  }, [h180]);

  return (
    <section className="forecast-factors-unified" aria-label="Sette leve di spinta">
      <div className="forecast-section-heading">
        <div>
          <p className="forecast-eyebrow">SETTE LEVE DI SPINTA</p>
          <h3>Contributi additivi · clicca una riga per il dettaglio</h3>
        </div>
      </div>
      <div className="forecast-factors-quadratura" aria-label="Quadratura dello scenario">
        <p>
          Consenso oggi ({pct(startPct)}) + Somma dei 7 fattori (
          {formatPpSignedIt(h180.deltaPp, 2)}) = Scenario Maggio 2027 ({pct(h180.centralPct)})
        </p>
        <ul>
          <li>
            <span>30g</span>
            <em>{pct(h30.centralPct)}</em>
          </li>
          <li>
            <span>90g</span>
            <em>{pct(h90.centralPct)}</em>
          </li>
          <li>
            <span>Mag &apos;27</span>
            <em>{pct(h180.centralPct)}</em>
          </li>
        </ul>
      </div>
      <div className="forecast-factor-waterfall forecast-factors-table">
        <div className="forecast-waterfall-heading">
          <span>7 VOCI · − / 0 / +</span>
          <span>30g · 90g · MAGGIO</span>
        </div>
        {FORECAST_FACTOR_ORDER.map((id, index) => {
          const meta = VOICE_ACTIONS[id];
          const row = h180.factors.find((f) => f.id === id);
          const pp30 = factorPp(h30, id);
          const pp90 = factorPp(h90, id);
          const pp180 = factorPp(h180, id);
          const provenance = row?.provenance ?? "ipotesi";
          const explanation = row?.plain?.trim() || meta.whyHow;
          const n = String(index + 1).padStart(2, "0");
          return (
            <details className="forecast-factor-detail" key={id} data-tone={tone(pp180)}>
              <summary className="forecast-factor-row">
                <div className="forecast-factor-copy">
                  <strong>
                    <span className="forecast-factor-index">{n}</span>
                    {meta.title}
                  </strong>
                  <span className={`forecast-provenance is-${provenance}`}>
                    {PROVENANCE_BADGE[provenance]}
                  </span>
                </div>
                <div className="forecast-diverging-track" aria-hidden="true">
                  <i />
                  <span
                    style={{
                      left: pp180 < 0 ? `${50 - (Math.abs(pp180) / maxAbs) * 48}%` : "50%",
                      width: `${(Math.abs(pp180) / maxAbs) * 48}%`,
                    }}
                  />
                </div>
                <ul className="forecast-factor-horizon-vals" aria-label="Contributo per orizzonte">
                  <li>
                    <span>30g</span>
                    <em data-tone={tone(pp30)}>{formatPpSignedIt(pp30, 2)}</em>
                  </li>
                  <li>
                    <span>90g</span>
                    <em data-tone={tone(pp90)}>{formatPpSignedIt(pp90, 2)}</em>
                  </li>
                  <li>
                    <span>Mag</span>
                    <em data-tone={tone(pp180)}>{formatPpSignedIt(pp180, 2)}</em>
                  </li>
                </ul>
              </summary>
              <div className="forecast-factor-explanation forecast-receipt-answers">
                <div>
                  <p className="forecast-eyebrow">1 · Come entra nello scenario</p>
                  <p>{explanation}</p>
                </div>
                <div>
                  <p className="forecast-eyebrow">2 · Azioni operative associate</p>
                  <p>{meta.action}</p>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

/** Bozza editoriale — riquadro compatto per la tab 01 */
export function ForecastEditorialCopy({
  startPct,
  mayHorizon,
  attackStatement,
}: {
  startPct: number;
  mayHorizon: ForecastHorizonResult;
  attackStatement: string;
}) {
  const [copied, setCopied] = useState<"consenso" | "attacco" | null>(null);
  const pollsAlone =
    startPct + (mayHorizon.factors.find((f) => f.id === "momentum")?.pp ?? 0);
  const consensoText = `Oggi i sondaggi ci collocano al ${pct(startPct)} (con una tendenza inerziale intorno al ${pct(pollsAlone)}). Il nostro scenario di lavoro punta all'area del ${pct(mayHorizon.centralPct)} per maggio 2027, dentro una fascia di variabilità ampia (${pct(mayHorizon.lo10Pct)} – ${pct(mayHorizon.hi90Pct)}): non è una promessa automatica né un sondaggio, ma un obiettivo condizionato alla nostra capacità di incidere sui temi economici, sulla sicurezza e sul radicamento territoriale.`;

  async function copy(kind: "consenso" | "attacco", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="forecast-editorial-copy" aria-label="Bozza editoriale per la comunicazione">
      <div className="forecast-section-heading">
        <div>
          <p className="forecast-eyebrow">BOZZA EDITORIALE PER LA COMUNICAZIONE</p>
          <h3>Testi pronti da copiare</h3>
        </div>
      </div>
      <div className="forecast-declare-grid">
        <article className="forecast-declare-card">
          <p className="forecast-eyebrow">Sul consenso previsto</p>
          <p>{consensoText}</p>
          <button type="button" onClick={() => void copy("consenso", consensoText)}>
            {copied === "consenso" ? "Copiato ✓" : "Copia testo"}
          </button>
        </article>
        <article className="forecast-declare-card">
          <p className="forecast-eyebrow">Attacco sulla Manovra · piazze</p>
          <p>{attackStatement}</p>
          <button type="button" onClick={() => void copy("attacco", attackStatement)}>
            {copied === "attacco" ? "Copiato ✓" : "Copia testo"}
          </button>
        </article>
      </div>
    </section>
  );
}

/** Sidebar compatta riquadro 02 */
export function ForecastSidebarCompact({
  startPct,
  h30,
  h90,
  h180,
  off180,
  onOpen,
}: {
  startPct: number;
  h30: ForecastHorizonResult;
  h90: ForecastHorizonResult;
  h180: ForecastHorizonResult;
  off180: ForecastHorizonResult;
  onOpen: () => void;
}) {
  const momentumPp = factorPp(h180, "momentum");
  const workPp = h180.deltaPp - momentumPp;
  return (
    <div className="forecast-sidebar-compact">
      <div className="mb-2 grid grid-cols-2 gap-2" title={`Oggi ${pct(startPct)}`}>
        <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-1.5 font-mono text-[11px] tabular-nums text-[var(--ink-secondary)]">
          Base Mag &apos;27
          <strong className="mt-0.5 block text-[13px] text-[var(--ink-primary)]">
            {pct(h180.centralPct)}
          </strong>
        </p>
        <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-1.5 font-mono text-[11px] tabular-nums text-[var(--ink-secondary)]">
          Offensiva
          <strong className="mt-0.5 block text-[13px] text-[var(--ink-primary)]">
            {pct(off180.centralPct)}
          </strong>
        </p>
      </div>
      <p className="forecast-sidebar-sub">
        Tendenza dai soli sondaggi: {formatPuntiSignedIt(momentumPp, 2)}. Il resto (
        {formatPuntiSignedIt(workPp, 2)}) è scenario condizionato a ipotesi sul lavoro
        politico (effetto non automatico).
      </p>
      <ul className="forecast-sidebar-tappe">
        {(
          [
            ["30g", h30],
            ["90g", h90],
            ["Mag ’27", h180],
          ] as const
        ).map(([label, h]) => (
          <li key={label}>
            <span>{label}</span>
            <strong>{pct(h.centralPct)}</strong>
            <em data-tone={tone(h.deltaPp)}>{formatPpSignedIt(h.deltaPp, 2)}</em>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="forecast-analyze-button h-9 w-full rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-[12px] font-medium text-emerald-300 hover:bg-emerald-500/15 light:text-emerald-700"
        onClick={onOpen}
      >
        <span>Apri previsione completa</span>
        <span aria-hidden>↗</span>
      </button>
    </div>
  );
}
