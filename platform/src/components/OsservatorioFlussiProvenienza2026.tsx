"use client";

import { FlussiMatrix2026Panel } from "@/components/FlussiMatrix2026Panel";
import {
  FLUSSI_MATRICES,
  type FlussiIpsos,
  type FlussiMatrixId,
  formatFlussiPctIt,
} from "@/lib/politicalModel";

export function OsservatorioFlussiProvenienza2026({
  flussiIpsos,
  flussiMatrixId,
  onSelectMatrix,
}: {
  flussiIpsos: FlussiIpsos;
  flussiMatrixId: FlussiMatrixId;
  onSelectMatrix: (id: FlussiMatrixId) => void;
}) {
  const ipsos = FLUSSI_MATRICES.find((m) => m.id === "ipsos_luglio_2026")!;
  const sky = FLUSSI_MATRICES.find((m) => m.id === "skytg24_ottobre_2026")!;

  return (
    <section className="rounded-xl border border-[#1B2436] bg-[#080C14]/95 p-5">
      <p className="font-mono text-[10px] tracking-[0.15em] text-emerald-400/90">
        Provenienza voti · Flussi 2026
      </p>
      <h2 className="mt-2 text-lg font-bold text-white">
        Provenienza dei Potenziali Voti di Futuro Nazionale (Nota Flussi 2026)
      </h2>

      <ol className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400">
        <li>
          <strong className="text-slate-200">Voti storici certi:</strong> risultati ufficiali di
          Lega e Fratelli d&apos;Italia alle Europee 2024 (indicano quanti voti hanno ottenuto, ma
          non quanti oggi sceglierebbero Futuro Nazionale).
        </li>
        <li>
          <strong className="text-slate-200">Preferenze personali di Vannacci:</strong> voti
          effettivamente espressi alle Europee 2024 (non automaticamente trasferibili al nuovo
          partito).
        </li>
        <li>
          <strong className="text-slate-200">Flussi elettorali stimati:</strong> stime da sondaggi
          campionari che chiedono cosa si è votato in passato e cosa si voterebbe oggi.
        </li>
      </ol>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse font-mono text-[10px]">
          <thead>
            <tr className="border-b border-[#1B2436] text-left text-slate-500">
              <th className="py-2 pr-3">Fonte verificata</th>
              <th className="py-2 px-2">Ex FdI</th>
              <th className="py-2 px-2">Ex Lega</th>
              <th className="py-2 px-2">Ex astenuti</th>
              <th className="py-2 pl-2">Altre</th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-300">
            <tr className="border-b border-[#1B2436]/80">
              <td className="py-2 pr-3 text-slate-200">Ipsos 5 luglio 2026</td>
              <td className="px-2">{formatFlussiPctIt(ipsos.quotes.FdI)}</td>
              <td className="px-2">{formatFlussiPctIt(ipsos.quotes.Lega)}</td>
              <td className="px-2">{formatFlussiPctIt(ipsos.quotes.ast)}</td>
              <td className="pl-2">{formatFlussiPctIt(ipsos.quotes.altri)}</td>
            </tr>
            <tr>
              <td className="py-2 pr-3 text-slate-200">Sky TG24 10 ottobre 2026</td>
              <td className="px-2">{formatFlussiPctIt(sky.quotes.FdI)}</td>
              <td className="px-2">{formatFlussiPctIt(sky.quotes.Lega)}</td>
              <td className="px-2">{formatFlussiPctIt(sky.quotes.ast)}</td>
              <td className="pl-2">{formatFlussiPctIt(sky.quotes.altri)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <FlussiMatrix2026Panel
          variant="compact"
          flussiIpsos={flussiIpsos}
          activeMatrixId={flussiMatrixId}
          onSelectMatrix={onSelectMatrix}
        />
      </div>
    </section>
  );
}
