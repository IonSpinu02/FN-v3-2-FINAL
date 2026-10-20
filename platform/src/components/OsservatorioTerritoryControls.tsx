"use client";

import { REGIONS, type Region } from "@/lib/engine/constants";
import {
  nextRegion,
  TERRITORY_NAZIONALE,
  type TerritoryScope,
} from "@/lib/engine/osservatorioTerritoryScope";

const selectClass =
  "rounded-lg border border-white/[0.1] bg-[#0D1322] px-3 py-1.5 text-xs font-medium text-white";

export function TerritoryScopeToolbar({
  value,
  onChange,
  compact,
}: {
  value: TerritoryScope;
  onChange: (v: TerritoryScope) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : ""}`}>
      <button
        type="button"
        onClick={() => onChange(TERRITORY_NAZIONALE)}
        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
          value === TERRITORY_NAZIONALE
            ? "bg-emerald-500/15 text-emerald-200"
            : "text-slate-400 hover:text-white"
        }`}
      >
        ITALIA · Quadro Nazionale
      </button>
      {(
        [
          ["Lazio", "Caso Doc §8: Lazio"],
          ["Veneto", "Caso Doc §2: Veneto"],
        ] as const
      ).map(([r, label]) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === r ? "bg-emerald-500/15 text-emerald-200" : "text-slate-400 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
      <TerritoryScopeSelect value={value} onChange={onChange} />
    </div>
  );
}

type TerritoryScopeSelectProps =
  | {
      regionOnly?: false;
      value: TerritoryScope;
      onChange: (v: TerritoryScope) => void;
      showNav?: boolean;
    }
  | {
      regionOnly: true;
      value: Region;
      onChange: (v: Region) => void;
      showNav?: boolean;
    };

export function TerritoryScopeSelect(props: TerritoryScopeSelectProps) {
  const { showNav, regionOnly } = props;
  const scopeValue = regionOnly ? undefined : props.value;
  const regionValue: Region = regionOnly
    ? props.value
    : props.value === TERRITORY_NAZIONALE
      ? REGIONS[0]!
      : props.value;

  return (
    <div className="flex items-center gap-1">
      {showNav && !regionOnly ? (
        <button
          type="button"
          aria-label="Regione precedente"
          className="rounded border border-white/[0.08] px-2 py-1 text-xs text-slate-400 hover:text-white"
          onClick={() => {
            const base =
              scopeValue === TERRITORY_NAZIONALE
                ? REGIONS[REGIONS.length - 1]!
                : scopeValue!;
            props.onChange(nextRegion(base, -1));
          }}
        >
          ←
        </button>
      ) : null}
      <select
        className={selectClass}
        value={regionOnly ? regionValue : scopeValue}
        onChange={(e) => {
          const v = e.target.value;
          if (regionOnly) {
            (props.onChange as (r: Region) => void)(v as Region);
          } else {
            (props.onChange as (s: TerritoryScope) => void)(
              v === TERRITORY_NAZIONALE ? TERRITORY_NAZIONALE : (v as Region),
            );
          }
        }}
      >
        {!regionOnly ? (
          <option value={TERRITORY_NAZIONALE}>
            Italia (Totale Nazionale — 20 Regioni)
          </option>
        ) : null}
        {REGIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {showNav && !regionOnly ? (
        <button
          type="button"
          aria-label="Regione successiva"
          className="rounded border border-white/[0.08] px-2 py-1 text-xs text-slate-400 hover:text-white"
          onClick={() => {
            const base =
              scopeValue === TERRITORY_NAZIONALE ? REGIONS[0]! : scopeValue!;
            props.onChange(nextRegion(base, 1));
          }}
        >
          →
        </button>
      ) : null}
    </div>
  );
}

export function ModuloATerritorySelect({
  value,
  onChange,
  id,
}: {
  value: TerritoryScope;
  onChange: (v: TerritoryScope) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      className={selectClass}
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === TERRITORY_NAZIONALE ? TERRITORY_NAZIONALE : (v as Region));
      }}
    >
      <option value={TERRITORY_NAZIONALE}>Italia (Media Nazionale = 1,00x)</option>
      <option value="Veneto">Veneto (Caso Studio Doc §2)</option>
      <option value="Lazio">Lazio (Caso Studio Doc §8)</option>
      {REGIONS.filter((r) => r !== "Veneto" && r !== "Lazio").map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
