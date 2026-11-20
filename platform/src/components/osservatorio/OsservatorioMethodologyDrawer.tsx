"use client";

import {
  BIP_PROGRAM_TITLE,
  orderedBipChaptersForRegion,
} from "@/lib/bipProgramCatalog";
import type { Region } from "@/lib/engine/constants";

const CARD = "rounded-xl border border-white/[0.06] bg-[#0A0E17] p-5";

export function OsservatorioMethodologyDrawer({
  open,
  onClose,
  regione,
}: {
  open: boolean;
  onClose: () => void;
  regione: Region;
}) {
  if (!open) return null;

  const chapters = orderedBipChaptersForRegion(regione);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-white/[0.08] bg-[#070A12] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Programma ufficiale 2027–2037
            </p>
            <h2 className="text-lg font-semibold text-white">
              Programma B.I.P. &amp; Metodologia
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Priorità filtrate per <span className="text-emerald-400">{regione}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
          >
            Chiudi
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <section className={CARD}>
            <h3 className="text-sm font-semibold text-white">{BIP_PROGRAM_TITLE}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Mappa rapida dei 15 capitoli. I capitoli evidenziati sono quelli più allineati ai
              pilastri territoriali prioritari per la regione selezionata nel cockpit.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              15 Capitoli · ordine per priorità regionale
            </h3>
            <ul className="space-y-2">
              {chapters.map((ch) => (
                <li
                  key={ch.num}
                  className={`rounded-xl border p-4 ${
                    ch.highlighted
                      ? "border-emerald-500/35 bg-emerald-500/[0.06]"
                      : "border-white/[0.06] bg-[#0A0E17]"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      Cap. {ch.num} · {ch.title}
                    </p>
                    <span className="font-mono text-[10px] text-slate-500">{ch.pages}</span>
                  </div>
                  {ch.highlighted ? (
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-emerald-400/90">
                      Priorità {regione} · rank {ch.priorityRank}
                    </p>
                  ) : null}
                  <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-400">
                    {ch.flagMeasures.slice(0, 4).map((m) => (
                      <li key={m.slice(0, 48)}>{m}</li>
                    ))}
                    {ch.flagMeasures.length > 4 ? (
                      <li className="text-slate-600">
                        +{ch.flagMeasures.length - 4} misure nel capitolo completo
                      </li>
                    ) : null}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <section className={CARD}>
            <h3 className="text-sm font-semibold text-emerald-300">3 principi guida (Osservatorio)</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
              <li>
                <strong className="text-slate-200">Bisogni ≠ Voto:</strong> fabbisogni descrivono
                condizioni oggettive, non intenzioni elettorali.
              </li>
              <li>
                <strong className="text-slate-200">Trends ≠ Gradimento:</strong> Google Trends misura
                attenzione 0–100, non approvazione.
              </li>
              <li>
                <strong className="text-slate-200">Post-evento ≠ Causalità:</strong> finestre ±14 gg
                richiedono eventi concorrenti annotati.
              </li>
            </ul>
          </section>

          <section className={CARD}>
            <h3 className="text-sm font-semibold text-white">Questionario minimo · 5 domande</h3>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-slate-400">
              <li>Problemi del territorio (aperta / codificata)</li>
              <li>Difficoltà personali negli ultimi 12 mesi</li>
              <li>Soddisfazione servizi pubblici essenziali</li>
              <li>Urgenza percepita delle soluzioni</li>
              <li>Intenzione di voto (facoltativa, separata)</li>
            </ol>
          </section>

          <section className={CARD}>
            <h3 className="text-sm font-semibold text-rose-300">Limiti metodologici</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
              <li>Quote regionali = modello territoriale + input nazionale.</li>
              <li>Trends 0–100: scala relativa al periodo export.</li>
              <li>Simulatore conversione: stime elasticità, non promessa elettorale.</li>
              <li>
                Testi «Cosa dichiarare» e «Come si risolve» ancorati al B.I.P.; verificare sempre
                numeri di pagina sull&apos;edizione cartacea ufficiale.
              </li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
