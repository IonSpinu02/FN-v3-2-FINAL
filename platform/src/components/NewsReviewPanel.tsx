"use client";

import { applyEventToEntry } from "@/lib/engine/localInstitutions";
import type {
  LocalRegistryEntry,
  NewsCandidate,
} from "@/lib/engine/localiTypes";
import { Btn } from "@/components/ui/FnUi";
import { useEffect, useState } from "react";

function matchRegistryId(
  candidate: NewsCandidate,
  entries: LocalRegistryEntry[],
): string {
  const comune = candidate.suggestedComune ?? candidate.comuneGuess;
  const regione = candidate.suggestedRegion ?? candidate.regioneGuess;
  if (!comune || !regione) return "";
  const hit = entries.find(
    (e) =>
      e.comune.toLowerCase() === comune.toLowerCase() &&
      e.regione === regione,
  );
  return hit?.id ?? "";
}

export function NewsReviewPanel({
  entries,
  onApplyToRegistry,
}: {
  entries: LocalRegistryEntry[];
  onApplyToRegistry: (entries: LocalRegistryEntry[]) => void;
}) {
  const [candidates, setCandidates] = useState<NewsCandidate[]>([]);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<Record<string, string>>({});
  const [lastScanInfo, setLastScanInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!candidates.length) return;
    setLinkTarget((prev) => {
      const next = { ...prev };
      for (const c of candidates) {
        if (!next[c.id]) {
          const m = matchRegistryId(c, entries);
          if (m) next[c.id] = m;
        }
      }
      return next;
    });
  }, [candidates, entries]);

  async function scan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = (await res.json()) as {
        candidates?: NewsCandidate[];
        error?: string;
        errors?: string[];
        scannedFeeds?: number;
        fromDefaultCatalog?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Scan fallito");
        setCandidates(data.candidates ?? []);
        return;
      }
      setCandidates(data.candidates ?? []);
      if (typeof data.scannedFeeds === "number") {
        setLastScanInfo(
          data.fromDefaultCatalog
            ? `Catalogo predefinito: ${data.scannedFeeds} feed (ANSA nazionale + 20 regioni + campioni locali). Override con NEWS_RSS_URLS in .env.`
            : `${data.scannedFeeds} feed da NEWS_RSS_URLS.`,
        );
      }
      if (data.errors?.length) {
        setError(`Alcuni feed non letti: ${data.errors.join("; ")}`);
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  function approve(candidate: NewsCandidate, useSuggestion: boolean) {
    let list = entries;
    let registryId = linkTarget[candidate.id];
    if (useSuggestion && !registryId) {
      const comune = candidate.suggestedComune ?? candidate.comuneGuess;
      const regione = candidate.suggestedRegion ?? candidate.regioneGuess;
      if (!comune || !regione) {
        alert("Suggerimento geo incompleto.");
        return;
      }
      const existing = list.find(
        (e) =>
          e.comune.toLowerCase() === comune.toLowerCase() &&
          e.regione === regione,
      );
      if (existing) {
        registryId = existing.id;
      } else {
        const newEntry: LocalRegistryEntry = {
          id: `local-news-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          comune,
          regione,
          carica: candidate.suggestedRole ?? "sind",
          partito_fn: true,
          note: `Da news: ${candidate.titolo.slice(0, 80)}`,
          ultimo_aggiornamento: new Date().toISOString().slice(0, 10),
        };
        list = [...list, newEntry];
        registryId = newEntry.id;
        setLinkTarget({ ...linkTarget, [candidate.id]: newEntry.id });
      }
    }
    if (!registryId) {
      alert("Seleziona una voce registro da aggiornare.");
      return;
    }
    const action = candidate.suggestedAction ?? "cambio_giunta";
    const next = list.map((e) =>
      e.id === registryId ? applyEventToEntry(e, action) : e,
    );
    onApplyToRegistry(next);
    setIgnored(new Set(ignored).add(candidate.id));
  }

  const visible = candidates.filter((c) => !ignored.has(c.id));

  return (
    <div className="fn-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="fn-label">Monitoraggio news (RSS)</p>
          <p className="text-xs text-fn-text-muted">
            Proposte automatiche — revisione umana obbligatoria. Non certificato.
          </p>
        </div>
        <Btn variant="primary" disabled={loading} onClick={scan}>
          {loading ? "Scansione…" : "Scansiona feed"}
        </Btn>
      </div>
      {lastScanInfo && (
        <p className="mb-2 text-xs text-fn-text-muted">{lastScanInfo}</p>
      )}
      {error && (
        <p className="mb-2 text-sm text-fn-danger" role="alert">
          {error}
        </p>
      )}
      {visible.length === 0 && !loading && (
        <p className="text-sm text-fn-text-muted">
          Nessun candidato in coda. Usa «Scansiona feed» (catalogo RSS già
          integrato; opzionale NEWS_RSS_URLS in .env per sorgenti custom).
        </p>
      )}
      <ul className="max-h-[360px] space-y-3 overflow-y-auto">
        {visible.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-fn-border-subtle bg-fn-surface p-3 text-sm"
          >
            <a
              href={c.link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-fn-accent hover:underline"
            >
              {c.titolo}
            </a>
            <p className="mt-1 text-xs text-fn-text-muted line-clamp-2">
              {c.snippet}
            </p>
            <p className="mt-1 text-xs">
              Keyword: {c.matchedKeywords.join(", ") || "—"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {c.suggestedRegion && (
                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-900">
                  Regione suggerita: {c.suggestedRegion}
                </span>
              )}
              {c.suggestedComune && (
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-900">
                  Comune rilevato: {c.suggestedComune}
                </span>
              )}
              {c.suggestedRole && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-900">
                  Carica rilevata: {c.suggestedRole}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className="fn-input max-w-xs py-1 text-xs"
                value={linkTarget[c.id] ?? ""}
                onChange={(e) =>
                  setLinkTarget({ ...linkTarget, [c.id]: e.target.value })
                }
              >
                <option value="">Collega a voce registro…</option>
                {entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.comune} ({e.carica}, {e.regione})
                  </option>
                ))}
              </select>
              {(c.suggestedComune || c.suggestedRegion) && (
                <Btn
                  variant="primary"
                  className="text-xs"
                  onClick={() => approve(c, true)}
                >
                  Approva suggerimento (1 clic)
                </Btn>
              )}
              <Btn
                variant="secondary"
                className="text-xs"
                onClick={() => approve(c, false)}
              >
                Approva ({c.suggestedAction ?? "cambio_giunta"})
              </Btn>
              <Btn
                variant="ghost"
                className="text-xs"
                onClick={() => setIgnored(new Set(ignored).add(c.id))}
              >
                Ignora
              </Btn>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
