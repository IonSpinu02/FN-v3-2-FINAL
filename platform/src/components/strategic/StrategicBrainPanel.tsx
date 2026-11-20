'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  FileDown,
  TrendingUp,
  AlertTriangle,
  CalendarClock,
  MapPin,
  ShieldCheck,
  PlusCircle,
  Trash2,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import {
  buildConsensusCausalReport,
  MediaSalienceInput,
  TerritorialActivityInput,
} from '@/lib/analytics/causalAttribution';
import {
  DEFAULT_UPCOMING_EVENTS_180D,
  ForecastHorizonDays,
  generateStrategicForecast180,
  ScheduledPoliticalEvent,
} from '@/lib/analytics/strategicForecast180';
import {
  ALL_REGIONAL_DOSSIERS,
  NATIONAL_DISCOMFORT_REMEDIES,
} from '@/lib/analytics/socialDiscomfortRemedies';

interface StrategicBrainPanelProps {
  currentConsensus?: number;
  previous7dConsensus?: number;
  previous30dConsensus?: number;
}

const STORAGE_KEY_EVENTS = 'fn_strategic_events_180_v1';
const STORAGE_KEY_INPUTS = 'fn_strategic_causal_inputs_v1';

export default function StrategicBrainPanel({
  currentConsensus = 7.4,
  previous7dConsensus: propPrev7d,
  previous30dConsensus: propPrev30d,
}: StrategicBrainPanelProps) {
  const [activeTab, setActiveTab] = useState<
    'perche' | 'previsione180' | 'disagi_rimedi' | 'regia_team'
  >('perche');
  const [selectedRegion, setSelectedRegion] = useState<string>('Veneto');
  const [exportMode, setExportMode] = useState<'nazionale' | 'regionale'>('nazionale');
  const [isExporting, setIsExporting] = useState(false);

  // Stato modificabile dal Team Tecnico per analisi causale fine
  const [prev7d, setPrev7d] = useState<number>(
    propPrev7d ?? Number((currentConsensus - 0.1).toFixed(2))
  );
  const [prev30d, setPrev30d] = useState<number>(
    propPrev30d ?? Number((currentConsensus - 0.25).toFixed(2))
  );
  const [media, setMedia] = useState<MediaSalienceInput>({
    securityAndImmigration: 68,
    costOfLivingAndTaxes: 74,
    greenDealAndEU: 55,
    coalitionInternalNoise: 42,
  });
  const [territory, setTerritory] = useState<TerritorialActivityInput>({
    newCommitteesLast30d: 14,
    newMembersGrowthPct: 6.5,
    localDefectionsCount: 3,
    vannacciMediaSpikes: 7,
  });

  // Lista eventi futuri personalizzabile dal Team Tecnico FN
  const [events, setEvents] = useState<ScheduledPoliticalEvent[]>(DEFAULT_UPCOMING_EVENTS_180D);

  // Campi per aggiungere un nuovo evento futuro
  const [newEvtTitle, setNewEvtTitle] = useState('');
  const [newEvtWindow, setNewEvtWindow] = useState<ForecastHorizonDays>(30);
  const [newEvtImpact, setNewEvtImpact] = useState<number>(0.25);
  const [newEvtProb, setNewEvtProb] = useState<number>(80);
  const [newEvtWhy, setNewEvtWhy] = useState('');
  const [newEvtHow, setNewEvtHow] = useState('');

  // Carica stato salvato su browser dallo staff
  useEffect(() => {
    try {
      const savedEvents = window.localStorage.getItem(STORAGE_KEY_EVENTS);
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(parsed);
        }
      }
      const savedInputs = window.localStorage.getItem(STORAGE_KEY_INPUTS);
      if (savedInputs) {
        const parsed = JSON.parse(savedInputs);
        if (parsed.media) setMedia(parsed.media);
        if (parsed.territory) setTerritory(parsed.territory);
        if (typeof parsed.prev7d === 'number') setPrev7d(parsed.prev7d);
        if (typeof parsed.prev30d === 'number') setPrev30d(parsed.prev30d);
      }
    } catch {
      // Ignora errori localStorage
    }
  }, []);

  function saveTeamConfig(
    nextEvents: ScheduledPoliticalEvent[],
    nextMedia: MediaSalienceInput,
    nextTerritory: TerritorialActivityInput,
    nextPrev7d: number,
    nextPrev30d: number
  ) {
    try {
      window.localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(nextEvents));
      window.localStorage.setItem(
        STORAGE_KEY_INPUTS,
        JSON.stringify({
          media: nextMedia,
          territory: nextTerritory,
          prev7d: nextPrev7d,
          prev30d: nextPrev30d,
        })
      );
    } catch {
      // Ignora
    }
  }

  const causalReport = useMemo(
    () =>
      buildConsensusCausalReport({
        currentConsensus,
        previous7dConsensus: prev7d,
        previous30dConsensus: prev30d,
        media,
        territory,
      }),
    [currentConsensus, prev7d, prev30d, media, territory]
  );

  const forecast180 = useMemo(
    () =>
      generateStrategicForecast180({
        currentConsensus,
        monthlyMomentum: causalReport.realNetDelta30d,
        activeCommitteesCount: 100 + territory.newCommitteesLast30d * 2,
        customEvents: events,
      }),
    [currentConsensus, causalReport.realNetDelta30d, territory.newCommitteesLast30d, events]
  );

  const currentRegionDossier = useMemo(
    () =>
      ALL_REGIONAL_DOSSIERS.find((r) => r.regionName === selectedRegion) ??
      ALL_REGIONAL_DOSSIERS[0]!,
    [selectedRegion]
  );

  function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newEvtTitle.trim() || !newEvtWhy.trim() || !newEvtHow.trim()) return;

    const dateLabel =
      newEvtWindow === 30
        ? 'Entro 30 giorni'
        : newEvtWindow === 90
        ? 'Tra 31 e 90 giorni'
        : 'Tra 91 e 180 giorni';

    const created: ScheduledPoliticalEvent = {
      id: `custom-${Date.now()}`, title: newEvtTitle.trim(), expectedWindowDays: newEvtWindow, dateLabel, category: 'azione_fn', probability: Math.min(1, Math.max(0.1, newEvtProb / 100)), baseImpactPct: newEvtImpact, whyItMatters: newEvtWhy.trim(), howFnMustAct: newEvtHow.trim(), };  const updated = [...events, created]; setEvents(updated); saveTeamConfig(updated, media, territory, prev7d, prev30d);  setNewEvtTitle(''); setNewEvtWhy(''); setNewEvtHow(''); }  function handleRemoveEvent(id: string) { const updated = events.filter((ev) => ev.id !== id); setEvents(updated); saveTeamConfig(updated, media, territory, prev7d, prev30d); }  function handleResetDefaults() { setEvents(DEFAULT_UPCOMING_EVENTS_180D); const defaultMedia = { securityAndImmigration: 68, costOfLivingAndTaxes: 74, greenDealAndEU: 55, coalitionInternalNoise: 42, }; const defaultTerr = { newCommitteesLast30d: 14, newMembersGrowthPct: 6.5, localDefectionsCount: 3, vannacciMediaSpikes: 7, }; const p7 = Number((currentConsensus - 0.1).toFixed(2)); const p30 = Number((currentConsensus - 0.25).toFixed(2)); setMedia(defaultMedia); setTerritory(defaultTerr); setPrev7d(p7); setPrev30d(p30); saveTeamConfig(DEFAULT_UPCOMING_EVENTS_180D, defaultMedia, defaultTerr, p7, p30); }  async function handleExportPdf() { try { setIsExporting(true); const res = await fetch('/api/export/vannacci-briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: exportMode, selectedRegion: exportMode === 'regionale' ? selectedRegion : undefined, currentConsensus, previous7dConsensus: prev7d, previous30dConsensus: prev30d, media, territory, customEvents: events, }), }); if (!res.ok) throw new Error('Generazione PDF fallita'); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = exportMode === 'regionale' ? `Dossier_Comando_Vannacci_Missione_${selectedRegion.replace(/\s+/g, '_')}.pdf`
          : `Dossier_Comando_Vannacci_Briefing_Nazionale.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Errore durante la generazione del Dossier PDF per Vannacci.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/95 p-5 text-slate-100 shadow-2xl mb-6">
      {/* HEADER OPERATIVO + GENERATORE PDF COMANDO VANNACCI */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-950/90 border border-blue-700/60 px-3 py-0.5 text-xs font-semibold text-blue-300">
            <ShieldCheck className="h-3.5 w-3.5"/> CERVELLO STRATEGICO FUTURO NAZIONALE
          </span>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-white">
            Analisi Causale Consenso, Previsione 30/90/180gg & Rimedi ai Disagi
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sala Macchine per il Team Tecnico FN • Il pulsante a destra genera il Briefing Esecutivo PDF per il Gen. Vannacci
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-700/80">
          <select
            value={exportMode}
            onChange={(e) => setExportMode(e.target.value as 'nazionale' | 'regionale')}
            className="rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-white"
          >
            <option value="nazionale">PDF Vannacci: Briefing Nazionale (5 pag.)</option>
            <option value="regionale">PDF Vannacci: Missione Regionale</option>
          </select>

          {exportMode === 'regionale' && (
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-white"
            >
              {ALL_REGIONAL_DOSSIERS.map((r) => (
                <option key={r.regionName} value={r.regionName}>
                  {r.regionName}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-1.5 text-xs font-bold text-white shadow transition"
          >
            <FileDown className="h-4 w-4"/>
            {isExporting ? 'Esportazione PDF...' : 'Esporta PDF Comando Vannacci'}
          </button>
        </div>
      </div>

      {/* BARRA DI NAVIGAZIONE MODULI */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('perche')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'perche'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4"/> 1. Perché Siamo Saliti / Scesi
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('previsione180')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'previsione180'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <CalendarClock className="h-4 w-4"/> 2. Previsione 30 / 90 / 180gg & Eventi
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('disagi_rimedi')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'disagi_rimedi'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="h-4 w-4"/> 3. Disagi Paese/Regioni & Rimedi FN
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('regia_team')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'regia_team'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-900 text-amber-300 hover:bg-slate-800 border border-amber-700/40'
          }`}
        >
          <Sliders className="h-4 w-4"/> 4. Regia Parametri & Eventi (Team FN)
        </button>
      </div>

      {/* TAB 1: SPIEGAZIONE DETTAGLIATA DEL PERCHÉ */}
      {activeTab === 'perche' && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
              <div className="text-[11px] uppercase font-bold text-slate-400">Consenso Attuale</div>
              <div className="text-2xl font-extrabold text-white mt-1">
                {causalReport.currentConsensus.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                7gg fa: {causalReport.previous7dConsensus.toFixed(2)}% ({causalReport.delta7d >= 0 ? '+' : ''}
                {causalReport.delta7d.toFixed(2)}%)
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
              <div className="text-[11px] uppercase font-bold text-slate-400">Delta 30 Giorni</div>
              <div className="text-2xl font-extrabold text-white mt-1">
                {causalReport.delta30d >= 0 ? '+' : ''}
                {causalReport.delta30d.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                30gg fa: {causalReport.previous30dConsensus.toFixed(2)}%
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
              <div className="text-[11px] uppercase font-bold text-slate-400">
                Crescita Reale Depurata
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                {causalReport.realNetDelta30d >= 0 ? '+' : ''}
                {causalReport.realNetDelta30d.toFixed(2)}%
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                House effect istituti: {causalReport.houseEffectBias >= 0 ? '+' : ''}
                {causalReport.houseEffectBias.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-800/60 bg-blue-950/30 p-4">
            <div className="text-sm font-bold text-blue-300">{causalReport.headlineVerdict}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
              {causalReport.deepNarrativeWhy}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {causalReport.drivers.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-slate-800 bg-slate-900/70 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{d.label}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      d.direction === 'positivo'
                        ? 'bg-emerald-950 text-emerald-300'
                        : d.direction === 'negativo'
                        ? 'bg-red-950 text-red-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {d.deltaContribution >= 0 ? '+' : ''}
                    {d.deltaContribution.toFixed(2)}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  <strong className="text-slate-100">Perché:</strong> {d.whyExplanation}
                </p>
                <p className="mt-2 text-xs text-blue-300">
                  <strong>Indicazione per il Team FN:</strong> {d.technicalActionForTeam}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PREVISIONE 30 / 90 / 180 GIORNI */}
      {activeTab === 'previsione180' && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              forecast180.horizons.d30,
              forecast180.horizons.d90,
              forecast180.horizons.d180,
            ].map((h) => (
              <div
                key={h.horizonDays}
                className="rounded-lg border border-slate-800 bg-slate-900/80 p-4"
              >
                <div className="text-xs font-bold uppercase text-blue-400">
                  +{h.horizonDays} Giorni ({h.targetDateFormatted})
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-extrabold text-white">
                      {h.regimes.base.toFixed(2)}%
                    </span>
                    <span className="ml-1.5 text-xs text-slate-400">Base</span>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold">
                    Offensiva: {h.regimes.offensiva.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Passivo: {h.regimes.passivo.toFixed(2)}% • Forchetta 80%: {h.confidenceInterval80[0].toFixed(1)}%–
                  {h.confidenceInterval80[1].toFixed(1)}%
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-1 text-[11px] text-slate-300 bg-slate-950/70 p-2 rounded border border-slate-800">
                  <span>Inerzia: {h.stepByStepFactors.pollMomentum >= 0 ? '+' : ''}{h.stepByStepFactors.pollMomentum}%</span>
                  <span>Eventi: +{h.stepByStepFactors.scheduledEventsImpact}%</span>
                  <span>Territorio: +{h.stepByStepFactors.territorialGrowthImpact}%</span>
                  <span>Logoram. Gov: +{h.stepByStepFactors.governmentWearImpact}%</span>
                </div>

                <p className="mt-3 text-xs text-slate-300 leading-relaxed border-t border-slate-800 pt-2.5">
                  {h.detailedWhyAndHow}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Eventi Programmati inclusi nella Previsione (0–180 Giorni)
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('regia_team')}
                className="text-xs text-blue-400 hover:underline font-semibold"
              >
                + Aggiungi / Modifica Eventi
              </button>
            </div>
            <div className="space-y-2.5">
              {forecast180.allEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded border border-slate-800 bg-slate-950/70 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">
                      [{ev.dateLabel}] {ev.title}
                    </span>
                    <span className="text-xs text-emerald-400 font-semibold">
                      Prob. {Math.round(ev.probability * 100)}% • Impatto {ev.baseImpactPct >= 0 ? '+' : ''}
                      {ev.baseImpactPct.toFixed(2)}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    <strong>Perché incide:</strong> {ev.whyItMatters}
                  </p>
                  <p className="mt-1 text-xs text-blue-300">
                    <strong>Come deve muoversi FN:</strong> {ev.howFnMustAct}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DISAGI PAESE & SINGOLE REGIONI -> RIMEDI TECNICI */}
      {activeTab === 'disagi_rimedi' && (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5">
              Problemi Generali nel Paese & Rimedi Operativi B.I.P.
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {NATIONAL_DISCOMFORT_REMEDIES.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.macroArea}</span>
                    <span className="text-[11px] font-semibold text-red-400">
                      Urgenza {item.severityScore}/100
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    <strong>Disagio sociale:</strong> {item.citizenPainDescription}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    <strong>Dato ufficiale:</strong> {item.hardDataEvidence}
                  </p>
                  <p className="mt-2 text-xs text-emerald-300">
                    <strong>Rimedio Tecnico FN:</strong> {item.fnTechnicalRemedy}
                  </p>
                  <div className="mt-2 rounded bg-amber-950/40 border border-amber-800/50 p-2 text-[11px] italic text-amber-200">
                    «{item.vannacciSoundbite}»
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-400"/>
                <h3 className="text-sm font-bold text-white">
                  Analisi Singola Regione (20/20): Disagi Locali & Piano d’Azione Team FN
                </h3>
              </div>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="rounded-md bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {ALL_REGIONAL_DOSSIERS.map((r) => (
                  <option key={r.regionName} value={r.regionName}>
                    {r.regionName} — Priorità {r.electoralOpportunityScore}/100
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/80 p-3.5 space-y-2 text-xs">
              <div className="flex flex-wrap gap-3 text-slate-300">
                <span>
                  <strong>Governo Regionale:</strong> {currentRegionDossier.currentGovernance}
                </span>
                <span>
                  • <strong>Indice Disagio/Rabbia:</strong> {currentRegionDossier.socialAngerIndex}/100
                </span>
                <span>
                  • <strong>Potenziale Elettorale FN:</strong>{' '}
                  {currentRegionDossier.electoralOpportunityScore}/100
                </span>
              </div>
              <p className="text-slate-200">
                <strong>Emergenza Territoriale:</strong> {currentRegionDossier.primaryCrisisSummary}
              </p>
              <p className="text-blue-300">
                <strong>Spazio Politico Scoperto:</strong>{' '}
                {currentRegionDossier.politicalVacuumAnalysis}
              </p>
              {currentRegionDossier.discomfortsAndRemedies.map((rem) => (
                <div key={rem.id} className="pt-2 border-t border-slate-800 space-y-1.5">
                  <p className="text-emerald-300">
                    <strong>Rimedio Tecnico FN per {currentRegionDossier.regionName}:</strong>{' '}
                    {rem.fnTechnicalRemedy}
                  </p>
                  <p className="text-slate-300">
                    <strong>Categorie da Incontrare Subito:</strong>{' '}
                    {rem.targetSocialGroups.join(', ')}
                  </p>
                  <ul className="list-disc pl-5 text-slate-400 space-y-0.5">
                    {rem.teamOperationalChecklist.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CABINA DI REGIA TEAM TECNICO ( CALIBRAZIONE PARAMETRI & EVENTI FUTURI ) */}
      {activeTab === 'regia_team' && (
        <div className="mt-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-bold text-amber-300">
                Calibrazione Tecnica Settimanale & Gestione Eventi (0–180gg)
              </h3>
              <p className="text-xs text-slate-400">
                Ogni modifica qui sotto aggiorna istantaneamente i calcoli e viene inclusa nel PDF Comando per Vannacci.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs text-slate-300"
            >
              <RotateCcw className="h-3.5 w-3.5"/> Ripristina Default
            </button>
          </div>

          {/* CALIBRAZIONE STORICO E PRESSIONE TEMATICA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded border border-slate-800 bg-slate-900/70 p-3 space-y-2">
              <div className="font-bold text-white">Storico Consenso Riferimento</div>
              <label className="block">
                <span className="text-slate-400">Consenso 7 giorni fa (%)</span>
                <input
                  type="number"
                  step="0.05"
                  value={prev7d}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 7.0;
                    setPrev7d(v);
                    saveTeamConfig(events, media, territory, v, prev30d);
                  }}
                  className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-white"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Consenso 30 giorni fa (%)</span>
                <input
                  type="number"
                  step="0.05"
                  value={prev30d}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 7.0;
                    setPrev30d(v);
                    saveTeamConfig(events, media, territory, prev7d, v);
                  }}
                  className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-white"
                />
              </label>
            </div>

            <div className="rounded border border-slate-800 bg-slate-900/70 p-3 space-y-2">
              <div className="font-bold text-white">Pressione Mediatica Temi (0–100)</div>
              <label className="block">
                <span className="text-slate-400">
                  Sicurezza & Immigrazione: {media.securityAndImmigration}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={media.securityAndImmigration}
                  onChange={(e) => {
                    const next = { ...media, securityAndImmigration: Number(e.target.value) };
                    setMedia(next);
                    saveTeamConfig(events, next, territory, prev7d, prev30d);
                  }}
                  className="w-full"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">
                  Caro-Vita, Bollette & Fisco: {media.costOfLivingAndTaxes}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={media.costOfLivingAndTaxes}
                  onChange={(e) => {
                    const next = { ...media, costOfLivingAndTaxes: Number(e.target.value) };
                    setMedia(next);
                    saveTeamConfig(events, next, territory, prev7d, prev30d);
                  }}
                  className="w-full"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">
                  Rumore di Palazzo / Tatticismi: {media.coalitionInternalNoise}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={media.coalitionInternalNoise}
                  onChange={(e) => {
                    const next = { ...media, coalitionInternalNoise: Number(e.target.value) };
                    setMedia(next);
                    saveTeamConfig(events, next, territory, prev7d, prev30d);
                  }}
                  className="w-full"
                />
              </label>
            </div>

            <div className="rounded border border-slate-800 bg-slate-900/70 p-3 space-y-2">
              <div className="font-bold text-white">Spinta Territoriale & Media (30gg)</div>
              <label className="block">
                <span className="text-slate-400">Nuovi Comitati aperti</span>
                <input
                  type="number"
                  min={0}
                  value={territory.newCommitteesLast30d}
                  onChange={(e) => {
                    const next = {
                      ...territory,
                      newCommitteesLast30d: Number(e.target.value) || 0,
                    };
                    setTerritory(next);
                    saveTeamConfig(events, media, next, prev7d, prev30d);
                  }}
                  className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-white"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Nuovi Amministratori / Eletti entrati</span>
                <input
                  type="number"
                  min={0}
                  value={territory.localDefectionsCount}
                  onChange={(e) => {
                    const next = {
                      ...territory,
                      localDefectionsCount: Number(e.target.value) || 0,
                    };
                    setTerritory(next);
                    saveTeamConfig(events, media, next, prev7d, prev30d);
                  }}
                  className="mt-1 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-white"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">
                  Intensità Ospitate TV / Social Vannacci (0–10): {territory.vannacciMediaSpikes}
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={territory.vannacciMediaSpikes}
                  onChange={(e) => {
                    const next = {
                      ...territory,
                      vannacciMediaSpikes: Number(e.target.value),
                    };
                    setTerritory(next);
                    saveTeamConfig(events, media, next, prev7d, prev30d);
                  }}
                  className="w-full"
                />
              </label>
            </div>
          </div>

          {/* FORM AGGIUNTA EVENTO FUTURO */}
          <form
            onSubmit={handleAddEvent}
            className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 space-y-3 text-xs"
          >
            <div className="font-bold text-white flex items-center gap-1.5">
              <PlusCircle className="h-4 w-4 text-emerald-400"/>
              Inserisci Nuovo Evento Atteso nei Prossimi 30 / 90 / 180 Giorni
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              <input
                type="text"
                placeholder="Titolo evento (es. Decreto Sicurezza, Sciopero Trasporti, Raduno FN...)"
                value={newEvtTitle}
                onChange={(e) => setNewEvtTitle(e.target.value)}
                className="md:col-span-2 rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-white"
                required
              />
              <select
                value={newEvtWindow}
                onChange={(e) => setNewEvtWindow(Number(e.target.value) as ForecastHorizonDays)}
                className="rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-white"
              >
                <option value={30}>Orizzonte: Entro 30 giorni</option>
                <option value={90}>Orizzonte: Entro 90 giorni</option>
                <option value={180}>Orizzonte: Entro 180 giorni</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.05"
                  placeholder="Impatto % (es. 0.30)"
                  value={newEvtImpact}
                  onChange={(e) => setNewEvtImpact(parseFloat(e.target.value) || 0)}
                  className="w-1/2 rounded bg-slate-950 border border-slate-700 px-2 py-1.5 text-white"
                />
                <input
                  type="number"
                  min={10}
                  max={100}
                  placeholder="Prob %"
                  value={newEvtProb}
                  onChange={(e) => setNewEvtProb(Number(e.target.value) || 80)}
                  className="w-1/2 rounded bg-slate-950 border border-slate-700 px-2 py-1.5 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="Perché sposterà il consenso? (Spiegazione causale)"
                value={newEvtWhy}
                onChange={(e) => setNewEvtWhy(e.target.value)}
                className="rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-white"
                required
              />
              <input
                type="text"
                placeholder="Come deve agire il Team FN / Vannacci?"
                value={newEvtHow}
                onChange={(e) => setNewEvtHow(e.target.value)}
                className="rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-white"
                required
              />
            </div>

            <button
              type="submit"
              className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 font-bold text-white"
            >
              Aggiungi Evento al Modello Previsionale & PDF
            </button>
          </form>

          {/* ELENCO EVENTI CON RIMOZIONE */}
          <div className="space-y-2">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-bold text-white">
                    [{ev.dateLabel}] {ev.title}
                  </span>{' '}
                  <span className="text-emerald-400">
                    ({ev.baseImpactPct >= 0 ? '+' : ''}
                    {ev.baseImpactPct.toFixed(2)}% • Prob. {Math.round(ev.probability * 100)}%)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEvent(ev.id)}
                  className="text-red-400 hover:text-red-300 p-1"
                  title="Rimuovi evento"
                >
                  <Trash2 className="h-4 w-4"/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
