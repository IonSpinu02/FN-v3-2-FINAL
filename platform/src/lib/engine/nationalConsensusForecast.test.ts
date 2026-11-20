import { describe, expect, it } from "vitest";
import { buildNationalConsensusForecast } from "./nationalConsensusForecast";
import { computeForecastV4, type ForecastPoll } from "./forecastEngineV4";
import { computeFnNationalAggregate } from "./fnNationalAggregate";

const asOf=new Date("2026-11-09T12:00:00Z");
const series=Array.from({length:45},(_,i)=>({isoDate:new Date(Date.UTC(2026,5,1+i*3,12)).toISOString().slice(0,10),pct:8-i*.04}));
describe("previsione statistica nazionale",()=>{
  it("non aggiunge crescita da rete, programma, calendario o impegno",()=>{
    const a=buildNationalConsensusForecast({asOf,history:series,polls:[]});
    const b=buildNationalConsensusForecast({asOf,history:series,polls:[],effort:3,networkDelta:{comitati:10000,tesserati:1000000},newsHeadlines:["record sicurezza e fisco"]});
    expect(a.horizon(180)).toEqual(b.horizon(180));
    expect(a.horizon(180).centralPct).toBeLessThanOrEqual(a.startPct);
    expect(a.horizon(30).factors).toHaveLength(1);
  });
  it("usa solo i sondaggi pubblicati all'origine, anche nell'aggregazione",()=>{
    const past:ForecastPoll={institute:"A",fieldEnd:"2026-11-05",publishedAt:"2026-11-06",fnPct:6,sampleSize:1000};
    const future:ForecastPoll={institute:"B",fieldEnd:"2026-11-06",publishedAt:"2026-11-12",fnPct:30,sampleSize:1000};
    const input={asOf,history:[],polls:[past]};
    expect(buildNationalConsensusForecast({...input,polls:[past,future]}).horizon(90)).toEqual(buildNationalConsensusForecast(input).horizon(90));
    const releases=[past,future].map((p,i)=>({...p,id:String(i),publishedAt:p.publishedAt!}));
    expect(computeFnNationalAggregate(releases,{asOf})?.fnPct).toBe(6);
    expect(computeForecastV4({...input,polls:[past,future]}).diagnostics.observations.polls).toBe(1);
  });
  it("non sostituisce array vuoti espliciti con dati statici",()=>{
    const model=buildNationalConsensusForecast({asOf,history:[],polls:[],startPct:4});
    expect(model.source).toBe("input senza osservazioni");
    expect(model.observationCount).toBe(0);
    expect(model.horizon(30).centralPct).toBe(4);
    expect(computeForecastV4({asOf,history:[],polls:[],startPct:4}).diagnostics.observations).toEqual({supermedia:0,polls:0});
  });
  it("con pochi dati mantiene il riferimento invariato e non dichiara validazione",()=>{
    const model=buildNationalConsensusForecast({asOf,polls:[],history:[{isoDate:"2026-11-06",pct:6}]});
    expect(model.method).toBe("flat");
    expect(model.mae).toBeNull();
    expect(model.maxValidatedDays).toBe(0);
    expect(model.horizon(180).centralPct).toBe(6);
    expect(model.horizon(180).uncertaintyNote).toContain("non dimostrata");
  });
  it("le previsioni storiche non cambiano quando si modifica il futuro",()=>{
    const first=buildNationalConsensusForecast({asOf,polls:[],history:series});
    const changed=buildNationalConsensusForecast({asOf,polls:[],history:series.map((p,i)=>i>30?{...p,pct:15}:p)});
    const cutoff=series[30].isoDate;
    expect(first.cases.filter(r=>r.target<=cutoff)).toEqual(changed.cases.filter(r=>r.target<=cutoff));
  });
  it("non duplica sondaggi aggregati e Supermedia; intervalli e valori restano finiti",()=>{
    const polls=series.map((p,i)=>({institute:`I${i%4}`,fieldEnd:p.isoDate,publishedAt:p.isoDate,fnPct:p.pct,sampleSize:1000}));
    const model=buildNationalConsensusForecast({asOf,history:series,polls});
    expect(model.series.length).toBeLessThanOrEqual(polls.length);
    for(const d of [0,1,30,90,180]){
      const h=model.horizon(d);
      expect(h.lo10Pct).toBeLessThanOrEqual(h.centralPct);
      expect(h.hi90Pct).toBeGreaterThanOrEqual(h.centralPct);
      expect(h.centralPct).toBeGreaterThanOrEqual(0);
      expect(h.centralPct).toBeLessThanOrEqual(100);
      expect(h.startPct+h.deltaPp).toBeCloseTo(h.centralPct,2);
    }
  });
  it("molti target sovrapposti non bastano per promuovere una tendenza",()=>{
    const history=Array.from({length:30},(_,i)=>({isoDate:new Date(Date.UTC(2026,9,1+i,12)).toISOString().slice(0,10),pct:8-i*.05}));
    const model=buildNationalConsensusForecast({asOf,polls:[],history});
    expect(model.cases.length).toBeGreaterThan(4);
    expect(model.selectionCasesCount).toBeLessThan(4);
    expect(model.method).toBe("flat");
  });
  it("non considera il punto odierno sintetico come nuova osservazione indipendente",()=>{
    const model=buildNationalConsensusForecast({asOf,startPct:7,polls:[],history:[{isoDate:"2026-11-06",pct:6},{isoDate:"2026-11-09",pct:7}]});
    expect(model.observationCount).toBe(1);
    expect(model.startPct).toBe(6);
  });
});
