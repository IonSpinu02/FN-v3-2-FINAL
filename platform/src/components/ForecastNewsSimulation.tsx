"use client";

import { useMemo, useState } from "react";
import { analyzeNationalNews, simulateNationalEvent } from "@/lib/engine/nationalNewsSignals";
import type { buildNationalConsensusForecast } from "@/lib/engine/nationalConsensusForecast";
import type { GrowthEvidence } from "@/lib/engine/growthTrajectory";
import { niceScale, smoothPath } from "@/lib/chartGeometry";
import { formatDecimalIt, formatPpSignedIt } from "@/lib/formatIt";

const dateAt = (asOf: Date, days: number) =>
  new Date(asOf.getTime() + days * 86400000).toISOString().slice(0, 10);

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Rome",
  });

export function ForecastNewsSimulation({
  model,
  evidence,
  asOf,
  days,
  compactChrome = false,
}: {
  model: ReturnType<typeof buildNationalConsensusForecast>;
  evidence: GrowthEvidence;
  asOf: Date;
  days: number;
  compactChrome?: boolean;
}) {
  const today = dateAt(asOf, 0);
  const end = dateAt(asOf, days);
  const signals = useMemo(
    () =>
      analyzeNationalNews(
        evidence.forecastNews ?? evidence.newsItems ?? [],
        model.eventModel.events,
        today,
      ),
    [evidence.forecastNews, evidence.newsItems, model.eventModel.events, today],
  );
  const events = model.eventModel.events.filter(
    (e) => e.status !== "cancelled" && e.date >= today && e.date <= end,
  );
  const choices = [
    ...events.map((e) => ({
      id: `event:${e.id}`,
      label: `${e.title} · ${shortDate(e.date)}`,
      date: e.date,
      kind: "evento" as const,
    })),
    ...signals.map((n) => ({
      id: `news:${n.id}`,
      label: n.title.length > 72 ? `${n.title.slice(0, 69)}…` : n.title,
      date: n.futureDate,
      kind: "notizia" as const,
    })),
    {
      id: "manual",
      label: "Ipotesi esplorativa senza evento selezionato",
      date: null as string | null,
      kind: "ipotesi" as const,
    },
  ];
  const [selection, setSelection] = useState("");
  const selected = choices.find((c) => c.id === selection) ?? choices[0];
  const [dateOverride, setDateOverride] = useState("");
  const eventDate =
    dateOverride >= today && dateOverride <= end
      ? dateOverride
      : selected.date && selected.date >= today && selected.date <= end
        ? selected.date
        : dateAt(asOf, Math.min(7, days));
  const eventDay = Math.round(
    (Date.parse(`${eventDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000,
  );
  const [amplitude, setAmplitude] = useState(0.25);
  const [rise, setRise] = useState(7);
  const [decay, setDecay] = useState(30);
  const simulation = useMemo(
    () =>
      simulateNationalEvent({
        horizonDays: days,
        eventDay,
        amplitudePp: amplitude,
        riseDays: rise,
        decayDays: decay,
        baseline: (d) => model.horizon(d).centralPct,
      }),
    [days, eventDay, amplitude, rise, decay, model],
  );
  const peakDay = Math.max(
    0,
    Math.min(days, Math.round(simulation.peakDay)),
  );
  const peakPoint =
    simulation.points.find((p) => p.day === peakDay) ??
    simulation.points[Math.min(simulation.points.length - 1, peakDay)] ??
    simulation.final;
  const peakIso = dateAt(asOf, peakDay);
  const scale = niceScale(
    simulation.points.flatMap((p) => [p.down, p.up]),
    0.5,
  );
  const x = (day: number) => 44 + (day / Math.max(1, days)) * 490;
  const y = (value: number) => 164 - ((value - scale.min) / (scale.max - scale.min || 1)) * 120;
  const paths = [
    { key: "up" as const, label: "Ipotesi aumento", color: "var(--forecast-positive)" },
    {
      key: "central" as const,
      label: "Riferimento statico odierno",
      color: "var(--forecast-accent)",
    },
    { key: "down" as const, label: "Ipotesi calo", color: "var(--forecast-negative)" },
  ];
  const meta = evidence.forecastNewsMeta;
  const status =
    meta?.status === "live"
      ? "Scansione acquisita"
      : meta?.status === "cache"
        ? "Cache giornaliera"
        : meta?.status === "stale"
          ? "Fonte non aggiornata"
          : meta?.status === "disabled"
            ? "Ricerca non configurata"
            : "Notizie non disponibili";

  return (
    <section className="forecast-detail-view forecast-news-simulation">
      {!compactChrome ? (
        <>
          <div className="forecast-section-heading">
            <div>
              <p className="forecast-eyebrow">NOTIZIE / IPOTESI / SENSIBILITÀ</p>
              <h3>Simula impatto notizia</h3>
            </div>
            <span>{signals.length} fonti</span>
          </div>
          <div className="forecast-news-status">
            <span>{status}</span>
            {meta?.fetchedAt ? (
              <time dateTime={meta.fetchedAt}>
                {new Date(meta.fetchedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}
              </time>
            ) : null}
          </div>
        </>
      ) : null}
      <section className="forecast-simulation-box">
        <p className="forecast-detail-context">
          La curva parte dal <strong>riferimento statico odierno</strong> (
          {formatDecimalIt(model.horizon(0).centralPct, 2)}%), a parità di altre condizioni — non
          dallo scenario base condizionato del report. Ampiezza e durata sono ipotesi manuali. I
          numeri sotto mostrano il <strong>picco</strong> e il residuo a fine orizzonte.
        </p>
        <div className="forecast-simulation-workspace">
          <div>
            <div className="forecast-simulation-controls">
              <label className="forecast-simulation-source">
                Notizia o evento
                <select
                  value={selected.id}
                  onChange={(e) => {
                    setSelection(e.target.value);
                    setDateOverride("");
                  }}
                >
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data scenario
                <input
                  type="date"
                  value={eventDate}
                  min={today}
                  max={end}
                  onChange={(e) => setDateOverride(e.target.value)}
                />
              </label>
              <label>
                Ampiezza (± punti percentuali)
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.05"
                  value={amplitude}
                  onChange={(e) =>
                    setAmplitude(Math.min(5, Math.max(0, Number(e.target.value) || 0)))
                  }
                />
              </label>
              <label>
                Sviluppo (gg)
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={rise}
                  onChange={(e) =>
                    setRise(Math.min(90, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </label>
              <label>
                Riassorbimento (gg)
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={decay}
                  onChange={(e) =>
                    setDecay(Math.min(180, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </label>
            </div>
          </div>
          <div>
            <svg
              viewBox="0 0 590 207"
              className="forecast-simulation-chart"
              role="img"
              aria-label={`Simulazione: picco ±${formatDecimalIt(amplitude, 2)} punti percentuali dal ${eventDate}`}
            >
              <title>Sensibilità a uno shock ipotetico</title>
              {scale.ticks.map((t) => (
                <g key={t}>
                  <line
                    x1="44"
                    x2="534"
                    y1={y(t)}
                    y2={y(t)}
                    stroke="var(--forecast-line)"
                    strokeWidth=".5"
                    strokeDasharray="2 4"
                  />
                  <text x="35" y={y(t) + 3} textAnchor="end" className="forecast-outlook-axis">
                    {formatDecimalIt(t, scale.decimals)}%
                  </text>
                </g>
              ))}
              <line
                x1={x(eventDay)}
                x2={x(eventDay)}
                y1="30"
                y2="169"
                stroke="var(--forecast-muted)"
                strokeWidth=".8"
                strokeDasharray="3 4"
              />
              <line
                x1={x(peakDay)}
                x2={x(peakDay)}
                y1="30"
                y2="169"
                stroke="var(--forecast-accent)"
                strokeWidth=".6"
                strokeDasharray="2 3"
                opacity=".7"
              />
              {paths.map((path) => (
                <path
                  key={path.key}
                  d={smoothPath(
                    simulation.points.map((p) => ({ x: x(p.day), y: y(p[path.key]) })),
                  )}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={path.key === "central" ? 1.8 : 2}
                  strokeDasharray={path.key === "central" ? "4 4" : undefined}
                />
              ))}
              <text x="44" y="190" className="forecast-outlook-axis">
                OGGI · {today}
              </text>
              <text x="534" y="190" textAnchor="end" className="forecast-outlook-axis">
                {end}
              </text>
            </svg>
            <div className="forecast-simulation-results">
              {paths.map((p) => {
                const peakVal = peakPoint[p.key];
                const finalVal = simulation.final[p.key];
                const peakDelta = peakVal - peakPoint.central;
                const residual = finalVal - simulation.final.central;
                return (
                  <div key={p.key} style={{ color: p.color }}>
                    <span>{p.label}</span>
                    <strong>{formatDecimalIt(peakVal, 2)}%</strong>
                    <small>
                      Picco {shortDate(peakIso)}: {formatPpSignedIt(peakDelta, 2)}
                      <br />
                      Residuo a fine: {formatPpSignedIt(residual, 2)}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
