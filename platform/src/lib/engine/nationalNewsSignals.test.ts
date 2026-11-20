import { describe,it,expect } from "vitest";
import { analyzeNationalNews,simulateNationalEvent } from "./nationalNewsSignals";
import type { NationalForecastEvent } from "./nationalForecastEvents";
const asOf="2026-11-09";
const event:NationalForecastEvent={id:"bce",title:"Decisioni BCE",date:"2026-12-17",knownAt:asOf,category:"monetary-policy",status:"scheduled",sourceUrl:"https://www.ecb.europa.eu/",sourceLabel:"BCE"};
describe("lettura delle news senza conversioni arbitrarie in consenso",()=>{
  it("mantiene fonte, data e data futura dichiarata, senza confermarne l'esito",()=>{
    const result=analyzeNationalNews([{title:"Mutui famiglie: la BCE rivede i tassi, rate in calo da dicembre 2026",url:"https://example.org/article",publishedAt:"2026-11-08T10:00:00Z",snippet:"riunione in programma il 17 dicembre 2026"}],[event],asOf);
    expect(result[0].futureDate).toBe("2026-12-17");
    expect(result[0].publishedAt).toBe("2026-11-08");
    expect(result[0].topic).toBe("monetary-policy");
    expect(result[0].linkedEventIds).toEqual(["bce"]);
  });
  it("non inventa anno o data di pubblicazione mancanti",()=>{
    const result=analyzeNationalNews([{title:"Mutui e famiglie: prossimi tassi BCE senza data certa nel testo",url:"https://example.org/a"}],[event],asOf);
    expect(result[0].futureDate).toBeNull();
    expect(result[0].publishedAt).toBeNull();
    expect(result[0].dateWarning).toBeTruthy();
  });
  it("scarta BCE pura e hub senza legame a mutui o famiglie",()=>{
    expect(analyzeNationalNews([{title:"BCE: riunione in programma il 17 dicembre 2026",url:"https://example.org/bce"}],[event],asOf)).toEqual([]);
    expect(analyzeNationalNews([{title:"Your gateway to the EU, News, Highlights | European Union",url:"https://european-union.europa.eu/"}],[],asOf)).toEqual([]);
  });
  it("scarta pubblicazioni future e URL non navigabili in sicurezza",()=>{
    expect(analyzeNationalNews([
      {title:"Titolo sufficientemente lungo",url:"javascript:alert(1)"},
      {title:"Titolo sufficientemente lungo",url:"https://example.org",publishedAt:"2026-12-01"},
    ],[],asOf)).toEqual([]);
  });
  it("una data impossibile non è un evento futuro",()=>{
    expect(analyzeNationalNews([{title:"Riunione prevista il 31 febbraio 2027",url:"https://example.org"}],[],asOf)[0].futureDate).toBeNull();
  });
  it("non conta separatamente copie dello stesso articolo con tracking",()=>{
    const result=analyzeNationalNews([
      {title:"Primo titolo per una notizia verificabile",url:"https://example.org/article?utm_source=a#section"},
      {title:"Titolo modificato dello stesso articolo",url:"https://example.org/article?utm_medium=b"},
    ],[],asOf);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.org/article");
  });
  it("non collega eventi non ancora noti alla data di riferimento",()=>{
    expect(analyzeNationalNews([{title:"Mutui famiglie: riunione BCE prevista il 17 dicembre 2026",url:"https://example.org"}],[{...event,knownAt:"2026-11-10"}],asOf)[0].linkedEventIds).toEqual([]);
  });
});
describe("simulazione di sensibilità: ipotesi separate dalla previsione",()=>{
  const input={horizonDays:90,eventDay:20,amplitudePp:.25,riseDays:7,decayDays:30,baseline:(d:number)=>6+d*.001};
  it("non cambia il passato, l'origine o la previsione di base",()=>{
    const simulation=simulateNationalEvent(input);
    for(const p of simulation.points){
      expect(p.central).toBe(input.baseline(p.day));
      if(p.day<=20){expect(p.up).toBe(p.central);expect(p.down).toBe(p.central);}
    }
  });
  it("sviluppa e riassorbe uno shock di ampiezza dichiarata, senza superarla",()=>{
    const simulation=simulateNationalEvent(input);
    const peak=Math.max(...simulation.points.map(p=>p.shift));
    expect(peak).toBeCloseTo(.25,3);
    expect(peak).toBeLessThanOrEqual(.25);
    expect(simulation.final.shift).toBeLessThan(peak);
    for(const p of simulation.points){expect(p.up-p.central).toBeCloseTo(p.central-p.down,8);}
  });
  it("con ampiezza zero non crea oscillazioni",()=>{
    for(const p of simulateNationalEvent({...input,amplitudePp:0}).points){expect(p.up).toBe(p.central);expect(p.down).toBe(p.central);}
  });
  it("mantiene percentuali valide anche per ipotesi estreme o dati non finiti",()=>{
    const result=simulateNationalEvent({...input,amplitudePp:99,riseDays:0,decayDays:NaN,baseline:d=>d%2?NaN:99.9});
    for(const p of result.points)for(const value of [p.up,p.down,p.central]){expect(Number.isFinite(value)).toBe(true);expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(100);}
    expect(result.amplitudePp).toBe(5);
  });
});
