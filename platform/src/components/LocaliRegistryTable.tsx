"use client";

import { REGIONS, type Region } from "@/lib/engine/constants";
import type { CaricaLocale, LocalRegistryEntry } from "@/lib/engine/localiTypes";
import { Btn } from "@/components/ui/FnUi";
import { useMemo, useState } from "react";

const CARICHE: CaricaLocale[] = ["dep", "creg", "sind", "com"];

export function LocaliRegistryTable({
  entries,
  onChange,
  onRestoreSeed,
}: {
  entries: LocalRegistryEntry[];
  onChange: (entries: LocalRegistryEntry[]) => void;
  onRestoreSeed?: () => void;
}) {
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterFn, setFilterFn] = useState<string>("all");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterRegion && e.regione !== filterRegion) return false;
      if (filterFn === "fn" && !e.partito_fn) return false;
      if (filterFn === "nonfn" && e.partito_fn) return false;
      return true;
    });
  }, [entries, filterRegion, filterFn]);

  function updateEntry(id: string, patch: Partial<LocalRegistryEntry>) {
    onChange(
      entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }

  function addRow() {
    const id = `loc-${Date.now()}`;
    onChange([
      ...entries,
      {
        id,
        comune: "Nuovo comune",
        regione: "Lombardia",
        carica: "com",
        partito_fn: false,
        ultimo_aggiornamento: new Date().toISOString().slice(0, 10),
      },
    ]);
  }

  function exportJson() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, entries }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "locali_registry_export.json";
    a.click();
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as {
          entries?: LocalRegistryEntry[];
        };
        if (Array.isArray(data.entries)) onChange(data.entries);
      } catch {
        alert("JSON non valido");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1B2436] bg-[#080C14] p-3">
        <select
          className="fn-input w-auto min-w-[120px] max-w-[160px] py-1 text-xs"
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
        >
          <option value="">Tutte le regioni</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="fn-input w-auto min-w-[88px] max-w-[120px] py-1 text-xs"
          value={filterFn}
          onChange={(e) => setFilterFn(e.target.value)}
        >
          <option value="all">Tutti</option>
          <option value="fn">Solo FN</option>
          <option value="nonfn">Non FN</option>
        </select>
        <Btn variant="secondary" className="text-xs" onClick={addRow}>
          + Voce
        </Btn>
        <Btn variant="secondary" className="text-xs" onClick={exportJson}>
          Esporta JSON
        </Btn>
        <label className="fn-btn fn-btn-secondary cursor-pointer text-xs">
          Importa JSON
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
            }}
          />
        </label>
        <a
          href="/templates/locali_registry_TEMPLATE.csv"
          download
          className="fn-btn fn-btn-secondary text-xs"
        >
          Template CSV
        </a>
        {onRestoreSeed && (
          <Btn variant="secondary" className="text-xs" onClick={onRestoreSeed}>
            Ripristina seed
          </Btn>
        )}
      </div>

      <div className="fn-table-wrap max-h-[420px] overflow-y-auto">
        <table className="fn-table min-w-[720px]">
          <thead>
            <tr>
              <th>Comune</th>
              <th>Regione</th>
              <th>Carica</th>
              <th>FN</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>
                  <input
                    className="fn-input py-1 text-sm"
                    value={e.comune}
                    onChange={(ev) =>
                      updateEntry(e.id, { comune: ev.target.value })
                    }
                  />
                </td>
                <td>
                  <select
                    className="fn-input py-1 text-sm"
                    value={e.regione}
                    onChange={(ev) =>
                      updateEntry(e.id, {
                        regione: ev.target.value as Region,
                      })
                    }
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="fn-input py-1 text-sm"
                    value={e.carica}
                    onChange={(ev) =>
                      updateEntry(e.id, {
                        carica: ev.target.value as CaricaLocale,
                      })
                    }
                  >
                    {CARICHE.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={e.partito_fn}
                    onChange={(ev) =>
                      updateEntry(e.id, { partito_fn: ev.target.checked })
                    }
                  />
                </td>
                <td>
                  <input
                    className="fn-input py-1 text-sm"
                    value={e.note ?? ""}
                    onChange={(ev) =>
                      updateEntry(e.id, { note: ev.target.value })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-fn-text-muted">
        {entries.length} voci totali · {filtered.length} visualizzate. Export/import
        per persistenza (Vercel read-only).
      </p>
    </div>
  );
}
