import Link from "next/link";

export const metadata = {
  title: "Osservatorio integrato — Guida metodologica",
};

export default function GuidaOsservatorioPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-fn-text">
      <p className="text-xs uppercase tracking-widest text-fn-text-muted">
        Documento di lavoro · 20 ottobre 2026
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
        Osservatorio integrato
      </h1>
      <p className="mt-2 text-fn-text-muted">
        Consenso elettorale, fabbisogni pubblici, eventi e opinione — ottobre
        2026 – maggio 2027.
      </p>

      <section className="prose prose-sm mt-8 max-w-none">
        <h2>Obiettivo</h2>
        <p>
          Lettura coordinata di dati elettorali, condizioni territoriali e
          attenzione agli eventi, distinguendo dati osservati, indicatori
          indiretti, scenari e ipotesi causali.
        </p>
        <h2>Tre moduli</h2>
        <ul>
          <li>
            <strong>A · Elettorale</strong> — sondaggi e scenari regionali
            (piattaforma FN v3.2).
          </li>
          <li>
            <strong>B · Fabbisogni</strong> — indicatori sociali e servizi
            (catalogo <code>fabbisogni_catalog.json</code>).
          </li>
          <li>
            <strong>C · Eventi</strong> — cronologia, Trends, sondaggi
            comparabili (registro eventi + Locali &amp; News).
          </li>
        </ul>
        <h2>Regola comune</h2>
        <p>
          Ogni valore: fonte, territorio, periodo, data pubblicazione, metodo,
          natura (osservato / ricostruito / ipotesi / simulazione),
          confrontabilità.
        </p>
        <h2>Google Trends</h2>
        <p>
          Indice 0–100 relativo; non misura gradimento né intenzioni di voto.
          Normalizzazione per area e periodo — conservare estrazione e parametri.
        </p>
        <h2>Limiti</h2>
        <ul>
          <li>Variazione dopo un evento ≠ causalità.</li>
          <li>Fabbisogni territoriali ≠ come votano le persone (no errore ecologico).</li>
          <li>Entropia H descrive concentrazione delle quote, non % di consenso.</li>
        </ul>
      </section>

      <p className="mt-10">
        <Link href="/app/scenario" className="text-fn-accent underline">
          ← Torna alla dashboard
        </Link>
      </p>
    </main>
  );
}
