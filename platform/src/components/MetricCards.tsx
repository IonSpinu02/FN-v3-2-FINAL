import { Kpi, KpiGrid } from "@/components/ui/FnUi";
import type { ScenarioResult } from "@/lib/engine/types";
import { pct, pp } from "@/lib/format";

export function MetricCards({ scenario }: { scenario: ScenarioResult }) {
  const { parametri, metriche } = scenario;
  const gap =
    parametri.iscritti_totali_dichiarati - parametri.iscritti_attribuiti;

  const items = [
    { label: "S nazionale", value: pct(parametri.S) },
    { label: "Voti scenario (stima)", value: numVoti(scenario) },
    { label: "H iscritti", value: metriche.H.iscritti.toFixed(4) },
    { label: "H scenario", value: metriche.H.scenario.toFixed(4) },
    {
      label: "Diff. media vs benchmark",
      value: pp(metriche.differenza_media_ponderata_scenario_benchmark_punti),
    },
    {
      label: "JS scenario / benchmark",
      value: metriche.JS.scenario_benchmark.toFixed(4),
    },
    {
      label: "Iscritti dich. / reg.",
      value: `${parametri.iscritti_totali_dichiarati.toLocaleString("it-IT")} / ${parametri.iscritti_attribuiti.toLocaleString("it-IT")}${gap ? ` (−${gap.toLocaleString("it-IT")})` : ""}`,
    },
    {
      label: "H elettorato 2024",
      value: metriche.H.elettorato.toFixed(4),
    },
  ];

  return (
    <KpiGrid>
      {items.map((item) => (
        <Kpi key={item.label} label={item.label} value={item.value} />
      ))}
    </KpiGrid>
  );
}

function numVoti(scenario: ScenarioResult): string {
  const tot = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
  return tot.toLocaleString("it-IT", { maximumFractionDigits: 0 });
}
