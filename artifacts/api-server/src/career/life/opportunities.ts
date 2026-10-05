import { LEVELS } from "../recognition/types.ts";
import { contentId } from "./content.ts";
import { publicProfile } from "./profile.ts";
import type { LifeSources, Opportunity } from "./types.ts";

export const OPPORTUNITY_FAMILIES = [
  {key:"LOCAL_SIGNING",name:"Local signing",min:0,fee:2500},
  {key:"SPONSOR_APPEARANCE",name:"Sponsor signing / appearance",min:1,fee:15000,sponsor:true},
  {key:"MEET_AND_GREET",name:"Darts meet-and-greet",min:1,fee:7500},
  {key:"EXHIBITION",name:"Darts exhibition",min:1,fee:20000},
  {key:"CHARITY",name:"Optional charity darts appearance",min:0,fee:0},
  {key:"PRODUCT_LAUNCH",name:"Equipment / product appearance",min:2,fee:30000},
  {key:"PODCAST",name:"Darts podcast / show",min:1,fee:5000},
  {key:"INTERVIEW",name:"Local / regional sports interview",min:0,fee:2500},
  {key:"TELEVISION",name:"Television sports appearance",min:3,fee:50000},
  {key:"AWARDS",name:"Darts awards / promotional evening",min:3,fee:40000},
  {key:"MAJOR_LAUNCH",name:"Major darts launch event",min:4,fee:100000},
  {key:"INTERNATIONAL",name:"International exhibition / appearance",min:4,fee:150000},
] as const;
export function opportunities(s:LifeSources):Opportunity[] {
  if(!s.active||!s.ready||s.facts.statistics.matchesPlayed===0)return [];
  const stature=Math.max(...s.recognition.contexts.map(c=>LEVELS.indexOf(c.level)));
  const profile=publicProfile(s),window=Math.floor((s.week-1)/4);
  const eligible=OPPORTUNITY_FAMILIES.filter(f=>f.min<=stature&&(!("sponsor" in f)||s.sponsor)&&
    (f.key!=="INTERNATIONAL"||s.recognition.contexts.some(c=>c.context==="INTERNATIONAL"&&c.level==="ELITE")));
  const selected=Array.from({length:Math.min(4,eligible.length)},(_,i)=>eligible[(window*3+i)%eligible.length]);
  return selected.map((f,i)=>{
    const id=contentId(s.saveId,`opportunity:${s.season}:${window}:${f.key}`),day=Math.min(364,(window*4+3)*7+1);
    const conflicts=s.commitments.filter(c=>c.season===s.season&&c.day===day).map(c=>c.title);
    // Entered tournaments occupy their authored date span; neither side silently replaces the other.
    const description=`${f.name} in your darts circuit. One full-day commitment; ${f.fee ? "an agreed commercial appearance fee" : "no fee or morality reward"}.`;
    return {id,family:f.key,title:f.name,description,season:s.season,day,feePence:f.fee*(1+Math.min(2,stature)),
      contractId:"sponsor" in f?s.sponsor!.id:null,compatibility:profile.persona.primary?
        `${profile.persona.label} presentation can be accommodated; sporting stature remains the primary driver.`:"No established persona required.",
      conflicts,canAccept:conflicts.length===0&&!s.decisions.some(d=>d.id===id)};
  }).filter(o=>o.day>=(s.week-1)*7+1&&!s.decisions.some(d=>d.id===o.id));
}
