"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Compass,
  MapPin,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import type { ForecastBriefing, StrategistPriority } from "@/lib/ai/strategistAgent";
import type {
  ForecastBacktestV4,
  ForecastHorizonKey,
  ForecastNetworkDelta,
  ForecastScenarioId,
  ForecastV4Input,
  ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import { factorPp } from "@/lib/engine/forecastEngineV4";
import {
  buildComputationId,
  freshnessLabel,
  isBriefingAligned,
  type DataFreshnessState,
} from "@/lib/engine/computationFingerprint";
import { formatDecimalIt } from "@/lib/formatIt";
import { toolModuleLabel } from "@/lib/ai/strategistTools";
import { EpistemicBadge } from "@/components/EpistemicBadge";
import { REGIONS, type Region } from "@/lib/engine/constants";

type ChatRow = {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
};

type Props = {
  open: boolean;
  v4: ForecastV4Result;
  v4Input: ForecastV4Input;
  networkDelta: ForecastNetworkDelta;
  backtest: ForecastBacktestV4 | null;
  newsHeadlines: string[];
  viewScenario: ForecastScenarioId;
  horizonKey?: ForecastHorizonKey;
  excludedEntityIds?: string[];
  selectedRegion?: Region | null;
  onSelectRegion?: (region: Region) => void;
  onHoverRegions?: (regions: readonly Region[] | null) => void;
  onOpenFattori?: () => void;
};

const KICKER = "font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]";
const DARK_SCROLL =
  "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15";

const REGION_SET = new Set<string>(REGIONS);

function asRegion(name: string): Region | null {
  const trimmed = name.trim();
  return REGION_SET.has(trimmed) ? (trimmed as Region) : null;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function padRank(n: number): string {
  return String(n).padStart(2, "0");
}

function shortComputationRef(id: string): { label: string; full: string } {
  const bare = id.replace(/^cmp_/i, "");
  return { label: `Ref. #${bare.slice(0, 6)}`, full: id };
}

/** Soften leftover engine jargon if Claude reintroduces it. */
function editorialCopy(text: string): string {
  return text
    .replace(/\bfattore radicamento \(ground\) del motore V4\b/gi, "presenza territoriale")
    .replace(/\bfattore ground del V4\b/gi, "presenza territoriale")
    .replace(/\bmotore V4\b/gi, "previsione")
    .replace(/\bmodello V4\b/gi, "previsione")
    .replace(/\bV4\b/g, "")
    .replace(/\bvs flat\b/gi, "vs riferimento statico")
    .replace(/\bCdX\b/g, "centrodestra")
    .replace(/\bfallback deterministico\b/gi, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Evidenzia cifre chiave, delta con segno, forchette e punteggi nel testo analitico. */
function renderRichCopy(text: string): ReactNode[] {
  const pattern = /([+−-]\d+(?:[.,]\d+)?(?:\s*(?:%|pt|pp|voti(?:\s+indicativi)?))?|±\d+(?:[.,]\d+)?(?:\s*pt)?|\b\d+(?:[.,]\d+)?%|\b\d{1,3}(?:\.\d{3})+\b|\b\d{1,3}\/100\b)/gi;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const isPositive = token.startsWith("+");
    const isNegative = token.startsWith("-") || token.startsWith("−");
    const isBand = token.startsWith("±");
    const cls = isPositive
      ? "font-mono text-[0.95em] font-semibold tabular-nums text-emerald-300 light:text-emerald-700"
      : isNegative
        ? "font-mono text-[0.95em] font-semibold tabular-nums text-amber-300 light:text-amber-700"
        : isBand
          ? "font-mono text-[0.95em] font-medium tabular-nums text-cyan-200 light:text-cyan-800"
          : "font-mono text-[0.95em] font-semibold tabular-nums text-[var(--ink-primary)]";
    nodes.push(
      <span key={`tok-${key++}`} className={cls}>
        {token}
      </span>,
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/** Separa la prima frase d'attacco dal dettaglio operativo senza perdere testo. */
function splitActionLead(raw: string): { headline: string; detail: string } {
  const clean = editorialCopy(raw);
  const dotIdx = clean.search(/\.\s+/);
  if (dotIdx >= 18 && dotIdx <= 155) {
    return {
      headline: clean.slice(0, dotIdx + 1).trim(),
      detail: clean.slice(dotIdx + 1).trim(),
    };
  }
  const colonIdx = clean.indexOf(": ");
  if (colonIdx >= 18 && colonIdx <= 115) {
    return {
      headline: clean.slice(0, colonIdx).trim(),
      detail: clean.slice(colonIdx + 2).trim(),
    };
  }
  return { headline: clean, detail: "" };
}

function classifyRiskTitle(risk: string, index: number): string {
  const lower = risk.toLowerCase();
  if (/passivo|base|offensiva|ipote/.test(lower) && index === 0) return "Condizionalità degli scenari";
  if (/non modellat|avversari|affluenza|internazional|shock/.test(lower)) return "Variabili esogene non modellate";
  if (/errore storico|controlli|fascia teorica|±/.test(lower)) return "Calibrazione storica & banda 80%";
  if (/manovra|maggioranza|calendario|accordo/.test(lower)) return "Rischio di assorbimento politico";
  if (/maggio 2027|comunicazione|breve periodo/.test(lower)) return "Disciplina comunicativa";
  return `Vincolo operativo 0${index + 1}`;
}

const TESI_META = [
  {
    code: "01",
    title: "Quadro attuale & baseline",
    subtitle: "Punto di partenza e inerzia sondaggi",
    icon: Compass,
    accent: "text-cyan-300 light:text-cyan-700",
  },
  {
    code: "02",
    title: "Dinamica dei 7 fattori",
    subtitle: "Spinte, freni e territori chiave",
    icon: TrendingUp,
    accent: "text-emerald-300 light:text-emerald-700",
  },
  {
    code: "03",
    title: "Condizioni operative & limiti",
    subtitle: "Soglie di esecuzione tra i regimi",
    icon: SlidersHorizontal,
    accent: "text-amber-300 light:text-amber-700",
  },
] as const;

const FACTOR_SHORT: Record<string, string> = {
  momentum: "Sondaggi",
  agenda: "Agenda / temi",
  donor: "Flussi bacini",
  ground: "Radicamento",
  magnet: "Eletti",
  cycle: "Calendario",
  bounds: "Tetto",
};

function splitTesiParagraphs(tesi: string): string[] {
  const parts = editorialCopy(tesi)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) return parts.slice(0, 3);
  if (parts.length === 2) return parts;
  return parts.length ? parts : [editorialCopy(tesi)];
}

export function ForecastStrategistPanel({
  open,
  v4,
  v4Input,
  networkDelta,
  backtest,
  newsHeadlines,
  viewScenario,
  horizonKey = "d180",
  excludedEntityIds = [],
  selectedRegion = null,
  onSelectRegion,
  onHoverRegions,
  onOpenFattori,
}: Props) {
  const [briefing, setBriefing] = useState<ForecastBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<DataFreshnessState>("PROVVISORIO");
  const [chat, setChat] = useState<ChatRow[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const briefingAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const pendingPrompt = useRef<string | null>(null);

  const headlinesKey = newsHeadlines.slice(0, 24).join("\u0001");
  const consideredHeadlines = useMemo(
    () => headlinesKey.split("\u0001").filter(Boolean),
    [headlinesKey],
  );

  const activeHorizon = useMemo(
    () =>
      v4.scenarios[viewScenario].horizons.find((h) => h.key === horizonKey) ??
      v4.scenarios[viewScenario].horizons[2]!,
    [v4, viewScenario, horizonKey],
  );
  const passivePct =
    v4.scenarios.passivo.horizons.find((h) => h.key === horizonKey)?.centralPct ?? v4.startPct;
  const basePct =
    v4.scenarios.base.horizons.find((h) => h.key === horizonKey)?.centralPct ?? v4.startPct;
  const offensivePctNum =
    v4.scenarios.offensiva.horizons.find((h) => h.key === horizonKey)?.centralPct ?? v4.startPct;

  const sortedFactors = useMemo(
    () =>
      [...activeHorizon.factors]
        .filter((f) => Math.abs(f.pp) >= 0.005)
        .sort((a, b) => b.pp - a.pp),
    [activeHorizon],
  );

  const quickChips = useMemo(() => {
    const baseH =
      v4.scenarios.base.horizons.find((h) => h.key === horizonKey) ??
      v4.scenarios.base.horizons[2]!;
    const pollsOnlyPct = formatDecimalIt(
      v4.startPct + factorPp(baseH, "momentum"),
      2,
    );
    const offensivePct = formatDecimalIt(offensivePctNum, 2);
    return [
      "Quali sono le 3 mosse prioritarie di questa settimana?",
      "Come recuperiamo i delusi di FdI e Lega sulla Manovra?",
      "Dove dobbiamo concentrare comitati e sopralluoghi?",
      `Perché i soli sondaggi proiettano ${pollsOnlyPct}% e come saliamo verso il ${offensivePct}%?`,
    ] as const;
  }, [v4, horizonKey, offensivePctNum]);

  const horizonKicker =
    horizonKey === "d30"
      ? "02 · DIRETTRICI TATTICHE · ~DICEMBRE 2026 · FASE MANOVRA"
      : horizonKey === "d90"
        ? "02 · DIRETTRICI DI TRANSIZIONE · ~FEBBRAIO 2027 · CONSOLIDAMENTO"
        : "02 · DIRETTRICI OPERATIVE · MAGGIO 2027 · MOBILITAZIONE";

  const { computationId: activeComputationId } = useMemo(
    () =>
      buildComputationId({
        v4,
        v4Input,
        networkDelta,
        scenarioMode: viewScenario,
        horizonKey,
        newsHeadlines: consideredHeadlines,
        excludedEntityIds,
      }),
    [
      v4,
      v4Input,
      networkDelta,
      viewScenario,
      horizonKey,
      consideredHeadlines,
      excludedEntityIds,
    ],
  );

  const payloadBase = useCallback(
    () => ({
      v4,
      v4Input,
      networkDelta,
      backtest,
      newsHeadlines: consideredHeadlines,
      scenario: viewScenario,
      horizonKey,
      computationId: activeComputationId,
      excludedEntityIds,
    }),
    [
      v4,
      v4Input,
      networkDelta,
      backtest,
      consideredHeadlines,
      viewScenario,
      horizonKey,
      activeComputationId,
      excludedEntityIds,
    ],
  );

  const loadBriefing = useCallback(
    async (forceRefresh = false) => {
      briefingAbortRef.current?.abort();
      const controller = new AbortController();
      briefingAbortRef.current = controller;
      const seq = ++requestSeqRef.current;
      const expectedId = activeComputationId;
      setBriefingLoading(true);
      setBriefingError(null);
      setFreshness("PROVVISORIO");
      if (forceRefresh) setBriefing(null);
      try {
        const res = await fetch("/api/ai/forecast-briefing", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            ...payloadBase(),
            forceRefresh: forceRefresh === true,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          ok?: boolean;
          briefing?: ForecastBriefing;
          activeComputationId?: string;
          error?: string;
        };
        if (seq !== requestSeqRef.current || controller.signal.aborted) return;
        if (!data.briefing) throw new Error(data.error || "Briefing vuoto");
        const aligned = isBriefingAligned(
          data.briefing.computationId,
          expectedId,
        );
        setBriefing(data.briefing);
        setFreshness(aligned ? "AGGIORNATO" : "NON_ALLINEATO");
      } catch (err) {
        if (controller.signal.aborted || seq !== requestSeqRef.current) return;
        setBriefingError(
          err instanceof Error ? err.message : "Briefing non disponibile",
        );
        setFreshness((prev) =>
          prev === "AGGIORNATO" || prev === "PRECEDENTE" || prev === "NON_ALLINEATO"
            ? "PRECEDENTE"
            : "MANCANTE",
        );
      } finally {
        if (!controller.signal.aborted && seq === requestSeqRef.current) {
          setBriefingLoading(false);
        }
      }
    },
    [payloadBase, activeComputationId],
  );

  const loadBriefingRef = useRef(loadBriefing);
  loadBriefingRef.current = loadBriefing;

  useEffect(() => {
    if (!open) return;
    setBriefing(null);
    setBriefingError(null);
    setFreshness("PROVVISORIO");
    const t = window.setTimeout(() => void loadBriefingRef.current(false), 0);
    return () => {
      window.clearTimeout(t);
      briefingAbortRef.current?.abort();
    };
  }, [open, activeComputationId]);

  const briefingStale =
    briefing != null &&
    !isBriefingAligned(briefing.computationId, activeComputationId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat, streaming]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      ev.preventDefault();
      setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [drawerOpen]);

  const sendChat = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      setDrawerOpen(true);
      setInput("");
      setToolsUsed([]);
      const userRow: ChatRow = { id: uid(), role: "user", content: trimmed };
      const assistantId = uid();
      setChat((prev) => [
        ...prev,
        userRow,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setStreaming(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const history = [...chat, userRow]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      try {
        const res = await fetch("/api/ai/strategist-chat", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          signal: controller.signal,
          body: JSON.stringify({
            ...payloadBase(),
            messages: history,
          }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part
              .split("\n")
              .map((l) => l.trim())
              .find((l) => l.startsWith("data:"));
            if (!line) continue;
            const raw = line.replace(/^data:\s*/, "");
            try {
              const ev = JSON.parse(raw) as {
                type: string;
                text?: string;
                label?: string;
                name?: string;
                message?: string;
                fullText?: string;
              };
              if (ev.type === "delta" && ev.text) {
                full += ev.text;
                setChat((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: full } : m,
                  ),
                );
              } else if (ev.type === "tool") {
                const moduleLabel = toolModuleLabel(ev.name || "");
                setToolsUsed((prev) =>
                  prev.includes(moduleLabel) ? prev : [...prev, moduleLabel],
                );
                const statusLabel = ev.label || moduleLabel;
                setChat((prev) => {
                  const withoutDup = prev.filter(
                    (m) => !(m.role === "status" && m.content === statusLabel),
                  );
                  return [
                    ...withoutDup.filter((m) => m.id !== assistantId),
                    { id: uid(), role: "status", content: statusLabel },
                    { id: assistantId, role: "assistant", content: full },
                  ];
                });
              } else if (ev.type === "status") {
                const statusLabel = ev.label || "Consulto…";
                setChat((prev) => {
                  const withoutDup = prev.filter(
                    (m) => !(m.role === "status" && m.content === statusLabel),
                  );
                  return [
                    ...withoutDup.filter((m) => m.id !== assistantId),
                    { id: uid(), role: "status", content: statusLabel },
                    { id: assistantId, role: "assistant", content: full },
                  ];
                });
              } else if (ev.type === "error") {
                setChat((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content:
                            m.content ||
                            `Non riesco a rispondere ora: ${ev.message ?? "errore"}`,
                        }
                      : m,
                  ),
                );
              } else if (ev.type === "done" && ev.fullText && !full) {
                full = ev.fullText;
                setChat((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: full } : m,
                  ),
                );
              }
            } catch {
              /* ignore */
            }
          }
        }
        if (!full) {
          setChat((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || "Nessuna risposta ricevuta." }
                : m,
            ),
          );
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setChat((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `Errore di connessione: ${err instanceof Error ? err.message : "sconosciuto"}`,
                }
              : m,
          ),
        );
      } finally {
        setStreaming(false);
      }
    },
    [chat, streaming, payloadBase],
  );

  const openDrawerWith = useCallback(
    (prompt: string | null) => {
      setDrawerOpen(true);
      if (prompt) {
        pendingPrompt.current = prompt;
        window.setTimeout(() => {
          if (pendingPrompt.current) {
            const p = pendingPrompt.current;
            pendingPrompt.current = null;
            void sendChat(p);
          }
        }, 40);
      }
    },
    [sendChat],
  );

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ prompt: string | null }>).detail;
      openDrawerWith(detail?.prompt ?? null);
    };
    window.addEventListener("fn-open-strategist", onOpen as EventListener);
    return () =>
      window.removeEventListener("fn-open-strategist", onOpen as EventListener);
  }, [openDrawerWith]);

  const deepen = (p: StrategistPriority) => {
    openDrawerWith(
      p.chatPrompt || `Approfondisci la priorità ${padRank(p.rank)}: ${p.azione}`,
    );
  };

  const lastAssistant = [...chat].reverse().find((m) => m.role === "assistant");
  const effectiveFreshness: DataFreshnessState = briefingStale ? "NON_ALLINEATO" : freshness;
  const freshTone =
    effectiveFreshness === "AGGIORNATO"
      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-300 light:text-emerald-700"
      : effectiveFreshness === "NON_ALLINEATO"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-300 light:text-amber-800"
        : "border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--ink-secondary)]";

  const drawerNode =
    typeof document !== "undefined" && drawerOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[190] flex justify-end"
            data-strategist-drawer-open=""
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
              aria-label="Chiudi portaborse"
              onClick={() => setDrawerOpen(false)}
            />
            <aside
              className="relative z-10 flex h-full w-full max-w-[500px] flex-col border-l border-[var(--border-default)] bg-[var(--surface-1)] text-[var(--ink-primary)] shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Portaborse di Vannacci"
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-3.5">
                <div>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-cyan-300 light:text-cyan-700">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    PORTABORSE OPERATIVO · ROBERTO VANNACCI
                  </p>
                  <h3 className="mt-0.5 text-[16px] font-semibold tracking-tight">
                    Cabina di approfondimento tattico
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-secondary)] hover:border-[var(--border-default)] hover:text-[var(--ink-primary)]"
                  aria-label="Chiudi"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>

              <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-[var(--border-subtle)] px-4 py-3" role="group" aria-label="Domande rapide">
                {quickChips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={streaming}
                    onClick={() => void sendChat(q)}
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)]/70 px-3 py-1 text-left text-[11px] leading-snug text-[var(--ink-secondary)] transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-[var(--ink-primary)] disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 ${DARK_SCROLL}`} aria-live="polite">
                {chat.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/40 p-4 text-[12.5px] leading-relaxed text-[var(--ink-muted)]">
                    Seleziona una domanda rapida o chiedi un approfondimento su una direttrice B.I.P., una regione o una contromossa sulla Manovra. Il portaborse interroga solo i dati verificati della piattaforma.
                  </div>
                ) : null}
                {chat.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "status"
                        ? "flex justify-start"
                        : m.role === "user"
                          ? "ml-8 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-2.5"
                          : "rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/65 px-4 py-3"
                    }
                  >
                    {m.role === "status" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10.5px] text-cyan-200 light:text-cyan-800">
                        <Activity className="h-3 w-3 animate-pulse" aria-hidden />
                        {m.content}
                      </span>
                    ) : m.role === "user" ? (
                      <>
                        <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-cyan-300 light:text-cyan-700">
                          Tu · Cabina
                        </span>
                        <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-primary)]">{m.content}</p>
                      </>
                    ) : (
                      <>
                        <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-emerald-300 light:text-emerald-700">
                          Portaborse
                        </span>
                        <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--ink-primary)]">
                          {m.content || (streaming ? "Elaborazione in corso…" : "")}
                        </p>
                      </>
                    )}
                  </div>
                ))}

                {toolsUsed.length > 0 ? (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/40 p-3 text-[11.5px] leading-relaxed text-[var(--ink-muted)]">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-secondary)]">
                      Moduli interrogati
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {toolsUsed.map((t) => (
                        <span key={t} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-secondary)]">
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px]">
                      Gli scenari Base/Offensiva restano proiezioni condizionate all&apos;esecuzione, non garanzie automatiche.
                    </p>
                  </div>
                ) : lastAssistant?.content ? (
                  <p className="border-t border-[var(--border-subtle)] pt-2.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                    Nota: gli scenari Base e Offensiva restano proiezioni condizionate all&apos;esecuzione delle priorità, non certezza automatica.
                  </p>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              <form
                className="flex shrink-0 items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendChat(input);
                }}
              >
                <label className="sr-only" htmlFor="strategist-chat-input">
                  Messaggio al portaborse
                </label>
                <input
                  id="strategist-chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Chiedi un piano di piazza, dati o contromosse…"
                  disabled={streaming}
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-cyan-400/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3.5 font-mono text-[11.5px] font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-45 light:text-cyan-900"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {streaming ? "…" : "Invia"}
                </button>
              </form>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col gap-5 text-[var(--ink-primary)]">
      <section aria-labelledby="forecast-briefing-title" className="flex flex-col gap-5">
        {/* HEADER COMPATTO + TELEMETRIA ALLINEAMENTO */}
        <header className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 font-mono text-[10.5px] font-medium tracking-[0.14em] text-emerald-300 light:text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              {horizonKicker}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium ${freshTone}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {freshnessLabel(effectiveFreshness)}
              </span>
              <EpistemicBadge status="INTERPRETAZIONE_IPOTESI" />
              {briefing?.computationId ? (
                <span
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-muted)]"
                  title={briefing.computationId}
                >
                  {shortComputationRef(briefing.computationId).label}
                </span>
              ) : null}
              <button
                type="button"
                disabled={briefingLoading}
                onClick={() => void loadBriefing(true)}
                className="obj-press inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 font-mono text-[11px] text-[var(--ink-secondary)] hover:border-[var(--ink-muted)] hover:text-[var(--ink-primary)] disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${briefingLoading ? "animate-spin" : ""}`} aria-hidden />
                {briefingLoading ? "Generazione…" : "Aggiorna"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 id="forecast-briefing-title" className="text-[clamp(18px,2vw,24px)] font-semibold tracking-tight text-[var(--ink-primary)]">
              {horizonKey === "d30"
                ? "Cosa fare nelle prossime 4 settimane (Manovra & media)"
                : horizonKey === "d90"
                  ? "Come preparare la rete entro febbraio"
                  : "Perché e a quali condizioni si sale verso Maggio"}
            </h3>
          </div>

          {/* STRISCIA EQUAZIONE V4 SULL'ORIZZONTE (ANCORAGGIO VISIVO DEI NUMERI) */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/55 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
              <span className="text-[var(--ink-muted)]">
                Oggi <strong className="text-[var(--ink-primary)]">{formatDecimalIt(v4.startPct, 2)}%</strong>
              </span>
              <ArrowRight className="h-3 w-3 text-[var(--ink-muted)]" aria-hidden />
              <span className={`rounded px-1.5 py-0.5 ${viewScenario === "passivo" ? "bg-[var(--surface-1)] font-semibold text-[var(--ink-primary)] ring-1 ring-[var(--border-default)]" : "text-[var(--ink-secondary)]"}`}>
                Passivo {formatDecimalIt(passivePct, 2)}%
              </span>
              <span className={`rounded px-1.5 py-0.5 ${viewScenario === "base" ? "bg-cyan-500/15 font-semibold text-cyan-200 ring-1 ring-cyan-400/35 light:text-cyan-900" : "text-[var(--ink-secondary)]"}`}>
                Base {formatDecimalIt(basePct, 2)}%
              </span>
              <span className={`rounded px-1.5 py-0.5 ${viewScenario === "offensiva" ? "bg-emerald-500/15 font-semibold text-emerald-200 ring-1 ring-emerald-400/35 light:text-emerald-900" : "text-[var(--ink-secondary)]"}`}>
                Offensiva {formatDecimalIt(offensivePctNum, 2)}%
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {sortedFactors.map((factor) => {
                const positive = factor.pp >= 0;
                return (
                  <span
                    key={factor.id}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] tabular-nums ${
                      positive
                        ? "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-300 light:text-emerald-800"
                        : "border-amber-400/25 bg-amber-500/[0.08] text-amber-300 light:text-amber-800"
                    }`}
                  >
                    {positive ? <TrendingUp className="h-2.5 w-2.5" aria-hidden /> : <TrendingDown className="h-2.5 w-2.5" aria-hidden />}
                    <span>{FACTOR_SHORT[factor.id] ?? factor.short}</span>
                    <strong>{positive ? "+" : ""}{formatDecimalIt(factor.pp, 2)}</strong>
                  </span>
                );
              })}
            </div>
          </div>
        </header>

        {/* STATO CARICAMENTO */}
        {briefingLoading && !briefing ? (
          <div
            className="rounded-xl border border-cyan-400/25 bg-cyan-500/[0.05] p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 shrink-0 animate-spin text-cyan-300 light:text-cyan-700" aria-hidden />
              <div>
                <p className="text-[13.5px] font-semibold">Elaborazione del dossier tattico sull&apos;orizzonte</p>
                <p className="text-[12px] text-[var(--ink-muted)]">
                  Allineamento tra consenso misurato, leve di spinta, notizie attive e misure B.I.P.…
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3" aria-hidden>
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 p-3.5">
                  <div className="h-2.5 w-28 animate-pulse rounded bg-white/10" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-white/10" />
                  <div className="h-2.5 w-5/6 animate-pulse rounded bg-white/10" />
                  <div className="h-2.5 w-3/4 animate-pulse rounded bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {briefingError && !briefing ? (
          <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 p-3.5 text-[13px] text-rose-200 light:text-rose-800">
            Mancante / fonte non disponibile: {briefingError}
          </div>
        ) : null}

        {briefingStale ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-[12.5px]" role="alert">
            <p className="max-w-[72ch] leading-relaxed text-[var(--ink-primary)]">
              Sintesi riferita a un&apos;elaborazione precedente (
              <code className="font-mono text-[11px]">{briefing?.computationId ? shortComputationRef(briefing.computationId).label : "—"}</code>
              {" "}vs attivo{" "}
              <code className="font-mono text-[11px]">{shortComputationRef(activeComputationId).label}</code>
              ).
            </p>
            <button
              type="button"
              disabled={briefingLoading}
              onClick={() => void loadBriefing(true)}
              className="rounded-md border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 font-mono text-[11px] font-medium text-amber-200 hover:bg-amber-500/25 light:text-amber-900"
            >
              Ri-allinea sintesi
            </button>
          </div>
        ) : null}

        {briefing && !briefingStale ? (
          <>
            {/* 1. TESI SULL'ORIZZONTE · 3 CARD AFFIANCATE STILE 04 · OBIETTIVO */}
            <div>
              <p className={KICKER}>TESI SULL&apos;ORIZZONTE · QUADRO, FATTORI E CONDIZIONI</p>
              <div className="mt-2 grid grid-cols-1 gap-3 xl:grid-cols-3" aria-label="Analisi previsionale">
                {splitTesiParagraphs(briefing.tesi).map((para, i) => {
                  const meta = TESI_META[i] ?? TESI_META[0];
                  const Icon = meta.icon;
                  return (
                    <article
                      key={meta.code}
                      className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/55 p-4"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] ${meta.accent}`}>
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <h4 className="truncate text-[13px] font-semibold tracking-tight text-[var(--ink-primary)]">
                              {meta.title}
                            </h4>
                            <p className="truncate font-mono text-[10px] text-[var(--ink-muted)]">{meta.subtitle}</p>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-[var(--ink-muted)]">
                          {meta.code}
                        </span>
                      </div>
                      <p className="mt-3 text-[13px] leading-[1.68] text-[var(--ink-secondary)]">
                        {renderRichCopy(para)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* 2. DIRETTRICI OPERATIVE 01–04 · CARD TATTICHE STRUTTURATE */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={KICKER}>PIANO D&apos;AZIONE · {briefing.priorita.length} DIRETTRICI PRIORITARIE</p>
                <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                  Passa il cursore o clicca una regione per evidenziarla sulla mappa
                </span>
              </div>

              <ol className="mt-2.5 grid grid-cols-1 gap-3 2xl:grid-cols-2">
                {briefing.priorita.map((p) => {
                  const { headline, detail } = splitActionLead(p.azione);
                  const rationale = editorialCopy(p.perche);
                  const validRegions = p.regioni
                    .map(asRegion)
                    .filter((r): r is Region => r !== null);

                  return (
                    <li
                      key={p.rank}
                      onMouseEnter={() => onHoverRegions?.(validRegions)}
                      onMouseLeave={() => onHoverRegions?.(null)}
                      className="group flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/45 p-4 transition-colors hover:border-emerald-400/35 hover:bg-[var(--surface-2)]/70"
                    >
                      <div>
                        {/* Card Top: Rank + Headline + CTA */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-400/35 bg-cyan-500/10 font-mono text-[13px] font-semibold tabular-nums text-cyan-200 light:text-cyan-800"
                              aria-hidden
                            >
                              {padRank(p.rank)}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-[14.5px] font-semibold leading-snug tracking-tight text-[var(--ink-primary)]">
                                {headline}
                              </h4>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => deepen(p)}
                            disabled={streaming}
                            className="obj-press inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-cyan-400/35 bg-cyan-500/10 px-2.5 font-mono text-[10.5px] font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-45 light:text-cyan-800"
                          >
                            <MessageSquare className="h-3 w-3" aria-hidden />
                            <span>Portaborse →</span>
                          </button>
                        </div>

                        {/* Dettaglio operativo / Bersagli & Proposta */}
                        {detail ? (
                          <div className="mt-2.5 pl-11">
                            <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                              Cosa fare &amp; messaggio
                            </p>
                            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                              {renderRichCopy(detail)}
                            </p>
                          </div>
                        ) : null}

                        {/* Razionale V4 / Perché sposta voti */}
                        <div className="mt-3 ml-11 rounded-lg border-l-2 border-emerald-400/75 bg-emerald-500/[0.05] py-2 pl-3 pr-2.5">
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-emerald-300 light:text-emerald-700">
                            Perché incide sull&apos;orizzonte
                          </p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                            {renderRichCopy(rationale)}
                          </p>
                        </div>
                      </div>

                      {/* Footer: Pillole Regioni + Badge Misura B.I.P. */}
                      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3 pl-11">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                          {p.regioni.map((reg) => {
                            const typed = asRegion(reg);
                            const active = typed != null && selectedRegion === typed;
                            return typed && onSelectRegion ? (
                              <button
                                key={reg}
                                type="button"
                                onClick={() => onSelectRegion(typed)}
                                className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] transition-colors ${
                                  active
                                    ? "border-emerald-400/60 bg-emerald-500/20 font-semibold text-emerald-200 light:text-emerald-900"
                                    : "border-[var(--border-default)] bg-[var(--surface-1)] text-[var(--ink-secondary)] hover:border-emerald-400/45 hover:text-[var(--ink-primary)]"
                                }`}
                              >
                                {reg}
                              </button>
                            ) : (
                              <span
                                key={reg}
                                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2 py-0.5 font-mono text-[10.5px] text-[var(--ink-secondary)]"
                              >
                                {reg}
                              </span>
                            );
                          })}
                        </div>

                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-cyan-400/25 bg-cyan-500/[0.07] px-2 py-0.5 font-mono text-[10.5px] text-cyan-200 light:text-cyan-900">
                          <BookOpen className="h-3 w-3 shrink-0 text-cyan-300 light:text-cyan-700" aria-hidden />
                          <span className="truncate">{p.levaBip}</span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* 3. VINCOLI DI CREDIBILITÀ & PROTOCOLLO DI PRUDENZA */}
            {briefing.rischi.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={KICKER}>VINCOLI DI CREDIBILITÀ &amp; RISCHI OPERATIVI</p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9.5px] text-amber-200 light:text-amber-800">
                    <ShieldAlert className="h-3 w-3" aria-hidden />
                    PROTOCOLLO DI PRUDENZA
                  </span>
                </div>

                <ul className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {briefing.rischi.map((r, idx) => {
                    const clean = editorialCopy(r);
                    const isLastOdd = briefing.rischi.length % 2 === 1 && idx === briefing.rischi.length - 1;
                    return (
                      <li
                        key={r}
                        className={`rounded-xl border p-3.5 ${
                          isLastOdd
                            ? "border-amber-400/35 bg-amber-500/[0.06] md:col-span-2"
                            : "border-[var(--border-subtle)] bg-[var(--surface-2)]/45"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-mono text-[10px] uppercase tracking-[0.12em] ${isLastOdd ? "text-amber-200 light:text-amber-800" : "text-[var(--ink-muted)]"}`}>
                            {classifyRiskTitle(clean, idx)}
                          </p>
                          <span className="font-mono text-[10px] text-[var(--ink-muted)]">R{idx + 1}</span>
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">
                          {renderRichCopy(clean)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {onOpenFattori ? (
        <nav className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3" aria-label="Approfondimenti">
          <span className="text-[12px] text-[var(--ink-muted)]">
            Vuoi testare varianti sulle leve, comitati o notizie attive?
          </span>
          <button
            type="button"
            onClick={onOpenFattori}
            className="obj-press inline-flex items-center gap-1.5 rounded-md border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 font-mono text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20 light:text-cyan-800"
          >
            <span>Approfondisci in 02 · Fattori e Simulazioni</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </nav>
      ) : null}

      {drawerNode}
    </div>
  );
}
