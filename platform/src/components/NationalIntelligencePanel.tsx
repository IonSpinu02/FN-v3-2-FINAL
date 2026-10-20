"use client";

import type { InstitutionalRow } from "@/lib/engine/calculate";
import { REGIONS, type Region } from "@/lib/engine/constants";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioRow } from "@/lib/engine/types";
import type { FnConfig } from "@/lib/engine/types";
import { Btn } from "@/components/ui/FnUi";
import { ClassStatusMark, IconTarget } from "@/components/ui/TelemetryUi";
import { pct } from "@/lib/format";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { motion } from "framer-motion";
import { useRef } from "react";

const CARICHE: { key: keyof InstitutionalRow; label: string }[] = [
  { key: "dep", label: "Deputati" },
  { key: "creg", label: "Cons. Regionali" },
  { key: "sind", label: "Sindaci" },
  { key: "com", label: "Comunali" },
];

function MixRadar({
  flussi,
  pref,
  isc,
  ist,
}: {
  flussi: number;
  pref: number;
  isc: number;
  ist: number;
}) {
  const cx = 70;
  const cy = 70;
  const r = 52;
  const axes = [
    { label: "FLUSSI", v: flussi, angle: -Math.PI / 2, anchor: "middle" as const },
    { label: "PREF.", v: pref, angle: 0, anchor: "start" as const },
    { label: "ISCR.", v: isc, angle: Math.PI / 2, anchor: "middle" as const },
    { label: "ISTIT.", v: ist, angle: Math.PI, anchor: "end" as const },
  ];
  const labelR = r + 22;
  const pts = axes
    .map(({ v, angle }) => {
      const d = v * r;
      return [cx + Math.cos(angle) * d, cy + Math.sin(angle) * d];
    })
    .join(" ");
  return (
    <div className="flex gap-3">
      <svg
        viewBox="-42 -20 224 180"
        className="h-32 w-36 shrink-0 overflow-visible"
      >
        {[1 / 3, 2 / 3, 1].map((k) => (
          <polygon
            key={k}
            points={axes
              .map(({ angle }) => {
                const d = k * r;
                return `${cx + Math.cos(angle) * d},${cy + Math.sin(angle) * d}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(148,163,184,0.2)"
            strokeWidth={1}
          />
        ))}
        {axes.map(({ label, angle }) => (
          <line
            key={label}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * r}
            y2={cy + Math.sin(angle) * r}
            stroke="rgba(148,163,184,0.25)"
          />
        ))}
        <motion.polygon
          points={pts}
          fill="#10B981"
          fillOpacity={0.22}
          stroke="#10B981"
          strokeWidth={1.5}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        {axes.map(({ label, angle, anchor }) => (
          <text
            key={`t-${label}`}
            x={cx + Math.cos(angle) * labelR}
            y={cy + Math.sin(angle) * labelR + (angle === Math.PI / 2 ? 4 : 0)}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-slate-400 text-[9px] font-mono"
          >
            {label}
          </text>
        ))}
      </svg>
      <div className="grid flex-1 content-center gap-1 font-mono text-[10px] tabular-nums text-slate-300">
        <span>Flussi {(flussi * 100).toFixed(1)}%</span>
        <span>Pref. {(pref * 100).toFixed(1)}%</span>
        <span>Iscritti {(isc * 100).toFixed(1)}%</span>
        <span>Istit. {(ist * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function hasInstChanges(d?: Partial<InstitutionalRow>): boolean {
  if (!d) return false;
  return CARICHE.some(({ key }) => (d[key] ?? 0) !== 0);
}

function RegionFocusPanel({
  row,
  shell,
  sectionLabel,
  variant,
  onSelectRegion,
  onAdjustInst,
  onResetRegion,
  fnConfig,
  region,
  regionQuickDelta,
  scenarioRow,
  baselineRow,
}: {
  row: RegionPollResult;
  shell: string;
  sectionLabel: string;
  variant: "default" | "stage" | "holographic";
  onSelectRegion: (r: string | null) => void;
  onAdjustInst?: (carica: keyof InstitutionalRow, delta: number) => void;
  onResetRegion?: () => void;
  fnConfig?: FnConfig;
  region?: Region;
  regionQuickDelta?: Partial<InstitutionalRow>;
  scenarioRow?: ScenarioRow;
  baselineRow?: ScenarioRow;
}) {
  const animPi = useAnimatedNumber(row.piHat * 100);
  const animMargine = useAnimatedNumber(row.margineVotiSoglia);
  const stimaDelta =
    scenarioRow && baselineRow ? (scenarioRow.stima - baselineRow.stima) * 100 : 0;
  const votiDelta =
    scenarioRow && baselineRow
      ? scenarioRow.voti_di_scenario - baselineRow.voti_di_scenario
      : 0;
  const showImpact = variant === "holographic" && hasInstChanges(regionQuickDelta);

  function displayCount(k: keyof InstitutionalRow): number {
    const base = fnConfig?.presenze_istituzionali[k]?.[region!] ?? 0;
    const d = regionQuickDelta?.[k] ?? 0;
    return base + d;
  }

  return (
    <div className={shell}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Focus regione
          </p>
          <h3 className="text-lg font-semibold text-white">{row.regione}</h3>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-emerald-300 hover:text-emerald-200"
          onClick={() => onSelectRegion(null)}
        >
          [ ← VISTA NAZIONALE ]
        </button>
      </div>

      <p className="font-mono text-2xl tabular-nums text-fn-text">
        {animPi.toFixed(2).replace(".", ",")}%{" "}
        <span className="text-sm text-fn-text-muted">± {(row.moe * 100).toFixed(1)} pp</span>
      </p>
      <p className="mt-1 font-mono text-xs tabular-nums text-fn-text-muted">
        {pct(row.icLow, 2)} – {pct(row.icHigh, 2)}
      </p>
      <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-400">
        Margine 3%: {animMargine >= 0 ? "+" : ""}
        {Math.round(animMargine).toLocaleString("it-IT")} voti
      </p>

      <div className="mt-4">
        <p className={variant === "holographic" ? sectionLabel : "fn-label"}>
          {variant === "holographic" ? "05 // MIX PROVENIENZA (RADAR)" : "Mix provenienza"}
        </p>
        {variant === "holographic" ? (
          <MixRadar
            flussi={row.contribFlussi}
            pref={row.contribPreferenze}
            isc={row.contribIscritti}
            ist={row.contribIstituzioni}
          />
        ) : (
          <div className="space-y-2">
            <WaterfallBar label="Flussi" share={row.contribFlussi} color="bg-orange-500" />
            <WaterfallBar label="Preferenze" share={row.contribPreferenze} color="bg-emerald-500" />
            <WaterfallBar label="Iscritti" share={row.contribIscritti} color="bg-sky-500" />
            <WaterfallBar label="Istituzioni" share={row.contribIstituzioni} color="bg-violet-500" />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="fn-badge fn-badge-cloud capitalize">{row.classificazione}</span>
        <span className="fn-badge fn-badge-local">V/I {row.votiPerIscritto.toFixed(2)}</span>
      </div>

      {onAdjustInst && (
        <div className="mt-4 border-t border-white/[0.07] pt-4">
          {showImpact && (
            <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-2 font-mono text-[10px] text-emerald-200">
              VARIAZIONE SIMULATA: {stimaDelta >= 0 ? "+" : ""}
              {stimaDelta.toFixed(2).replace(".", ",")} pp ({votiDelta >= 0 ? "+" : ""}
              {votiDelta.toLocaleString("it-IT")} VOTI)
            </div>
          )}
          <p className="fn-label mb-2">CAMPAGNA ACQUISTI (DELTA ISTITUZIONALE)</p>
          <div className="grid grid-cols-2 gap-2">
            {CARICHE.map(({ key, label }) => {
              const delta = regionQuickDelta?.[key] ?? 0;
              const count = region && fnConfig ? displayCount(key) : null;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-2 transition-shadow hover:shadow-[0_0_12px_rgba(52,211,153,0.2)]"
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-fn-text-muted">{label}</span>
                    {delta !== 0 && (
                      <span className="rounded bg-emerald-500/20 px-1 font-mono text-[9px] text-emerald-300">
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                  {count != null && (
                    <p className="mb-1 font-mono text-sm tabular-nums text-slate-100">{count}</p>
                  )}
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="fn-icon-btn h-7 w-7 active:shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                      aria-label={`Meno ${label}`}
                      onClick={() => onAdjustInst(key, -1)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="fn-icon-btn h-7 w-7 active:shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                      aria-label={`Più ${label}`}
                      onClick={() => onAdjustInst(key, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {onResetRegion && (
            <Btn variant="secondary" className="mt-2 w-full text-xs" onClick={onResetRegion}>
              Azzera modifiche regione
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

export function NationalIntelligencePanel({
  poll,
  selectedRegion,
  onSelectRegion,
  onAdjustInst,
  onResetRegion,
  variant = "default",
  fnConfig,
  region,
  regionQuickDelta,
  scenarioRow,
  baselineRow,
  nationalS = 0.072,
}: {
  poll: RegionPollResult[];
  selectedRegion: string | null;
  onSelectRegion: (r: string | null) => void;
  onAdjustInst?: (carica: keyof InstitutionalRow, delta: number) => void;
  onResetRegion?: () => void;
  variant?: "default" | "stage" | "holographic";
  fnConfig?: FnConfig;
  region?: Region;
  regionQuickDelta?: Partial<InstitutionalRow>;
  scenarioRow?: ScenarioRow;
  baselineRow?: ScenarioRow;
  nationalS?: number;
}) {
  const targetIdx = useRef(0);
  const shell =
    variant === "holographic"
      ? "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#1B2436] bg-[#080C14]/90 divide-y divide-[#1B2436]"
      : variant === "stage"
        ? "flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-[#0B1221]/90 p-3.5 shadow-lg"
        : "fn-bento fn-intel-panel flex h-full flex-col";
  const sectionLabel =
    "mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500";
  const row = poll.find((p) => p.regione === selectedRegion);

  if (row) {
    const focusShell =
      variant === "holographic"
        ? "flex h-full min-h-0 flex-col rounded-xl border border-[#1B2436] bg-[#080C14]/90 p-4"
        : shell;
    return (
      <RegionFocusPanel
        row={row}
        shell={focusShell}
        sectionLabel={sectionLabel}
        variant={variant}
        onSelectRegion={onSelectRegion}
        onAdjustInst={onAdjustInst}
        onResetRegion={onResetRegion}
        fnConfig={fnConfig}
        region={region}
        regionQuickDelta={regionQuickDelta}
        scenarioRow={scenarioRow}
        baselineRow={baselineRow}
      />
    );
  }

  const sicure = poll.filter((p) => p.classificazione === "sicura").length;
  const contese = poll.filter((p) => p.classificazione === "contesa").length;
  const critiche = poll.filter((p) => p.classificazione === "critica").length;

  const top5 = [...poll].sort((a, b) => b.piHat - a.piHat).slice(0, 5);
  const watch = [...poll].sort((a, b) => a.piHat - b.piHat).slice(0, 5);

  const mix = poll.reduce(
    (acc, p) => ({
      flussi: acc.flussi + p.contribFlussi,
      pref: acc.pref + p.contribPreferenze,
      isc: acc.isc + p.contribIscritti,
      ist: acc.ist + p.contribIstituzioni,
    }),
    { flussi: 0, pref: 0, isc: 0, ist: 0 },
  );
  const n = poll.length || 1;
  const mixNorm = {
    flussi: mix.flussi / n,
    pref: mix.pref / n,
    isc: mix.isc / n,
    ist: mix.ist / n,
  };

  const nationalPct = nationalS * 100;

  return (
    <div className={variant === "holographic" ? shell : `${shell} overflow-hidden p-4`}>
      {variant !== "holographic" && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Panoramica Territoriale Live
          </p>
          <p className="mb-3 text-xs text-slate-400">
            Clicca una regione sulla mappa per il focus tattico
          </p>
        </>
      )}

      {variant === "default" && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatPill label="Sicure" count={sicure} color="bg-emerald-500" />
          <StatPill label="Contese" count={contese} color="bg-amber-400" />
          <StatPill label="Critiche" count={critiche} color="bg-red-500" />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className={variant === "holographic" ? "p-4" : ""}>
          <p className={variant === "holographic" ? sectionLabel : "mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"}>
            {variant === "holographic"
              ? "02 // LOCOMOTIVE TERRITORIALI (TOP 5)"
              : "Top 5 regioni per stima %"}
          </p>
          <ul className="space-y-2">
            {top5.map((p, i) => (
              <li key={p.regione}>
                <button
                  type="button"
                  className="w-full text-left transition-colors hover:bg-white/[0.03]"
                  onClick={() => onSelectRegion(p.regione)}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">
                        [{String(i + 1).padStart(2, "0")}]
                      </span>
                      <span className="truncate font-medium text-slate-100">{p.regione}</span>
                    </div>
                    <span className="shrink-0 font-mono tabular-nums text-emerald-400">
                      {(p.piHat * 100).toFixed(2).replace(".", ",")}%
                    </span>
                  </div>
                </button>
                <div className="relative h-1 overflow-hidden bg-[#162032]">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-emerald-500/80"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, p.piHat * 400)}%` }}
                    transition={{ duration: 0.4, delay: i * 0.04 }}
                  />
                  <div
                    className="absolute top-0 h-full w-px bg-slate-400/70"
                    style={{ left: `${Math.min(100, nationalPct * 4)}%` }}
                    title={`Media nazionale ${nationalPct.toFixed(2)}%`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={variant === "holographic" ? "border-t border-[#1B2436] p-4" : "mt-4"}>
          <p className={variant === "holographic" ? sectionLabel : "mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"}>
            {variant === "holographic"
              ? "03 // MARGINE SBARRAMENTO 3% (WATCHLIST)"
              : "Watchlist soglia sbarramento 3%"}
          </p>
          <ul className="space-y-1.5">
            {watch.map((p) => (
              <li key={p.regione}>
                <button
                  type="button"
                  className="w-full py-0.5 text-left transition-colors hover:bg-white/[0.03]"
                  onClick={() => onSelectRegion(p.regione)}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <ClassStatusMark classificazione={p.classificazione} />
                      <span className="truncate font-medium text-slate-100">{p.regione}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tabular-nums text-slate-300">
                      {p.margineVotiSoglia >= 0 ? "+" : ""}
                      {p.margineVotiSoglia.toLocaleString("it-IT")} VOTI
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={variant === "holographic" ? "border-t border-[#1B2436] p-4" : "mt-4"}>
          <p className={variant === "holographic" ? sectionLabel : "mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"}>
            {variant === "holographic"
              ? "04 // SPETTRO FATTORI (35 / 25 / 25 / 15)"
              : "Mix nazionale · 4 fattori"}
          </p>
          <div className="flex h-1.5 overflow-hidden bg-[#162032]">
            <div className="bg-orange-500" style={{ width: `${mixNorm.flussi * 100}%` }} />
            <div className="bg-emerald-500" style={{ width: `${mixNorm.pref * 100}%` }} />
            <div className="bg-sky-500" style={{ width: `${mixNorm.isc * 100}%` }} />
            <div className="bg-violet-500" style={{ width: `${mixNorm.ist * 100}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 font-mono text-[9px] tabular-nums text-slate-400">
            <span>FLUSSI {(mixNorm.flussi * 100).toFixed(0)}%</span>
            <span>PREF. {(mixNorm.pref * 100).toFixed(0)}%</span>
            <span>ISCR. {(mixNorm.isc * 100).toFixed(0)}%</span>
            <span>IST. {(mixNorm.ist * 100).toFixed(0)}%</span>
          </div>
        </section>

        {variant === "holographic" && (
          <div className="border-t border-[#1B2436] p-4">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 border border-[#1B2436] bg-[#0C101A] py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-emerald-300 transition-colors hover:border-emerald-500/40 hover:bg-[#162032]"
              onClick={() => {
                targetIdx.current = (targetIdx.current + 1) % REGIONS.length;
                onSelectRegion(REGIONS[targetIdx.current]!);
              }}
            >
              <IconTarget className="h-3.5 w-3.5" />
              [ + ] ISPEZIONA REGIONE TARGET
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-2 text-center">
      <span className={`mx-auto mb-1 block h-2 w-2 rounded-full ${color}`} />
      <p className="font-mono text-lg tabular-nums">{count}</p>
      <p className="text-[10px] text-fn-text-muted">{label}</p>
    </div>
  );
}

function WaterfallBar({
  label,
  share,
  color,
}: {
  label: string;
  share: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px]">
        <span className="text-fn-text-muted">{label}</span>
        <span className="font-mono tabular-nums">{(share * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
