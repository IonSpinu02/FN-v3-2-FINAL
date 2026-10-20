"use client";

import { applyEventToEntry } from "@/lib/engine/localInstitutions";
import type {
  LocalRegistryEntry,
  NewsCandidate,
} from "@/lib/engine/localiTypes";
import { Btn } from "@/components/ui/FnUi";
import { useState } from "react";

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

  function approve(candidate: NewsCandidate) {
    const registryId = linkTarget[candidate.id];
    if (!registryId) {
      alert("Seleziona una voce registro da aggiornare.");
      return;
    }
    const action = candidate.suggestedAction ?? "cambio_giunta";
    const next = entries.map((e) =>
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
              {c.comuneGuess && ` · Comune?: ${c.comuneGuess}`}
              {c.regioneGuess && ` · ${c.regioneGuess}`}
            </p>
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
              <Btn
                variant="secondary"
                className="text-xs"
                onClick={() => approve(c)}
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
