import { LEVELS } from "../recognition/types.ts";
import { PERSONAS, type LifeSources, type PublicProfile, type Tone } from "./types.ts";

export function publicProfile(s:LifeSources):PublicProfile {
  const answers=s.decisions.filter(d=>d.kind==="DIALOGUE");
  // Rolling recent emphasis and bounded historical influence permit genuine change.
  const counts=Object.fromEntries(PERSONAS.map(p=>[p,0])) as Record<typeof PERSONAS[number],number>;
  answers.slice(0,-8).forEach(d=>{if(PERSONAS.includes(d.choice as typeof PERSONAS[number])) {
    const p=d.choice as typeof PERSONAS[number];counts[p]=Math.min(8,counts[p]+1);
  }});
  answers.slice(-8).forEach(d=>{if(PERSONAS.includes(d.choice as typeof PERSONAS[number])) counts[d.choice as typeof PERSONAS[number]]+=3;});
  const sorted=[...PERSONAS].sort((a,b)=>counts[b]-counts[a] || PERSONAS.indexOf(a)-PERSONAS.indexOf(b));
  const primary=answers.length>=2 ? sorted[0] : null,secondary=primary && counts[sorted[1]]>=counts[primary]*0.6 ? sorted[1] : null;
  const sporting=Math.max(0,...s.recognition.contexts.map(c=>LEVELS.indexOf(c.level)));
  const world=s.facts.results.some(r=>r.champion && r.classification!=="QUALIFIER" && r.presentationTier==="WORLD");
  const stage=s.recognition.contexts.filter(c=>["MAJOR_STAGE","INTERNATIONAL"].includes(c.context)).some(c=>LEVELS.indexOf(c.level)>=3);
  const attention=counts.SHOWMAN+counts.FIERY+counts.CONFIDENT;
  const sportingAwareness=world ? 5 : stage ? 4 : sporting>=4 ? 3 : sporting>=2 ? 2 : sporting>=1 || s.facts.statistics.matchesPlayed>0 ? 1 : 0;
  const awarenessIndex=Math.min(5,sportingAwareness+(attention>=12 ? 1 : 0));
  const awareness=["Not yet known","Local following","Recognised","Well known","National darts figure","Major darts star"][awarenessIndex];
  const drawIndex=Math.min(3,Math.floor(awarenessIndex/2)+(attention>=12 ? 1 : 0));
  const fiery=counts.FIERY;
  const reception=fiery>=6 && fiery>=counts.PROFESSIONAL+counts.RESERVED ? "Divisive" : answers.length ? fiery>=3 ? "Mixed" : "Positive" : "Not yet established";
  const completed=s.commitments.filter(c=>c.status==="COMPLETED").length;
  const declined=s.decisions.filter(d=>d.kind==="OPPORTUNITY" && d.choice==="DECLINE").length;
  return {persona:{primary,secondary,label:primary ? primary.charAt(0)+primary.slice(1).toLowerCase() : "Still developing",
    description:"Presentation emerges from your actual answers, not results. It can evolve; no style changes sporting ability."},
    awareness,reception,draw:["Limited","Growing","Strong","Major draw"][drawIndex],
    commercial:{demand:world || stage ? "Major sporting demand" : sporting>=3 ? "Established sporting demand" : sporting>=1 ? "Developing sporting demand" :
      s.facts.statistics.matchesPlayed>0?"Early sporting interest":"Not yet established",
      activity:completed ? `${completed} completed off-board commitments` : declined ? "Selective / commercially quiet" : "No commercial history yet",
      description:"Sporting stature is the primary driver. Public draw, presentation and completed work shape context, not a currency or sponsor gate."}};
}
export function relationshipTones(s:LifeSources) {
  return s.relationships.opponents.filter(o=>s.decisions.some(d=>d.kind==="DIALOGUE" && d.data.opponentId===o.player.id))
    .map(o=>{
      const recent=s.decisions.filter(d=>d.kind==="DIALOGUE" && d.data.opponentId===o.player.id).slice(-6);
      const fiery=recent.filter(d=>d.choice==="FIERY").length,competitive=recent.filter(d=>["CONFIDENT","SHOWMAN"].includes(d.choice)).length;
      const tone:Tone=fiery>=2 ? "HEATED" : competitive>=2 ? "COMPETITIVE" : "RESPECTFUL";
      return {opponentId:o.player.id,name:o.player.name,tone,sportingLabels:o.labels};
    });
}
