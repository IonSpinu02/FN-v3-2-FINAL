"use client";

import { CinematicBackground } from "@/components/CinematicBackground";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  Building2,
  LayoutGrid,
  Map,
  Radar,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type ShellNavItem = {
  id: string;
  label: string;
  desc: string;
  icon?: LucideIcon;
};

const NAV_ICONS: Record<string, LucideIcon> = {
  scenario: Map,
  quadro: LayoutGrid,
  osservatorio: Radar,
  locali: Building2,
  audit: Archive,
};

export function DashboardShell({
  nav,
  tab,
  onTabChange,
  children,
  contentClassName = "",
  overrideActive,
  topHud,
  fullBleed = false,
  lockViewport = false,
}: {
  nav: ShellNavItem[];
  tab: string;
  onTabChange: (id: string) => void;
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
      className={`screen-only relative w-full max-w-full overflow-x-hidden bg-[#02040A] ${
        lockViewport ? "h-screen max-h-screen overflow-hidden" : "min-h-screen"
      }`}
    >
      <CinematicBackground />

      {topHud}

      <nav
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-white/15 bg-[#070D19]/90 px-1 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.85),0_0_24px_rgba(16,185,129,0.1)] backdrop-blur-2xl"
        aria-label="Navigazione principale"
      >
        {nav.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon ?? NAV_ICONS[item.id] ?? Map;
          return (
            <button
              key={item.id}
              type="button"
              title={item.desc}
              onClick={() => onTabChange(item.id)}
              className={`group relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-all hover:-translate-y-0.5 ${
                active
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              {overrideActive && item.id === "scenario" && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>

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
  metaDate,
  dbCloudConnected,
}: {
  busy: boolean;
  metaDate: string;
  dbCloudConnected: boolean | null;
}) {
  return (
    <>
      <span
        className={`inline-flex h-2 w-2 rounded-full ${busy ? "animate-pulse bg-emerald-400" : "bg-emerald-500"}`}
        aria-hidden
      />
      Base {metaDate}
      {busy ? " · sync" : ""}
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
          dbCloudConnected
            ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
        }`}
      >
        {dbCloudConnected ? "Cloud Neon" : "Modalità Locale"}
      </span>
    </>
  );
}
