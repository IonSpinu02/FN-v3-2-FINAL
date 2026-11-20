import eventCatalog from "../../../data/national_forecast_events.json";
import { fitNationalEventEffects, type NationalForecastEvent } from "./nationalForecastEvents";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { computeFnNationalAggregate, toValidDate } from "./fnNationalAggregate";
import { dampedSlopePp, isoDaysBetween, type ConsensusPoint } from "./growthMath";
import { staticForecastPolls, type ForecastHorizonResult, type ForecastV4Input } from "./forecastEngineV4";
import { getCalibrationMetrics } from "./forecastCalibrationEngine";
import type { CalibrationReport } from "./calibrationReport";

type Method = "flat" | "damped";
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round = (n: number) => Math.round(n * 100) / 100;
const day = (s: string) => s.slice(0, 10);
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T12:00:00Z`));

/** Recency-weighted regression, in pp/month, without partisan/calendar addends. */
function slope(history: ConsensusPoint[], origin: string): number {
  const points = history.filter(p => isoDaysBetween(p.isoDate, origin) <= 60);
  if (points.length < 3 || isoDaysBetween(points[0].isoDate, origin) < 14) return 0;
  const weighted = points.map(p => ({ x: -isoDaysBetween(p.isoDate, origin) / 30.44, y: p.pct, w: Math.exp(-isoDaysBetween(p.isoDate, origin) / 30) }));
  const sum = weighted.reduce((s,p)=>s+p.w,0);
  const mx=weighted.reduce((s,p)=>s+p.x*p.w,0)/sum, my=weighted.reduce((s,p)=>s+p.y*p.w,0)/sum;
  const variance=weighted.reduce((s,p)=>s+p.w*(p.x-mx)**2,0);
  return variance > 1e-8 ? weighted.reduce((s,p)=>s+p.w*(p.x-mx)*(p.y-my),0)/variance : 0;
}
function predict(method: Method, past: ConsensusPoint[], origin: string, start: number, days: number) {
  return clamp(start + (method === "damped" ? dampedSlopePp(slope(past,origin), days/30.44) : 0));
}
export type NationalForecastCase = {
  origin: string; target: string; days: number; flatError: number; dampedError: number;
  selectedError: number; selected: Method;
};
function nonOverlapping(rows: NationalForecastCase[]): NationalForecastCase[] {
  const selected: NationalForecastCase[]=[];
  for (const row of [...rows].sort((a,b)=>a.target.localeCompare(b.target))) {
    if (!selected.length || row.origin>=selected.at(-1)!.target) selected.push(row);
  }
  return selected;
}
function choose(allRows: NationalForecastCase[]): Method {
  const rows=nonOverlapping(allRows);
  // Sparse or tied evidence retains the simple benchmark. A trend must improve MAE by 5%.
  if (rows.length < 4) return "flat";
  const flat=rows.reduce((s,r)=>s+Math.abs(r.flatError),0), damped=rows.reduce((s,r)=>s+Math.abs(r.dampedError),0);
  return damped < flat*.95 ? "damped" : "flat";
}

export function buildNationalConsensusForecast(input: ForecastV4Input, events:NationalForecastEvent[]=eventCatalog.events as NationalForecastEvent[]) {
  const asOfDate = toValidDate(input.asOf);
  const asOf=day(asOfDate.toISOString());
  const polls=(input.polls ?? staticForecastPolls()).filter(p=>validDate(day(p.fieldEnd)) && validDate(day(p.publishedAt ?? p.fieldEnd)) && day(p.fieldEnd)<=asOf && day(p.publishedAt ?? p.fieldEnd)<=asOf && Number.isFinite(p.fnPct) && p.fnPct>0 && p.fnPct<=100);
  const releases=polls.map((p,i)=>({...p,id:p.id??`poll-${i}`,publishedAt:p.publishedAt??p.fieldEnd}));
  const aggregate=computeFnNationalAggregate(releases,{asOf:asOfDate});
  const aggregateSeries=[...new Set(polls.map(p=>day(p.publishedAt??p.fieldEnd)))].sort().flatMap(isoDate=>{
    const value=computeFnNationalAggregate(releases,{asOf:new Date(`${isoDate}T12:00:00Z`)});
    return value ? [{isoDate,pct:value.fnPct}] : [];
  });
  const historical = new Map<string,ConsensusPoint>();
  for (const p of input.history ?? FN_SUPERMEDIA_CONSENSO_SERIES) {
    const isoDate=day(p.isoDate);
    const syntheticToday=!input.startIsObservation && isoDate===asOf && input.startPct!=null && Math.abs(p.pct-input.startPct)<.006;
    if(!syntheticToday&&validDate(isoDate)&&isoDate<=asOf&&Number.isFinite(p.pct)&&p.pct>=0&&p.pct<=100) historical.set(isoDate,{isoDate,pct:p.pct});
  }
  const history=[...historical.values()].sort((a,b)=>a.isoDate.localeCompare(b.isoDate));
  const usePolls=aggregateSeries.length>=4 && isoDaysBetween(aggregateSeries[0].isoDate,aggregateSeries.at(-1)!.isoDate)>=14;
  // Poll aggregates and Supermedia reuse surveys: never count both as independent samples.
  const series=usePolls?aggregateSeries:history;
  const startPct=round(aggregate?.fnPct ?? series.at(-1)?.pct ?? clamp(Number.isFinite(input.startPct)?input.startPct!:0));
  const source=aggregate ? "sondaggi aggregati" : series.length ? "ultima Supermedia" : "input senza osservazioni";
  const cases:NationalForecastCase[]=[];
  for(let i=2;i<series.length;i++) {
    const origin=series[i];
    const target=series.slice(i+1).find(p=>{const d=isoDaysBetween(origin.isoDate,p.isoDate);return d>=14&&d<=50;});
    if(!target) continue;
    const days=isoDaysBetween(origin.isoDate,target.isoDate), past=series.slice(0,i+1);
    // Select only from validations whose targets were already observed at this origin.
    const selected=choose(cases.filter(r=>r.target<=origin.isoDate));
    const flatError=target.pct-origin.pct;
    const dampedError=target.pct-predict("damped",past,origin.isoDate,origin.pct,days);
    cases.push({origin:origin.isoDate,target:target.isoDate,days,flatError,dampedError,selectedError:selected==="flat"?flatError:dampedError,selected});
  }
  const method=choose(cases);
  const mae=cases.length?cases.reduce((s,r)=>s+Math.abs(r.selectedError),0)/cases.length:null;
  const flatMae=cases.length?cases.reduce((s,r)=>s+Math.abs(r.flatError),0)/cases.length:null;
  const latestDate=series.at(-1)?.isoDate ?? null;
  const ageDays=latestDate?Math.max(0,isoDaysBetween(latestDate,asOf)):null;
  // Stale observations cannot sustain an indefinitely extrapolated trend.
  const delta=(days:number)=>{
    if(method==="flat"||!latestDate) return 0;
    const trend=slope(series,latestDate), age=ageDays??0;
    return dampedSlopePp(trend,(age+days)/30.44)-dampedSlopePp(trend,age/30.44);
  };
  const horizons=cases.map(r=>r.days);
  const maxValidatedDays=horizons.length?Math.max(...horizons):0;
  const baselineDays=horizons.length?horizons.reduce((s,d)=>s+d,0)/horizons.length:30;
  const residualRmse=cases.length?Math.sqrt(cases.reduce((s,r)=>s+r.selectedError**2,0)/cases.length):.5;
  const eventModel=fitNationalEventEffects(events,series,asOf,(past,origin,days)=>predict(choose(cases.filter(r=>r.target<=origin.isoDate)),past,origin.isoDate,origin.pct,days));
  const calibration = getCalibrationMetrics(series);
  const calibrationReport: CalibrationReport = calibration.calibrationReport;
  return {
    method, source, startPct, series, cases, eventModel, recalibratedAt:asOf, mae, flatMae, ageDays, maxValidatedDays,
    observationCount:series.length, pollsCount:polls.length, selectionCasesCount:nonOverlapping(cases).length,
    calibration, calibrationReport,
    horizon(days:number,key:ForecastHorizonResult["key"]="custom",label=`${days} giorni`):ForecastHorizonResult {
      days=Math.max(0,Math.round(days));
      const target=new Date(`${asOf}T12:00:00Z`); target.setUTCDate(target.getUTCDate()+days);
      const eventPp=eventModel.deltaAt(target.toISOString().slice(0,10));
      const centralPct=round(clamp(startPct+delta(days)+eventPp)), deltaPp=round(centralPct-startPct);
      const sigma=Math.max(.35,residualRmse)*Math.sqrt(Math.max(1,(days+(ageDays??0))/baselineDays));
      const uncertaintyNote="Fascia indicativa gaussiana: copertura all’80% non dimostrata. I pochi casi storici non validano gli orizzonti più lunghi.";
      return {key,label,days,startPct,centralPct,deltaPp,lo10Pct:round(clamp(centralPct-1.2816*sigma)),hi90Pct:round(clamp(centralPct+1.2816*sigma)),sigma:{poll:0,hist:sigma,model:0,total:sigma},uncertaintyNote,uncertaintyPlain:uncertaintyNote,
        factors:[{id:"momentum",n:1,label:method==="flat"?"Consenso invariato":"Tendenza osservata smorzata",short:"Dati osservati",pp:round(deltaPp-round(eventPp)),rawPp:delta(days),note:"Confronto walk-forward con previsione invariata; nessun incremento automatico da attività o calendario.",plain:method==="flat"?"La storia disponibile non dimostra un vantaggio sufficiente della tendenza sul riferimento invariato. La stima centrale resta al livello di partenza; gli esiti reali possono oscillare.":"La tendenza dei dati recenti è proiettata con intensità decrescente. Il modello non anticipa eventi futuri non osservati.",provenance:"dati",sources:[{label:source}],sub:[]}, ...(Math.abs(eventPp)>=.005?[{id:"cycle" as const,n:2,label:"Eventi con effetto stimato",short:"Eventi",pp:round(eventPp),rawPp:eventPp,note:"Associazione pre/post al netto della previsione di base, verificata su eventi successivi; non prova di causalità.",plain:"Contributo degli eventi con associazione stimata su casi già osservati. La previsione include soltanto categorie che migliorano la verifica progressiva.",provenance:"misto" as const,sources:eventModel.events.filter(e=>eventModel.effects.some(f=>f.category===e.category&&f.validated)).map(e=>({label:e.title,url:e.sourceUrl})),sub:[]}]:[]) ]};
    },
  };
}
