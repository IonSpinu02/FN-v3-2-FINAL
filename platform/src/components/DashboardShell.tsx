"use client";

import { CinematicBackground } from "@/components/CinematicBackground";
import { CoverageTelemetryPanel } from "@/components/CoverageTelemetryPanel";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  Map,
  Radar,
  Target,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import "./dashboard-experience.css";

export type ShellNavItem = {
  id: string;
  label: string;
  /** Etichetta corta per la barra inferiore del telefono. */
  short?: string;
  desc: string;
  href: string;
  icon?: LucideIcon;
};

const NAV_ICONS: Record<string, LucideIcon> = {
  scenario: Map,
  osservatorio: Radar,
  locali: Building2,
  obiettivo: Target,
};

const SPRING = { type: "spring" as const, stiffness: 420, damping: 32 };

export function DashboardShell({
  nav,
  tab,
  children,
  contentClassName = "",
  overrideActive,
  topHud,
  fullBleed = false,
  lockViewport = false,
}: {
  nav: ShellNavItem[];
  tab: string;
  title?: string;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  overrideActive?: boolean;
  topHud?: ReactNode;
  fullBleed?: boolean;
  lockViewport?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      className={`fn-workspace screen-only relative w-full max-w-full overflow-x-hidden bg-[#02040A] ${
        lockViewport
          ? "min-h-dvh overflow-x-hidden max-lg:overflow-y-auto lg:h-dvh lg:max-h-dvh lg:overflow-hidden"
          : "min-h-dvh overflow-x-hidden"
      }`}
    >
      <CinematicBackground />

      {topHud}

      <LayoutGroup id="fn-dock-nav">
        <nav
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[var(--border-subtle)] bg-[var(--surface-1)]/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md lg:hidden"
          aria-label="Navigazione principale"
          data-workspace-nav
        >
          {nav.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon ?? NAV_ICONS[item.id] ?? Map;
            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.desc}
                aria-current={active ? "page" : undefined}
                className={`group relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors sm:px-3 ${
                  active
                    ? "text-emerald-100"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {active && !reduce ? (
                  <motion.span
                    layoutId="fn-dock-pill"
                    className="absolute inset-0 rounded-xl border border-emerald-400/50 bg-emerald-500/18 shadow-[0_0_28px_-4px_rgba(16,185,129,0.55)]"
                    transition={SPRING}
                    aria-hidden
                  />
                ) : active ? (
                  <span
                    className="absolute inset-0 rounded-xl border border-emerald-400/50 bg-emerald-500/18 shadow-[0_0_28px_-4px_rgba(16,185,129,0.55)]"
                    aria-hidden
                  />
                ) : null}
                {active ? (
                  <span
                    className="absolute left-2 right-2 top-0 h-[2px] rounded-full bg-emerald-300/90 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                    aria-hidden
                  />
                ) : null}
                <Icon className="relative z-10 h-4 w-4 shrink-0" aria-hidden />
                <span className="relative z-10 max-w-full truncate px-0.5 text-center text-[10px] font-semibold leading-tight">
                  {item.short ?? item.label}
                </span>
                {overrideActive && item.id === "scenario" && (
                  <span className="absolute -right-0.5 -top-0.5 z-10 h-2 w-2 rounded-full bg-amber-400" />
                )}
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>

      <AnimatePresence mode="wait">
        <motion.main
          key={tab}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={
            fullBleed
              ? `relative z-10 h-full min-h-0 ${contentClassName}`
              : `relative z-0 mx-auto w-full max-w-[1600px] px-4 pb-32 pt-16 ${contentClassName}`
          }
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

export function DashboardSubtitle({
  busy,
  newsConsidered,
  newsDetected,
  calendarSource,
  calendarUsedFallback,
}: {
  busy: boolean;
  newsConsidered?: number;
  newsDetected?: number;
  calendarSource?: "official-calendar" | "local-catalog";
  calendarUsedFallback?: boolean;
}) {
  return (
    <CoverageTelemetryPanel
      busy={busy}
      newsConsidered={newsConsidered}
      newsDetected={newsDetected}
      calendarSource={calendarSource}
      calendarUsedFallback={calendarUsedFallback}
    />
  );
}
