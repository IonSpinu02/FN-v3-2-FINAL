"use client";

import "./forecast-predictive.css";

import { niceScale, smoothPath } from "@/lib/chartGeometry";
import { useId, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import type { ForecastHorizonKey, ForecastHorizonResult } from "@/lib/engine/forecastEngineV4";
import { formatDecimalIt, formatPpSignedIt } from "@/lib/formatIt";

const pct = (v: number) => `${formatDecimalIt(v, 2)}%`;
const tone = (v: number) => v > 0 ? "positive" : v < 0 ? "negative" : "neutral";

export function ForecastHorizonControl({ value, onChange }: {
  value: ForecastHorizonKey;
  onChange: (key: ForecastHorizonKey) => void;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const options = [{ key: "d30", label: "30G" }, { key: "d90", label: "90G" }, { key: "d180", label: "180G · MAG ’27" }] as const;
  return (
    <LayoutGroup id={id}>
      <div className="forecast-segments" role="group" aria-label="Orizzonte della previsione">
        {options.map((option, index) => (
          <button key={option.key} type="button" aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
              onChange(options[next].key);
              (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
            }}>
            {value === option.key && <motion.span className="forecast-horizon-pill" layoutId="forecast-horizon-pill"
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 36 }} />}
            <span className="relative">{option.label}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}

/** Observations are never interpolated into invented historical data. The future fan
 * widens schematically to the model's actual horizon quantiles, not new MC samples. */
export function ForecastFanChart({ horizon: h, history, asOf }: {
  horizon: ForecastHorizonResult;
  history: { isoDate: string; pct: number }[];
  asOf: Date;
}) {
  const now = asOf.getTime();
  const points = history.filter(p => Number.isFinite(p.pct) && Number.isFinite(Date.parse(p.isoDate)) && Date.parse(p.isoDate) <= now)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate)).slice(-8);
  const min = Math.min(h.centralPct, h.startPct, ...points.map(p => p.pct)) - .2;
  const max = Math.max(h.centralPct, h.startPct, ...points.map(p => p.pct)) + .2;
  const y = (v: number) => 51 - (v - min) / (max - min || 1) * 40;
  const todayX = 93;
  const earliest = points.length ? Date.parse(points[0].isoDate) : now - 86400000;
  const x = (date: string) => 5 + (Date.parse(date) - earliest) / Math.max(86400000, now - earliest) * (todayX - 5);
  const historical = points.map(p => `${x(p.isoDate)},${y(p.pct)}`).join(" ");
  return (
    <svg viewBox="0 0 240 68" className="forecast-fan" role="img"
      aria-label={`Storico osservato e proiezione ${h.label}: ${pct(h.centralPct)}`}>
      <title>Storico osservato · oggi · proiezione del modello</title>
      <desc>Lo storico mostra i dati osservati; il punto oggi è il livello iniziale del modello.</desc>
      {[18, 35, 51].map(v => <line key={v} x1="4" x2="235" y1={v} y2={v} stroke="var(--forecast-line)" strokeWidth=".5" />)}
      {points.length > 0 && <polyline points={historical} fill="none" stroke="var(--forecast-muted)" strokeWidth="1.6" strokeLinejoin="round" />}
      {points.map(p => <circle key={p.isoDate} cx={x(p.isoDate)} cy={y(p.pct)} r="1.7" fill="var(--forecast-muted)"><title>{`${p.isoDate}: ${pct(p.pct)}`}</title></circle>)}
      <line x1={todayX} x2={todayX} y1="5" y2="54" stroke="var(--forecast-muted)" strokeDasharray="2 3" strokeWidth=".7" />
      <path d={`M${todayX},${y(h.startPct)} L232,${y(h.centralPct)}`} fill="none" stroke="var(--forecast-accent)" strokeWidth="1.7" strokeDasharray="3 3" />
      <circle className="forecast-now-pulse" cx={todayX} cy={y(h.startPct)} r="5" fill="var(--forecast-accent)" opacity=".2" />
      <circle cx={todayX} cy={y(h.startPct)} r="2.5" fill="var(--forecast-accent)" />
      <circle cx="232" cy={y(h.centralPct)} r="2.5" fill="var(--forecast-accent)" />
      <text x="4" y="65" className="forecast-svg-label">STORICO</text>
      <text x={todayX} y="65" textAnchor="middle" className="forecast-svg-label">OGGI</text>
      <text x="235" y="65" textAnchor="end" className="forecast-svg-label">+{h.days}G</text>
    </svg>
  );
}

export type OutlookSample = {
  days: number;
  centralPct: number;
  lo10Pct: number;
  hi90Pct: number;
  cyclePp: number;
  calendarLabel: string;
};

function areaUnderCurve(
  linePoints: { x: number; y: number }[],
  baselineY: number,
): string {
  if (linePoints.length < 2) return "";
  const line = smoothPath(linePoints);
  const first = linePoints[0]!;
  const last = linePoints[linePoints.length - 1]!;
  return `${line} L${last.x.toFixed(1)},${baselineY.toFixed(1)} L${first.x.toFixed(1)},${baselineY.toFixed(1)} Z`;
}

function ribbonPath(upper: { x: number; y: number }[], lower: { x: number; y: number }[]): string {
  if (upper.length < 2 || lower.length < 2) return "";
  const back = smoothPath([...lower].reverse()).replace(/^M/, "L");
  return `${smoothPath(upper)} ${back} Z`;
}

/** Expanded report chart; a single time scale and endpoint quantiles replace
 * the separate mini-chart and bullet ruler. Intermediate band is schematic. */
export function ForecastOutlookChart({
  horizon: h,
  history,
  asOf,
  threshold,
  projection,
  offensiveProjection,
  inertialProjection,
  pollsAlonePct,
  historyLabel = "Supermedia osservata",
  compactChrome = false,
  hideHeading = false,
  markerDay,
  onSelectDay,
}: {
  historyLabel?: string;
  projection: OutlookSample[];
  offensiveProjection?: OutlookSample[];
  /** Traiettoria passiva/inerziale, disegnata insieme a Base e Offensiva. */
  inertialProjection?: OutlookSample[];
  horizon: ForecastHorizonResult;
  history: { isoDate: string; pct: number }[];
  asOf: Date;
  threshold?: number;
  /** Tendenza inerziale dai soli sondaggi (linea tratteggiata neutra). */
  pollsAlonePct?: number;
  /** Una sola barra header (titolo + legenda) senza titoli duplicati. */
  compactChrome?: boolean;
  /** Nasconde l'header interno quando la card ospite ha già titolo e legenda. */
  hideHeading?: boolean;
  /** Giorno della tappa attiva, evidenziato senza troncare la rotta fino a maggio. */
  markerDay?: number;
  /** Click su un nodo +30 / +90 / +180. */
  onSelectDay?: (days: number) => void;
}) {
  const gradId = useId().replace(/:/g, "");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const day = 86400000;
  const now = asOf.getTime();
  const days = Math.max(1, h.days);
  const historyDays = Math.min(days, 60);
  const start = now - historyDays * day;
  const points = history
    .filter(
      (p) =>
        Number.isFinite(p.pct) &&
        Date.parse(p.isoDate) >= start &&
        Date.parse(p.isoDate) <= now,
    )
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  const offensiveEnd =
    offensiveProjection?.[offensiveProjection.length - 1]?.centralPct ?? null;
  const scale = niceScale(
    [
      h.startPct,
      ...(threshold == null ? [] : [threshold]),
      ...(pollsAlonePct == null ? [] : [pollsAlonePct]),
      ...projection.flatMap((p) => [
        p.centralPct,
        p.centralPct + (p.lo10Pct - p.centralPct) * 0.35,
        p.centralPct + (p.hi90Pct - p.centralPct) * 0.35,
      ]),
      ...(offensiveProjection ?? []).map((p) => p.centralPct),
      ...(inertialProjection ?? []).map((p) => p.centralPct),
      ...points.map((p) => p.pct),
    ],
    2,
  );
  const plotLeft = hideHeading ? 42 : 40;
  const plotRight = hideHeading ? 104 : 96;
  const plotTop = hideHeading ? 18 : 28;
  const plotBottom = hideHeading ? 26 : 42;
  const vbW = hideHeading ? 960 : 720;
  const vbH = hideHeading ? 188 : 290;
  const plotW = vbW - plotLeft - plotRight;
  const plotH = vbH - plotTop - plotBottom;
  const y = (v: number) =>
    plotTop + plotH - ((v - scale.min) / (scale.max - scale.min || 1)) * plotH;
  const x = (time: number) =>
    plotLeft + ((time - start) / ((historyDays + days) * day)) * plotW;
  const todayX = x(now);
  const endX = x(now + days * day);
  const date = (time: number) =>
    new Date(time).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Rome",
    });
  const linePoints = projection.map((p) => ({
    x: x(now + p.days * day),
    y: y(p.centralPct),
  }));
  const offensivePoints = (offensiveProjection ?? []).map((p) => ({
    x: x(now + p.days * day),
    y: y(p.centralPct),
  }));
  const inertialPoints = (inertialProjection ?? []).map((p) => ({
    x: x(now + p.days * day),
    y: y(p.centralPct),
  }));
  const markerX = markerDay != null && markerDay >= 0 ? x(now + markerDay * day) : null;
  const markerSample =
    markerDay == null
      ? null
      : projection.reduce<OutlookSample | null>((best, sample) => {
          if (!best) return sample;
          return Math.abs(sample.days - markerDay) < Math.abs(best.days - markerDay) ? sample : best;
        }, null);
  const markerY = markerSample ? y(markerSample.centralPct) : y(h.centralPct);
  const historyPoints = points.map((p) => ({
    x: x(Date.parse(p.isoDate)),
    y: y(p.pct),
  }));
  const baselineY = y(h.startPct);
  const candidates = [
    ...points.map((p) => ({
      key: p.isoDate,
      x: x(Date.parse(p.isoDate)),
      y: y(p.pct),
      value: p.pct,
      label: date(Date.parse(p.isoDate)),
      type: "Osservato",
      calendar: historyLabel,
    })),
    ...projection.map((p) => ({
      key: `future-${p.days}`,
      x: x(now + p.days * day),
      y: y(p.centralPct),
      value: p.centralPct,
      label: p.days ? date(now + p.days * day) : "Oggi",
      type: p.days ? "Proiezione condizionata" : "Livello iniziale",
      calendar:
        p.days && p.calendarLabel
          ? p.calendarLabel
          : "",
    })),
  ];
  const active = candidates.find((p) => p.key === activeKey);
  // Un solo asse X: marker mensili senza seconda riga di date
  const monthMarkers = projection.filter(
    (p) =>
      p.calendarLabel &&
      p.days > 0 &&
      new Date(now + p.days * day).getUTCDate() === 1,
  );
  const baseEndY = y(h.centralPct);
  const offensiveEndY = offensiveEnd != null ? y(offensiveEnd) : null;
  let stimaLabelY = baseEndY;
  let offensivaLabelY = offensiveEndY;
  if (offensiveEndY != null && Math.abs(offensiveEndY - baseEndY) < 34) {
    const mid = (offensiveEndY + baseEndY) / 2;
    offensivaLabelY = mid - 18;
    stimaLabelY = mid + 18;
  }
  return (
    <section
      className={`forecast-outlook${compactChrome ? " is-compact-chrome" : ""}`}
      aria-label="Traiettoria del consenso e incertezza"
    >
      {!hideHeading ? (
        <div className="forecast-outlook-heading">
          <h3>
            {compactChrome ? "Traiettoria fino a maggio" : "Traiettoria del consenso"}
          </h3>
          <span>
            {compactChrome
              ? `Continua = regime attivo · Verde = Offensiva · Grigia = Inerziale · +${h.days}G`
              : `ORIZZONTE +${h.days}G`}
          </span>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        role="group"
        className="forecast-outlook-svg"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const cursorX = ((event.clientX - rect.left) / rect.width) * vbW;
          const nearest = candidates.reduce((a, b) =>
            Math.abs(a.x - cursorX) < Math.abs(b.x - cursorX) ? a : b,
          );
          setActiveKey(nearest.key);
        }}
        onPointerLeave={() => setActiveKey(null)}
        aria-label={`Previsione ${pct(h.centralPct)}${offensiveEnd != null ? `; tetto offensiva ${pct(offensiveEnd)}` : ""}`}
      >
        <defs>
          <filter id={`forecast-node-${gradId}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`forecast-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--forecast-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--forecast-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <title>Storico osservato, corridoio di crescita e tetto offensiva</title>
        {scale.ticks.map((v) => (
          <g key={v}>
            <line
              x1={plotLeft}
              x2={endX}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--forecast-line)"
              strokeWidth=".5"
              strokeDasharray="2 5"
            />
            <text
              x={plotLeft - 9}
              y={y(v) + 3}
              textAnchor="end"
              className="forecast-outlook-axis"
            >
              {formatDecimalIt(v, scale.decimals)}%
            </text>
          </g>
        ))}
        {!hideHeading ? (
          <>
            <text x={plotLeft} y="16" className="forecast-outlook-axis">
              STORICO
            </text>
            <text x={endX} y="16" textAnchor="end" className="forecast-outlook-axis">
              PREVISIONE
            </text>
          </>
        ) : null}
        {pollsAlonePct != null ? (
          <g>
            <line
              x1={todayX}
              x2={endX}
              y1={y(pollsAlonePct)}
              y2={y(pollsAlonePct)}
              stroke="var(--forecast-muted)"
              strokeDasharray="3 4"
              strokeWidth="1.1"
              opacity=".85"
            />
            <text
              x={endX + 8}
              y={y(pollsAlonePct) + 3}
              className="forecast-outlook-end-label"
            >
              SONDAGGI {pct(pollsAlonePct)}
            </text>
          </g>
        ) : null}
        {threshold != null && (
          <line
            x1={plotLeft}
            x2={endX}
            y1={y(threshold)}
            y2={y(threshold)}
            stroke="var(--forecast-threshold)"
            strokeDasharray="2 5"
            strokeWidth=".8"
            opacity=".7"
          />
        )}
        {points.length > 0 && (
          <path
            d={smoothPath(historyPoints)}
            fill="none"
            stroke="var(--forecast-muted)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}
        {points.map((p) => (
          <circle
            key={p.isoDate}
            cx={x(Date.parse(p.isoDate))}
            cy={y(p.pct)}
            r="2.6"
            fill="var(--forecast-bg)"
            stroke="var(--forecast-muted)"
            strokeWidth="1.5"
          >
            <title>{`${date(Date.parse(p.isoDate))}: ${pct(p.pct)}`}</title>
          </circle>
        ))}
        <line
          x1={todayX}
          x2={todayX}
          y1={plotTop}
          y2={plotTop + plotH}
          stroke="var(--forecast-muted)"
          strokeDasharray="3 5"
          strokeWidth=".8"
        />
        {linePoints.length > 1 ? (
          <path
            d={areaUnderCurve(linePoints, baselineY)}
            fill={`url(#forecast-fill-${gradId})`}
            stroke="none"
          />
        ) : null}
        {projection.length > 2 ? (
          <path
            d={ribbonPath(
              projection.map((sample) => ({
                x: x(now + sample.days * day),
                y: y(sample.centralPct + (sample.hi90Pct - sample.centralPct) * 0.35),
              })),
              projection.map((sample) => ({
                x: x(now + sample.days * day),
                y: y(sample.centralPct + (sample.lo10Pct - sample.centralPct) * 0.35),
              })),
            )}
            fill="var(--forecast-accent)"
            opacity="0.14"
            stroke="none"
          >
            <title>Fascia indicativa intorno alla stima del regime attivo</title>
          </path>
        ) : null}
        {inertialPoints.length > 1 ? (
          <path
            d={smoothPath(inertialPoints)}
            stroke="var(--forecast-muted)"
            strokeWidth="1.3"
            strokeDasharray="5 4"
            strokeLinecap="round"
            fill="none"
            opacity=".9"
          />
        ) : null}
        {offensivePoints.length > 1 ? (
          <path
            d={smoothPath(offensivePoints)}
            stroke="var(--forecast-positive)"
            strokeWidth="1.4"
            strokeDasharray="2 3"
            strokeLinecap="round"
            fill="none"
            opacity=".85"
          />
        ) : null}
        <path
          d={smoothPath(linePoints)}
          stroke="var(--forecast-accent)"
          strokeWidth="2.3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={todayX} cy={y(h.startPct)} r="3.2" fill="var(--forecast-accent)" />
        <path d={`M${endX},${baseEndY} h24`} stroke="var(--forecast-accent)" strokeWidth=".8" />
        {offensiveEnd != null &&
        offensivaLabelY != null &&
        Math.abs(offensivaLabelY - y(offensiveEnd)) > 1 ? (
          <path
            d={`M${endX},${y(offensiveEnd)} L${endX + 18},${offensivaLabelY + 4}`}
            stroke="var(--forecast-positive)"
            strokeWidth=".7"
            fill="none"
            opacity=".7"
          />
        ) : null}
        {Math.abs(stimaLabelY - baseEndY) > 1 ? (
          <path
            d={`M${endX},${baseEndY} L${endX + 18},${stimaLabelY + 4}`}
            stroke="var(--forecast-accent)"
            strokeWidth=".7"
            fill="none"
            opacity=".7"
          />
        ) : null}
        <text x={endX + 29} y={stimaLabelY - 4} className="forecast-outlook-end-label">
          STIMA
        </text>
        <text
          x={endX + 29}
          y={stimaLabelY + 12}
          className="forecast-outlook-end-value is-central"
        >
          {pct(h.centralPct)}
        </text>
        {offensiveEnd != null && offensivaLabelY != null ? (
          <>
            <text
              x={endX + 29}
              y={offensivaLabelY - 4}
              className="forecast-outlook-end-label is-offensive"
            >
              OFFENSIVA
            </text>
            <text
              x={endX + 29}
              y={offensivaLabelY + 12}
              className="forecast-outlook-end-value is-offensive"
            >
              {pct(offensiveEnd)}
            </text>
          </>
        ) : null}
        {compactChrome
          ? [
              { days: -historyDays, label: "STORICO" },
              { days: 0, label: "OGGI" },
              ...(days >= 30 ? [{ days: 30, label: "+30G" }] : []),
              ...(days >= 90 ? [{ days: 90, label: "+90G" }] : []),
              { days, label: days >= 150 ? "MAG '27" : `+${days}G` },
            ]
              .filter((tick, index, all) => all.findIndex((row) => row.days === tick.days) === index)
              .map((tick) => (
                <text
                  key={tick.label}
                  x={tick.days < 0 ? plotLeft : tick.days === 0 ? todayX : x(now + tick.days * day)}
                  y={vbH - 6}
                  textAnchor={tick.days < 0 ? "start" : tick.days === days ? "end" : "middle"}
                  className="forecast-outlook-axis"
                >
                  {tick.label}
                </text>
              ))
          : null}
        {markerX != null ? (
          <g>
            <line
              x1={markerX}
              x2={markerX}
              y1={plotTop}
              y2={plotTop + plotH}
              stroke="#e2e8f0"
              strokeWidth="1.4"
              strokeDasharray="4 3"
            />
            <circle cx={markerX} cy={markerY} r="6.5" fill="#e2e8f0" opacity="0.22" />
            <circle cx={markerX} cy={markerY} r="3.4" fill="#f8fafc" stroke="var(--forecast-accent)" strokeWidth="1.4" />
          </g>
        ) : null}
        {!compactChrome && monthMarkers.map((p) => (
          <g key={p.days}>
            <line
              x1={x(now + p.days * day)}
              x2={x(now + p.days * day)}
              y1={plotTop}
              y2={plotTop + plotH}
              stroke="var(--forecast-line)"
              strokeWidth=".6"
              strokeDasharray="2 5"
              opacity=".55"
            />
            <text
              x={x(now + p.days * day)}
              y={vbH - 12}
              textAnchor="middle"
              className="forecast-outlook-axis"
            >
              {new Date(now + p.days * day)
                .toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" })
                .toUpperCase()}
            </text>
          </g>
        ))}
        <circle cx={endX} cy={y(h.centralPct)} r="3" fill="var(--forecast-accent)" />
        {candidates
          .filter((p) => !p.key.startsWith("future-") || p.key === `future-${days}`)
          .map((p) => (
            <circle
              key={p.key}
              cx={p.x}
              cy={p.y}
              r="9"
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${p.type}, ${p.label}: ${pct(p.value)}`}
              onFocus={() => setActiveKey(p.key)}
              onBlur={() => setActiveKey(null)}
              onClick={() => setActiveKey(p.key)}
            />
          ))}
        {active && (
          <g pointerEvents="none">
            <line
              x1={active.x}
              x2={active.x}
              y1={plotTop}
              y2={plotTop + plotH}
              stroke="var(--forecast-text)"
              strokeWidth=".7"
              strokeDasharray="2 3"
              opacity=".55"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="4.2"
              fill="var(--forecast-bg)"
              stroke="var(--forecast-accent)"
              strokeWidth="2"
            />
            <g
              transform={`translate(${Math.max(plotLeft, Math.min(vbW - 180, active.x - 80))},${plotTop - 6})`}
            >
              <rect
                width="168"
                height="58"
                rx="4"
                fill="var(--forecast-bg)"
                stroke="var(--forecast-line)"
              />
              <text x="10" y="16" className="forecast-outlook-axis">
                {active.label}
              </text>
              <text x="10" y="34" className="forecast-outlook-end-value is-central">
                {pct(active.value)}
              </text>
              <text x="10" y="48" className="forecast-outlook-axis">
                {active.type}
                {active.calendar ? ` · ${active.calendar}` : ""}
              </text>
            </g>
          </g>
        )}
        {compactChrome
          ? [30, 90, days]
              .filter((mark, index, all) => mark > 0 && mark <= days && all.indexOf(mark) === index)
              .map((mark) => {
                const sample = projection.reduce<OutlookSample | null>((best, row) => {
                  if (!best) return row;
                  return Math.abs(row.days - mark) < Math.abs(best.days - mark) ? row : best;
                }, null);
                if (!sample) return null;
                const cx = x(now + sample.days * day);
                const cy = y(sample.centralPct);
                const on = markerDay != null && Math.abs(markerDay - mark) < 2;
                return (
                  <g
                    key={`node-${mark}`}
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectDay?.(mark);
                    }}
                  >
                    {on ? (
                      <circle cx={cx} cy={cy} r="9" fill="#34d399" opacity="0.28" filter={`url(#forecast-node-${gradId})`} />
                    ) : null}
                    <circle cx={cx} cy={cy} r={on ? 4.2 : 3} fill={on ? "#ecfdf5" : "var(--forecast-bg)"} stroke={on ? "#34d399" : "var(--forecast-accent)"} strokeWidth={on ? 2 : 1.4} />
                    <circle cx={cx} cy={cy} r="11" fill="transparent" />
                    {on && mark < days - 5 ? (
                      <text x={cx} y={Math.max(plotTop + 10, cy - 10)} textAnchor="middle" className="forecast-outlook-end-value is-central">
                        {pct(sample.centralPct)}
                      </text>
                    ) : null}
                    <title>{`${mark >= 150 ? "Maggio 2027" : `+${mark}g`}: ${pct(sample.centralPct)}`}</title>
                  </g>
                );
              })
          : null}
        {!compactChrome ? (
        <text x={todayX} y={vbH - 12} textAnchor="middle" className="forecast-outlook-axis">
          OGGI
        </text>
        ) : null}
        {!compactChrome && monthMarkers.length === 0 ? (
          <text x={endX} y={vbH - 12} textAnchor="end" className="forecast-outlook-axis">
            {date(now + days * day)}
          </text>
        ) : null}
      </svg>
      {!compactChrome ? (
        <div className="forecast-outlook-legend">
          <span>
            <i className="is-observed" />
            Dati osservati
          </span>
          <span>
            <i className="is-central-band" />
            Corridoio stima
          </span>
          {offensiveProjection ? (
            <span>
              <i className="is-offensive" />
              Tetto offensiva
            </span>
          ) : null}
          {threshold != null && (
            <span>
              <i className="is-threshold" />
              Soglia di freno {pct(threshold)}
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function ForecastDriverChips({ horizon }: { horizon: ForecastHorizonResult }) {
  const labels: Record<string, string> = { momentum: "Inerzia", agenda: "Notizie / Temi", donor: "Bacino", ground: "B.I.P. & Rete", magnet: "Attrazione", cycle: "Calendario", bounds: "Freno zoccolo" };
  return <ul className="forecast-drivers" aria-label="Contributi dei fattori in punti percentuali">{horizon.factors.map(f => (
    <li key={f.id} data-tone={tone(f.pp)} title={f.plain}><span>{labels[f.id] ?? f.short}</span><strong>{formatPpSignedIt(f.pp, 2)}</strong></li>
  ))}</ul>;
}

const PROVENANCE_LABEL: Record<ForecastHorizonResult["factors"][number]["provenance"], string> = {
  dati: "dato",
  misto: "dato + ipotesi",
  ipotesi: "ipotesi",
};

export function ForecastHorizonTriptych({
  items,
  activeKey,
  onSelect,
}: {
  items: { key: ForecastHorizonKey; label: string; horizon: ForecastHorizonResult }[];
  activeKey: ForecastHorizonKey;
  onSelect: (key: ForecastHorizonKey) => void;
}) {
  return (
    <div className="forecast-horizon-triptych" role="group" aria-label="Previsione a 30, 90 e 180 giorni">
      {items.map((item) => {
        const delta = item.horizon.deltaPp;
        return (
          <button
            key={item.key}
            type="button"
            className="forecast-horizon-card"
            aria-pressed={activeKey === item.key}
            onClick={() => onSelect(item.key)}
          >
            <span className="forecast-eyebrow">{item.label}</span>
            <strong>
              {formatDecimalIt(item.horizon.centralPct, 2)}
              <span>%</span>
            </strong>
            <em data-tone={tone(delta)}>{formatPpSignedIt(delta, 2)}</em>
            <span className="forecast-horizon-card-start">
              da {formatDecimalIt(item.horizon.startPct, 2)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

function flashLine(text: string, max = 70): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

const WORK_FACTOR_IDS = new Set(["agenda", "donor", "ground", "magnet", "cycle"]);

const FACTOR_ORAL: Record<string, string> = {
  momentum: "l’andamento dei sondaggi",
  agenda: "i temi su cui ci riconoscono",
  donor: "i delusi di Fratelli d’Italia e della Lega",
  ground: "il lavoro dei tesserati sul territorio",
  magnet: "gli eletti e i nuovi ingressi",
  cycle: "il calendario politico verso il voto",
  bounds: "il nostro zoccolo duro",
};

function oralFactor(f: { id: string; short: string; label: string }): string {
  return FACTOR_ORAL[f.id] ?? (f.short || f.label).toLowerCase();
}

/**
 * Copia orale per la dirigenza: frasi brevi, «tu/noi», zero gergo da modello.
 * Deve potersi leggere ad alta voce a Vannacci senza spiegazioni a lato.
 */
export function buildTrajectoryWhyCopy(
  horizon: ForecastHorizonResult,
): { horizonFrame: string; lead: string; engines: string; condition: string } {
  const momentum = horizon.factors.find((f) => f.id === "momentum");
  const work = horizon.factors.filter((f) => WORK_FACTOR_IDS.has(f.id));
  const workSum = work.reduce((s, f) => s + f.pp, 0);
  const momPp = momentum?.pp ?? 0;
  const top = [...work]
    .filter((f) => f.pp > 0.005)
    .sort((a, b) => b.pp - a.pp)
    .slice(0, 3);
  const drag = [...horizon.factors]
    .filter((f) => f.pp < -0.005)
    .sort((a, b) => a.pp - b.pp)
    .slice(0, 2);

  const when =
    horizon.days <= 35
      ? "tra trenta giorni"
      : horizon.days <= 100
        ? "tra novanta giorni"
        : "a maggio 2027";

  const horizonFrame =
    horizon.days <= 35
      ? `Guardando ${when}, questo numero è ancora molto legato ai sondaggi di queste settimane. Il lavoro sul campo e sui temi ha poco tempo per pesare: è una fotografia a breve, non ancora la partita lunga.`
      : horizon.days <= 100
        ? `Guardando ${when}, i sondaggi contano meno di quanto sembri. Entrano in gioco i temi che ci riconoscono e chi, dentro il centrodestra, è deluso: lì inizia a costruirsi lo scarto rispetto a oggi.`
        : `Guardando ${when}, la curva sale perché il tempo lavora a favore di chi organizza: calendario verso il voto, tesserati, eletti. Non sale perché un sondaggio di oggi te lo promette.`;

  const pollsBit =
    momPp < -0.005
      ? `Se ascoltassimo solo i sondaggi, saremmo intorno al ${pct(horizon.startPct + momPp)} (${formatPpSignedIt(momPp, 2)}).`
      : momPp > 0.005
        ? `I sondaggi, per una volta, già ci danno una spinta (${formatPpSignedIt(momPp, 2)}).`
        : "I sondaggi, da soli, non ci spostano: restano fermi.";

  const lead = `Il ${pct(horizon.centralPct)} non è un disegno sul grafico. È la risposta a una domanda sola: dove possiamo arrivare ${when} se continuiamo con il lavoro di oggi. ${pollsBit} Tutto il resto — ${formatPpSignedIt(workSum, 2)} — viene da quello che farete voi: temi, delusi del centrodestra, tesserati, eletti, calendario.`;

  const engines =
    top.length > 0
      ? `Da dove arriva questo scarto, in concreto? Soprattutto da ${top
          .map((f) => `${oralFactor(f)} (${formatPpSignedIt(f.pp, 2)})`)
          .join(", ")}${
          drag.length
            ? `. Quello che tira indietro: ${drag
                .map((f) => `${oralFactor(f)} (${formatPpSignedIt(f.pp, 2)})`)
                .join(", ")}`
            : ""
        }.`
      : `In questo periodo il lavoro politico che contiamo vale ${formatPpSignedIt(workSum, 2)}.`;

  const condition =
    "Attenzione: questo non è un verdetto. È uno scenario. Vale se i temi si presidiano, se i delusi del centrodestra si parlano, se la rete e gli eletti lavorano. Se quel lavoro non c’è, rimane solo quello che dicono i sondaggi — e i sondaggi, da soli, non vincono un’elezione.";

  return { horizonFrame, lead, engines, condition };
}

/** Compact 2×3 driver grid for section 01 — visible above the fold. */
export function ForecastCompactDriverChart({
  horizon,
  onGoDetail,
}: {
  horizon: ForecastHorizonResult;
  onGoDetail: () => void;
}) {
  const ranked = [...horizon.factors]
    .filter((f) => Math.abs(f.pp) >= 0.005 || f.id === "bounds")
    .sort((a, b) => Math.abs(b.pp) - Math.abs(a.pp))
    .slice(0, 6);
  const max = Math.max(0.01, ...ranked.map((f) => Math.abs(f.pp)));
  const why = buildTrajectoryWhyCopy(horizon);
  return (
    <section className="forecast-driver-compact" aria-label="Perché questo numero e questa traiettoria">
      <div className="forecast-section-heading forecast-driver-compact-head">
        <div>
          <p className="forecast-eyebrow">PERCHÉ QUESTO NUMERO</p>
          <h3>
            {pct(horizon.startPct)} → {pct(horizon.centralPct)}{" "}
            <span className="forecast-driver-compact-delta">
              {formatPpSignedIt(horizon.deltaPp, 2)}
            </span>
          </h3>
        </div>
        <button type="button" className="forecast-driver-detail-link" onClick={onGoDetail}>
          Dettaglio tecnico →
        </button>
      </div>
      <article className="forecast-trajectory-why" aria-label="Cosa significa questo numero">
        <p className="forecast-eyebrow">COSA SIGNIFICA QUESTO NUMERO</p>
        <p className="forecast-trajectory-why-frame">{why.horizonFrame}</p>
        <p>{why.lead}</p>
        <p>{why.engines}</p>
        <p className="forecast-trajectory-why-condition">{why.condition}</p>
      </article>
      <ul className="forecast-driver-compact-list is-grid-2x3">
        {ranked.map((f) => (
          <li key={f.id} data-tone={tone(f.pp)} title={f.plain}>
            <div className="forecast-driver-compact-main">
              <span className="forecast-driver-compact-index">
                {f.n.toString().padStart(2, "0")}
              </span>
              <strong>{f.short || f.label}</strong>
              <em className="forecast-driver-compact-pp">{formatPpSignedIt(f.pp, 2)}</em>
            </div>
            <div className="forecast-diverging-track" aria-hidden="true">
              <i />
              <span
                style={{
                  left: f.pp < 0 ? `${50 - (Math.abs(f.pp) / max) * 48}%` : "50%",
                  width: `${(Math.abs(f.pp) / max) * 48}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** @deprecated Prefer ForecastCompactDriverChart — kept for any residual imports. */
export function ForecastPlainWhy(props: {
  horizon: ForecastHorizonResult;
  phrase: string;
  onGoDetail: () => void;
}) {
  return (
    <ForecastCompactDriverChart
      horizon={props.horizon}
      onGoDetail={props.onGoDetail}
    />
  );
}

export function ForecastHorizontalWaterfall({ horizon }: { horizon: ForecastHorizonResult }) {
  const max = Math.max(0.01, ...horizon.factors.map((f) => Math.abs(f.pp)));
  return (
    <section className="forecast-factor-waterfall" aria-label="Contributi alla previsione">
      <div className="forecast-waterfall-heading">
        <span>
          DA {pct(horizon.startPct)} A {pct(horizon.centralPct)}
        </span>
        <span>− / 0 / + · PUNTI PERCENTUALI</span>
      </div>
      {horizon.factors.map((f) => (
        <details className="forecast-factor-detail" key={f.id} data-tone={tone(f.pp)}>
          <summary className="forecast-factor-row">
            <div className="forecast-factor-copy">
              <strong>
                <span className="forecast-factor-index">{f.n.toString().padStart(2, "0")}</span>
                {f.label}
              </strong>
              <span className={`forecast-provenance is-${f.provenance}`}>
                {PROVENANCE_LABEL[f.provenance]}
              </span>
            </div>
            <div className="forecast-diverging-track" aria-hidden="true">
              <i />
              <span
                style={{
                  left: f.pp < 0 ? `${50 - (Math.abs(f.pp) / max) * 48}%` : "50%",
                  width: `${(Math.abs(f.pp) / max) * 48}%`,
                }}
              />
            </div>
            <strong className="forecast-factor-value">
              {formatPpSignedIt(f.pp, 2)}
              <span className="forecast-expand" aria-hidden="true">
                +
              </span>
            </strong>
          </summary>
          <div className="forecast-factor-explanation">
            <p className="forecast-factor-flash">{flashLine(f.plain, 110)}</p>
            <div className="forecast-how-calc is-open">
              <p className="forecast-how-label">Come ci siamo arrivati</p>
              <p>{f.note}</p>
              {f.sub.filter((s) => s.label?.trim()).length > 0 ? (
                <ul className="forecast-factor-sub">
                  {f.sub
                    .filter((s) => s.label?.trim())
                    .map((s) => (
                      <li key={s.label}>
                        {s.label}: {formatPpSignedIt(s.pp, 2)}
                      </li>
                    ))}
                </ul>
              ) : null}
              {f.sources.length > 0 ? (
                <p className="forecast-factor-sources">
                  Fonti:{" "}
                  {f.sources.map((s, i) => (
                    <span key={s.label}>
                      {i > 0 ? " · " : ""}
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.label}
                        </a>
                      ) : (
                        s.label
                      )}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        </details>
      ))}
      <div className="forecast-waterfall-total">
        <span>
          Σ CONTRIBUTI · oggi {pct(horizon.startPct)} → previsione {pct(horizon.centralPct)}
        </span>
        <strong>{formatPpSignedIt(horizon.deltaPp, 2)}</strong>
      </div>
    </section>
  );
}

