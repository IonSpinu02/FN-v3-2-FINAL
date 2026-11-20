"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { appPath, type AppTab } from "@/lib/appRoutes";
import { REGIONS, type Region } from "@/lib/engine/constants";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import {
  DEFAULT_FLUSSI_MATRIX_ID,
  FLUSSI_MATRICES,
  type FlussiMatrixId,
} from "@/lib/politicalModel";
import { ClassStatusMark } from "@/components/ui/TelemetryUi";
import { Command, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearActiveStrategicRoute } from "@/lib/state/activeStrategicRoute";
import { useActiveStrategicRoute } from "@/lib/state/useActiveStrategicRoute";
import { formatDecimalIt } from "@/lib/formatIt";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type CommandItem = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  node?: ReactNode;
  run: () => void;
};

export function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:border-emerald-500/40 hover:bg-white/10 hover:text-white"
      title="Apri i comandi"
    >
      <Command className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">Comandi</span>
    </button>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  poll = [],
  onSelectRegion,
  onSelectFlussiMatrix,
  activeFlussiMatrixId = DEFAULT_FLUSSI_MATRIX_ID,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poll?: RegionPollResult[];
  onSelectRegion?: (region: Region) => void;
  onSelectFlussiMatrix?: (id: FlussiMatrixId) => void;
  activeFlussiMatrixId?: FlussiMatrixId;
}) {
  const router = useRouter();
  const { route } = useActiveStrategicRoute();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollByRegion = useMemo(
    () => new Map(poll.map((p) => [p.regione, p])),
    [poll],
  );

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setActive(0);
  }, [onOpenChange]);

  const items = useMemo((): CommandItem[] => {
    const nav: { id: AppTab; label: string }[] = [
      { id: "scenario", label: "01 · Scenario" },
      { id: "osservatorio", label: "02 · Osservatorio" },
      { id: "locali", label: "03 · Rassegna stampa" },
      { id: "obiettivo", label: "04 · Piano Obiettivo" },
    ];
    const list: CommandItem[] = [
      ...nav.map((n) => ({
        id: `nav-${n.id}`,
        group: "Navigazione",
        label: n.label,
        keywords: n.id,
        run: () => {
          router.push(appPath(n.id));
          close();
        },
      })),
      ...(route
        ? [
            {
              id: "route-clear",
              group: "Piano Obiettivo",
              label: `Disattiva Rotta Operativa attiva (${formatDecimalIt(route.targetPct, 1)}%)`,
              keywords: "disattiva rotta",
              run: () => {
                clearActiveStrategicRoute();
                close();
              },
            },
            {
              id: "route-pdf",
              group: "Piano Obiettivo",
              label: "Esporta PDF Piano Obiettivo",
              keywords: "pdf piano obiettivo",
              run: () => {
                void fetch("/api/export/strategic-plan-pdf", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ targetPct: route.targetPct, horizonDays: route.horizonDays }),
                })
                  .then(async (res) => {
                    if (!res.ok) return;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "Piano_Obiettivo.pdf";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                  })
                  .catch(() => undefined);
                close();
              },
            },
          ]
        : []),
      ...([8, 9, 10] as const).map((pct) => ({
        id: `goal-${pct}`,
        group: "Piano Obiettivo",
        label: `Obiettivo ${pct.toFixed(1).replace(".", ",")}%`,
        keywords: `obiettivo ${pct} piano`,
        run: () => {
          router.push(`${appPath("obiettivo")}?target=${pct}`);
          close();
        },
      })),
      ...REGIONS.map((region) => {
        const p = pollByRegion.get(region);
        const pct = p ? `${(p.piHat * 100).toFixed(2).replace(".", ",")}%` : "—";
        const prio = p
          ? Math.max(40, Math.min(95, Math.round(p.piHat * 900)))
          : null;
        return {
          id: `region-${region}`,
          group: "Regioni",
          label: region,
          keywords: region,
          hint: prio != null ? `${pct} · Priorità ${prio}/100` : pct,
          node: p ? <ClassStatusMark classificazione={p.classificazione} /> : null,
          run: () => {
            onSelectRegion?.(region);
            router.push(appPath("scenario"));
            close();
          },
        };
      }),
      ...FLUSSI_MATRICES.map((m) => ({
        id: `flussi-${m.id}`,
        group: "Matrice Flussi",
        label: m.title,
        hint: activeFlussiMatrixId === m.id ? "ATTIVA" : m.badge,
        keywords: `${m.id} ${m.badge}`,
        run: () => {
          onSelectFlussiMatrix?.(m.id);
          close();
        },
      })),
      {
        id: "theme-dark",
        group: "Tema",
        label: "Dark · Tattico",
        hint: theme === "dark" ? "ATTIVO" : undefined,
        run: () => {
          setTheme("dark");
          close();
        },
      },
      {
        id: "theme-light",
        group: "Tema",
        label: "Light · Istituzionale",
        hint: theme === "light" ? "ATTIVO" : undefined,
        run: () => {
          setTheme("light");
          close();
        },
      },
    ];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.keywords ?? "").toLowerCase().includes(q) ||
        (item.hint ?? "").toLowerCase().includes(q),
    );
  }, [
    pollByRegion,
    route,
    query,
    router,
    close,
    onSelectRegion,
    onSelectFlussiMatrix,
    activeFlussiMatrixId,
    theme,
    setTheme,
  ]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[active]?.run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, items, active]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-label="Command Palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="glass-panel hud-brackets w-full max-w-xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-500" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca regioni, moduli, flussi, tema…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="rounded border border-white/15 bg-black/40 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
            ESC
          </kbd>
        </div>
        <ul className="max-h-[min(52vh,420px)] overflow-y-auto py-1">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              Nessun risultato
            </li>
          ) : (
            items.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <li key={item.id}>
                  {showGroup ? (
                    <p className="px-3 pb-1 pt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={item.run}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                      i === active
                        ? "bg-emerald-500/15 text-emerald-50"
                        : "text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {item.node}
                      {item.hint ? (
                        <span className="font-mono text-[10px] tabular-nums text-slate-400">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
