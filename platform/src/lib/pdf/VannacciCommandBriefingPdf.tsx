import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ConsensusCausalReport } from "@/lib/analytics/causalAttribution";
import type { FullForecast180Report } from "@/lib/analytics/strategicForecast180";
import type {
  DiscomfortRemedyCard,
  RegionalStrategicDossier,
} from "@/lib/analytics/socialDiscomfortRemedies";

export interface VannacciPdfPayload {
  mode: "nazionale" | "regionale";
  selectedRegion?: string;
  generatedDateLabel: string;
  computationId: string;
  causalReport: ConsensusCausalReport;
  forecast180: FullForecast180Report;
  nationalDiscomforts: DiscomfortRemedyCard[];
  topRegions: RegionalStrategicDossier[];
  focusRegionDossier?: RegionalStrategicDossier;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 34,
    paddingHorizontal: 28,
    fontFamily: "Helvetica",
    fontSize: 9.2,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  headerBar: {
    backgroundColor: "#0B192C",
    padding: 12,
    borderRadius: 4,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  headerSubtitle: {
    color: "#93C5FD",
    fontSize: 8,
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: "#1E3A8A",
    color: "#F8FAFC",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#0B192C",
    borderBottomWidth: 1.5,
    borderBottomColor: "#1E3A8A",
    paddingBottom: 3,
    marginTop: 8,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  kpiCard: {
    width: "32%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 4,
    padding: 7,
  },
  kpiLabel: {
    fontSize: 7.2,
    color: "#475569",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  kpiValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0B192C",
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 7.2,
    color: "#334155",
    marginTop: 2,
  },
  verdictBox: {
    backgroundColor: "#EFF6FF",
    borderLeftWidth: 3,
    borderLeftColor: "#1D4ED8",
    padding: 7,
    marginBottom: 7,
  },
  verdictTitle: {
    fontSize: 9.2,
    fontFamily: "Helvetica-Bold",
    color: "#1E3A8A",
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 8.6,
    lineHeight: 1.35,
    color: "#1E293B",
    marginTop: 1,
  },
  driverCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    padding: 6.5,
    marginBottom: 5.5,
    backgroundColor: "#FFFFFF",
  },
  driverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  driverTitle: {
    fontSize: 9.2,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
    maxWidth: "72%",
  },
  deltaPositive: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#15803D",
  },
  deltaNegative: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#B91C1C",
  },
  deltaNeutral: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  actionLine: {
    fontSize: 8.2,
    color: "#1E3A8A",
    fontFamily: "Helvetica-Bold",
    marginTop: 3,
  },
  horizonBox: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 4,
    padding: 7,
    marginBottom: 6.5,
    backgroundColor: "#F8FAFC",
  },
  horizonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 2,
  },
  soundbiteBox: {
    backgroundColor: "#FEF3C7",
    borderLeftWidth: 3,
    borderLeftColor: "#D97706",
    padding: 5.5,
    marginTop: 4,
  },
  soundbiteLabel: {
    fontSize: 7.2,
    fontFamily: "Helvetica-Bold",
    color: "#92400E",
    textTransform: "uppercase",
  },
  soundbiteText: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Oblique",
    color: "#78350F",
    marginTop: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 3.5,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    paddingVertical: 4.5,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  tableHeaderText: {
    color: "#FFFFFF",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
  },
  tableCell: {
    fontSize: 7.8,
    color: "#1E293B",
    paddingHorizontal: 4,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.2,
    color: "#64748B",
  },
});

function deltaStyle(
  direction: "positivo" | "negativo" | "neutro",
): typeof styles.deltaPositive {
  if (direction === "positivo") return styles.deltaPositive;
  if (direction === "negativo") return styles.deltaNegative;
  return styles.deltaNeutral;
}

export function VannacciCommandBriefingPdf({
  data,
}: {
  data: VannacciPdfPayload;
}) {
  const {
    causalReport,
    forecast180,
    nationalDiscomforts,
    topRegions,
    focusRegionDossier,
  } = data;
  const horizonsList = [
    forecast180.horizons.d30,
    forecast180.horizons.d90,
    forecast180.horizons.d180,
  ];

  return (
    <Document
      title={`Briefing ${data.generatedDateLabel} - Comando FN`}
      author="Sala Operativa Futuro Nazionale"
      subject="Dossier Centro Comando Vannacci"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerTitle}>
              DOSSIER COMANDO — GEN. ROBERTO VANNACCI
            </Text>
            <Text style={styles.headerSubtitle}>
              {`CERVELLO STRATEGICO FUTURO NAZIONALE • ${data.generatedDateLabel}`}
            </Text>
          </View>
          <Text style={styles.headerBadge}>
            {data.mode === "regionale" && focusRegionDossier
              ? `MISSIONE: ${focusRegionDossier.regionName.toUpperCase()}`
              : "BRIEFING NAZIONALE"}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          1. Situazione Consenso Nazionale & Perché Siamo Saliti / Scesi
        </Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Consenso Attuale</Text>
            <Text style={styles.kpiValue}>
              {`${causalReport.currentConsensus.toFixed(2)}%`}
            </Text>
            <Text style={styles.kpiSub}>
              {`7gg: ${causalReport.delta7d >= 0 ? "+" : ""}${causalReport.delta7d.toFixed(2)}%`}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Variazione Grezza 30gg</Text>
            <Text style={styles.kpiValue}>
              {`${causalReport.delta30d >= 0 ? "+" : ""}${causalReport.delta30d.toFixed(2)}%`}
            </Text>
            <Text style={styles.kpiSub}>
              {`Da ${causalReport.previous30dConsensus.toFixed(2)}%`}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Variazione Reale Netta</Text>
            <Text style={styles.kpiValue}>
              {`${causalReport.realNetDelta30d >= 0 ? "+" : ""}${causalReport.realNetDelta30d.toFixed(2)}%`}
            </Text>
            <Text style={styles.kpiSub}>
              {`House Effect: ${causalReport.houseEffectBias >= 0 ? "+" : ""}${causalReport.houseEffectBias.toFixed(2)}%`}
            </Text>
          </View>
        </View>

        <View style={styles.verdictBox}>
          <Text style={styles.verdictTitle}>{causalReport.headlineVerdict}</Text>
          <Text style={styles.bodyText}>{causalReport.deepNarrativeWhy}</Text>
        </View>

        <Text style={styles.sectionTitle}>
          Scomposizione Matematica e Politica dei Fattori (30 Giorni)
        </Text>

        {causalReport.drivers.map((drv) => (
          <View key={drv.id} style={styles.driverCard} wrap={false}>
            <View style={styles.driverHeader}>
              <Text style={styles.driverTitle}>{drv.label}</Text>
              <Text style={deltaStyle(drv.direction)}>
                {`${drv.deltaContribution >= 0 ? "+" : ""}${drv.deltaContribution.toFixed(2)}% (Stima: ${drv.confidence})`}
              </Text>
            </View>
            <Text style={styles.bodyText}>{`PERCHÉ: ${drv.whyExplanation}`}</Text>
            <Text style={styles.actionLine}>
              {`DIRETTIVA TEAM FN: ${drv.technicalActionForTeam}`}
            </Text>
          </View>
        ))}

        <View style={styles.verdictBox}>
          <Text style={styles.verdictTitle}>
            Origine dei Flussi Elettorali Attuali
          </Text>
          <Text style={styles.bodyText}>
            {causalReport.competitorFlowsSummary.explanation}
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Futuro Nazionale — Uso Riservato Direzione & Stato Maggiore</Text>
          <Text>{`ID Calcolo: ${data.computationId} • Pag. 1 / 5`}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>
          2. Previsione Consenso a 30, 90 e 180 Giorni (Perché e Per Come)
        </Text>

        <View style={styles.verdictBox}>
          <Text style={styles.verdictTitle}>Traiettoria Strategica Semestrale</Text>
          <Text style={styles.bodyText}>
            {forecast180.strategicExecutiveSummary}
          </Text>
        </View>

        {horizonsList.map((h) => (
          <View key={h.horizonDays} style={styles.horizonBox} wrap={false}>
            <View style={styles.horizonHeader}>
              <Text style={styles.driverTitle}>
                {`ORIZZONTE +${h.horizonDays} GIORNI (${h.targetDateFormatted})`}
              </Text>
              <Text style={styles.deltaPositive}>
                {`Passivo: ${h.regimes.passivo.toFixed(2)}% | BASE: ${h.regimes.base.toFixed(2)}% | Offensiva: ${h.regimes.offensiva.toFixed(2)}%`}
              </Text>
            </View>
            <Text style={styles.bodyText}>{h.detailedWhyAndHow}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>
          Eventi Programmati nei Prossimi 180 Giorni & Come Cavalcarli
        </Text>

        {forecast180.allEvents.map((ev) => (
          <View key={ev.id} style={styles.driverCard} wrap={false}>
            <View style={styles.driverHeader}>
              <Text style={styles.driverTitle}>
                {`[${ev.dateLabel}] ${ev.title}`}
              </Text>
              <Text
                style={
                  ev.baseImpactPct >= 0
                    ? styles.deltaPositive
                    : styles.deltaNegative
                }
              >
                {`Prob. ${Math.round(ev.probability * 100)}% • ${ev.baseImpactPct >= 0 ? "+" : ""}${ev.baseImpactPct.toFixed(2)}%`}
              </Text>
            </View>
            <Text style={styles.bodyText}>
              {`PERCHÉ SPOSTA VOTI: ${ev.whyItMatters}`}
            </Text>
            <Text style={styles.actionLine}>
              {`MOSSA OPERATIVA FN: ${ev.howFnMustAct}`}
            </Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Futuro Nazionale — Previsione Multi-Orizzonte 30/90/180gg</Text>
          <Text>{`ID Calcolo: ${data.computationId} • Pag. 2 / 5`}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>
          3. Problemi Reali nel Paese: Dal Disagio Sociale al Rimedio FN
        </Text>

        {nationalDiscomforts.map((item) => (
          <View key={item.id} style={styles.driverCard} wrap={false}>
            <View style={styles.driverHeader}>
              <Text style={styles.driverTitle}>
                {item.macroArea.toUpperCase()}
              </Text>
              <Text style={styles.deltaNegative}>
                {`Gravità Sociale: ${item.severityScore}/100`}
              </Text>
            </View>
            <Text style={styles.bodyText}>
              {`• DISAGIO REALE CITTADINI: ${item.citizenPainDescription}`}
            </Text>
            <Text style={styles.bodyText}>
              {`• DATO UFFICIALE DA CITARE: ${item.hardDataEvidence}`}
            </Text>
            <Text style={styles.bodyText}>
              {`• RESPONSABILITÀ POLITICA: ${item.politicalResponsibility}`}
            </Text>
            <Text style={styles.actionLine}>
              {`• RIMEDIO TECNICO FN (B.I.P.): ${item.fnTechnicalRemedy}`}
            </Text>
            <View style={styles.soundbiteBox}>
              <Text style={styles.soundbiteLabel}>
                Argomento Chiave Pronto per Vannacci (TV / Palco / Social):
              </Text>
              <Text style={styles.soundbiteText}>
                {`«${item.vannacciSoundbite}»`}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Futuro Nazionale — Diagnosi Disagi Sociali & Soluzioni B.I.P.</Text>
          <Text>{`ID Calcolo: ${data.computationId} • Pag. 3 / 5`}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        {data.mode === "regionale" && focusRegionDossier ? (
          <View>
            <Text style={styles.sectionTitle}>
              {`4. Dossier Missione Territoriale: ${focusRegionDossier.regionName}`}
            </Text>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Giunta Regionale</Text>
                <Text style={styles.kpiValue}>
                  {focusRegionDossier.currentGovernance}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Indice Rabbia Sociale</Text>
                <Text style={styles.kpiValue}>
                  {`${focusRegionDossier.socialAngerIndex}/100`}
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Potenziale Crescita FN</Text>
                <Text style={styles.kpiValue}>
                  {`${focusRegionDossier.electoralOpportunityScore}/100`}
                </Text>
              </View>
            </View>

            <View style={styles.verdictBox}>
              <Text style={styles.verdictTitle}>
                {`Perché FN può sfondare in ${focusRegionDossier.regionName}`}
              </Text>
              <Text style={styles.bodyText}>
                {focusRegionDossier.politicalVacuumAnalysis}
              </Text>
            </View>

            {focusRegionDossier.discomfortsAndRemedies.map((rem) => (
              <View key={rem.id} style={styles.driverCard} wrap={false}>
                <Text style={styles.driverTitle}>
                  {`Emergenza Principale: ${rem.macroArea}`}
                </Text>
                <Text style={styles.bodyText}>
                  {`• Problema sentito dalle persone: ${rem.citizenPainDescription}`}
                </Text>
                <Text style={styles.bodyText}>
                  {`• Dato oggettivo locale: ${rem.hardDataEvidence}`}
                </Text>
                <Text style={styles.bodyText}>
                  {`• Categorie sociali da incontrare: ${rem.targetSocialGroups.join(", ")}`}
                </Text>
                <Text style={styles.actionLine}>
                  {`• Soluzione concreta FN per ${focusRegionDossier.regionName}: ${rem.fnTechnicalRemedy}`}
                </Text>
                <Text style={styles.bodyText}>
                  {`• Checklist Team Regionale: ${rem.teamOperationalChecklist.join(" | ")}`}
                </Text>
                <View style={styles.soundbiteBox}>
                  <Text style={styles.soundbiteLabel}>
                    Dichiarazione d’Apertura per Stampa Locale:
                  </Text>
                  <Text style={styles.soundbiteText}>
                    {`«${rem.vannacciSoundbite}»`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>
              4. Top 5 Regioni Prioritarie: Disagi Locali & Soluzioni Pronte
            </Text>
            {topRegions.slice(0, 5).map((reg) => {
              const firstRem = reg.discomfortsAndRemedies[0];
              return (
                <View
                  key={reg.regionName}
                  style={styles.driverCard}
                  wrap={false}
                >
                  <View style={styles.driverHeader}>
                    <Text style={styles.driverTitle}>
                      {`${reg.regionName.toUpperCase()} (Giunta: ${reg.currentGovernance})`}
                    </Text>
                    <Text style={styles.deltaPositive}>
                      {`Priorità FN: ${reg.electoralOpportunityScore}/100 • Rabbia: ${reg.socialAngerIndex}/100`}
                    </Text>
                  </View>
                  <Text style={styles.bodyText}>
                    {`• Problema Critico: ${reg.primaryCrisisSummary}`}
                  </Text>
                  <Text style={styles.bodyText}>
                    {`• Vuoto Elettorale: ${reg.politicalVacuumAnalysis}`}
                  </Text>
                  {firstRem ? (
                    <Text style={styles.actionLine}>
                      {`• Rimedio FN (${firstRem.targetSocialGroups.join(", ")}): ${firstRem.fnTechnicalRemedy}`}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Futuro Nazionale — Cabina di Regia Territoriale</Text>
          <Text>{`ID Calcolo: ${data.computationId} • Pag. 4 / 5`}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>
          5. Quadro Sinottico Completo delle 20 Regioni Italiane
        </Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { width: "18%" }]}>Regione</Text>
          <Text style={[styles.tableHeaderText, { width: "14%" }]}>Giunta</Text>
          <Text style={[styles.tableHeaderText, { width: "10%" }]}>Priorità</Text>
          <Text style={[styles.tableHeaderText, { width: "10%" }]}>Rabbia</Text>
          <Text style={[styles.tableHeaderText, { width: "48%" }]}>
            Emergenza Primaria & Rimedio Sintetico FN
          </Text>
        </View>

        {topRegions.map((reg) => {
          const rem = reg.discomfortsAndRemedies[0];
          const rimedio = rem
            ? `${rem.fnTechnicalRemedy.slice(0, 105)}...`
            : `${reg.primaryCrisisSummary.slice(0, 105)}`;
          return (
            <View key={reg.regionName} style={styles.tableRow} wrap={false}>
              <Text
                style={[
                  styles.tableCell,
                  { width: "18%", fontFamily: "Helvetica-Bold" },
                ]}
              >
                {reg.regionName}
              </Text>
              <Text style={[styles.tableCell, { width: "14%" }]}>
                {reg.currentGovernance}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: "10%", fontFamily: "Helvetica-Bold" },
                ]}
              >
                {`${reg.electoralOpportunityScore}/100`}
              </Text>
              <Text style={[styles.tableCell, { width: "10%" }]}>
                {`${reg.socialAngerIndex}/100`}
              </Text>
              <Text style={[styles.tableCell, { width: "48%" }]}>
                {`[${rem ? rem.macroArea : "Generale"}] ${rimedio}`}
              </Text>
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text>Futuro Nazionale — Mappa Nazionale Operativa 20 Regioni</Text>
          <Text>{`ID Calcolo: ${data.computationId} • Pag. 5 / 5`}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function createVannacciPdfDocument(data: VannacciPdfPayload) {
  return <VannacciCommandBriefingPdf data={data} />;
}
