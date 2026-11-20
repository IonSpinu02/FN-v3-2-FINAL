"use client";

import { CsvDropzone } from "@/components/CsvDropzone";
import type { Region } from "@/lib/engine/constants";

export function OsservatorioDataDrawer({
  open,
  onClose,
  regione,
  eventCount,
  dbConnected,
  onPrioritaCsv,
  onTrendsCsv,
  onLoadDemoTrends,
  onAddEvent,
  onSavePriorita,
  onSaveCloud,
}: {
  open: boolean;
  onClose: () => void;
  regione: Region;
  eventCount: number;
  dbConnected: boolean;
  onPrioritaCsv: (text: string) => void;
  onTrendsCsv: (text: string) => void;
  onLoadDemoTrends: () => void;
  onAddEvent: () => void;
  onSavePriorita: () => void;
  onSaveCloud: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative mx-4 mb-4 w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#090D16] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Dati &amp; CSV</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-white"
          >
            Chiudi
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Importazioni locali · sync cloud {dbConnected ? "attivo" : "offline"}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-[#0A0E17] p-4">
            <p className="font-mono text-[9px] uppercase text-slate-500">Priorità territoriali</p>
            <CsvDropzone label="CSV priorità" onText={onPrioritaCsv} />
            <button
              type="button"
              onClick={onSavePriorita}
              className="mt-2 text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              Salva {regione}
            </button>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#0A0E17] p-4">
            <p className="font-mono text-[9px] uppercase text-slate-500">Google Trends</p>
            <CsvDropzone label="CSV Google Trends" onText={onTrendsCsv} />
            <button
              type="button"
              onClick={onLoadDemoTrends}
              className="mt-2 text-xs text-slate-400 hover:text-white"
            >
              Carica serie demo
            </button>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#0A0E17] p-4">
            <p className="font-mono text-[9px] uppercase text-slate-500">Registro eventi</p>
            <button
              type="button"
              onClick={onAddEvent}
              className="mt-2 text-sm font-medium text-white hover:text-emerald-200"
            >
              + Nuovo episodio
            </button>
            <p className="mt-3 font-mono text-[10px] text-slate-600">{eventCount} in registro</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSaveCloud}
          className="mt-6 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
        >
          Salva su cloud
        </button>
      </div>
    </div>
  );
}
