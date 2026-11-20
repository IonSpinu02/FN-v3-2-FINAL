import type { ConsensusPoint } from "./growthMath";
import { isoDaysBetween } from "./growthMath";

export type NationalForecastEvent = {
  id: string; title: string; date: string; knownAt: string;
  category: string; status: "scheduled" | "occurred" | "plausible" | "cancelled";
  sourceUrl: string; sourceLabel: string;
};
const dateOK=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(`${s}T12:00:00Z`));

/** Associations, not causal attribution. Only sourced, occurred events with a
 * completed observation window can teach an effect. Scheduled ≠ occurred. */
export function fitNationalEventEffects(events:NationalForecastEvent[],series:ConsensusPoint[],asOf:string,
  baseline?: (past:ConsensusPoint[], origin:ConsensusPoint, days:number)=>number) {
  const visible=events.filter(e=>dateOK(e.date)&&dateOK(e.knownAt)&&e.knownAt<=asOf&&/^https:\/\//.test(e.sourceUrl));
  const points=[...series].filter(p=>dateOK(p.isoDate)&&p.isoDate<=asOf&&Number.isFinite(p.pct)).sort((a,b)=>a.isoDate.localeCompare(b.isoDate));
  const categories=[...new Set(visible.map(e=>e.category))];
  const effects=categories.map(category=>{
    const observations:{date:string;knownAt:string;availableAt:string;residual:number}[]=[];
    for(const event of visible.filter(e=>e.category===category&&e.status==="occurred").sort((a,b)=>a.date.localeCompare(b.date))) {
      if(isoDaysBetween(event.date,asOf)<21) continue;
      // Closely spaced events cannot be treated as separate clean experiments.
      if(visible.some(e=>e.id!==event.id&&e.status==="occurred"&&Math.abs(isoDaysBetween(e.date,event.date))<28)) continue;
      const before=points.filter(p=>p.isoDate<event.date&&isoDaysBetween(p.isoDate,event.date)<=14).at(-1);
      const after=points.filter(p=>{const d=isoDaysBetween(event.date,p.isoDate);return d>=7&&d<=21;}).sort((a,b)=>Math.abs(isoDaysBetween(event.date,a.isoDate)-14)-Math.abs(isoDaysBetween(event.date,b.isoDate)-14))[0];
      if(before&&after) {
        const past=points.filter(p=>p.isoDate<=before.isoDate);
        const expected=baseline?.(past,before,isoDaysBetween(before.isoDate,after.isoDate))??before.pct;
        observations.push({date:event.date,knownAt:event.knownAt,availableAt:after.isoDate>event.knownAt?after.isoDate:event.knownAt,residual:after.pct-expected});
      }
    }
    // Prospective validation: estimate from events fully observed before each
    // held-out event; the target event never contributes to its own estimate.
    let tests=0,baseError=0,eventError=0;
    for(const row of observations){
      if(row.knownAt>row.date)continue;
      const past=observations.filter(p=>p.availableAt<row.date);
      if(past.length<4)continue;
      const mean=past.reduce((s,p)=>s+p.residual,0)/(past.length+4);
      tests++;baseError+=Math.abs(row.residual);eventError+=Math.abs(row.residual-mean);
    }
    const sum=observations.reduce((s,p)=>s+p.residual,0);
    const estimate=sum/(observations.length+4);
    const validated=tests>=3&&eventError<baseError*.95;
    return {category,observations:observations.length,validationCases:tests,estimatePp:estimate,validated,baseMae:tests?baseError/tests:null,eventMae:tests?eventError/tests:null};
  });
  const response=(event:NationalForecastEvent,at:string)=>{
    if(event.status==="plausible"||event.status==="cancelled"||(event.status==="scheduled"&&event.date<asOf))return 0;
    const age=isoDaysBetween(event.date,at);
    if(age<=0)return 0;
    const effect=effects.find(e=>e.category===event.category);
    if(!effect?.validated)return 0;
    // Declared response shape; its estimated amplitude may be positive or negative.
    return effect.estimatePp*(1-Math.exp(-age/7))*Math.exp(-age/30);
  };
  return {
    events:visible, effects,
    deltaAt(target:string){return visible.reduce((s,e)=>s+response(e,target)-response(e,asOf),0);},
  };
}
