import type { NationalForecastEvent } from "./nationalForecastEvents";
import {
  isForeignAngloNews,
  isJunkNewsHeadline,
  isValidNewsHeadline,
} from "./growthEvidence";

export type ForecastNewsItem = { title:string; url?:string; publishedAt?:string|null; snippet?:string };
export type ForecastNewsSignal = {
  id:string; title:string; url:string; source:string; publishedAt:string|null;
  topic:string; mentionsParty:boolean; futureDate:string|null;
  linkedEventIds:string[]; dateWarning:string|null;
};
const TOPICS:[string,RegExp][]=[
  ["monetary-policy",/\bbce\b|banca centrale|politica monetaria|tassi d.interesse/i],
  ["polling",/sondagg|supermedia|intenzioni di voto/i],
  ["economy",/inflazion|prezzi|bollett|energia|lavoro|occupaz|pil\b|manovra|bilancio/i],
  ["institutions",/parlament|governo|decret|legge|referendum|elezion/i],
  ["international",/ucraina|russia|guerra|europa|europe[oa]|ester[oi]/i],
];
const MONTHS=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const validDate=(s:string)=>{const d=new Date(`${s}T12:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;};
function explicitFutureDate(text:string,asOf:string):string|null{
  if(!/si terrà|in programma|previst[oaie]|atteso|prossim|riunion|votazion|conferenza|presentazion/i.test(text))return null;
  const iso=text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const named=text.toLowerCase().match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join("|")})\\s+(20\\d{2})\\b`));
  const date=iso?.[1] ?? (named?`${named[3]}-${String(MONTHS.indexOf(named[2])+1).padStart(2,"0")}-${named[1].padStart(2,"0")}`:null);
  return date&&validDate(date)&&date>=asOf?date:null;
}

/** Deterministic metadata analysis, not a sentiment→votes conversion. Date
 * extraction is a claim in an article, never independent event confirmation. */
export function analyzeNationalNews(items:ForecastNewsItem[],events:NationalForecastEvent[],asOf:string):ForecastNewsSignal[]{
  const seenUrls=new Set<string>(),seenTitles=new Set<string>();
  return items.flatMap(item=>{
    if(!item.url||!isValidNewsHeadline(item.title,item.url)||isJunkNewsHeadline(item.title,item.url)||isForeignAngloNews(item.title,item.url))return [];
    let url:URL;
    try{url=new URL(item.url);if(!["https:","http:"].includes(url.protocol))return [];}catch{return [];}
    if(/instagram\.com|facebook\.com\/reel|tiktok\.com/i.test(url.hostname+url.pathname))return [];
    if(/\.(co\.)?uk$/i.test(url.hostname)||/(bbc|moneysavingexpert|reuters|bloomberglaw|ft\.com)/i.test(url.hostname))return [];
    url.hash="";for(const key of [...url.searchParams.keys()])if(/^utm_|^fbclid$|^gclid$/i.test(key))url.searchParams.delete(key);
    const titleKey=item.title.toLowerCase().replace(/\W+/g," ").trim();
    const canonical=url.toString();
    if(seenUrls.has(canonical)||seenTitles.has(titleKey))return [];
    const rawDate=item.publishedAt?new Date(item.publishedAt):null;
    const publishedAt=rawDate&&Number.isFinite(rawDate.getTime())?rawDate.toISOString().slice(0,10):null;
    if(publishedAt&&publishedAt>asOf)return [];
    seenUrls.add(canonical);seenTitles.add(titleKey);
    const text=`${item.title} ${item.snippet??""}`;
    const topic=TOPICS.find(([,pattern])=>pattern.test(text))?.[0]??"general";
    // BCE/mercati e sola demoscopia restano fuori dalla lettura operativa del report.
    if(topic==="monetary-policy"&&!/\b(mutu\w*|famigl\w*|affitt\w*|ipotec\w*|rate?|casa)\b/i.test(text))return [];
    if(topic==="polling")return [];
    const futureDate=explicitFutureDate(text,asOf);
    return [{id:canonical,title:item.title.trim(),url:canonical,source:url.hostname.replace(/^www\./,""),publishedAt,topic,mentionsParty:/futuro nazionale|vannacci|\bfn\b/i.test(text),futureDate,
      linkedEventIds:events.filter(e=>e.knownAt<=asOf&&e.category===topic&&e.status!=="cancelled"&&(!futureDate||e.date===futureDate)).map(e=>e.id),
      dateWarning:publishedAt?null:"Data di pubblicazione non disponibile: attualità non verificata"}];
  });
}

/** A manually chosen sensitivity experiment. Peak amplitude and temporal
 * constants are assumptions, not fitted effects or probabilities. */
export function simulateNationalEvent(input:{
  horizonDays:number;eventDay:number;amplitudePp:number;riseDays:number;decayDays:number;
  baseline:(day:number)=>number;
}){
  const horizonDays=Math.max(1,Math.min(730,Math.round(Number.isFinite(input.horizonDays)?input.horizonDays:30)));
  const eventDay=Math.max(0,Math.min(horizonDays,Math.round(Number.isFinite(input.eventDay)?input.eventDay:7)));
  const amplitude=Math.max(0,Math.min(5,Number.isFinite(input.amplitudePp)?input.amplitudePp:0));
  const rise=Math.max(1,Math.min(90,Number.isFinite(input.riseDays)?input.riseDays:7));
  const decay=Math.max(1,Math.min(180,Number.isFinite(input.decayDays)?input.decayDays:30));
  const peakTime=rise*Math.log(1+decay/rise);
  const response=(age:number)=>age<=0?0:(1-Math.exp(-age/rise))*Math.exp(-age/decay);
  const peak=response(peakTime);
  const clip=(v:number)=>Math.max(0,Math.min(100,v));
  const points=Array.from({length:horizonDays+1},(_,day)=>{
    const base=input.baseline(day),central=Number.isFinite(base)?clip(base):0;
    const shift=amplitude*response(day-eventDay)/peak;
    return {day,central,up:clip(central+shift),down:clip(central-shift),shift};
  });
  return {points,eventDay,amplitudePp:amplitude,peakDay:eventDay+peakTime,final:points.at(-1)!};
}
