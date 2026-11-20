import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import { ensureDossierPdfFonts } from "@/lib/export/pdfFonts";
import { pdfSafeText } from "@/lib/export/pdfSafeText";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { BASIN_LABEL, BAND_LABEL, primaryBasin } from "@/components/obiettivo/goalViewModel";
import {
  buildOperationalRoadmap,
  ensureOperationalRoadmapDepth,
  type OperationalRoadmap,
} from "@/lib/engine/operationalRoadmapBuilder";

ensureDossierPdfFonts();

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Inter", fontSize: 10, color: "#14221c" },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  kicker: { fontSize: 9, letterSpacing: 1, color: "#3d5c50", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  cell: { flex: 1, borderWidth: 1, borderColor: "#d5e2db", borderRadius: 4, padding: 6 },
  label: { fontSize: 8, color: "#4d675c", marginBottom: 2 },
  value: { fontSize: 12, fontWeight: 700 },
  p: { fontSize: 9, lineHeight: 1.35, marginBottom: 3 },
  th: { fontSize: 8, color: "#4d675c" },
});

function line(text: string) {
  return pdfSafeText(text);
}

export function StrategicPlanPdfDocument({
  plan,
  roadmap: roadmapInput,
}: {
  plan: StrategicBackcastResult;
  roadmap?: OperationalRoadmap;
}) {
  const fronts = [...plan.regions].sort((a, b) => b.addedVotes - a.addedVotes || a.region.localeCompare(b.region, "it"));
  const roadmap = ensureOperationalRoadmapDepth(roadmapInput ?? buildOperationalRoadmap(plan, plan.horizonDays));
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>PIANO OBIETTIVO STRATEGICO</Text>
        <Text style={styles.h1}>Dossier esecutivo</Text>
        <Text style={styles.p}>
          {line("La traiettoria stimata non viene ricalcolata. Il surplus e i fabbisogni sono IPOTESI.")}
        </Text>
        <Text style={styles.p}>
          {line(
            `Fonte: ${roadmap.generatedBy === "AI_MODEL" ? "Strategia AI" : "Variante automatica"}. ${roadmap.executiveThesis}`,
          )}
        </Text>
        {roadmap.generationMeta?.diagnostic ? (
          <Text style={styles.p}>{line(roadmap.generationMeta.diagnostic)}</Text>
        ) : null}
        {roadmap.keyBottleneckResolution ? (
          <Text style={styles.p}>{line(`Collo di bottiglia: ${roadmap.keyBottleneckResolution}`)}</Text>
        ) : null}
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.label}>OGGI - MISURATO</Text>
            <Text style={styles.value}>{formatDecimalIt(plan.currentPct, 2)}%</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>SCENARIO OFFENSIVO - STIMA</Text>
            <Text style={styles.value}>{formatDecimalIt(plan.offensiveCentral, 2)}%</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.label}>TRAGUARDO - IPOTESI</Text>
            <Text style={styles.value}>
              {formatDecimalIt(plan.targetPct, 2)}% / +{formatIntIt(plan.netSurplusVotes)} voti
            </Text>
          </View>
        </View>
        <Text style={styles.p}>
          {line(
            `Fattibilita ${plan.feasibilityIndex}/100. Probabilita stimata ${formatDecimalIt(plan.successProbability * 100, 1)}%. Tenuta scenario avverso ${formatDecimalIt(plan.cvar10, 2)}%. Fascia ${BAND_LABEL[plan.feasibilityBand] ?? plan.feasibilityBand}.`,
          )}
        </Text>
        {plan.targetPct > plan.maxEndogenousPct ? (
          <Text style={styles.p}>
            {line(
              `Macchina organizzativa fino al ${formatDecimalIt(plan.achievablePct, 2)}%. Quota residua ${formatDecimalIt(plan.exogenousGapPct, 2)} pp: fattori politici acceleratori. IPOTESI.`,
            )}
          </Text>
        ) : null}
        <Text style={[styles.label, { marginTop: 8 }]}>CHECKPOINT</Text>
        {plan.checkpoints.map((point) => (
          <Text key={point.day} style={styles.p}>
            {line(
              `${point.day}g - in rotta da ${formatDecimalIt(point.minOnTrackPct, 2)}% - atteso ${formatDecimalIt(point.expectedPct, 2)}% - tetto ${formatDecimalIt(point.stretchPct, 2)}%`,
            )}
          </Text>
        ))}
        <Text style={[styles.label, { marginTop: 8 }]}>QUADRO COMPLETO 20 REGIONI - IPOTESI</Text>
        {fronts.map((row) => (
          <Text key={row.region} style={styles.p}>
            {line(
              `${row.region} (${row.role}) ${formatDecimalIt(row.anchorPct, 2)}% -> ${formatDecimalIt(row.targetPct, 2)}% +${formatIntIt(row.addedVotes)} voti. Bacino ${BASIN_LABEL[primaryBasin(row)]}.`,
            )}
          </Text>
        ))}
        <Text style={[styles.label, { marginTop: 8 }]}>ARIA, TERRA, ELETTI - IPOTESI</Text>
        {plan.themes.slice(0, 6).map((theme) => (
          <Text key={theme.theme} style={styles.p}>
            {line(`${theme.theme}: +${formatIntIt(theme.votes)} voti. ${theme.regions.slice(0, 4).join(", ")}`)}
          </Text>
        ))}
        <Text style={styles.p}>
          {line(
            `Comitati +${formatIntIt(plan.network.deltaCommittees)}. Tesserati +${formatIntIt(plan.network.deltaMembers)}. Eletti locali ${formatIntIt(plan.network.electedTarget)}.`,
          )}
        </Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>CRONOPROGRAMMA OPERATIVO E PRESIDI TERRITORIALI</Text>
        <Text style={styles.p}>{line("IPOTESI. Ogni tappa, luogo e azione descrive un'ipotesi di esecuzione e non modifica la traiettoria stimata.")}</Text>
        {roadmap.stages.map((stage) => (
          <View key={stage.stageId} style={{ marginBottom: 8 }}>
            <Text style={styles.label}>
              {line(`TAPPA ${stage.stageId} - ${stage.label} - ${stage.dayRangeLabel} - IPOTESI`)}
            </Text>
            <Text style={styles.p}>
              {line(`Atteso ${formatDecimalIt(stage.targetConsensusPct, 2)}%. Voti di tappa +${formatIntIt(stage.stageVotesDelta)}, cumulati +${formatIntIt(stage.cumulativeVotesTarget)}. In rotta da ${formatDecimalIt(stage.verificationMilestone.minOnTrackPct, 2)}%.`)}
            </Text>
            <Text style={styles.p}>
              {line(`Di tappa: comitati +${formatIntIt(stage.stageCommitteesDelta)}, tesserati +${formatIntIt(stage.stageMembersDelta)}, eletti +${formatIntIt(stage.stageOfficialsDelta)}. Cumulati: comitati +${formatIntIt(stage.committees)}, tesserati +${formatIntIt(stage.members)}, eletti +${formatIntIt(stage.elected)}.`)}
            </Text>
            <Text style={styles.p}>{line(`Perche strategico: ${stage.strategicRationale.whyNow}`)}</Text>
            <Text style={styles.p}>{line(`Meccanismo di conversione: ${stage.strategicRationale.voterPsychologyMechanism}`)}</Text>
            <Text style={styles.p}>{line(`Collo di bottiglia: ${stage.strategicRationale.structuralObjective}`)}</Text>
            <Text style={styles.p}>{line(`Presidi: ${stage.placesToPresidiate.map((place) => place.place).join("; ")}.`)}</Text>
            {stage.detailedMoves.map((move) => (
              <Text key={move.lane} style={styles.p}>
                {line(`${move.lane} - ${move.headline}. Cosa: ${move.whatToDo} Perche: ${move.whyItWorks}`)}
              </Text>
            ))}
            <Text style={styles.p}>{line(`Disagio sociale: ${stage.interferenceMatrix.socialDiscontentVector}`)}</Text>
            <Text style={styles.p}>{line(`Altri partiti e contromossa: ${stage.interferenceMatrix.otherPartiesMoves}`)}</Text>
            <Text style={styles.p}>{line(`Eventi e piazze: ${stage.interferenceMatrix.eventsAndProtests}`)}</Text>
            <Text style={styles.p}>{line(`Internazionale/UE: ${stage.interferenceMatrix.internationalAndEuFactor}`)}</Text>
            <Text style={styles.p}>{line(`Piano B: ${stage.interferenceMatrix.contingencyPlaybook}`)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
