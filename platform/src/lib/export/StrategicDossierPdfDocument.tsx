import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Line,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from "@react-pdf/renderer";
import type { StrategicDossierPayload } from "@/lib/export/dossierTypes";
import { ensureDossierPdfFonts } from "@/lib/export/pdfFonts";
import {
  formatDateIt,
  pdfPct,
  pdfSafeText,
  pdfSignedPp,
  sanitizeDossierPublicText,
} from "@/lib/export/pdfSafeText";
import { formatDecimalIt } from "@/lib/formatIt";

ensureDossierPdfFonts();

const C = {
  night: "#070D18",
  night2: "#0E1A2D",
  night3: "#16263F",
  ink: "#0F172A",
  muted: "#475569",
  soft: "#94A3B8",
  line: "#E2E8F0",
  card: "#F8FAFC",
  white: "#FFFFFF",
  emerald: "#059669",
  emeraldLight: "#34D399",
  emeraldBg: "#ECFDF5",
  cyan: "#0284C7",
  cyanLight: "#38BDF8",
  cyanBg: "#F0F9FF",
  amber: "#D97706",
  amberBg: "#FFFBEB",
  red: "#DC2626",
  violet: "#7C3AED",
  blue: "#2563EB",
  gray: "#94A3B8",
  itGreen: "#009246",
  itWhite: "#F1F5F9",
  itRed: "#CE2B37",
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 38;
const CW = PAGE_W - MARGIN_X * 2;
const CHART_W = CW - 22;

const FONT = "Inter";

const styles = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 50,
    paddingHorizontal: MARGIN_X,
    fontFamily: FONT,
    fontSize: 9,
    color: C.ink,
    backgroundColor: C.white,
  },
  cover: {
    fontFamily: FONT,
    backgroundColor: C.night,
    color: C.white,
    padding: 0,
  },
  runningHeader: {
    position: "absolute",
    top: 18,
    left: MARGIN_X,
    right: MARGIN_X,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 6.5,
    letterSpacing: 1,
    color: C.soft,
  },
  runningBrand: { fontWeight: 700, color: C.ink, letterSpacing: 1.2 },
  footer: {
    position: "absolute",
    left: MARGIN_X,
    right: MARGIN_X,
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 6.5,
    color: C.soft,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    paddingTop: 7,
  },
  pageBadge: {
    backgroundColor: C.night,
    color: C.white,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    fontSize: 6.5,
  },
  hero: {
    backgroundColor: C.night,
    borderRadius: 6,
    marginBottom: 12,
    overflow: "hidden",
  },
  heroInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  heroNum: {
    fontSize: 30,
    fontWeight: 700,
    color: C.emeraldLight,
    marginRight: 14,
    letterSpacing: -1,
  },
  heroKicker: {
    fontSize: 6.8,
    color: C.soft,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.white,
    letterSpacing: -0.3,
  },
  lead: {
    fontSize: 8,
    color: C.muted,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  p: {
    fontSize: 8.4,
    lineHeight: 1.45,
    color: C.ink,
  },
  muted: {
    fontSize: 7.4,
    color: C.muted,
    lineHeight: 1.45,
  },
  label: {
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: C.muted,
  },
  chartCard: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    backgroundColor: C.white,
  },
  chartTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 2,
  },
  chartSub: {
    fontSize: 7,
    color: C.muted,
    marginBottom: 6,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  legendSwatch: {
    width: 12,
    height: 3,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: { fontSize: 6.8, color: C.muted },
  kpiRow: { flexDirection: "row", marginBottom: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 6,
    marginRight: 6,
    overflow: "hidden",
  },
  kpiBar: { height: 3 },
  kpiBody: { padding: 9 },
  kpiLabel: {
    fontSize: 6.3,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 700,
    marginBottom: 5,
  },
  kpiValue: {
    fontSize: 21,
    fontWeight: 700,
    letterSpacing: -0.6,
  },
  kpiHint: { fontSize: 6.8, color: C.muted, marginTop: 4, lineHeight: 1.35 },
  explainBox: {
    backgroundColor: C.card,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  explainRow: { flexDirection: "row", marginBottom: 4 },
  explainDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2.5,
    marginRight: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  tr: { flexDirection: "row", alignItems: "center" },
  trAlt: { backgroundColor: C.card },
  thRow: { flexDirection: "row", backgroundColor: C.night },
  th: {
    fontSize: 6.5,
    fontWeight: 700,
    color: C.white,
    paddingVertical: 6,
    paddingHorizontal: 6,
    lineHeight: 1.3,
    letterSpacing: 0.3,
  },
  td: {
    fontSize: 7.8,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
    lineHeight: 1.4,
    color: C.ink,
  },
  tdRight: { textAlign: "right" },
  pill: {
    fontSize: 7.4,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    textAlign: "center",
  },
  chip: {
    fontSize: 6.5,
    fontWeight: 600,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 6,
    marginRight: 3,
    marginTop: 3,
  },
  totalBand: {
    backgroundColor: C.night,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  newsCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 9,
    backgroundColor: C.white,
  },
  newsBody: { flex: 1, padding: 10 },
  newsNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    color: C.white,
    fontSize: 9,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 4.5,
    marginRight: 8,
  },
  sectionTag: {
    fontSize: 6.3,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
    marginTop: 6,
  },
  analysisPanel: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 4,
  },
  analysisTitle: {
    fontSize: 8.6,
    fontWeight: 700,
    marginBottom: 3,
  },
  directiveGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  directiveCard: {
    width: "49.2%",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
    backgroundColor: C.white,
  },
  directiveNum: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: -0.8,
    marginRight: 7,
  },
  quoteCard: {
    flex: 1,
    backgroundColor: C.night,
    borderRadius: 6,
    padding: 12,
  },
  quoteMark: {
    fontSize: 30,
    fontWeight: 700,
    color: C.emeraldLight,
    lineHeight: 0.9,
    marginBottom: -2,
  },
  reliability: {
    flexDirection: "row",
    backgroundColor: C.amberBg,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 2,
  },
});

type Payload = StrategicDossierPayload;
type ChartPoint = Payload["fattori"]["chart"][number];
function T({
  children,
  style,
}: {
  children: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
}) {
  return <Text style={style}>{sanitizeDossierPublicText(children)}</Text>;
}

function svgText(fontSize: number, fill: string, fontWeight = 400) {
  return { fontSize, fontFamily: FONT, fill, fontWeight };
}

function Tricolore({ height = 3 }: { height?: number }) {
  return (
    <View style={{ flexDirection: "row", height }}>
      <View style={{ flex: 1, backgroundColor: C.itGreen }} />
      <View style={{ flex: 1, backgroundColor: C.itWhite }} />
      <View style={{ flex: 1, backgroundColor: C.itRed }} />
    </View>
  );
}

function RunningHeader() {
  return (
    <View style={styles.runningHeader} fixed>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flexDirection: "row", width: 18, height: 6, marginRight: 6 }}>
          <View style={{ flex: 1, backgroundColor: C.itGreen }} />
          <View style={{ flex: 1, backgroundColor: C.line }} />
          <View style={{ flex: 1, backgroundColor: C.itRed }} />
        </View>
        <Text style={styles.runningBrand}>FUTURO NAZIONALE</Text>
        <Text>{pdfSafeText("  /  DOSSIER STRATEGICO")}</Text>
      </View>
      <Text>{pdfSafeText("RISERVATO · USO INTERNO")}</Text>
    </View>
  );
}

function Footer({ verificationCode }: { verificationCode: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {pdfSafeText(
          `FUTURO NAZIONALE · Dossier Analisi & Supporto Decisionale · Codice verifica calcolo: #${verificationCode}`,
        )}
      </Text>
      <Text
        style={styles.pageBadge}
        render={({ pageNumber, totalPages }) =>
          pdfSafeText(`Pagina ${pageNumber} di ${totalPages}`)
        }
      />
    </View>
  );
}

function SectionHero({
  n,
  title,
  kicker,
}: {
  n: string;
  title: string;
  kicker: string;
}) {
  return (
    <View style={styles.hero} wrap={false}>
      <View style={styles.heroInner}>
        <Text style={styles.heroNum}>{n}</Text>
        <View style={{ flex: 1 }}>
          <T style={styles.heroKicker}>{kicker}</T>
          <T style={styles.heroTitle}>{title}</T>
        </View>
      </View>
      <Tricolore />
    </View>
  );
}

function Legend({
  items,
}: {
  items: Array<{ color: string; label: string; dashed?: boolean; dot?: boolean }>;
}) {
  return (
    <View style={styles.legendRow}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View
            style={[
              styles.legendSwatch,
              it.dot
                ? { width: 6, height: 6, borderRadius: 3, backgroundColor: it.color }
                : it.dashed
                  ? { backgroundColor: "transparent", borderTopWidth: 1.5, borderTopColor: it.color, borderStyle: "dashed", height: 0 }
                  : { backgroundColor: it.color },
            ]}
          />
          <T style={styles.legendText}>{it.label}</T>
        </View>
      ))}
    </View>
  );
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.chartCard} wrap={false}>
      <T style={styles.chartTitle}>{title}</T>
      {sub ? <T style={styles.chartSub}>{sub}</T> : null}
      {children}
    </View>
  );
}

function TableHeader(
  cols: Array<{ w: string | number; label: string; right?: boolean }>,
) {
  return (
    <View style={styles.thRow}>
      {cols.map((c) => (
        <Text
          key={c.label}
          style={[styles.th, { width: c.w }, c.right ? styles.tdRight : undefined]}
        >
          {pdfSafeText(c.label)}
        </Text>
      ))}
    </View>
  );
}

function niceTicks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(2)));
  return out;
}

function pickStep(range: number): number {
  if (range <= 0.6) return 0.1;
  if (range <= 1.6) return 0.25;
  if (range <= 3) return 0.5;
  return 1;
}

function bipColor(code: string): string {
  if (code.startsWith("BIP.09")) return C.amber;
  if (code.startsWith("BIP.13-CV")) return C.violet;
  if (code.startsWith("BIP.13-SAN")) return C.emerald;
  if (code.startsWith("BIP.07")) return C.red;
  if (code.startsWith("BIP.02")) return C.blue;
  return C.cyan;
}

function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * alpha + 255 * (1 - alpha));
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/* ------------------------------------------------------------------ */
/* Cover                                                               */
/* ------------------------------------------------------------------ */

function CoverDecoration({ points }: { points: ChartPoint[] }) {
  const series = points
    .map((p, i) => ({ i, v: p.base ?? p.pollsAlone }))
    .filter((p): p is { i: number; v: number } => p.v != null);
  const top = 640;
  const bottom = 770;
  const left = 0;
  const right = PAGE_W - 44;
  const lo = Math.min(...series.map((s) => s.v)) - 0.2;
  const hi = Math.max(...series.map((s) => s.v)) + 0.1;
  const n = Math.max(1, points.length - 1);
  const xOf = (i: number) => left + (i / n) * (right - left);
  const yOf = (v: number) => top + ((hi - v) / Math.max(0.01, hi - lo)) * (bottom - top);
  const line = series
    .map((s, k) => `${k ? "L" : "M"} ${xOf(s.i).toFixed(1)} ${yOf(s.v).toFixed(1)}`)
    .join(" ");
  const first = series[0];
  const last = series[series.length - 1];
  const area =
    first && last
      ? `${line} L ${xOf(last.i).toFixed(1)} ${PAGE_H} L ${xOf(first.i).toFixed(1)} ${PAGE_H} Z`
      : "";

  return (
    <Svg
      width={PAGE_W}
      height={PAGE_H - 2}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <RadialGradient id="glowA" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={C.emerald} stopOpacity={0.45} />
          <Stop offset="1" stopColor={C.emerald} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowB" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={C.cyan} stopOpacity={0.35} />
          <Stop offset="1" stopColor={C.cyan} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="coverArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.emeraldLight} stopOpacity={0.28} />
          <Stop offset="1" stopColor={C.emeraldLight} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={PAGE_W} height={PAGE_H} fill={C.night} />
      <Circle cx={PAGE_W - 40} cy={150} r={300} fill="url(#glowA)" />
      <Circle cx={30} cy={560} r={260} fill="url(#glowB)" />
      {Array.from({ length: 13 }).map((_, k) => (
        <Line
          key={`vg-${k}`}
          x1={(k * PAGE_W) / 12}
          y1={0}
          x2={(k * PAGE_W) / 12}
          y2={PAGE_H}
          stroke={C.white}
          strokeOpacity={0.035}
          strokeWidth={0.6}
        />
      ))}
      {Array.from({ length: 18 }).map((_, k) => (
        <Line
          key={`hg-${k}`}
          x1={0}
          y1={(k * PAGE_H) / 17}
          x2={PAGE_W}
          y2={(k * PAGE_H) / 17}
          stroke={C.white}
          strokeOpacity={0.035}
          strokeWidth={0.6}
        />
      ))}
      {area ? <Path d={area} fill="url(#coverArea)" /> : null}
      {line ? (
        <Path d={line} stroke={C.emeraldLight} strokeWidth={2} fill="none" strokeOpacity={0.85} />
      ) : null}
      {last ? (
        <>
          <Circle cx={xOf(last.i)} cy={yOf(last.v)} r={14} fill={C.emeraldLight} fillOpacity={0.15} />
          <Circle cx={xOf(last.i)} cy={yOf(last.v)} r={4.5} fill={C.emeraldLight} />
          <Text x={xOf(last.i) - 10} y={yOf(last.v) - 12} textAnchor="end" style={svgText(8, C.emeraldLight, 700)}>
            {pdfSafeText(`Maggio 2027 · ${pdfPct(last.v)}`)}
          </Text>
        </>
      ) : null}
      <Rect x={0} y={0} width={PAGE_W / 3} height={6} fill={C.itGreen} />
      <Rect x={PAGE_W / 3} y={0} width={PAGE_W / 3} height={6} fill={C.itWhite} />
      <Rect x={(PAGE_W * 2) / 3} y={0} width={PAGE_W / 3} height={6} fill={C.itRed} />
    </Svg>
  );
}

function CoverPage({ data, generated }: { data: Payload; generated: string }) {
  const { meta, consenso, fattori } = data;
  const maggio = consenso.horizons.find((h) => h.horizonKey === "d180")!;
  const index = [
    ["01", "Quadro generale e scenari"],
    ["02", "Come si costruisce la crescita"],
    ["03", "Quadro completo delle 20 regioni"],
    ["04", "Temi caldi e risposte B.I.P."],
    ["05", "Analisi strategica e 4 mosse"],
    ["06", "Dichiarazioni e sondaggi"],
  ];
  const miniKpis = [
    { label: "Consenso oggi", value: pdfPct(consenso.s0Pct), color: C.white },
    { label: "Soli sondaggi", value: pdfPct(maggio.pollsAlonePct), color: C.soft },
    { label: "Offensiva", value: pdfPct(maggio.offensivaPct), color: C.emeraldLight },
  ];

  return (
    <Page size="A4" style={styles.cover}>
      <CoverDecoration points={fattori.chart} />

      <View style={{ position: "absolute", top: 58, left: 56, right: 56 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, color: C.emeraldLight }}>
            FUTURO NAZIONALE
          </Text>
          <View
            style={{
              borderWidth: 0.8,
              borderColor: C.itRed,
              borderRadius: 8,
              paddingVertical: 3,
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 1.5, color: "#FCA5A5" }}>
              {pdfSafeText("RISERVATO · USO INTERNO")}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 50, fontWeight: 700, letterSpacing: -2, marginTop: 46, lineHeight: 1 }}>
          Dossier
        </Text>
        <Text
          style={{
            fontSize: 50,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1,
            color: C.emeraldLight,
          }}
        >
          Strategico
        </Text>
        <T style={{ fontSize: 11, color: C.soft, marginTop: 12, letterSpacing: 0.2 }}>
          {"Analisi & Supporto Decisionale per la Segreteria Politica"}
        </T>
        <View style={{ flexDirection: "row", marginTop: 14, alignItems: "center" }}>
          <View style={{ width: 24, height: 1.5, backgroundColor: C.emeraldLight, marginRight: 8 }} />
          <T style={{ fontSize: 8.5, color: C.white }}>
            {`${meta.startDateDisplay} -> ${meta.endDateDisplay} · ${meta.exactDays} giorni di proiezione`}
          </T>
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          top: 330,
          left: 56,
          right: 56,
          backgroundColor: C.night2,
          borderRadius: 10,
          borderWidth: 0.8,
          borderColor: C.night3,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", padding: 20, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.6, color: C.soft }}>
              {"SCENARIO BASE · MAGGIO 2027"}
            </T>
            <Text style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2.5, marginTop: 6, lineHeight: 1 }}>
              {pdfSafeText(pdfPct(maggio.basePct))}
            </Text>
          </View>
          <View style={{ width: 170, paddingBottom: 6 }}>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: C.emerald,
                borderRadius: 8,
                paddingVertical: 3,
                paddingHorizontal: 8,
                marginBottom: 6,
              }}
            >
              <T style={{ fontSize: 9, fontWeight: 700, color: C.white }}>
                {`${pdfSignedPp(maggio.deltaBaseVsOggiPp)} punti vs oggi`}
              </T>
            </View>
            <T style={{ fontSize: 8, color: C.soft, lineHeight: 1.45 }}>{maggio.votesBaseHint}</T>
          </View>
        </View>
        <View style={{ flexDirection: "row", borderTopWidth: 0.8, borderTopColor: C.night3 }}>
          {miniKpis.map((k, i) => (
            <View
              key={k.label}
              style={{
                flex: 1,
                paddingVertical: 11,
                paddingHorizontal: 20,
                borderLeftWidth: i ? 0.8 : 0,
                borderLeftColor: C.night3,
              }}
            >
              <T style={{ fontSize: 6.5, letterSpacing: 1.2, color: C.soft, fontWeight: 700 }}>
                {k.label.toUpperCase()}
              </T>
              <Text style={{ fontSize: 17, fontWeight: 700, color: k.color, marginTop: 3 }}>
                {pdfSafeText(k.value)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ position: "absolute", top: 548, left: 56, right: 56 }}>
        <T style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1.6, color: C.soft, marginBottom: 6 }}>
          {"INDICE"}
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {index.map(([num, label]) => (
            <View
              key={num}
              style={{
                width: "50%",
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 4,
                borderBottomWidth: 0.5,
                borderBottomColor: C.night3,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: 700, color: C.emeraldLight, width: 22 }}>{num}</Text>
              <T style={{ fontSize: 8.5, color: C.white }}>{label}</T>
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          bottom: 30,
          left: 56,
          right: 56,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <T style={{ fontSize: 6.8, color: C.soft }}>{`Generato ${generated}`}</T>
        <T style={{ fontSize: 6.8, color: C.soft }}>{`Codice verifica calcolo: #${meta.verificationCode}`}</T>
      </View>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

function TrajectoryChart({ points, s0Pct }: { points: ChartPoint[]; s0Pct: number }) {
  const W = CHART_W;
  const H = 188;
  const padL = 32;
  const padR = 84;
  const padT = 16;
  const padB = 26;
  const vals = points.flatMap((p) =>
    [p.pollsAlone, p.base, p.offensiva].filter((v): v is number => v != null),
  );
  const minRaw = Math.min(...vals, s0Pct);
  const maxRaw = Math.max(...vals, s0Pct);
  const step = pickStep(maxRaw - minRaw + 0.4);
  const minY = Math.floor((minRaw - 0.1) / step) * step;
  const maxY = Math.ceil((maxRaw + 0.1) / step) * step;
  const n = Math.max(1, points.length - 1);
  const xOf = (i: number) => padL + (i / n) * (W - padL - padR);
  const yOf = (v: number) =>
    padT + ((maxY - v) / Math.max(0.01, maxY - minY)) * (H - padT - padB);
  const yBottom = H - padB;

  const seriesOf = (key: "pollsAlone" | "base" | "offensiva") =>
    points
      .map((p, i) => ({ i, v: p[key] }))
      .filter((p): p is { i: number; v: number } => p.v != null);
  const pathOf = (pts: Array<{ i: number; v: number }>) =>
    pts
      .map((p, k) => `${k ? "L" : "M"} ${xOf(p.i).toFixed(1)} ${yOf(p.v).toFixed(1)}`)
      .join(" ");

  const todayIdx = Math.max(
    0,
    points.findIndex((p) => p.isToday || p.label === "OGGI"),
  );
  const base = seriesOf("base");
  const off = seriesOf("offensiva").filter((p) => p.i >= todayIdx);
  const polls = seriesOf("pollsAlone").filter((p) => p.i >= todayIdx);
  const fan =
    off.length > 1 && polls.length > 1
      ? `${pathOf(off)} ${[...polls]
          .reverse()
          .map((p) => `L ${xOf(p.i).toFixed(1)} ${yOf(p.v).toFixed(1)}`)
          .join(" ")} Z`
      : "";
  const baseFirst = base[0];
  const baseLast = base[base.length - 1];
  const baseArea =
    baseFirst && baseLast
      ? `${pathOf(base)} L ${xOf(baseLast.i).toFixed(1)} ${yBottom} L ${xOf(baseFirst.i).toFixed(1)} ${yBottom} Z`
      : "";

  const last = points[points.length - 1]!;
  const endLabels = [
    { key: "offensiva", label: "Offensiva", color: C.emerald, v: last.offensiva },
    { key: "base", label: "Base", color: C.cyan, v: last.base },
    { key: "pollsAlone", label: "Soli sondaggi", color: "#64748B", v: last.pollsAlone },
  ]
    .filter((e): e is typeof e & { v: number } => e.v != null)
    .sort((a, b) => b.v - a.v);
  const placed: number[] = [];
  const labelY = endLabels.map((e) => {
    let y = yOf(e.v) + 3;
    const prev = placed[placed.length - 1];
    if (prev != null && y - prev < 10) y = prev + 10;
    placed.push(y);
    return y;
  });

  return (
    <View>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="baseArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.cyan} stopOpacity={0.22} />
            <Stop offset="1" stopColor={C.cyan} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect
          x={xOf(todayIdx)}
          y={padT - 6}
          width={W - padR - xOf(todayIdx)}
          height={yBottom - padT + 6}
          fill={C.emeraldBg}
        />
        {niceTicks(minY, maxY, step).map((v) => (
          <React.Fragment key={`y-${v}`}>
            <Line x1={padL} y1={yOf(v)} x2={W - padR} y2={yOf(v)} stroke={C.line} strokeWidth={0.6} />
            <Text x={padL - 4} y={yOf(v) + 2.5} textAnchor="end" style={svgText(6.5, C.soft)}>
              {pdfSafeText(pdfPct(v, step < 0.25 ? 1 : 2))}
            </Text>
          </React.Fragment>
        ))}
        {baseArea ? <Path d={baseArea} fill="url(#baseArea)" /> : null}
        {fan ? <Path d={fan} fill={C.emerald} fillOpacity={0.1} /> : null}
        <Path
          d={pathOf(seriesOf("pollsAlone"))}
          stroke={C.gray}
          strokeWidth={1.2}
          strokeDasharray="3 2"
          fill="none"
        />
        <Path d={pathOf(off)} stroke={C.emerald} strokeWidth={1.5} strokeDasharray="4 2" fill="none" />
        <Path d={pathOf(base)} stroke={C.cyan} strokeWidth={2.2} fill="none" />
        <Line
          x1={xOf(todayIdx)}
          y1={padT - 6}
          x2={xOf(todayIdx)}
          y2={yBottom}
          stroke={C.night}
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        <Rect x={xOf(todayIdx) - 34} y={padT - 13} width={68} height={12} rx={6} fill={C.night} />
        <Text x={xOf(todayIdx)} y={padT - 4.5} textAnchor="middle" style={svgText(6.3, C.white, 700)}>
          {pdfSafeText(`OGGI ${pdfPct(s0Pct)}`)}
        </Text>
        <Circle cx={xOf(todayIdx)} cy={yOf(s0Pct)} r={3.5} fill={C.white} stroke={C.night} strokeWidth={1.4} />
        {base
          .filter((p) => p.i > todayIdx)
          .map((p) => (
            <React.Fragment key={`bd-${p.i}`}>
              <Circle cx={xOf(p.i)} cy={yOf(p.v)} r={2.6} fill={C.white} stroke={C.cyan} strokeWidth={1.3} />
              <Text x={xOf(p.i)} y={yOf(p.v) - 6} textAnchor="middle" style={svgText(6, C.cyan, 700)}>
                {pdfSafeText(pdfPct(p.v))}
              </Text>
            </React.Fragment>
          ))}
        {points.map((p, i) =>
          p.label && p.label !== "OGGI" ? (
            <Text key={`x-${i}`} x={xOf(i)} y={yBottom + 11} textAnchor="middle" style={svgText(6.3, C.muted)}>
              {pdfSafeText(p.label)}
            </Text>
          ) : null,
        )}
        <Text x={padL + 2} y={H - 2} style={svgText(5.8, C.soft, 700)}>
          STORICO OSSERVATO
        </Text>
        <Text x={xOf(todayIdx) + 4} y={H - 2} style={svgText(5.8, C.emerald, 700)}>
          PROIEZIONE A MAGGIO 2027
        </Text>
        {endLabels.map((e, k) => (
          <React.Fragment key={`end-${e.key}`}>
            <Circle cx={W - padR + 6} cy={labelY[k]! - 2.5} r={2.5} fill={e.color} />
            <Text x={W - padR + 12} y={labelY[k]!} style={svgText(6.6, e.color, 700)}>
              {pdfSafeText(`${e.label} ${pdfPct(e.v)}`)}
            </Text>
          </React.Fragment>
        ))}
      </Svg>
      <Legend
        items={[
          { color: C.cyan, label: "Scenario Base (passo attuale)" },
          { color: C.emerald, label: "Offensiva (massima spinta)", dashed: true },
          { color: C.gray, label: "Soli sondaggi (senza azione)", dashed: true },
          { color: tint(C.emerald, 0.25), label: "Ventaglio dei possibili esiti" },
        ]}
      />
    </View>
  );
}

const FACTOR_SHORT: Record<string, string> = {
  momentum: "Sondaggi",
  agenda: "Temi B.I.P.",
  donor: "Delusi",
  ground: "Rete",
  magnet: "Eletti",
  cycle: "Calendario",
  bounds: "Tetto",
};

function factorShort(row: Payload["fattori"]["rows"][number], i: number): string {
  const byId = FACTOR_SHORT[row.id.toLowerCase()];
  if (byId) return byId;
  const s = (row.short || row.label || `F${i + 1}`).trim();
  return s.length > 12 ? `${s.slice(0, 11)}.` : s;
}

function WaterfallChart({
  rows,
  s0Pct,
  basePct,
}: {
  rows: Payload["fattori"]["rows"];
  s0Pct: number;
  basePct: number;
}) {
  type Bar = { label: string; from: number; to: number; kind: "total" | "up" | "down" | "flat"; value: number };
  const bars: Bar[] = [];
  let cum = s0Pct;
  rows.forEach((r, i) => {
    const v = r.pp180;
    const kind = Math.abs(v) < 0.005 ? "flat" : v > 0 ? "up" : "down";
    bars.push({ label: factorShort(r, i), from: cum, to: cum + v, kind, value: v });
    cum += v;
  });
  const all = [s0Pct, basePct, ...bars.flatMap((b) => [b.from, b.to])];
  const step = pickStep(Math.max(...all) - Math.min(...all) + 0.4);
  const lo = Math.floor((Math.min(...all) - 0.25) / step) * step;
  const hi = Math.ceil((Math.max(...all) + 0.12) / step) * step;
  const series: Bar[] = [
    { label: "Oggi", from: lo, to: s0Pct, kind: "total", value: s0Pct },
    ...bars,
    { label: "Maggio 2027", from: lo, to: basePct, kind: "total", value: basePct },
  ];

  const W = CHART_W;
  const H = 196;
  const padL = 34;
  const padR = 6;
  const padT = 16;
  const padB = 22;
  const slot = (W - padL - padR) / series.length;
  const bw = Math.min(34, slot * 0.62);
  const yOf = (v: number) => padT + ((hi - v) / Math.max(0.01, hi - lo)) * (H - padT - padB);
  const xMid = (i: number) => padL + slot * i + slot / 2;
  const colorOf = (b: Bar, i: number) =>
    b.kind === "total" ? (i === 0 ? C.night : C.cyan) : b.kind === "up" ? C.emerald : b.kind === "down" ? C.itRed : C.gray;

  return (
    <View>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="wfTotal" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.cyanLight} />
            <Stop offset="1" stopColor={C.cyan} />
          </LinearGradient>
        </Defs>
        {niceTicks(lo, hi, step).map((v) => (
          <React.Fragment key={`wy-${v}`}>
            <Line x1={padL} y1={yOf(v)} x2={W - padR} y2={yOf(v)} stroke={C.line} strokeWidth={0.6} />
            <Text x={padL - 4} y={yOf(v) + 2.5} textAnchor="end" style={svgText(6.3, C.soft)}>
              {pdfSafeText(pdfPct(v, step < 0.25 ? 1 : 2))}
            </Text>
          </React.Fragment>
        ))}
        {series.map((b, i) => {
          const top = Math.min(yOf(b.from), yOf(b.to));
          const h = Math.max(1.4, Math.abs(yOf(b.from) - yOf(b.to)));
          const x = xMid(i) - bw / 2;
          const next = series[i + 1];
          const color = colorOf(b, i);
          const fill = b.kind === "total" && i > 0 ? "url(#wfTotal)" : color;
          const valueLabel =
            b.kind === "total" ? pdfPct(b.value) : pdfSignedPp(b.value);
          return (
            <React.Fragment key={`wb-${i}`}>
              <Rect x={x} y={top} width={bw} height={h} rx={2} fill={fill} />
              {next ? (
                <Line
                  x1={x + bw}
                  y1={yOf(b.to)}
                  x2={xMid(i + 1) - bw / 2}
                  y2={yOf(b.to)}
                  stroke={C.soft}
                  strokeWidth={0.6}
                  strokeDasharray="2 1.5"
                />
              ) : null}
              <Text
                x={xMid(i)}
                y={top - 4}
                textAnchor="middle"
                style={svgText(b.kind === "total" ? 7.2 : 6.6, b.kind === "total" ? C.ink : color, 700)}
              >
                {pdfSafeText(valueLabel)}
              </Text>
              <Text x={xMid(i)} y={H - 8} textAnchor="middle" style={svgText(6.2, b.kind === "total" ? C.ink : C.muted, b.kind === "total" ? 700 : 400)}>
                {pdfSafeText(b.label)}
              </Text>
            </React.Fragment>
          );
        })}
        <Text x={padL} y={9} style={svgText(5.8, C.soft)}>
          {pdfSafeText(`Asse verticale da ${pdfPct(lo, 1)} per rendere leggibili i singoli contributi`)}
        </Text>
      </Svg>
      <Legend
        items={[
          { color: C.night, label: "Consenso di partenza" },
          { color: C.emerald, label: "Fattore che spinge" },
          { color: C.itRed, label: "Fattore che frena" },
          { color: C.gray, label: "Neutro" },
          { color: C.cyan, label: "Scenario Base a Maggio" },
        ]}
      />
    </View>
  );
}

function regionBarColor(roleLabel: string): string {
  if (roleLabel.includes("Verde")) return C.emerald;
  if (roleLabel.includes("Espansione")) return C.cyan;
  return C.gray;
}

function RegionBars({ regions }: { regions: Payload["cabina"]["regions"] }) {
  const W = CHART_W;
  const rowH = 12.4;
  const padL = 108;
  const padR = 52;
  const padT = 4;
  const H = padT + rowH * regions.length + 12;
  const barW = W - padL - padR;
  return (
    <Svg width={W} height={H}>
      {[0, 25, 50, 75, 100].map((v) => (
        <React.Fragment key={`rg-${v}`}>
          <Line
            x1={padL + (v / 100) * barW}
            y1={padT}
            x2={padL + (v / 100) * barW}
            y2={padT + rowH * regions.length}
            stroke={C.line}
            strokeWidth={0.5}
          />
          <Text x={padL + (v / 100) * barW} y={H - 2} textAnchor="middle" style={svgText(5.4, C.soft)}>
            {String(v)}
          </Text>
        </React.Fragment>
      ))}
      {regions.map((r, i) => {
        const y = padT + rowH * i;
        const w = Math.max(3, (Math.min(100, Math.max(0, r.affinity)) / 100) * barW);
        const color = regionBarColor(r.roleLabel);
        const short = REGION_SHORT[r.regione] ?? r.regione;
        return (
          <React.Fragment key={r.regione}>
            <Text x={padL - 16} y={y + rowH / 2 + 2.2} textAnchor="end" style={svgText(6.1, C.ink, 700)}>
              {pdfSafeText(`${String(i + 1).padStart(2, "0")} ${short}`)}
            </Text>
            <Rect x={padL} y={y + 2.4} width={barW} height={rowH - 5} rx={2} fill={C.card} />
            <Rect x={padL} y={y + 2.4} width={w} height={rowH - 5} rx={2} fill={color} />
            <Text x={W - 2} y={y + rowH / 2 + 2.1} textAnchor="end" style={svgText(6, color, 700)}>
              {pdfSafeText(`${formatDecimalIt(r.affinity, 0)} · ${pdfPct(r.sharePct)}`)}
            </Text>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const REGION_SHORT: Record<string, string> = {
  "Friuli-Venezia Giulia": "Friuli V.G.",
  "Emilia-Romagna": "Emilia R.",
  "Trentino-Alto Adige": "Trentino A.A.",
  "Valle d'Aosta": "V. d'Aosta",
};

function FrontRegionMatrix({
  news,
  rankedRegions,
}: {
  news: Payload["newsBip"];
  rankedRegions: string[];
}) {
  if (!news.length || !rankedRegions.length) return null;
  const firstW = 108;
  const cellW = (CHART_W - firstW) / news.length;
  return (
    <ChartCard
      title="Mappa d'impatto: fronti per regione"
      sub="Tutte le 20 regioni. Il punto colorato indica dove il fronte va portato in campo."
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 3 }} wrap={false}>
        <View style={{ width: firstW }} />
        {news.map((n, i) => (
          <T
            key={`h-${n.codiceBip}-${i}`}
            style={{ width: cellW, fontSize: 5.6, fontWeight: 700, color: bipColor(n.codiceBip), textAlign: "center" }}
          >
            {String(i + 1)}
          </T>
        ))}
      </View>
      {rankedRegions.map((region, i) => (
        <View
          key={region}
          wrap={false}
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 13,
            backgroundColor: i % 2 ? C.white : C.card,
            borderRadius: 2,
          }}
        >
          <T style={{ width: firstW, fontSize: 6.2, fontWeight: 700, color: C.ink, paddingLeft: 3 }}>
            {`${String(i + 1).padStart(2, "0")} ${REGION_SHORT[region] ?? region}`}
          </T>
          {news.map((n, j) => {
            const on = n.regioniTarget.includes(region);
            const color = bipColor(n.codiceBip);
            return (
              <View key={`${region}-${j}`} style={{ width: cellW, alignItems: "center" }}>
                <View
                  style={{
                    width: on ? 7 : 3.5,
                    height: on ? 7 : 3.5,
                    borderRadius: 4,
                    backgroundColor: on ? color : C.line,
                  }}
                />
              </View>
            );
          })}
        </View>
      ))}
    </ChartCard>
  );
}

function PollDotPlot({
  polls,
  s0Pct,
}: {
  polls: Payload["consenso"]["polls"];
  s0Pct: number;
}) {
  const W = CHART_W;
  const rowH = 15;
  const padL = 150;
  const padR = 44;
  const padT = 16;
  const H = padT + rowH * polls.length + 14;
  const vals = [...polls.map((p) => p.pct), s0Pct];
  const step = pickStep(Math.max(...vals) - Math.min(...vals) + 0.4);
  const lo = Math.floor((Math.min(...vals) - 0.15) / step) * step;
  const hi = Math.ceil((Math.max(...vals) + 0.15) / step) * step;
  const xOf = (v: number) => padL + ((v - lo) / Math.max(0.01, hi - lo)) * (W - padL - padR);

  return (
    <Svg width={W} height={H}>
      {niceTicks(lo, hi, step).map((v) => (
        <React.Fragment key={`pt-${v}`}>
          <Line x1={xOf(v)} y1={padT - 4} x2={xOf(v)} y2={padT + rowH * polls.length} stroke={C.line} strokeWidth={0.6} />
          <Text x={xOf(v)} y={H - 3} textAnchor="middle" style={svgText(6, C.soft)}>
            {pdfSafeText(pdfPct(v, step < 0.25 ? 1 : 2))}
          </Text>
        </React.Fragment>
      ))}
      <Rect x={xOf(s0Pct) - 30} y={0} width={60} height={11} rx={5.5} fill={C.emerald} />
      <Text x={xOf(s0Pct)} y={8} textAnchor="middle" style={svgText(6, C.white, 700)}>
        {pdfSafeText(`MEDIA ${pdfPct(s0Pct)}`)}
      </Text>
      <Line
        x1={xOf(s0Pct)}
        y1={11}
        x2={xOf(s0Pct)}
        y2={padT + rowH * polls.length}
        stroke={C.emerald}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      {polls.map((p, i) => {
        const y = padT + rowH * i + rowH / 2;
        const above = p.pct >= s0Pct;
        const color = above ? C.emerald : C.amber;
        return (
          <React.Fragment key={`pp-${i}`}>
            <Text x={0} y={y + 2.5} style={svgText(7, C.ink, 700)}>
              {pdfSafeText(p.institute)}
            </Text>
            <Text x={padL - 8} y={y + 2.5} textAnchor="end" style={svgText(6.4, C.muted)}>
              {pdfSafeText(p.dateDisplay)}
            </Text>
            <Line x1={xOf(s0Pct)} y1={y} x2={xOf(p.pct)} y2={y} stroke={color} strokeWidth={1.6} strokeOpacity={0.55} />
            <Circle cx={xOf(p.pct)} cy={y} r={3.6} fill={color} stroke={C.white} strokeWidth={1} />
            <Text x={W - 2} y={y + 2.5} textAnchor="end" style={svgText(7, color, 700)}>
              {pdfSafeText(pdfPct(p.pct))}
            </Text>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Pagina 6 — pulizia finale sul testo che va in stampa                 */
/* ------------------------------------------------------------------ */

/** Testi card: punti doppi (anche tipografici o separati da spazio) → un punto. */
export function sanitizeCardText(input: unknown): string {
  let s = String(input ?? "");
  s = s.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");
  s = s.replace(/[．｡。\u2024\u2025\u2026\u22EF\uFE52\uFF0E]/g, ".");
  s = s.replace(/\.{2,}/g, ".");
  s = s.replace(/\.\s+\./g, ".");
  s = s.replace(/\bomiut\b/gi, "pmi.it");
  s = s.replace(/(?<![/\d])\b(?:19|20)\d{2}\b/g, (year) => {
    const y = Number(year);
    return y === 2025 || y === 2026 ? year : "2026";
  });
  s = s.replace(/\bperch(?![eéèêë])/gi, "perché");
  s = s.replace(/\bperche\b/gi, "perché");
  return s;
}

/** Un solo punto finale: toglie quelli già presenti, poi ne mette uno. */
function withSingleFinalPeriod(input: unknown): string {
  const body = sanitizeCardText(input).replace(/\.+$/g, "").trim();
  return body ? `${body}.` : "";
}

/** Label data/fonte: ogni anno diverso da 2025 o 2026 diventa 2026. */
export function sanitizeSourceDateLabel(input: unknown): string {
  return sanitizeCardText(input).replace(/\b(?:19|20)\d{2}\b/g, (year) => {
    const y = Number(year);
    return y === 2025 || y === 2026 ? year : "2026";
  });
}

function CardText({
  children,
  style,
}: {
  children: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any;
}) {
  return <Text style={style}>{sanitizeCardText(children)}</Text>;
}

/** Stesse rilevazioni della tabella/KPI di pagina 2: stesso minimo e massimo. */
function shownPollstersNote(
  polls: Array<{ institute: string; pct: number }>,
): string {
  const ranked = polls.filter((p) => Number.isFinite(p.pct));
  if (ranked.length < 2) return "";
  const lo = ranked.reduce((a, b) => (a.pct <= b.pct ? a : b));
  const hi = ranked.reduce((a, b) => (a.pct >= b.pct ? a : b));
  const fmt = (n: number) => formatDecimalIt(n, 2);
  return `${hi.institute} stima FN al ${fmt(hi.pct)}% mentre ${lo.institute} al ${fmt(lo.pct)}%: quando esce ${hi.institute} la media sale più facilmente, quando pesa ${lo.institute} la media scende.`;
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export function StrategicDossierPdfDocument({ data }: { data: StrategicDossierPayload }) {
  ensureDossierPdfFonts();
  const { meta, consenso, fattori, cabina } = data;
  const { newsBip } = data;
  const generated = new Date(meta.generatedAtISO).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const maggio = consenso.horizons.find((h) => h.horizonKey === "d180")!;
  const pollsCov =
    meta.coverage.sources.find((s) => s.sourceKey === "polls")?.itemsAccepted ??
    consenso.pollsCount;
  const smCov =
    meta.coverage.sources.find((s) => s.sourceKey === "supermedia")?.itemsAccepted ?? 0;

  const kpis = [
    { label: "Consenso attuale", value: pdfPct(consenso.s0Pct), hint: "Media ponderata sondaggi", color: C.night },
    { label: "Tendenza soli sondaggi", value: pdfPct(maggio.pollsAlonePct), hint: "Orizzonte Maggio", color: C.gray },
    { label: "Scenario Base Maggio", value: pdfPct(maggio.basePct), hint: maggio.votesBaseHint, color: C.cyan },
    { label: "Scenario Offensiva", value: pdfPct(maggio.offensivaPct), hint: maggio.votesOffHint, color: C.emerald },
  ];
  const explainColors = [C.night, C.gray, C.cyan, C.emerald];
  const panelColors = [C.cyan, C.emerald, C.amber];
  const directiveColors = [C.emerald, C.cyan, C.violet, C.amber];

  return (
    <Document
      title={`Dossier Strategico FN · ${meta.startDateDisplay}`}
      author="Futuro Nazionale"
      subject="Analisi & Supporto Decisionale"
    >
      <CoverPage data={data} generated={generated} />

      {/* 01 · Quadro Generale e Scenari */}
      <Page size="A4" style={styles.page} wrap>
        <RunningHeader />
        <SectionHero
          n="01"
          kicker="Dove siamo oggi e dove possiamo arrivare"
          title="Quadro Generale e Scenari"
        />

        <View style={styles.kpiRow} wrap={false}>
          {kpis.map((k, i) => (
            <View key={k.label} style={[styles.kpiCard, i === kpis.length - 1 ? { marginRight: 0 } : {}]}>
              <View style={[styles.kpiBar, { backgroundColor: k.color }]} />
              <View style={styles.kpiBody}>
                <T style={styles.kpiLabel}>{k.label}</T>
                <T style={[styles.kpiValue, { color: k.color === C.gray ? C.muted : k.color }]}>{k.value}</T>
                <T style={styles.kpiHint}>{k.hint}</T>
              </View>
            </View>
          ))}
        </View>

        {(() => {
          const why = consenso.movementWhy;
          const delta = why.deltaPp;
          const deltaColor =
            delta != null && delta > 0.1
              ? C.emerald
              : delta != null && delta < -0.1
                ? C.itRed
                : C.muted;
          const plainWhy = why.plainWhy || why.paragraph;
          const facts = why.factsBullets ?? [];
          const pollstersNote =
            shownPollstersNote(consenso.polls) || why.pollstersNote || "";
          const teamAction = why.teamAction || "";
          const prevDateIt = why.previousIsoDate
            ? formatDateIt(why.previousIsoDate, "short")
            : null;
          return (
            <View
              style={{
                backgroundColor: C.night,
                borderRadius: 6,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <T
                style={{
                  fontSize: 7,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: C.emeraldLight,
                  marginBottom: 4,
                }}
              >
                {why.headline}
              </T>
              <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 4 }}>
                <T style={{ fontSize: 22, fontWeight: 700, color: C.white, letterSpacing: -0.5 }}>
                  {pdfPct(why.pct, 1)}
                </T>
                {delta != null && Math.abs(delta) > 0.001 ? (
                  <T
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: deltaColor,
                      marginLeft: 8,
                      marginBottom: 3,
                    }}
                  >
                    {`${pdfSignedPp(delta, 1)} pp`}
                  </T>
                ) : null}
              </View>
              <T style={{ fontSize: 7.2, color: C.soft, marginBottom: 8 }}>
                {[
                  why.previousPct != null
                    ? `rispetto al ${pdfPct(why.previousPct, 1)}${
                        prevDateIt ? ` del ${prevDateIt}` : ""
                      }`
                    : "riferimento precedente n/d",
                  why.supermediaPct != null
                    ? `Media sondaggi ${pdfPct(why.supermediaPct, 1)}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </T>

              <T
                style={{
                  fontSize: 6.5,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  color: C.soft,
                  marginBottom: 3,
                }}
              >
                IN PAROLE SEMPLICI
              </T>
              <T
                style={{
                  fontSize: 8.4,
                  color: C.white,
                  lineHeight: 1.4,
                  marginBottom: 8,
                }}
              >
                {plainWhy}
              </T>

              {facts.length > 0 ? (
                <View style={{ marginBottom: 8 }}>
                  <T
                    style={{
                      fontSize: 6.5,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      color: C.soft,
                      marginBottom: 4,
                    }}
                  >
                    FATTI E USCITE CHE HANNO INCISO
                  </T>
                  {facts.slice(0, 4).map((f, i) => (
                    <T
                      key={`fact-${i}-${f.badge}`}
                      style={{
                        fontSize: 7.4,
                        color: C.white,
                        lineHeight: 1.35,
                        marginBottom: 3,
                      }}
                    >
                      {`• [${f.badge}] ${f.text}`}
                    </T>
                  ))}
                </View>
              ) : null}

              {pollstersNote ? (
                <View style={{ marginBottom: 8 }}>
                  <T
                    style={{
                      fontSize: 6.5,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      color: C.soft,
                      marginBottom: 3,
                    }}
                  >
                    STIME DEI SONDAGGISTI
                  </T>
                  <T style={{ fontSize: 7.4, color: C.soft, lineHeight: 1.35 }}>
                    {pollstersNote}
                  </T>
                  {why.polls.length > 0 ? (
                    <View style={{ marginTop: 4 }}>
                      {why.polls.slice(0, 4).map((p) => (
                        <View
                          key={`${p.institute}-${p.dateDisplay}`}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 2,
                          }}
                        >
                          <T style={{ fontSize: 6.8, color: C.soft }}>
                            {`${p.institute} · ${p.dateDisplay}`}
                          </T>
                          <T style={{ fontSize: 6.8, fontWeight: 700, color: C.emeraldLight }}>
                            {pdfPct(p.pct, 1)}
                          </T>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {teamAction ? (
                <View
                  style={{
                    backgroundColor: C.night2,
                    borderLeftWidth: 2,
                    borderLeftColor: C.amber,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    marginBottom: 6,
                  }}
                >
                  <T
                    style={{
                      fontSize: 6.5,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      color: "#FBBF24",
                      marginBottom: 3,
                    }}
                  >
                    COSA FARE ORA (TEAM FN)
                  </T>
                  <T style={{ fontSize: 7.6, color: C.white, lineHeight: 1.35 }}>
                    {teamAction}
                  </T>
                </View>
              ) : null}

              {why.sources.length > 0 ? (
                <T style={{ fontSize: 6.5, color: C.cyanLight, marginTop: 2, lineHeight: 1.3 }}>
                  {`Fonti: ${why.sources.map((s) => s.label).join(" · ")}`}
                </T>
              ) : null}
              <T style={{ fontSize: 6.2, color: C.soft, marginTop: 4, lineHeight: 1.3 }}>
                {why.disclaimer}
              </T>
            </View>
          );
        })()}

        <View style={styles.explainBox} wrap={false}>
          <T style={[styles.label, { color: C.ink, marginBottom: 6 }]}>Come leggere i 4 indicatori</T>
          {consenso.kpiExplain.map((line, i) => (
            <View key={line.slice(0, 24)} style={styles.explainRow}>
              <View style={[styles.explainDot, { backgroundColor: explainColors[i + 1] ?? C.cyan }]} />
              <T style={[styles.p, { flex: 1, fontSize: 7.5, lineHeight: 1.4 }]}>{line}</T>
            </View>
          ))}
          <T style={[styles.muted, { marginTop: 2, fontSize: 7 }]}>{meta.votesBaseNote}</T>
        </View>

        <ChartCard
          title="Traiettoria del consenso: storico e proiezione"
          sub={`Dal consenso di oggi allo scenario di ${meta.horizonActiveLabel}: la fascia verde è lo spazio di crescita tra inerzia e massima spinta.`}
        >
          <TrajectoryChart points={fattori.chart} s0Pct={consenso.s0Pct} />
        </ChartCard>

        <View wrap={false}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <View style={{ width: 16, height: 2, backgroundColor: C.cyan, marginRight: 6 }} />
            <T style={[styles.label, { color: C.ink, fontSize: 7.5 }]}>Confronto orizzonti temporali</T>
          </View>
          <View style={styles.table}>
            {TableHeader([
              { w: "14%", label: "Orizzonte temporale" },
              { w: "16%", label: "Senza azione (Soli sondaggi)", right: true },
              { w: "15%", label: "Impegno ridotto (Passivo)", right: true },
              { w: "15%", label: "Passo attuale (Base)", right: true },
              { w: "15%", label: "Massima spinta (Offensiva)", right: true },
              { w: "25%", label: "Crescita Base vs Oggi (punti e voti)", right: true },
            ])}
            {consenso.horizons.map((h, i) => (
              <View key={h.horizonKey} style={[styles.tr, i % 2 ? styles.trAlt : undefined]}>
                <T style={[styles.td, { width: "14%", fontWeight: 700 }]}>{h.horizonLabel}</T>
                <T style={[styles.td, styles.tdRight, { width: "16%", color: C.muted }]}>{pdfPct(h.pollsAlonePct)}</T>
                <T style={[styles.td, styles.tdRight, { width: "15%", color: C.amber }]}>{pdfPct(h.passivoPct)}</T>
                <T style={[styles.td, styles.tdRight, { width: "15%", color: C.cyan, fontWeight: 700 }]}>{pdfPct(h.basePct)}</T>
                <T style={[styles.td, styles.tdRight, { width: "15%", color: C.emerald, fontWeight: 700 }]}>{pdfPct(h.offensivaPct)}</T>
                <T style={[styles.td, styles.tdRight, { width: "25%" }]}>{h.growthBaseLabel}</T>
              </View>
            ))}
          </View>
        </View>

        <Footer verificationCode={meta.verificationCode} />
      </Page>

      {/* 02 · I 7 Fattori */}
      <Page size="A4" style={styles.page} wrap>
        <RunningHeader />
        <SectionHero
          n="02"
          kicker="I 7 fattori che portano dal consenso di oggi allo scenario Base"
          title="Come si Costruisce la Crescita"
        />
        <T style={styles.lead}>{meta.votesBaseNote}</T>

        <ChartCard
          title={`Ponte del consenso: da ${pdfPct(consenso.s0Pct)} a ${pdfPct(maggio.basePct)}`}
          sub="Ogni colonna mostra quanto ciascun fattore aggiunge o toglie, in punti percentuali, entro Maggio 2027."
        >
          <WaterfallChart rows={fattori.rows} s0Pct={consenso.s0Pct} basePct={maggio.basePct} />
        </ChartCard>

        <View style={styles.table}>
          {TableHeader([
            { w: "25%", label: "Fattore" },
            { w: "13%", label: "Contributo", right: true },
            { w: "16%", label: "Stima voti", right: true },
            { w: "46%", label: "Da dove esce il punteggio" },
          ])}
          {fattori.rows.map((row, i) => {
            const color = row.pp180 > 0.005 ? C.emerald : row.pp180 < -0.005 ? C.itRed : C.muted;
            return (
              <View key={row.id} style={[styles.tr, i % 2 ? styles.trAlt : undefined]} wrap={false}>
                <View style={[styles.td, { width: "25%", flexDirection: "row" }]}>
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: C.night,
                      marginRight: 5,
                      marginTop: 0.5,
                    }}
                  >
                    <Text style={{ fontSize: 6.5, fontWeight: 700, color: C.white, textAlign: "center", marginTop: 3 }}>
                      {String(i + 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: 700, fontSize: 7.8 }}>{row.label}</T>
                    <T style={[styles.muted, { fontSize: 6.6 }]}>{row.nature}</T>
                  </View>
                </View>
                <View style={[styles.td, { width: "13%", alignItems: "flex-end" }]}>
                  <T style={[styles.pill, { color, backgroundColor: tint(color, 0.12) }]}>
                    {`${pdfSignedPp(row.pp180)}%`}
                  </T>
                </View>
                <T style={[styles.td, styles.tdRight, { width: "16%", fontSize: 7.2 }]}>{row.votesHint}</T>
                <T style={[styles.td, { width: "46%", fontSize: 7.3 }]}>{row.explanation}</T>
              </View>
            );
          })}
        </View>

        <View style={styles.totalBand} wrap={false}>
          <View style={{ marginRight: 12 }}>
            <T style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 1.4, color: C.soft }}>TOTALE</T>
            <T style={{ fontSize: 20, fontWeight: 700, color: C.emeraldLight, letterSpacing: -0.5 }}>
              {pdfPct(maggio.basePct)}
            </T>
          </View>
          <View style={{ flex: 1, borderLeftWidth: 0.8, borderLeftColor: C.night3, paddingLeft: 12 }}>
            <Text style={{ fontSize: 7.8, color: C.white, lineHeight: 1.5, fontWeight: 600 }}>
              {pdfSafeText(`TOTALE: ${fattori.totalEquation}`)}
            </Text>
          </View>
        </View>

        <Footer verificationCode={meta.verificationCode} />
      </Page>

      {/* 03 · Quadro nazionale */}
      <Page size="A4" style={styles.page} wrap>
        <RunningHeader />
        <SectionHero
          n="03"
          kicker="Classifica nazionale per potenziale di bacino, stima FN locale, criticità territoriale e risposta B.I.P."
          title="Quadro Completo delle 20 Regioni"
        />
        <T style={styles.lead}>{cabina.regionsSubtitle}</T>
        <ChartCard
          title="Potenziale del bacino e stima FN locale"
          sub="Barra: potenziale 0-100 (verde = priorità alta, blu = espansione, grigio = presidio). A destra: potenziale e stima FN locale."
        >
          <RegionBars regions={cabina.regions} />
        </ChartCard>
        <View style={styles.legendRow}>
          {[
            { color: C.emerald, label: "Priorità Alta / Fascia Verde" },
            { color: C.cyan, label: "Espansione / Fascia Contendibile" },
            { color: C.gray, label: "Presidio Territoriale" },
          ].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
              <T style={styles.legendText}>{item.label}</T>
            </View>
          ))}
        </View>
        <Footer verificationCode={meta.verificationCode} />
      </Page>

      {/* 03 · Schede operative, 8 card per pagina senza spezzature */}
      {Array.from({ length: Math.ceil(cabina.regions.length / 8) }, (_, pageIndex) => {
        const slice = cabina.regions.slice(pageIndex * 8, pageIndex * 8 + 8);
        const from = pageIndex * 8 + 1;
        const to = pageIndex * 8 + slice.length;
        return (
          <Page key={`reg-cards-${pageIndex}`} size="A4" style={styles.page} wrap={false}>
            <RunningHeader />
            <T style={[styles.sectionTag, { marginTop: 0 }]}>
              {`SCHEDE OPERATIVE TERRITORIALI · ${String(from).padStart(2, "0")}-${String(to).padStart(2, "0")}`}
            </T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {slice.map((r, i) => {
                const rank = pageIndex * 8 + i + 1;
                return (
                  <View
                    key={r.regione}
                    wrap={false}
                    style={{
                      width: "49.2%",
                      borderWidth: 1,
                      borderColor: C.line,
                      borderRadius: 6,
                      padding: 7,
                      marginBottom: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: regionBarColor(r.roleLabel), marginRight: 5 }}>
                        {String(rank).padStart(2, "0")}
                      </Text>
                      <T style={{ fontSize: 8.4, fontWeight: 700, flex: 1 }}>{r.regione}</T>
                    </View>
                    <T style={{ fontSize: 6.4, color: C.muted, marginBottom: 3 }}>{r.roleLabel}</T>
                    <View style={{ flexDirection: "row", marginBottom: 3 }}>
                      <T style={[styles.chip, { marginTop: 0, color: C.emerald, backgroundColor: C.emeraldBg }]}>
                        {`Bacino ${formatDecimalIt(r.affinity, 0)}`}
                      </T>
                      <T style={[styles.chip, { marginTop: 0, marginRight: 0, color: C.cyan, backgroundColor: C.cyanBg }]}>
                        {`FN ${pdfPct(r.sharePct)}`}
                      </T>
                    </View>
                    <T style={[styles.sectionTag, { marginTop: 0, color: C.amber }]}>Problema principale dei cittadini</T>
                    <T style={[styles.p, { fontSize: 7.1, lineHeight: 1.32 }]}>{r.emergency}</T>
                    <T style={[styles.sectionTag, { color: C.emerald }]}>Risposta pronta dal Programma B.I.P.</T>
                    <T style={[styles.p, { fontSize: 7.1, lineHeight: 1.32, fontWeight: 600 }]}>{r.levaBip}</T>
                  </View>
                );
              })}
            </View>
            <Footer verificationCode={meta.verificationCode} />
          </Page>
        );
      })}

      {/* 04 · Notizie / B.I.P. */}
      <Page size="A4" style={styles.page} wrap>
        <RunningHeader />
        <SectionHero
          n="04"
          kicker="Cinque fronti operativi: notizia, effetto sul consenso, soluzione B.I.P."
          title="Temi Caldi e Risposte del B.I.P."
        />
        {newsBip.map((n, i) => {
          const color = bipColor(n.codiceBip);
          const sourceDate = sanitizeSourceDateLabel(`${n.testata} · ${n.dataPubblicazione}`);
          return (
            <View key={`${n.codiceBip}-${n.fronteLabel}`} style={styles.newsCard} wrap={false}>
              <View style={{ width: 5, backgroundColor: color }} />
              <View style={styles.newsBody}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[styles.newsNum, { backgroundColor: color }]}>{String(i + 1)}</Text>
                  <CardText style={{ fontSize: 9.5, fontWeight: 700, color, flex: 1 }}>
                    {n.fronteLabel.replace(/^\s*\d+\s*[.)-]\s*/, "")}
                  </CardText>
                  <CardText style={{ fontSize: 6.6, color: C.soft }}>{sourceDate}</CardText>
                </View>
                <CardText style={[styles.sectionTag, { color: C.muted }]}>LA NOTIZIA</CardText>
                <CardText style={{ fontWeight: 700, fontSize: 8.8, lineHeight: 1.35 }}>{n.notiziaTitolo}</CardText>
                <CardText style={[styles.sectionTag, { color: C.muted }]}>EFFETTO SUL CONSENSO</CardText>
                <CardText style={[styles.p, { fontSize: 7.8 }]}>{n.rischioOpportunitaConsenso}</CardText>
                <View
                  style={{
                    marginTop: 6,
                    backgroundColor: tint(color, 0.07),
                    borderRadius: 5,
                    padding: 7,
                  }}
                >
                  <CardText style={[styles.sectionTag, { marginTop: 0, color }]}>LA SOLUZIONE B.I.P. DA PORTARE IN CAMPO</CardText>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                    <CardText style={[styles.chip, { marginTop: 0, color: C.white, backgroundColor: color }]}>
                      {n.codiceBip}
                    </CardText>
                    <CardText style={{ fontSize: 8.2, fontWeight: 700, color: C.ink, flex: 1 }}>{n.titoloBip}</CardText>
                  </View>
                  <CardText style={[styles.p, { fontSize: 7.8 }]}>{withSingleFinalPeriod(n.azioneRimedioBip)}</CardText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 2 }}>
                    <CardText style={{ fontSize: 6.6, color: C.muted, marginRight: 4, marginTop: 3 }}>Regioni dove insistere:</CardText>
                    {n.regioniTarget.map((reg) => (
                      <CardText key={reg} style={[styles.chip, { color, backgroundColor: C.white, borderWidth: 0.6, borderColor: tint(color, 0.4) }]}>
                        {reg}
                      </CardText>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        <FrontRegionMatrix news={newsBip} rankedRegions={cabina.regions.map((row) => row.regione)} />
        <Footer verificationCode={meta.verificationCode} />
      </Page>

      {/* 05 · Analisi e 4 mosse */}
      <Page size="A4" style={styles.page} wrap>
        <RunningHeader />
        <SectionHero
          n="05"
          kicker="Lettura politica del quadro e piano d'azione"
          title="Analisi Strategica e 4 Mosse Operative"
        />
        <View
          wrap={false}
          style={{
            marginBottom: 5,
            borderWidth: 1,
            borderColor: C.emerald,
            borderRadius: 6,
            padding: 6,
            backgroundColor: "#F3FAF6",
          }}
        >
          <T style={[styles.label, { color: C.emerald, marginBottom: 4 }]}>
            ORDINE OPERATIVO PRIORITARIO DI OGGI
          </T>
          <T style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>
            {`${data.ordineOperativo.region} · ${data.ordineOperativo.piazza}`}
          </T>
          <T style={[styles.p, { fontSize: 7.8 }]}>
            {`Problema reale: ${data.ordineOperativo.problema}`}
          </T>
          <T style={[styles.p, { fontSize: 7.8 }]}>
            {`Misura B.I.P.: ${data.ordineOperativo.misura}`}
          </T>
          <T style={[styles.p, { fontSize: 7.8 }]}>
            {`Frase pronta: ${data.ordineOperativo.frase}`}
          </T>
          <T style={[styles.p, { fontSize: 7.6, color: C.muted }]}>
            {`Forchetta a 30 giorni. ${data.ordineOperativo.fork}`}
          </T>
          {data.ordineOperativo.bersaglio ? (
            <T style={[styles.p, { fontSize: 7.4, color: C.muted }]}>
              {data.ordineOperativo.bersaglio}
            </T>
          ) : null}
        </View>
        {["Quadro attuale", "Dinamica del consenso", "Condizioni operative e limiti"].map((title, i) => (
          <View key={title} style={styles.analysisPanel} wrap={false}>
            <View style={{ width: 3, backgroundColor: panelColors[i] }} />
            <View style={{ flex: 1, paddingVertical: 4, paddingHorizontal: 8 }}>
              <T style={[styles.analysisTitle, { color: panelColors[i], marginBottom: 1 }]}>{`${i + 1} - ${title}`}</T>
              <T style={[styles.p, { fontSize: 7.2, lineHeight: 1.28 }]}>{cabina.tesiParagraphs[i] ?? ""}</T>
            </View>
          </View>
        ))}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, marginBottom: 4 }}>
          <View style={{ width: 16, height: 2, backgroundColor: C.emerald, marginRight: 6 }} />
          <T style={[styles.label, { color: C.ink, fontSize: 7.5 }]}>Le 4 mosse operative</T>
        </View>
        <View style={styles.directiveGrid}>
          {cabina.directives.map((d, i) => {
            const color = directiveColors[i % directiveColors.length]!;
            return (
              <View key={d.rank} style={[styles.directiveCard, { borderTopWidth: 2.5, borderTopColor: color }]} wrap={false}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4 }}>
                  <Text style={[styles.directiveNum, { color }]}>{String(d.rank).padStart(2, "0")}</Text>
                  <T style={{ fontSize: 8.4, fontWeight: 700, lineHeight: 1.3, flex: 1, marginTop: 2 }}>{d.azione}</T>
                </View>
                <T style={[styles.p, { fontSize: 7.4, lineHeight: 1.36 }]}>{d.perche}</T>
                <View style={{ borderTopWidth: 0.5, borderTopColor: C.line, marginTop: 5, paddingTop: 4 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {d.regioni.map((reg) => (
                      <T key={reg} style={[styles.chip, { color, backgroundColor: tint(color, 0.1) }]}>
                        {reg}
                      </T>
                    ))}
                  </View>
                  <T style={[styles.muted, { fontSize: 6.8, marginTop: 3 }]}>{`Leva: ${d.levaBip}`}</T>
                </View>
              </View>
            );
          })}
        </View>
        <Footer verificationCode={meta.verificationCode} />
      </Page>

      {/* 06 · Dichiarazioni e sondaggi */}
      <Page size="A4" style={styles.page} wrap>
        <RunningHeader />
        <SectionHero
          n="06"
          kicker="Messaggi pronti all'uso e verifica sui dati pubblicati"
          title="Dichiarazioni Pronte e Sondaggi Recenti"
        />

        <View style={{ flexDirection: "row", marginBottom: 10 }} wrap={false}>
          {[0, 1].map((k) => (
            <View key={k} style={[styles.quoteCard, k === 0 ? { marginRight: 8 } : {}]}>
              <Text style={styles.quoteMark}>{"\u201C"}</Text>
              <T style={{ fontSize: 8.6, fontWeight: 700, color: C.emeraldLight, marginBottom: 5 }}>
                {cabina.draftTitles[k] ?? ""}
              </T>
              <T style={{ fontSize: 7.9, color: C.white, lineHeight: 1.5 }}>{cabina.draftComms[k] ?? ""}</T>
            </View>
          ))}
        </View>

        <ChartCard
          title="Ultimi sondaggi pubblicati rispetto alla media"
          sub={`Verde: sopra la media ponderata (${pdfPct(consenso.s0Pct)}). Arancio: sotto la media.`}
        >
          <PollDotPlot polls={consenso.polls} s0Pct={consenso.s0Pct} />
        </ChartCard>

        <View style={styles.table} wrap={false}>
          {TableHeader([
            { w: "34%", label: "Istituto" },
            { w: "20%", label: "Data" },
            { w: "16%", label: "FN %", right: true },
            { w: "30%", label: `Scarto dalla media ${pdfPct(consenso.s0Pct)}`, right: true },
          ])}
          {consenso.polls.map((p, i) => (
            <View key={`${p.institute}-${p.date}-${i}`} style={[styles.tr, i % 2 ? styles.trAlt : undefined]}>
              <T style={[styles.td, { width: "34%", paddingVertical: 3.5, fontWeight: 600 }]}>{p.institute}</T>
              <T style={[styles.td, { width: "20%", paddingVertical: 3.5 }]}>{p.dateDisplay}</T>
              <T style={[styles.td, styles.tdRight, { width: "16%", paddingVertical: 3.5, fontWeight: 700 }]}>{pdfPct(p.pct)}</T>
              <T
                style={[
                  styles.td,
                  styles.tdRight,
                  {
                    width: "30%",
                    paddingVertical: 3.5,
                    color: p.pct >= consenso.s0Pct ? C.emerald : C.amber,
                  },
                ]}
              >
                {p.scartoLabel}
              </T>
            </View>
          ))}
        </View>
        <T style={[styles.muted, { marginBottom: 8, fontSize: 6.8 }]}>
          {`Fonti acquisite: ${pollsCov} sondaggi / ${smCov} Supermedia (in tabella gli ultimi ${consenso.polls.length}).`}
        </T>

        <View style={styles.reliability} wrap={false}>
          <View style={{ width: 3, backgroundColor: C.amber }} />
          <View style={{ flex: 1, padding: 9 }}>
            <T style={[styles.label, { color: C.amber, marginBottom: 4 }]}>Attendibilità e verifica storica</T>
            <T style={[styles.p, { fontSize: 7.8 }]}>{cabina.reliabilityBox}</T>
            <T style={{ fontSize: 6.8, color: C.amber, marginTop: 4, fontWeight: 600 }}>
              {`Fonti: ${pollsCov} sondaggi / ${smCov} Supermedia / ${Math.max(meta.coverage.news.considered, newsBip.length)} notizie / Origine testi: ${meta.textOriginPublic}`}
            </T>
          </View>
        </View>

        <Footer verificationCode={meta.verificationCode} />
      </Page>
    </Document>
  );
}
