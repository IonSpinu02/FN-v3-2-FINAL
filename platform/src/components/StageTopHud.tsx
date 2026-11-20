"use client";

import { appPath } from "@/lib/appRoutes";
import { useActiveStrategicRoute } from "@/lib/state/useActiveStrategicRoute";
import { formatDecimalIt } from "@/lib/formatIt";
import { ThemeToggleButton } from "@/components/theme/ThemeProvider";
import { TricolorMark } from "@/components/ui/TelemetryUi";
import Link from "next/link";
import type { ReactNode } from "react";

export type StageTopNavItem = {
  id: string;
  label: string;
  href: string;
  desc?: string;
};

export function StageTopHud({
  brandHref,
  brandExtra,
  methodologyPill,
  scenarioControls,
  frostedBar = true,
  nav = [],
  activeId,
}: {
  /** Link al showcase pubblico (es. `/`). */
  brandHref?: string;
  brandExtra?: ReactNode;
  methodologyPill?: ReactNode;
  scenarioControls?: ReactNode;
  /** Barra piena opaca durante lo scroll (disattiva in mappa immersive). */
  frostedBar?: boolean;
  nav?: StageTopNavItem[];
  activeId?: string;
}) {
  const { route } = useActiveStrategicRoute();
  return (
    <div
      className={`fn-workspace-header pointer-events-none fixed left-0 right-0 top-0 z-50 flex h-auto min-h-[52px] items-center border-b px-2 pt-[max(0px,env(safe-area-inset-top))] backdrop-blur-md sm:h-[52px] sm:px-4 ${
        frostedBar
          ? "border-[var(--border-subtle)] bg-[var(--surface-1)]/95"
          : "border-transparent bg-[var(--surface-1)]/80"
      }`}
    >
      <div className="pointer-events-auto mx-auto grid h-full w-full max-w-[1920px] grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-2">
      {brandHref ? (
        <Link
          href={brandHref}
          title="Torna alla pagina iniziale"
          className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-[#070D19]/80 px-3 py-1.5 shadow-lg backdrop-blur-md transition hover:border-emerald-500/35 sm:gap-3 sm:px-4 sm:py-2"
        >
          <TricolorMark />
          <span className="hidden truncate text-[11px] font-bold tracking-wide text-white/90 min-[420px]:inline sm:text-xs">
            FUTURO NAZIONALE
          </span>
          <span className="relative hidden h-2 w-2 shrink-0 sm:flex">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-[#070D19]/80 px-3 py-1.5 shadow-lg backdrop-blur-md sm:gap-3 sm:px-4 sm:py-2">
          <TricolorMark />
          <span className="hidden truncate text-[11px] font-bold tracking-wide text-white/90 min-[420px]:inline sm:text-xs">
            FUTURO NAZIONALE
          </span>
          <span className="relative hidden h-2 w-2 shrink-0 sm:flex">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </div>
      )}

      {nav.length > 0 ? (
        <nav
          aria-label="Viste della piattaforma"
          className="pointer-events-auto hidden min-w-0 items-center justify-center gap-0.5 overflow-hidden lg:flex"
        >
          {nav.map((item) => {
            const active = item.id === activeId;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.desc}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium ${
                  active
                    ? "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--ink-primary)]"
                    : "border border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--signal-positive)]" : "bg-[var(--border-default)]"}`}
                  aria-hidden
                />
                {item.id === "locali" ? (
                  <>
                    <span className="xl:hidden">03 · Rassegna</span>
                    <span className="hidden xl:inline">{item.label}</span>
                  </>
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </nav>
      ) : methodologyPill ? (
        <div className="pointer-events-auto hidden max-w-md flex-1 justify-center md:flex">
          {methodologyPill}
        </div>
      ) : (
        <span className="hidden flex-1 lg:block" />
      )}

      <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
        {brandExtra ? <div className="shrink-0">{brandExtra}</div> : null}
        {route ? (
          <Link
            href={appPath("obiettivo")}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-[12px] text-[var(--ink-primary)]"
            title={`Rotta ${formatDecimalIt(route.targetPct, 1)}% a ${route.horizonDays} giorni`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal-positive)]" aria-hidden />
            <span className="hidden font-mono tabular-nums xl:inline">
              Rotta {formatDecimalIt(route.targetPct, 1)}% ({route.horizonDays}g)
            </span>
          </Link>
        ) : null}
        <ThemeToggleButton className="h-7 px-2 [&>span]:hidden" />
        {scenarioControls}
      </div>
      </div>
    </div>
  );
}

export type ScenarioViewMode = "showcase" | "map-matrix";

export function ScenarioViewSwitch({
  mode,
  onChange,
}: {
  mode: ScenarioViewMode;
  onChange: (m: ScenarioViewMode) => void;
}) {
  const items: { id: ScenarioViewMode; label: string }[] = [
    { id: "map-matrix", label: "Mappa dei dati" },
    { id: "showcase", label: "Panoramica" },
  ];
  return (
    <div className="inline-flex max-w-[min(100vw-2rem,560px)] flex-wrap justify-end rounded-full border border-white/15 bg-black/40 p-0.5 text-[10px] font-semibold sm:text-[11px]">
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-full px-2 py-1.5 transition-all sm:px-3 ${
            mode === id
              ? id === "showcase"
                ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.45)]"
                : "bg-emerald-500 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.4)]"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span className="sm:hidden">{id === "map-matrix" ? "Mappa" : "Quadro"}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** @deprecated Use ScenarioViewSwitch */
export function StageModeSwitch({
  holographic,
  onHolographic,
  onConsole,
}: {
  holographic: boolean;
  onHolographic: () => void;
  onConsole: () => void;
}) {
  return (
    <ScenarioViewSwitch
      mode={holographic ? "map-matrix" : "showcase"}
      onChange={(m) => {
        if (m === "map-matrix") onHolographic();
        if (m === "showcase") onConsole();
      }}
    />
  );
}
