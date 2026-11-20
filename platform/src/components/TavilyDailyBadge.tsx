"use client";

import {
  isTavilyDailyScanDone,
  tavilyDailyBadgeLabel,
  type TavilyGateMeta,
} from "@/lib/cache/tavilyDailyMeta";

export type TavilyScanButtonState = {
  label: string;
  disabled: boolean;
  /** Il clic chiede una nuova scansione oltre il limite giornaliero (solo con bypass admin). */
  force: boolean;
  title: string | undefined;
};

/** Stato del pulsante di scansione Tavily in base al budget giornaliero. */
export function tavilyScanButtonState(
  meta: TavilyGateMeta | null | undefined,
  nowMs: number,
  idleLabel: string,
): TavilyScanButtonState {
  if (!meta) return { label: idleLabel, disabled: false, force: false, title: undefined };
  if (meta.status === "disabled") {
    return {
      label: "[ Tavily non configurato ]",
      disabled: true,
      force: false,
      title: meta.message ?? undefined,
    };
  }
  if (isTavilyDailyScanDone(meta, nowMs)) {
    return meta.forceBypassAvailable
      ? {
          label: "[ ↻ Forza nuova scansione Tavily (admin) ]",
          disabled: false,
          force: true,
          title: "Bypass amministrativo attivo: consuma crediti Tavily",
        }
      : {
          label: "[ ✓ Dati giornalieri sincronizzati ]",
          disabled: true,
          force: false,
          title: meta.message ?? undefined,
        };
  }
  return { label: idleLabel, disabled: false, force: false, title: meta.message ?? undefined };
}

/** «✓ Scansione giornaliera completata (Oggi ore HH:MM · Prossima: domani)». */
export function TavilyDailyBadge({
  meta,
  nowMs,
  className = "",
}: {
  meta: TavilyGateMeta | null | undefined;
  nowMs: number;
  className?: string;
}) {
  const label = meta ? tavilyDailyBadgeLabel(meta, nowMs) : null;
  if (!label) return null;
  return (
    <span
      title={meta?.message ?? undefined}
      className={`inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-semibold leading-tight text-emerald-200 ${className}`}
    >
      {label}
    </span>
  );
}
