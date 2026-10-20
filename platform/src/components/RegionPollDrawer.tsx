"use client";

import type { RegionPollResult } from "@/lib/engine/regionalPoll";
import type { ScenarioRow } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import { Btn } from "@/components/ui/FnUi";

export function RegionPollDrawer({
  poll,
  row,
  onClose,
}: {
  poll: RegionPollResult;
  row: ScenarioRow;
  onClose: () => void;
}) {
  const classLabel = {
    sicura: "Sicura (≥90% prob. sopra soglia)",
    contesa: "Contesa / In bilico (35–89%)",
    critica: "Sotto soglia / Critica (<35%)",
  }[poll.classificazione];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-fn-text/40 screen-only backdrop-blur-sm"
      role="dialog"
      aria-label={`Sondaggio ${poll.regione}`}
      onClick={onClose}
    >
      <div
        className="fn-panel h-full w-full max-w-md overflow-y-auto border-l-0 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <p className="fn-label">Bollettino regionale</p>
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold">
              {poll.regione}
            </h2>
          </div>
          <Btn variant="secondary" className="text-sm" onClick={onClose}>
            Chiudi
          </Btn>
        </div>

        <p className="fn-alert mb-4 text-xs">
          Simulazione interna — non sondaggio certificato.
        </p>

        <div className="mb-6 rounded-xl bg-fn-accent-soft px-4 py-4">
          <p className="font-mono text-3xl font-medium text-fn-accent">
            {pct(poll.piHat)}{" "}
            <span className="text-lg text-fn-text-muted">
              ± {(poll.moe * 100).toFixed(1)} pp
            </span>
          </p>
          <p className="mt-1 text-sm text-fn-text-muted">
            Forbice {pct(poll.icLow, 2)} – {pct(poll.icHigh, 2)} · N=
            {poll.Nr.toLocaleString("it-IT")}
          </p>
          <div className="relative mt-3 h-2 w-full rounded-full bg-white/80">
            <div
              className="absolute h-2 rounded-full bg-fn-accent"
              style={{
                left: `${poll.icLow * 100}%`,
                width: `${Math.max(1, (poll.icHigh - poll.icLow) * 100)}%`,
              }}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Prob. ≥ soglia" value={`${(poll.probAboveThreshold * 100).toFixed(1)}%`} />
          <Stat label="Classificazione" value={classLabel} />
          <Stat label="Voti attesi FN" value={Math.round(poll.votiAttesi).toLocaleString("it-IT")} />
          <Stat label="Validi attesi" value={Math.round(poll.validiAttesi).toLocaleString("it-IT")} />
          <Stat label="FdI 2024" value={pct(poll.fdiShare2024)} />
          <Stat label="Lega 2024" value={pct(poll.legaShare2024)} />
          <Stat label="Scarto vs benchmark" value={`${(poll.scartoVsBenchmark * 100).toFixed(2)} pp`} />
          <Stat label="Sensibilità pesi" value={`${pct(row.lo10, 2)} – ${pct(row.hi90, 2)}`} />
        </dl>

        <h3 className="fn-label mb-2 mt-8">Origine consenso (mix)</h3>
        <ul className="space-y-2 text-sm">
          <Bar label="Flussi" pct={poll.contribFlussi} color="bg-orange-500" />
          <Bar label="Preferenze" pct={poll.contribPreferenze} color="bg-emerald-600" />
          <Bar label="Iscritti" pct={poll.contribIscritti} color="bg-fn-accent" />
          <Bar label="Istituzioni" pct={poll.contribIstituzioni} color="bg-violet-600" />
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-fn-border-subtle bg-fn-surface px-2 py-2">
      <dt className="text-xs text-fn-text-muted">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}

function Bar({
  label,
  pct: share,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <li>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono">{(share * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-fn-border-subtle">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </li>
  );
}
