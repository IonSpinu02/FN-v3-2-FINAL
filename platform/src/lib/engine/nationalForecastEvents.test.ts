import { describe,it,expect } from "vitest";
import { fitNationalEventEffects,type NationalForecastEvent } from "./nationalForecastEvents";
import { parseEcbForecastCalendar } from "./nationalForecastEventFeed";
const date=(days:number)=>new Date(Date.UTC(2023,0,1+days,12)).toISOString().slice(0,10);
const event=(i:number,status:NationalForecastEvent["status"]="occurred"):NationalForecastEvent=>({id:`e${i}`,title:"Evento macroeconomico",date:date(i*60),knownAt:date(i*60),category:"macro",status,sourceUrl:"https://example.org/primary",sourceLabel:"Fonte primaria di test"});
const training=(sign:number)=>({events:Array.from({length:9},(_,i)=>event(i)),series:Array.from({length:9},(_,i)=>[{isoDate:date(i*60-1),pct:6},{isoDate:date(i*60+14),pct:6+sign*.2}]).flat()});
describe("eventi nazionali: evidenza e tempo",()=>{
  it("una data programmata non diventa da sola un evento verificato",()=>{
    const t=training(1),asOf=date(520);
    const model=fitNationalEventEffects(t.events.map(e=>({...e,status:"scheduled"})),t.series,asOf);
    expect(model.effects[0].observations).toBe(0);
    expect(model.effects[0].validated).toBe(false);
    expect(model.deltaAt(date(550))).toBe(0);
  });
  it.each([1,-1])("apprende un'associazione firmata (%s) solo da casi precedenti e validati",sign=>{
    const t=training(sign),asOf=date(520),future={...event(9,"scheduled"),knownAt:asOf};
    const model=fitNationalEventEffects([...t.events,future],t.series,asOf);
    expect(model.effects[0].validated).toBe(true);
    expect(Math.sign(model.effects[0].estimatePp)).toBe(sign);
    expect(Math.sign(model.deltaAt(date(550)))).toBe(sign);
    expect(model.deltaAt(asOf)).toBe(0);
  });
  it("non usa eventi non ancora noti o osservazioni future",()=>{
    const t=training(1),asOf=date(520);
    const a=fitNationalEventEffects(t.events,t.series,asOf);
    const b=fitNationalEventEffects([...t.events,{...event(9),knownAt:date(530)}],[...t.series,{isoDate:date(555),pct:30}],asOf);
    expect(b.effects).toEqual(a.effects);
    expect(b.events).toEqual(a.events);
  });
  it("non assegna automaticamente un effetto agli eventi plausibili",()=>{
    const t=training(1),asOf=date(520),hypothesis={...event(9,"plausible"),knownAt:asOf};
    const a=fitNationalEventEffects(t.events,t.series,asOf), b=fitNationalEventEffects([...t.events,hypothesis],t.series,asOf);
    expect(b.deltaAt(date(550))).toBe(a.deltaAt(date(550)));
  });
  it("la verifica prospettica non usa archivi ricostruiti dopo gli eventi",()=>{
    const t=training(1),asOf=date(520);
    const model=fitNationalEventEffects(t.events.map(e=>({...e,knownAt:asOf})),t.series,asOf);
    expect(model.effects[0].observations).toBe(9);
    expect(model.effects[0].validationCases).toBe(0);
    expect(model.effects[0].validated).toBe(false);
  });
  it("non attribuisce due volte la stessa finestra a eventi concomitanti",()=>{
    const t=training(1),events=t.events.flatMap(e=>[e,{...e,id:e.id+"-concurrent"}]);
    expect(fitNationalEventEffects(events,t.series,date(520)).effects[0].observations).toBe(0);
  });
  it("la variazione già prevista dalla base non diventa un effetto evento",()=>{
    const t=training(1);
    const result=fitNationalEventEffects(t.events,t.series,date(520),(_past,origin)=>origin.pct+.2);
    expect(result.effects[0].estimatePp).toBeCloseTo(0);
    expect(result.effects[0].validated).toBe(false);
  });
  it("estrae soltanto le decisioni future BCE, senza duplicare i due giorni",()=>{
    const html="<div>16/12/2026 Monetary policy meeting (Day 1)</div><div>17/12/2026 Monetary policy meeting (Day 2), followed by press conference</div><div>25/11/2026 non-monetary policy meeting</div>";
    expect(parseEcbForecastCalendar(html,"2026-11-09").map(e=>e.date)).toEqual(["2026-12-17"]);
    expect(parseEcbForecastCalendar(html,"2027-01-01")).toEqual([]);
  });
});
