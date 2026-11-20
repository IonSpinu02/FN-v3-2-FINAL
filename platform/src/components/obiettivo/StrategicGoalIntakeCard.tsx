"use client";

import { useMemo, useState } from "react";
import type { HorizonDays } from "@/lib/engine/strategicBackcastEngine";
import { formatApproximateVotes } from "@/lib/formatApproximateVotes";
import { formatDecimalIt } from "@/lib/formatIt";
import { roundTenth } from "@/components/obiettivo/useStrategicPlan";
import type { V4Band } from "@/components/obiettivo/useStrategicAnchors";

const PRESETS: { pct: number; label: string; hint: string }[] = [
  { pct: 8, label: "8,0%", hint: "Consolidamento" },
  { pct: 9.5, label: "9,5%", hint: "Espansione" },
  { pct: 10.5, label: "10,5%", hint: "Doppia Cifra" },
  { pct: 12, label: "12,0%", hint: "Sfondamento" },
  { pct: 15, label: "15,0%", hint: "Polo Maggioritario" },
];

const HORIZON_CARDS: { days: HorizonDays; title: string; hint: string }[] = [
  { days: 30, title: "30 giorni", hint: "Sprint" },
  { days: 90, title: "90 giorni", hint: "Trimestre" },
  { days: 180, title: "180 giorni", hint: "Semestre" },
  { days: 360, title: "360 giorni", hint: "Piano Annuale" },
];

export function StrategicGoalIntakeCard({
  floor,
  currentPct,
  bandFor,
  ballots,
  initialTarget = 10,
  initialHorizon = 360,
  initialNote = "",
  isGenerating,
  error,
  onGenerate,
}: {
  floor: number;
  currentPct: number;
  bandFor: (horizonDays: HorizonDays) => V4Band;
  ballots: number;
  initialTarget?: number;
  initialHorizon?: HorizonDays;
  initialNote?: string;
  isGenerating: boolean;
  error?: string | null;
  onGenerate: (input: { targetPct: number; horizonDays: HorizonDays; strategicFocusNote?: string }) => void;
}) {
  const [target, setTarget] = useState(() => roundTenth(Math.max(floor, initialTarget)));
  const [horizon, setHorizon] = useState<HorizonDays>(initialHorizon);
  const [note, setNote] = useState(initialNote);
  const safeTarget = Math.min(20, Math.max(floor, target));
  const sliderMin = Math.max(7, floor);
  const deltaVotes = Math.max(0, Math.round(((safeTarget - currentPct) / 100) * ballots));
  const v4Band = useMemo(() => bandFor(horizon), [bandFor, horizon]);
  const votesLabel = formatApproximateVotes(deltaVotes, { suffix: "" }).replace(/^circa\s+/i, "");

  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] w-full items-center justify-center overflow-hidden bg-[var(--surface-canvas)] px-5 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12),transparent_55%),radial-gradient(ellipse_at_top,rgba(71,85,105,0.18),transparent_45%)]"
      />
      <section className="relative z-[1] w-full max-w-2xl rounded-2xl border border-[var(--border-default)] bg-[var(--surface-1)] p-6 shadow-2xl sm:p-8">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] text-[var(--ink-secondary)]">
            Consenso Oggi: {formatDecimalIt(currentPct, 2)}% (MISURATO)
          </span>
          <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] text-[var(--ink-secondary)]">
            Senza nuove mosse, a {horizon}g: ~{formatDecimalIt(v4Band.passive, 2)}%–{formatDecimalIt(v4Band.offensive, 2)}% (stima)
          </span>
        </div>

        <p className="mt-5 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)]">
          PIANIFICAZIONE STRATEGICA INVERSA · FUTURO NAZIONALE
        </p>
        <h1 className="mt-2 text-[clamp(1.45rem,3vw,2rem)] font-semibold leading-tight tracking-tight text-[var(--ink-primary)]">
          Qual è il nostro obiettivo in termini di consenso?
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-secondary)]">
          Imposta il traguardo percentuale e l&apos;orizzonte temporale: il motore matematico calcolerà i bacini elettorali
          necessari e l&apos;AI elaborerà la roadmap operativa su misura.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => setTarget(roundTenth(Math.max(floor, safeTarget - 0.1)))}
            className="obj-press h-11 w-11 rounded-xl border border-[var(--border-default)] bg-[var(--surface-2)] text-[18px] text-[var(--ink-primary)] disabled:opacity-50"
            aria-label="Diminuisci traguardo"
          >
            -
          </button>
          <p className="min-w-[7.5rem] text-center font-mono text-[2.4rem] font-semibold tabular-nums text-[var(--ink-primary)]">
            {formatDecimalIt(safeTarget, 1)}%
          </p>
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => setTarget(roundTenth(Math.min(20, safeTarget + 0.1)))}
            className="obj-press h-11 w-11 rounded-xl border border-[var(--border-default)] bg-[var(--surface-2)] text-[18px] text-[var(--ink-primary)] disabled:opacity-50"
            aria-label="Aumenta traguardo"
          >
            +
          </button>
        </div>
        <input
          type="range"
          min={sliderMin}
          max={18}
          step={0.1}
          value={Math.min(18, Math.max(sliderMin, safeTarget))}
          disabled={isGenerating}
          onChange={(event) => setTarget(Number(event.target.value))}
          aria-label="Consenso obiettivo"
          className="mt-3 h-1.5 w-full accent-emerald-400 disabled:opacity-50"
        />
        <p className="mt-2 text-center text-[12px] text-[var(--ink-secondary)]">
          pari a circa {votesLabel} nuovi voti validi da conquistare rispetto a oggi
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {PRESETS.map((preset) => {
            const active = Math.abs(safeTarget - preset.pct) < 0.05;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={isGenerating}
                onClick={() => setTarget(roundTenth(Math.max(floor, preset.pct)))}
                className={`obj-press rounded-lg border px-2.5 py-1.5 text-left disabled:opacity-50 ${
                  active
                    ? "border-emerald-500/40 bg-emerald-500/10 text-[var(--signal-positive)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <span className="block font-mono text-[12px] tabular-nums">{preset.label}</span>
                <span className="block text-[10px] opacity-80">{preset.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HORIZON_CARDS.map((card) => {
            const active = horizon === card.days;
            return (
              <button
                key={card.days}
                type="button"
                disabled={isGenerating}
                onClick={() => setHorizon(card.days)}
                className={`obj-press rounded-xl border px-3 py-2.5 text-left disabled:opacity-50 ${
                  active
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--ink-muted)]"
                }`}
              >
                <span className="block font-mono text-[12px] font-semibold text-[var(--ink-primary)]">{card.title}</span>
                <span className="mt-0.5 block text-[10px] text-[var(--ink-muted)]">{card.hint}</span>
              </button>
            );
          })}
        </div>

        <label className="mt-5 block text-[11px] text-[var(--ink-muted)]">
          Direttiva o priorità politica specifica (opzionale)
          <input
            value={note}
            maxLength={280}
            disabled={isGenerating}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Focus su distretti PMI del Nord, sicurezza urbana e recupero astensione Sud"
            className="mt-1 h-10 w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--ink-primary)] outline-none focus:border-emerald-400/50 disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          disabled={isGenerating}
          onClick={() =>
            onGenerate({
              targetPct: safeTarget,
              horizonDays: horizon,
              ...(note.trim() ? { strategicFocusNote: note.trim().slice(0, 280) } : {}),
            })
          }
          className="obj-press mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-[14px] font-semibold text-[var(--signal-positive)] hover:bg-emerald-500/20 disabled:opacity-60"
        >
          Calcola Bacini e Genera Roadmap AI →
        </button>
        {error ? <p className="mt-3 text-[12px] text-[var(--signal-danger)]">{error}</p> : null}
      </section>
    </div>
  );
}
