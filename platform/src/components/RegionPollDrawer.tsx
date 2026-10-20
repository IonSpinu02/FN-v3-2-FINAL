"use client";

import type { InstitutionalRow } from "@/lib/engine/calculate";
import type { Region } from "@/lib/engine/constants";
import type { RegionPollResult } from "@/lib/engine/regionalPoll";
import type { FnConfig, ScenarioRow } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import { Btn } from "@/components/ui/FnUi";

const CARICHE: { key: keyof InstitutionalRow; label: string }[] = [
  { key: "dep", label: "Deputati" },
  { key: "creg", label: "Cons. Regionali" },
  { key: "sind", label: "Sindaci" },
  { key: "com", label: "Cons. Comunali" },
];

const TESSERE_LABEL: Record<RegionPollResult["statoTesseramento"], string> = {
  equilibrato: "Equilibrato",
  da_strutturare: "Aprire sedi (alti flussi)",
  anomalia_tessere: "Verifica conversione",
};

export function RegionPollDrawer({
  poll,
  row,
  fnConfig,
  region,
  quickDelta,
  mergedDelta,
  onAdjustInst,
  onResetRegion,
  onClose,
}: {
  poll: RegionPollResult;
  row: ScenarioRow;
  fnConfig: FnConfig;
  region: Region;
  quickDelta?: Partial<InstitutionalRow>;
  mergedDelta?: Partial<InstitutionalRow>;
  onAdjustInst: (carica: keyof InstitutionalRow, delta: number) => void;
  onResetRegion: () => void;
  onClose: () => void;
}) {
  const classLabel = {
    sicura: "Sicura (≥90% prob. sopra soglia)",
    contesa: "Contesa / In bilico (35–89%)",
    critica: "Sotto soglia / Critica (<35%)",
  }[poll.classificazione];

  function displayCount(k: keyof InstitutionalRow): number {
    const b = fnConfig.presenze_istituzionali[k]?.[region] ?? 0;
    const d = mergedDelta?.[k] ?? 0;
    return b + d;
  }

  const margineFmt =
    poll.margineVotiSoglia >= 0
      ? `+${poll.margineVotiSoglia.toLocaleString("it-IT")}`
      : poll.margineVotiSoglia.toLocaleString("it-IT");

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
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Prob. ≥ soglia" value={`${(poll.probAboveThreshold * 100).toFixed(1)}%`} />
          <Stat label="Classificazione" value={classLabel} />
          <Stat
            label="Voti stimati sondaggio"
            value={poll.votiStimatiSondaggio.toLocaleString("it-IT")}
          />
          <Stat label="Voti soglia" value={poll.votiSoglia.toLocaleString("it-IT")} />
          <Stat label="Margine soglia (voti)" value={margineFmt} />
          <Stat label="Validi attesi" value={poll.validiAttesi.toLocaleString("it-IT")} />
          <Stat
            label="Salute tessere"
            value={TESSERE_LABEL[poll.statoTesseramento]}
          />
          <Stat
            label="Voti / iscritto"
            value={`${poll.votiPerIscritto.toFixed(1)} voti attesi per iscritto`}
          />
          <Stat label="Scarto vs benchmark" value={`${(poll.scartoVsBenchmark * 100).toFixed(2)} pp`} />
          <Stat label="Sensibilità pesi" value={`${pct(row.lo10, 2)} – ${pct(row.hi90, 2)}`} />
        </dl>

        <h3 className="fn-label mb-2 mt-8">
          What-If Istituzionale Rapido (Campagna Acquisti)
        </h3>
        <p className="mb-3 text-xs text-fn-text-muted">
          Modifica i delta istituzionali per {region} (si sommano al registro
          Locali se applicato). Conteggi mostrati = config v3.2 + delta totale.
        </p>
        <ul className="space-y-2 text-sm">
          {CARICHE.map(({ key, label }) => (
            <li
              key={key}
              className="flex items-center justify-between rounded-lg border border-fn-border-subtle px-3 py-2"
            >
              <span>
                {label}:{" "}
                <span className="font-mono font-medium">{displayCount(key)}</span>
                {quickDelta?.[key] ? (
                  <span className="ml-1 text-xs text-fn-accent">
                    (Δ rapido {quickDelta[key]! > 0 ? "+" : ""}
                    {quickDelta[key]})
                  </span>
                ) : null}
              </span>
              <span className="flex gap-1">
                <Btn
                  variant="secondary"
                  className="px-2 py-0.5 text-xs"
                  onClick={() => onAdjustInst(key, -1)}
                >
                  −
                </Btn>
                <Btn
                  variant="secondary"
                  className="px-2 py-0.5 text-xs"
                  onClick={() => onAdjustInst(key, 1)}
                >
                  +
                </Btn>
              </span>
            </li>
          ))}
        </ul>
        <Btn
          variant="ghost"
          className="mt-2 text-xs"
          onClick={onResetRegion}
        >
          Azzera modifiche regione
        </Btn>

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
