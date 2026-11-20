"use client";

import Link from "next/link";
import { useCallback } from "react";

const PDF_HREF = "/METODOLOGIA-NUMERI-E-SIMULAZIONI-FN-v3-2.pdf";

export default function GuidaMetodologiaPage() {
  const printPdf = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: #111 !important;
          }
          .metodologia-doc {
            max-width: none !important;
            padding: 0 !important;
          }
          .metodologia-doc h1,
          .metodologia-doc h2,
          .metodologia-doc h3 {
            break-after: avoid;
          }
          .metodologia-doc table,
          .metodologia-doc pre {
            break-inside: avoid;
          }
        }
      `}</style>

      <main className="metodologia-doc mx-auto max-w-3xl px-6 py-10 text-slate-100">
        <div className="no-print mb-8 flex flex-wrap items-center gap-3 border-b border-white/10 pb-6">
          <Link href="/app/scenario" className="text-sm text-emerald-400 hover:underline">
            ← Scenario
          </Link>
          <a
            href={PDF_HREF}
            download
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/25"
          >
            Scarica PDF
          </a>
          <button
            type="button"
            onClick={printPdf}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Stampa / Salva come PDF
          </button>
        </div>

        <article className="prose prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-li:leading-relaxed max-w-none print:prose-slate">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Futuro Nazionale v3.2 · Ottobre 2026
          </p>
          <h1 className="text-3xl text-white print:text-black">
            Metodologia: numeri, simulazioni e affidabilità
          </h1>
          <p className="text-slate-300 print:text-slate-700">
            Versione web sintetica. Il PDF completo è in{" "}
            <a href={PDF_HREF} className="text-emerald-400 underline">
              METODOLOGIA-NUMERI-E-SIMULAZIONI-FN-v3-2.pdf
            </a>{" "}
            — versione completa senza riferimenti tecnici al codice.
          </p>

          <section className="mt-10 rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 print:border-amber-800 print:bg-amber-50">
            <h2 className="mt-0 text-lg text-amber-100 print:text-amber-900">
              Disclaimer
            </h2>
            <p className="mb-0 text-sm text-slate-300 print:text-slate-800">
              Strumento interno di <strong>scenario territoriale</strong>, non previsione
              elettorale validata. I valori servono a prioritizzare territori e temi con regole
              esplicite e input verificabili.
            </p>
          </section>

          <h2>Perché tre moduli (A / B / C)</h2>
          <ul>
            <li>
              <strong>A Elettorale</strong> — dove siamo forti (mix flussi, preferenze, iscritti,
              istituzioni + S nazionale).
            </li>
            <li>
              <strong>B Fabbisogni</strong> — stress oggettivo ISTAT/AGENAS (≠ voto).
            </li>
            <li>
              <strong>C Eventi &amp; Trends</strong> — attenzione mediatica e agenda (≠ causalità
              automatica).
            </li>
          </ul>

          <h2>Modulo A — scenario elettorale</h2>
          <p>
            Per ogni regione combiniamo flussi elettorali, preferenze, iscritti e cariche
            istituzionali (pesi default 35/25/25/15), applichiamo il consenso nazionale S e
            ricaviamo stima percentuale e voti rispetto ai validi del 2024.
          </p>
          <p>
            <strong>Monte Carlo</strong> (20.000 simulazioni): variabilità su pesi e su S → fasce
            di incertezza e input al poll simulato.
          </p>

          <h2>Poll regionale simulato</h2>
          <p>
            Modello statistico sullo scenario, non inchiesta sul campo: margine errore,
            classificazione regione, probabilità di superare la soglia del 3%, contributo dei
            quattro indici al mix.
          </p>

          <h2>Crescita Mag &apos;27</h2>
          <p>
            Incremento in punti percentuali = regime campagna (+1,15 / +1,85 / +2,6) + eventuale
            boost Sky (+0,35) + aggiustamento se S differisce dal 7,2%. Traiettoria mensile fino
            a maggio 2027 con fascia di incertezza.
          </p>

          <h2>Conversione temi Osservatorio (+pp / +voti)</h2>
          <p>
            Intensità problema × permeabilità territoriale × elasticità del tema, con limiti tra
            0,04 e 0,85 pp per tema; voti proporzionali ai validi regionali. Permeabilità dallo
            storico Lega / FdI / PD / astensione.
          </p>

          <h2>Cosa è affidabile</h2>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Sì</th>
                <th className="text-left">No</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Regole tracciabili, controlli automatici, snapshot audit</td>
                <td>“FN vincerà al X%”</td>
              </tr>
              <tr>
                <td>Priorità territorio/tema coerente con regole</td>
                <td>Trends = consenso</td>
              </tr>
              <tr>
                <td>Sensibilità a S, pesi, flussi in tempo reale</td>
                <td>Sostituto YouTrend/Quorum</td>
              </tr>
            </tbody>
          </table>

          <p className="text-sm text-slate-400 print:text-slate-600">
            Per il dettaglio completo (tabelle atlante, bibliografia, parametri ufficiali) usa il
            PDF scaricabile sopra.
          </p>
        </article>
      </main>
    </>
  );
}
