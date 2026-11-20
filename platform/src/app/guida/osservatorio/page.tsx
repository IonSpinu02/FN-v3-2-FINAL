import Link from "next/link";
import {
  OFFICIAL_S_SOURCE_LABEL,
  OFFICIAL_S_SOURCE_URL,
} from "@/lib/engine/defaults";

export const metadata = {
  title: "Osservatorio integrato — Guida dirigenziale",
};

export default function GuidaOsservatorioPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-fn-text">
      <p className="text-xs uppercase tracking-widest text-fn-text-muted">
        Futuro Nazionale · Ott 2026 – Mag 2027
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        Osservatorio integrato
      </h1>
      <p className="mt-3 text-base leading-relaxed text-fn-text-muted">
        Cabina di regia in <strong className="text-fn-text">tre passi</strong>: dove andare, su quali
        problemi intervenire con le promesse FN, e quali dati ufficiali documentano le scelte.
      </p>

      <section className="mt-10 space-y-8">
        <div className="rounded-2xl border border-fn-border/40 bg-fn-surface/30 p-6">
          <h2 className="text-lg font-semibold text-fn-text">Passo 1 — Dove andare</h2>
          <p className="mt-2 text-sm leading-relaxed text-fn-text-muted">
            Griglia delle 20 regioni con consenso, obiettivo Maggio 2027 e semaforo strategico (bacino
            Lega/FdI vs muro PD).
          </p>
        </div>

        <div className="rounded-2xl border border-fn-border/40 bg-fn-surface/30 p-6">
          <h2 className="text-lg font-semibold text-fn-text">
            Passo 2 — Problemi &amp; Promesse FN
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fn-text-muted">
            Problemi territoriali, promessa programmatica, stima di +pp e +voti. I due temi principali
            sono già inclusi nella stima al primo accesso alla regione.
          </p>
        </div>

        <div className="rounded-2xl border border-fn-border/40 bg-fn-surface/30 p-6">
          <h2 className="text-lg font-semibold text-fn-text">Passo 3 — Dati ufficiali &amp; Trends</h2>
          <ul className="mt-3 space-y-2 text-sm text-fn-text-muted">
            <li>Flussi elettorali Ipsos vs Sky TG24.</li>
            <li>Cinque dimensioni ISTAT/AGENAS (regione vs Italia).</li>
            <li>Google Trends (0–100) e scheda mensile per export PDF.</li>
          </ul>
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
        <h2 className="text-sm font-semibold text-cyan-200/90">Fonte consenso nazionale</h2>
        <p className="mt-2 text-sm text-fn-text-muted">
          L&apos;input <strong className="text-fn-text">7,20%</strong> (ottobre 2026) deriva dalla{" "}
          <a
            href={OFFICIAL_S_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-fn-accent underline"
          >
            {OFFICIAL_S_SOURCE_LABEL}
          </a>
          .
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <h2 className="text-sm font-semibold text-amber-200/90">Metodologia &amp; limiti</h2>
        <p className="mt-2 text-sm leading-relaxed text-fn-text-muted">
          Bisogni ≠ voto. Trends = attenzione, non gradimento. Dettagli nel drawer Metodologia nella
          tab Osservatorio.
        </p>
      </section>

      <p className="mt-8">
        <Link
          href="/guida/metodologia"
          className="font-medium text-fn-accent underline"
        >
          Metodologia completa (PDF) — numeri e simulazioni →
        </Link>
      </p>

      <p className="mt-6">
        <Link href="/app/osservatorio" className="font-medium text-fn-accent underline">
          Apri Osservatorio →
        </Link>
      </p>
    </main>
  );
}
