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
export const LOCAL_PATH_OPPORTUNITIES = Object.freeze({
  local: {key:"LOCAL_SPOTLIGHT",title:"Local club spotlight",minAppearances:3,feePence:7500},
  regional: {key:"REGIONAL_SHOWCASE",title:"Regional darts showcase",minAppearances:5,minWins:3,feePence:25000},
});
export function opportunities(s:LifeSources):Opportunity[] {
  const local=s.localTeamRecord??{appearances:0,wins:0};
  if(!s.active||!s.ready||(s.facts.statistics.matchesPlayed===0&&local.appearances===0))return [];
  const stature=Math.max(...s.recognition.contexts.map(c=>LEVELS.indexOf(c.level)));
  const profile=publicProfile(s),window=Math.floor((s.week-1)/4);
  const eligible=OPPORTUNITY_FAMILIES.filter(f=>f.min<=stature&&(!("sponsor" in f)||s.sponsor)&&
    (f.key!=="INTERNATIONAL"||s.recognition.contexts.some(c=>c.context==="INTERNATIONAL"&&c.level==="ELITE")));
  const selected=Array.from({length:Math.min(4,eligible.length)},(_,i)=>eligible[(window*3+i)%eligible.length]);
  const generic=selected.map(f=>{
    const id=contentId(s.saveId,`opportunity:${s.season}:${window}:${f.key}`),day=Math.min(364,(window*4+3)*7+1);
    const conflicts=s.commitments.filter(c=>c.season===s.season&&c.day===day).map(c=>c.title);
    // Entered tournaments occupy their authored date span; neither side silently replaces the other.
    const description=`${f.name} in your darts circuit. One full-day commitment; ${f.fee ? "an agreed commercial appearance fee" : "no fee or morality reward"}.`;
    return {id,family:f.key,title:f.name,description,season:s.season,day,feePence:f.fee*(1+Math.min(2,stature)),
      contractId:"sponsor" in f?s.sponsor!.id:null,compatibility:profile.persona.primary?
        `${profile.persona.label} presentation can be accommodated; sporting stature remains the primary driver.`:"No established persona required.",
      conflicts,canAccept:conflicts.length===0&&!s.decisions.some(d=>d.id===id)};
  }).filter(o=>o.day>=(s.week-1)*7+1&&!s.decisions.some(d=>d.id===o.id));

  const hasResolved=(family:string)=>s.commitments.some(c=>c.family===family)||
    s.decisions.some(d=>d.kind==="OPPORTUNITY"&&d.data.family===family);
  const spotlight=LOCAL_PATH_OPPORTUNITIES.local;
  const regional=LOCAL_PATH_OPPORTUNITIES.regional;
  const spotlightCompleted=s.commitments.some(c=>c.family===spotlight.key&&c.status==="COMPLETED");
  const path= !hasResolved(spotlight.key)&&local.appearances>=spotlight.minAppearances
    ? spotlight
    : spotlightCompleted&&!hasResolved(regional.key)&&local.appearances>=regional.minAppearances&&local.wins>=regional.minWins
      ? regional : null;
  if(!path)return generic;
  const id=contentId(s.saveId,`opportunity:${s.season}:${window}:${path.key}`);
  const day=Math.min(364,(window*4+3)*7+1);
  const conflicts=s.commitments.filter(c=>c.season===s.season&&c.day===day).map(c=>c.title);
  const isRegional=path.key===regional.key;
  const localOffer:Opportunity={
    id,family:path.key,title:path.title,
    description:isRegional
      ? `Your club record has earned a regional showcase invitation. Make a one-day appearance, meet the wider circuit and earn an agreed fee. This is an off-board commitment, not a tournament result.`
      : `Your player-played club appearances have brought a local spotlight invitation. Represent your club for one day and earn an agreed fee. This is an off-board commitment, not a tournament result.`,
    season:s.season,day,feePence:path.feePence,contractId:null,
    compatibility:isRegional
      ? `${local.appearances} genuine appearances · ${local.wins} wins · completed local spotlight.`
      : `${local.appearances} genuine club appearances. Teammate cover does not count.`,
    conflicts,canAccept:conflicts.length===0&&!s.decisions.some(d=>d.id===id),
  };
  return [...generic,localOffer].filter(o=>o.day>=(s.week-1)*7+1&&!s.decisions.some(d=>d.id===o.id));
}
