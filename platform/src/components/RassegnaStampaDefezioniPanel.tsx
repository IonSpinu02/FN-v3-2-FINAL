"use client";

import { useRealtimeDomain } from "@/components/realtime/RealtimeSyncProvider";
import {
  computeSimulatorAggregates,
  countAnagrafeByFilter,
  DEFECTION_REGIONS,
  filterPoliticians,
  passaggioCompattoLine,
  passaggioMetaLine,
  registerManualPassaggio,
  ruoloBadgeShort,
  ruoloPrefix,
  sortPoliticians,
  type AnagrafeFilterId,
  type DefectionNewsItem,
  type PartitoProvenienza,
  type PoliticianRole,
  type PoliticianSortKey,
  type TrackedPolitician,
} from "@/lib/politicalDefectionsEngine";
import { INITIAL_TRACKED_POLITICIANS } from "@/lib/politicalDefectionsCatalog";
import { decodeRssPlainText } from "@/lib/engine/newsIngest";
import type { Region } from "@/lib/engine/constants";
import { formatApproximateVotes, formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { toggleSimulatedEntry, useSimulatedEntries } from "@/lib/simulatedEntriesStore";
import { RassegnaStampaConsensoChart } from "@/components/RassegnaStampaConsensoChart";
import { TavilyDailyBadge, tavilyScanButtonState } from "@/components/TavilyDailyBadge";
import { EpistemicBadge, HumanSupervisionControls } from "@/components/EpistemicBadge";
import {
  classifyHeadlineEpistemic,
  newsEntityId,
  partySwitchEntityId,
} from "@/lib/engine/epistemicStatus";
import type { TavilyGateMeta } from "@/lib/cache/tavilyDailyMeta";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const PANEL_SCROLL =
  "overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const NEWS_PAGE = 5;
const LIST_PAGE = 8;

const NEWS_ORIGIN_FILTERS = [
  { id: "ALL", label: "Tutte le Notizie" },
  { id: "Lega", label: "Da Lega" },
  { id: "Fratelli d'Italia", label: "Da FdI" },
  { id: "Forza Italia", label: "Da Forza Italia / Civici" },
] as const;

const LIST_PROVENIENZA_FILTERS = [
  { id: "ALL", label: "Tutte le provenienze", search: "" },
  { id: "Lega", label: "Da Lega", search: "da lega" },
  { id: "FdI", label: "Da FdI", search: "da fdi" },
  { id: "FI", label: "Da Forza Italia", search: "forza italia" },
  { id: "Altri", label: "Ex M5S/Altri", search: "ex m5s" },
] as const;

function statoAdesioneBadge(p: TrackedPolitician): { label: string; className: string } {
  if (p.statoAdesioneFN === "Ufficiale in FN") {
    return { label: "In FN", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" };
  }
  if (p.statoAdesioneFN === "Uscito nel Misto (Contendibile)") {
    return {
      label: "Contendibile nel Misto",
      className: "border-cyan-500/40 bg-cyan-500/15 text-cyan-100",
    };
  }
  if (p.partitoProvenienza === "Lega") {
    return {
      label: "Uscito da Lega",
      className: "border-amber-500/40 bg-amber-500/15 text-amber-100",
    };
  }
  if (p.partitoProvenienza === "Fratelli d'Italia") {
    return {
      label: "Uscito da FdI",
      className: "border-amber-500/40 bg-amber-500/15 text-amber-100",
    };
  }
  return {
    label: p.statoAdesioneFN ?? "Monitorato",
    className: "border-white/15 bg-white/5 text-slate-300",
  };
}

function formatNewsDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function newsSnippet(n: DefectionNewsItem, fallback?: string): string {
  const raw = n.sintesi?.trim() || fallback || n.titolo;
  return decodeRssPlainText(raw);
}

function badgeNotizia(stato: DefectionNewsItem["statoNotizia"]) {
  if (stato === "PASSAGGIO UFFICIALE")
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
  if (stato === "CAMBIO GRUPPO") return "border-cyan-500/40 bg-cyan-500/15 text-cyan-200";
  if (stato === "MOVIMENTO ALTRI PARTITI (Esterno a FN)")
    return "border-slate-500/40 bg-slate-500/15 text-slate-300";
  return "border-yellow-500/40 bg-yellow-500/15 text-yellow-200";
}

export function RassegnaStampaDefezioniPanel() {
  const [politicians, setPoliticians] = useState<TrackedPolitician[]>(
    INITIAL_TRACKED_POLITICIANS,
  );
  const [news, setNews] = useState<DefectionNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState<Region | "ALL">("ALL");
  const [newsOrigin, setNewsOrigin] = useState<(typeof NEWS_ORIGIN_FILTERS)[number]["id"]>("ALL");
  const [newsSearch, setNewsSearch] = useState("");
  const [newsPage, setNewsPage] = useState(1);
  const [listPage, setListPage] = useState(1);
  const [listStato, setListStato] = useState<AnagrafeFilterId>("ALL");
  const [listRuolo, setListRuolo] = useState<"ALL" | "PARLAMENTO" | "CONSIGLIERE" | "SINDACO">("ALL");
  const [listSort, setListSort] = useState<PoliticianSortKey>("data");
  const [listSearch, setListSearch] = useState("");
  const [listProvenienza, setListProvenienza] =
    useState<(typeof LIST_PROVENIENZA_FILTERS)[number]["id"]>("ALL");
  const [verifyQ, setVerifyQ] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyHits, setVerifyHits] = useState<
    Array<{
      slug?: string;
      nome: string;
      collegioDisplay: string;
      daPartito: string;
      aPartito: string;
      fonteStampa?: { testata: string; url: string; titoloArticolo: string };
      beneficio: { voti: number; pp: number };
    }>
  >([]);
  const [verifyLive, setVerifyLive] = useState<DefectionNewsItem[]>([]);
  const [excludedEntityIds, setExcludedEntityIds] = useState<string[]>([]);
  const simulatedEntries = useSimulatedEntries();

  const reloadExclusions = useCallback(() => {
    void fetch("/api/ledger/supervision?limit=200", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { activeExclusions?: string[] };
        if (Array.isArray(json.activeExclusions)) {
          setExcludedEntityIds(json.activeExclusions);
        }
      })
      .catch(() => undefined);
  }, []);

  const simulatedIds = useMemo(
    () => new Set(simulatedEntries.map((p) => p.id)),
    [simulatedEntries],
  );
  const [registerOpen, setRegisterOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rassegnaVista, setRassegnaVista] = useState<"live" | "trend">("live");
  const [form, setForm] = useState({
    nome: "",
    ruolo: "Deputato" as PoliticianRole,
    regione: "Lombardia" as Region,
    provincia: "",
    provenienza: "Lega" as PartitoProvenienza,
    preferenze: 8000,
  });

  const [tavilyMeta, setTavilyMeta] = useState<TavilyGateMeta | null>(null);
  const [tavilyReceivedAt, setTavilyReceivedAt] = useState(0);
  const [tavilyBusy, setTavilyBusy] = useState(false);

  /** `background`: aggiorna le notizie senza sostituire il pannello con il caricamento. */
  const load = useCallback(async (opts?: { force?: boolean; background?: boolean }) => {
    if (!opts?.background) setLoading(true);
    try {
      const res = await fetch(`/api/press/defections${opts?.force ? "?force=1" : ""}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        politicians: TrackedPolitician[];
        news: DefectionNewsItem[];
        meta?: { news?: { tavily?: TavilyGateMeta } };
      };
      setPoliticians(data.politicians ?? INITIAL_TRACKED_POLITICIANS);
      setNews(data.news ?? []);
      setTavilyMeta(data.meta?.news?.tavily ?? null);
      setTavilyReceivedAt(Date.now());
    } catch {
      setPoliticians(INITIAL_TRACKED_POLITICIANS);
    } finally {
      if (!opts?.background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    reloadExclusions();
  }, [reloadExclusions]);

  useRealtimeDomain("supervision", reloadExclusions);
  useRealtimeDomain("news", () => {
    void load({ background: true });
  });

  const tavilyButton = tavilyScanButtonState(
    tavilyMeta,
    tavilyReceivedAt,
    "[ ↻ Scansiona cambi di partito con Tavily ]",
  );

  const runTavilyScan = useCallback(
    async (force: boolean) => {
      setTavilyBusy(true);
      try {
        await load({ force, background: true });
      } finally {
        setTavilyBusy(false);
      }
    },
    [load],
  );

  const simulator = useMemo(
    () => computeSimulatorAggregates(politicians, simulatedIds),
    [politicians, simulatedIds],
  );

  const politicianById = useMemo(() => {
    const m = new Map<string, TrackedPolitician>();
    for (const p of politicians) m.set(p.id, p);
    return m;
  }, [politicians]);

  const filteredNews = useMemo(() => {
    let items = news.filter((n) => {
      const nid = newsEntityId(n.titolo);
      const pid = n.politicianId
        ? partySwitchEntityId(n.politicianId)
        : null;
      if (excludedEntityIds.includes(nid)) return false;
      if (pid && excludedEntityIds.includes(pid)) return false;
      return true;
    });
    if (regionFilter !== "ALL") {
      items = items.filter((n) => {
        const p = n.politicianId ? politicianById.get(n.politicianId) : null;
        return p?.regione === regionFilter;
      });
    }
    if (newsOrigin !== "ALL") {
      items = items.filter((n) => {
        const prov = n.partitoProvenienza ?? politicianById.get(n.politicianId ?? "")?.partitoProvenienza;
        if (newsOrigin === "Forza Italia") {
          return prov === "Forza Italia" || prov === "Lista Civica CDX";
        }
        return prov === newsOrigin;
      });
    }
    const q = newsSearch.trim().toLowerCase();
    if (q) {
      items = items.filter((n) => {
        const p = n.politicianId ? politicianById.get(n.politicianId) : null;
        return (
          n.titolo.toLowerCase().includes(q) ||
          p?.nome.toLowerCase().includes(q) ||
          p?.provinciaCollegio.toLowerCase().includes(q)
        );
      });
    }
    return items;
  }, [news, regionFilter, newsOrigin, newsSearch, politicianById, excludedEntityIds]);

  const newsPages = Math.max(1, Math.ceil(filteredNews.length / NEWS_PAGE));
  const safeNewsPage = Math.min(newsPage, newsPages);
  const newsSlice = filteredNews.slice((safeNewsPage - 1) * NEWS_PAGE, safeNewsPage * NEWS_PAGE);

  const filteredList = useMemo(() => {
    const provenienzaSearch =
      LIST_PROVENIENZA_FILTERS.find((f) => f.id === listProvenienza)?.search ?? "";
    const mergedSearch = [listSearch.trim(), provenienzaSearch].filter(Boolean).join(" ");
    // Se entrambi presenti, filterPoliticians fa OR su provenienza alias — applichiamo in cascata.
    let base = filterPoliticians(politicians, {
      regione: regionFilter,
      stato: listStato,
      ruolo: listRuolo,
      search: listSearch,
      rassegnaExternalsOnly: true,
    });
    if (provenienzaSearch) {
      base = filterPoliticians(base, { search: provenienzaSearch });
    }
    void mergedSearch;
    return sortPoliticians(base, listSort);
  }, [
    politicians,
    regionFilter,
    listStato,
    listRuolo,
    listSearch,
    listProvenienza,
    listSort,
  ]);

  const runVerifySearch = useCallback(async () => {
    const q = verifyQ.trim();
    if (q.length < 2) return;
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const res = await fetch(
        `/api/press/defections/verify?q=${encodeURIComponent(q)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        catalog?: Array<{
          slug?: string;
          nome: string;
          collegioDisplay: string;
          daPartito: string;
          aPartito: string;
          fonteStampa?: { testata: string; url: string; titoloArticolo: string };
          beneficio: { voti: number; pp: number };
        }>;
        liveSources?: DefectionNewsItem[];
        error?: string;
      };
      if (!res.ok) {
        setVerifyError(data.error ?? "Ricerca non riuscita");
        setVerifyHits([]);
        setVerifyLive([]);
        return;
      }
      setVerifyHits(data.catalog ?? []);
      setVerifyLive(data.liveSources ?? []);
    } catch {
      setVerifyError("Errore di rete sulla verifica live");
      setVerifyHits([]);
      setVerifyLive([]);
    } finally {
      setVerifyBusy(false);
    }
  }, [verifyQ]);

  const listPages = Math.max(1, Math.ceil(filteredList.length / LIST_PAGE));
  const safeListPage = Math.min(listPage, listPages);
  const listSlice = filteredList.slice(
    (safeListPage - 1) * LIST_PAGE,
    safeListPage * LIST_PAGE,
  );

  useEffect(() => {
    if (listPage > listPages) setListPage(listPages);
  }, [listPage, listPages]);

  const counts = useMemo(
    () => countAnagrafeByFilter(politicians, regionFilter),
    [politicians, regionFilter],
  );

  const toggleSimulaFn = (id: string) => {
    const p = politicianById.get(id);
    if (!p) return;
    toggleSimulatedEntry({
      id: p.id,
      nome: p.nome,
      ruolo: p.ruolo,
      regione: p.regione,
      votiPortati:
        p.beneficioIngressoFn?.votiPortatiStimati ?? p.doteElettorale.votiPortatiStimati,
    });
  };

  const submitRegister = () => {
    if (!form.nome.trim() || !form.provincia.trim()) return;
    const nuovo = registerManualPassaggio({
      nome: form.nome.trim(),
      ruolo: form.ruolo,
      regione: form.regione,
      provinciaCollegio: form.provincia.trim(),
      partitoProvenienza: form.provenienza,
      preferenzeStoriche: form.preferenze,
    });
    setPoliticians((prev) => [nuovo, ...prev]);
    setRegisterOpen(false);
    setForm((f) => ({ ...f, nome: "", provincia: "" }));
  };

  const workspaceH =
    "min-h-[520px] lg:min-h-0 lg:h-[calc(100dvh-9.5rem)] lg:max-h-[calc(100dvh-9.5rem)]";
  const filtersActive =
    listStato !== "ALL" || listRuolo !== "ALL" || listProvenienza !== "ALL" || listSearch.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-28">
      <header className="shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 text-[15px] font-semibold tracking-tight text-[var(--ink-primary)]">
            03 · Rassegna stampa
          </h2>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] tabular-nums text-[var(--ink-secondary)]">
            <span>{simulator.ultimiCambiCount} cambi</span>
            <span>{simulator.ingressiSimulatiCount} simulati</span>
            <span>{formatApproximateVotes(simulator.beneficioVotiTotal)}</span>
            <span>+{formatDecimalIt(simulator.spintaMediaPp, 2)} pp</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVerifyOpen((o) => !o)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink-primary)]"
            >
              Verifica Live
            </button>
            <button
              type="button"
              onClick={() => setRegisterOpen((o) => !o)}
              className="rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink-primary)]"
            >
              + Segnala
            </button>
            <button
              type="button"
              onClick={() => setRassegnaVista((v) => (v === "live" ? "trend" : "live"))}
              className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-[12px] text-[var(--ink-secondary)]"
            >
              {rassegnaVista === "trend" ? "Operatività Live" : "Grafico Supermedia"}
            </button>
            <select
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value as Region | "ALL");
                setNewsPage(1);
                setListPage(1);
              }}
              className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-white lg:text-[13px]"
            >
              <option value="ALL">Tutte le Regioni</option>
              {DEFECTION_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setRegisterOpen((o) => !o)}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
            >
              + Segnala transizione
            </button>
          </div>
        </div>

        {registerOpen ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-white/[0.08] bg-black/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              placeholder="Nome cognome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="rounded-lg border border-white/10 bg-[#080C14] px-2 py-1.5 text-xs text-white"
            />
            <select
              value={form.ruolo}
              onChange={(e) => setForm((f) => ({ ...f, ruolo: e.target.value as PoliticianRole }))}
              className="rounded-lg border border-white/10 bg-[#080C14] px-2 py-1.5 text-xs text-white"
            >
              <option value="Deputato">Deputato</option>
              <option value="Senatore">Senatore</option>
              <option value="Eurodeputato">Eurodeputato</option>
              <option value="Consigliere Regionale">Consigliere Regionale</option>
              <option value="Sindaco">Sindaco</option>
              <option value="Dirigente / Amministratore">Dirigente / Amministratore</option>
            </select>
            <select
              value={form.regione}
              onChange={(e) => setForm((f) => ({ ...f, regione: e.target.value as Region }))}
              className="rounded-lg border border-white/10 bg-[#080C14] px-2 py-1.5 text-xs text-white"
            >
              {DEFECTION_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              placeholder="Provincia / collegio"
              value={form.provincia}
              onChange={(e) => setForm((f) => ({ ...f, provincia: e.target.value }))}
              className="rounded-lg border border-white/10 bg-[#080C14] px-2 py-1.5 text-xs text-white"
            />
            <select
              value={form.provenienza}
              onChange={(e) =>
                setForm((f) => ({ ...f, provenienza: e.target.value as PartitoProvenienza }))
              }
              className="rounded-lg border border-white/10 bg-[#080C14] px-2 py-1.5 text-xs text-white"
            >
              <option value="Lega">Lega</option>
              <option value="Fratelli d'Italia">Fratelli d&apos;Italia</option>
              <option value="Forza Italia">Forza Italia</option>
              <option value="Gruppo Misto">Gruppo Misto</option>
              <option value="Lista Civica CDX">Lista Civica CDX</option>
              <option value="Altri">Altri</option>
            </select>
            <input
              type="number"
              placeholder="Preferenze storiche"
              value={form.preferenze}
              onChange={(e) => setForm((f) => ({ ...f, preferenze: Number(e.target.value) }))}
              className="rounded-lg border border-white/10 bg-[#080C14] px-2 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              onClick={submitRegister}
              className="rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100"
            >
              Salva in anagrafe FN
            </button>
          </div>
        ) : null}

        {verifyOpen ? (
        <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Ricerca Verifica Cambio Partito (Live)
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Google News live + articoli della scansione Tavily di oggi · nessun credito Tavily extra
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={verifyQ}
              onChange={(e) => {
                const next = e.target.value;
                setVerifyQ(next);
                if (next.trim().length > 0) setVerifyOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runVerifySearch();
              }}
              placeholder="Nome politico, regione o collegio…"
              className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-white/10 bg-[#080C14] px-3 py-2 text-[13px] text-white placeholder:text-slate-500 sm:min-w-[220px]"
            />
            <button
              type="button"
              disabled={verifyBusy || verifyQ.trim().length < 2}
              onClick={() => void runVerifySearch()}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40 hover:bg-cyan-500/25"
            >
              {verifyBusy ? "Verifica…" : "Verifica live"}
            </button>
          </div>
          {verifyError ? (
            <p className="mt-2 text-xs text-red-300">{verifyError}</p>
          ) : null}
          {verifyHits.length > 0 || verifyLive.length > 0 ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {verifyHits.slice(0, 4).map((h) => (
                <div
                  key={`${h.nome}-${h.collegioDisplay}`}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs"
                >
                  <p className="font-semibold text-white">{h.nome}</p>
                  <p className="text-slate-400">
                    {h.daPartito} → {h.aPartito} · {h.collegioDisplay}
                  </p>
                  <p className="mt-1 font-mono text-emerald-400">
                    {formatApproximateVotes(h.beneficio.voti)} · +
                    {formatDecimalIt(h.beneficio.pp, 2)} punti
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {h.fonteStampa?.url ? (
                      <a
                        href={h.fonteStampa.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-amber-200 hover:underline"
                        title={h.fonteStampa.titoloArticolo}
                      >
                        Fonte: {h.fonteStampa.testata} ↗
                      </a>
                    ) : null}
                    {h.slug ? (
                      <Link
                        href={`/app/news/${h.slug}`}
                        className="text-[11px] text-cyan-200 hover:underline"
                      >
                        Apri Dossier →
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
              {verifyLive.slice(0, 4).map((n) => (
                <a
                  key={n.id}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs hover:border-white/20"
                >
                  <p className="font-medium text-slate-200 line-clamp-2">{n.titolo}</p>
                  <p className="mt-1 text-slate-500">
                    {n.fonte} · fonte live verificata
                  </p>
                </a>
              ))}
            </div>
          ) : null}
        </div>
        ) : null}
      </header>

      {rassegnaVista === "trend" ? (
        <div className="shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3">
          <RassegnaStampaConsensoChart />
        </div>
      ) : null}

      {rassegnaVista !== "live" ? null : loading ? (
        <p className="text-sm text-slate-500">Caricamento feed e anagrafe…</p>
      ) : (
        <div
          className={`grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 xl:grid-cols-12 ${workspaceH}`}
        >
          {/* Sinistra — notizie */}
          <div className={`flex min-h-0 flex-col xl:col-span-5 ${workspaceH}`}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 lg:p-4">
              <div className="shrink-0 space-y-2.5 border-b border-white/[0.06] pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                    Notizie live sui cambi di partito
                  </p>
                  <button
                    type="button"
                    disabled={tavilyBusy || tavilyButton.disabled}
                    title={tavilyButton.title}
                    onClick={() => void runTavilyScan(tavilyButton.force)}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {tavilyBusy ? "[ Scansione in corso… ]" : tavilyButton.label}
                  </button>
                </div>
                <TavilyDailyBadge meta={tavilyMeta} nowMs={tavilyReceivedAt} />
                <div className="flex flex-wrap gap-1.5">
                  {NEWS_ORIGIN_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setNewsOrigin(f.id);
                        setNewsPage(1);
                      }}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                        newsOrigin === f.id
                          ? "border border-white/20 bg-white/10 text-white"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <input
                  value={newsSearch}
                  onChange={(e) => {
                    setNewsSearch(e.target.value);
                    setNewsPage(1);
                  }}
                  placeholder="Cerca nome o città…"
                  className="w-full rounded-lg border border-white/10 bg-[#080C14] px-3 py-2 text-[13px] text-white placeholder:text-slate-500"
                />
              </div>

              <div className={`min-h-0 flex-1 space-y-2.5 py-3 pr-1 ${PANEL_SCROLL}`}>
                {newsSlice.length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-slate-500">
                    Nessuna notizia con i filtri attivi.
                  </p>
                ) : null}
                {newsSlice.map((n) => {
                  const p = n.politicianId ? politicianById.get(n.politicianId) : null;
                  const snippet = newsSnippet(n);
                  const epistemic = classifyHeadlineEpistemic({
                    confidence:
                      n.statoNotizia === "PASSAGGIO UFFICIALE" ||
                      n.statoNotizia === "CAMBIO GRUPPO"
                        ? "high"
                        : "medium",
                    hasPrimarySource: Boolean(p?.fonteIstituzionale?.url || p?.schedaCameraUrl),
                  });
                  const entityId = newsEntityId(n.titolo);
                  return (
                    <article
                      key={n.id}
                      className="shrink-0 rounded-xl border border-white/[0.08] bg-[#0B101A] p-3.5 transition hover:border-white/[0.14] lg:p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                        <time dateTime={n.dataOra}>{formatNewsDate(n.dataOra)}</time>
                        <span aria-hidden className="text-slate-600">
                          ·
                        </span>
                        <span className="truncate">{n.fonte}</span>
                        <EpistemicBadge status={epistemic} className="ml-1" />
                        <span
                          className={`ml-auto shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${badgeNotizia(n.statoNotizia)}`}
                        >
                          {n.statoNotizia}
                        </span>
                      </div>
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-3 text-[15px] font-semibold leading-snug text-white hover:text-emerald-200 lg:text-base"
                      >
                        {decodeRssPlainText(n.titolo)}
                      </a>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-400">
                        {snippet}
                      </p>
                      {n.verificaEtichetta ? (
                        <p className="mt-2 font-mono text-[11px] text-cyan-300">
                          {n.verificaEtichetta}
                        </p>
                      ) : null}
                      {n.beneficioPotenzialeFn ? (
                        <div className="mt-2 space-y-0.5">
                          <p className="font-mono text-[12px] text-emerald-400">
                            Beneficio potenziale per FN (ipotesi):{" "}
                            {formatApproximateVotes(n.beneficioPotenzialeFn.voti)} (+
                            {formatDecimalIt(n.beneficioPotenzialeFn.pp, 2)} punti)
                          </p>
                          <p className="font-mono text-[10px] text-amber-200/90">
                            {n.ipotesiSimulataEtichetta ??
                              "Ipotesi simulata di trasferimento voti (non verificata)"}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 font-mono text-[11px] text-slate-400">
                          {n.statoNotizia === "MOVIMENTO ALTRI PARTITI (Esterno a FN)"
                            ? "Nessun effetto diretto per FN — movimento tra altri partiti"
                            : "Nessun beneficio voti per FN (manca menzione esplicita Futuro Nazionale / Vannacci)"}
                        </p>
                      )}
                      {p ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                          <span>
                            {ruoloPrefix(p.ruolo)} {p.nome} · {p.collegioDisplay}
                          </span>
                          {p.slug ? (
                            <Link
                              href={`/app/news/${p.slug}`}
                              className="text-cyan-300 hover:underline"
                            >
                              Apri Dossier →
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      <HumanSupervisionControls
                        entityType="news_item"
                        entityId={entityId}
                        currentStatus={epistemic}
                        onDecided={(_d, exclusions) => setExcludedEntityIds(exclusions)}
                      />
                    </article>
                  );
                })}
              </div>

              <div className="mt-auto flex shrink-0 items-center justify-between border-t border-white/[0.06] pt-3 text-[12px] text-slate-400">
                <button
                  type="button"
                  disabled={safeNewsPage <= 1}
                  onClick={() => setNewsPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/[0.04]"
                >
                  Precedente
                </button>
                <span className="font-mono tabular-nums">
                  {filteredNews.length === 0
                    ? "0 notizie"
                    : `${(safeNewsPage - 1) * NEWS_PAGE + 1}-${Math.min(safeNewsPage * NEWS_PAGE, filteredNews.length)} di ${filteredNews.length}`}
                </span>
                <button
                  type="button"
                  disabled={safeNewsPage >= newsPages}
                  onClick={() => setNewsPage((p) => Math.min(newsPages, p + 1))}
                  className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/[0.04]"
                >
                  Successiva
                </button>
              </div>
            </div>
          </div>

          {/* Destra — anagrafe */}
          <div className={`flex min-h-0 flex-col xl:col-span-7 ${workspaceH}`}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
              <div className="mb-3 shrink-0 space-y-2.5 border-b border-white/[0.07] pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="text-xs font-mono uppercase tracking-wider text-slate-300">
                      Ultimi cambi di partito rilevati
                    </p>
                    <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-slate-200">
                      {filteredList.length} esponenti
                    </span>
                  </div>
                  <select
                    value={listSort}
                    onChange={(e) => {
                      setListSort(e.target.value as PoliticianSortKey);
                      setListPage(1);
                    }}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200"
                  >
                    <option value="data">Ordina: Più recenti</option>
                    <option value="voti">Ordina: Beneficio voti FN</option>
                    <option value="media">Ordina: Potenza mediatica</option>
                  </select>
                </div>
                <input
                  value={listSearch}
                  onChange={(e) => {
                    setListSearch(e.target.value);
                    setListPage(1);
                  }}
                  placeholder="Cerca nome, cognome, collegio, regione o partito…"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-white placeholder:text-slate-500"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] p-0.5">
                    {(
                      [
                        ["ALL", `Tutti (${counts.ALL})`],
                        ["CAMBIO_GRUPPO", `Cambio Gruppo (${counts.CAMBIO_GRUPPO})`],
                        ["RUMOR", `Rumor (${counts.RUMOR})`],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setListStato(id);
                          setListPage(1);
                        }}
                        className={`rounded px-2 py-1 text-[12px] ${
                          listStato === id
                            ? "bg-[var(--surface-1)] text-[var(--ink-primary)]"
                            : "text-[var(--ink-muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <select
                    value={listProvenienza}
                    onChange={(e) => {
                      setListProvenienza(e.target.value as (typeof LIST_PROVENIENZA_FILTERS)[number]["id"]);
                      setListPage(1);
                    }}
                    className="rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2 py-1 text-[12px] text-[var(--ink-primary)]"
                    aria-label="Provenienza"
                  >
                    {LIST_PROVENIENZA_FILTERS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={listRuolo}
                    onChange={(e) => {
                      setListRuolo(e.target.value as typeof listRuolo);
                      setListPage(1);
                    }}
                    className="rounded-md border border-[var(--border-default)] bg-[var(--surface-2)] px-2 py-1 text-[12px] text-[var(--ink-primary)]"
                    aria-label="Ruolo"
                  >
                    <option value="ALL">Tutti i ruoli</option>
                    <option value="PARLAMENTO">Parlamentari</option>
                    <option value="CONSIGLIERE">Consiglieri Regionali</option>
                    <option value="SINDACO">Sindaci</option>
                  </select>
                  {filtersActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setListStato("ALL");
                        setListRuolo("ALL");
                        setListProvenienza("ALL");
                        setListSearch("");
                        setListPage(1);
                      }}
                      className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--ink-secondary)]"
                    >
                      Reset filtri
                    </button>
                  ) : null}
                </div>
              </div>

              {listSlice.length > 0 ? (
                <div className="hidden shrink-0 grid-cols-12 gap-3 border-b border-white/[0.06] px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 xl:grid">
                  <span className="col-span-3">Esponente &amp; Collegio</span>
                  <span className="col-span-2">Transizione</span>
                  <span className="col-span-3">Fonte verificata</span>
                  <span className="col-span-4 text-right">Beneficio se entra in FN</span>
                </div>
              ) : null}

              <div className={`min-h-0 flex-1 space-y-2 py-2 ${PANEL_SCROLL}`}>
                {listSlice.length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-slate-500">
                    Nessun profilo con i filtri attivi.
                  </p>
                ) : null}
                {listSlice.map((p) => {
                  const switchId = partySwitchEntityId(p.id);
                  if (excludedEntityIds.includes(switchId)) return null;
                  const b = p.beneficioIngressoFn;
                  const inSim = simulatedIds.has(p.id);
                  const pp = b?.crescitaRegionePp ?? p.doteElettorale.impattoRegionePp;
                  const voti = b?.votiPortatiStimati ?? p.doteElettorale.votiPortatiStimati;
                  const badge = statoAdesioneBadge(p);
                  const slug = p.slug ?? p.id;
                  const istUrl = p.fonteIstituzionale?.url ?? p.schedaCameraUrl;
                  const press = p.fonteStampa;
                  const epistemic = classifyHeadlineEpistemic({
                    hasPrimarySource: Boolean(istUrl),
                    confidence: istUrl ? "high" : "medium",
                  });
                  return (
                    <div
                      key={p.id}
                      className={`grid grid-cols-1 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 transition-all hover:bg-white/[0.04] xl:grid-cols-12 ${inSim ? "ring-1 ring-emerald-500/40" : ""}`}
                    >
                      <div className="col-span-3 min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <Link
                            href={`/app/news/${slug}`}
                            className="truncate text-sm font-semibold text-white hover:text-emerald-200"
                          >
                            {p.nome}
                          </Link>
                          <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                            {ruoloBadgeShort(p.ruolo)}
                          </span>
                          <span
                            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">
                          {p.ruolo} · {p.collegioDisplay}
                        </p>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">
                          {passaggioCompattoLine(p)}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {p.dataCambioPartito
                            ? `${formatNewsDate(p.dataCambioPartito)} · `
                            : ""}
                          {passaggioMetaLine(p)}
                        </p>
                      </div>
                      <div className="col-span-3 min-w-0 space-y-1.5">
                        {istUrl ? (
                          <a
                            href={istUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 hover:bg-cyan-500/20"
                          >
                            Atto Camera.it ↗
                          </a>
                        ) : (
                          <span className="text-[10px] text-red-300">Atto mancante</span>
                        )}
                        {press?.url ? (
                          <a
                            href={press.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={press.titoloArticolo}
                            className="ml-1.5 inline-flex max-w-full items-center truncate rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100 hover:bg-amber-500/20"
                          >
                            Fonte: {press.testata} ↗
                          </a>
                        ) : (
                          <span className="ml-1.5 text-[10px] text-red-300">Fonte stampa mancante</span>
                        )}
                      </div>
                      <div className="col-span-4 flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <div className="text-right">
                          <p className="whitespace-nowrap font-mono text-xs font-bold text-emerald-400">
                            {formatApproximateVotes(voti)}
                          </p>
                          <p className="whitespace-nowrap font-mono text-[11px] text-emerald-300/90">
                            +{formatDecimalIt(pp, 2)} pp
                          </p>
                        </div>
                        <Link
                          href={`/app/news/${slug}`}
                          className="shrink-0 whitespace-nowrap rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/20"
                        >
                          Apri Dossier →
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleSimulaFn(p.id)}
                          className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                            inSim
                              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                              : "border-white/[0.10] bg-white/[0.05] text-slate-200 hover:bg-white/[0.10]"
                          }`}
                        >
                          {inSim ? "In stima" : "+ Simula"}
                        </button>
                      </div>
                      <div className="col-span-12 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-2">
                        <EpistemicBadge status={epistemic} />
                        <HumanSupervisionControls
                          entityType="party_switch"
                          entityId={switchId}
                          currentStatus={epistemic}
                          onDecided={(_d, exclusions) => setExcludedEntityIds(exclusions)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto flex shrink-0 items-center justify-between border-t border-white/[0.06] pt-3 text-[12px] text-slate-400">
                <button
                  type="button"
                  disabled={safeListPage <= 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/[0.04]"
                >
                  Precedente
                </button>
                <span>
                  {filteredList.length === 0
                    ? "0 profili"
                    : `${(safeListPage - 1) * LIST_PAGE + 1}-${Math.min(safeListPage * LIST_PAGE, filteredList.length)} di ${filteredList.length} · pag. ${safeListPage}/${listPages}`}
                </span>
                <button
                  type="button"
                  disabled={safeListPage >= listPages}
                  onClick={() => setListPage((p) => Math.min(listPages, p + 1))}
                  className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-40 hover:bg-white/[0.04]"
                >
                  Successiva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
