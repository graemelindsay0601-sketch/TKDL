import type { Award, Card, Evidence, Induction, LegacyView, Player, Ranking, RecordEvent, RecordRow, Result, SeasonReview, Totals } from "./types.ts";

export const YOUNG_MAX_AGE = 23; // public age at the start of the season; never an ability input
export const zero=(id:string,season=0):Totals=>({id,season,appearances:0,titles:0,finals:0,majorTitles:0,worlds:0,amateurTitles:0,nationalTitles:0,proTitles:0,wins:0,losses:0});
const fields=["appearances","titles","finals","majorTitles","worlds","amateurTitles","nationalTitles","proTitles","wins","losses"] as const;
export const nameOf=(e:Evidence,id:string)=>e.players.find(p=>p.id===id)?.name??"Recorded participant";
export function aggregate(e:Evidence,through=e.currentSeason):Totals[] {
  const map=new Map<string,Totals>();
  for(const row of e.totals.filter(t=>t.season<=through)) {
    const t=map.get(row.id)??zero(row.id);for(const key of fields)t[key]+=row[key];map.set(row.id,t);
  }
  return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
const sportingOrder=(a:Totals,b:Totals)=>b.worlds-a.worlds||b.majorTitles-a.majorTitles||b.nationalTitles-a.nationalTitles||
  b.proTitles-a.proTitles||b.titles-a.titles||b.finals-a.finals||b.wins-a.wins||a.id.localeCompare(b.id);
const resultOrder=(a:Result,b:Result)=>tier(b)-tier(a)||a.position-b.position||a.day-b.day||a.id.localeCompare(b.id);
const tier=(r:Result)=>r.classification==="QUALIFIER"?0:r.tier==="WORLD"?4:r.tier==="MAJOR"?3:r.tier==="TELEVISED"?2:1;
export function rankAt(e:Evidence,id:string,season:number,first=false):Ranking|null {
  return e.rankings.filter(r=>r.participant===id&&r.season===season).sort((a,b)=>first?a.week-b.week||a.id.localeCompare(b.id):b.week-a.week||a.id.localeCompare(b.id))[0]??null;
}
function priorRank(e:Evidence,id:string,season:number):Ranking|null {
  return e.rankings.filter(r=>r.participant===id&&r.season<season).sort((a,b)=>b.season-a.season||b.week-a.week||a.id.localeCompare(b.id))[0]??null;
}
export function seasonAwards(e:Evidence,season:number):Award[] {
  const rows=e.totals.filter(t=>t.season===season&&t.appearances>0),out:Award[]=[];
  const add=(kind:string,t:Totals|undefined,reason:string,sources:string[])=>{
    if(t)out.push({kind,season,participant:t.id,name:nameOf(e,t.id),reason,sources});
  };
  const top=[...rows].sort(sportingOrder)[0];
  add("Player of the Season",top,`Recorded ${top?.worlds??0} Worlds, ${top?.majorTitles??0} majors/Worlds, ${top?.nationalTitles??0} national/open-amateur titles, ${top?.proTitles??0} pro titles, ${top?.titles??0} total titles and ${top?.finals??0} finals. Ordered in that sequence, then wins; equal evidence uses public ID.`,
    top?[`A3:season:${season}:${top.id}`]:[]);
  const amateur=[...rows].filter(t=>t.amateurTitles>0).sort((a,b)=>b.nationalTitles-a.nationalTitles||b.amateurTitles-a.amateurTitles||b.finals-a.finals||a.id.localeCompare(b.id))[0];
  add("Amateur Player of the Season",amateur,`${amateur?.amateurTitles??0} amateur titles, including ${amateur?.nationalTitles??0} national/open-circuit titles.`,amateur?[`A3:amateur:${season}:${amateur.id}`]:[]);
  const young=rows.filter(t=>{
    const p=e.players.find(p=>p.id===t.id);
    const age=t.id==="HUMAN"?(e.ages?.find(a=>a.participant==="HUMAN"&&a.season===season)?.atStart??(season===1?p?.startingAge:null)):
      p?.startingAge==null?null:p.startingAge+season-p.createdSeason;
    return age!=null&&age>=0&&age<=YOUNG_MAX_AGE;
  }).sort(sportingOrder)[0];
  add("Young Player of the Season",young,"Age 23 or under at season start, from recorded identity/public cohort age; same sporting achievement ordering.",young?[`A1/A2:age:${young.id}:${season}`,`A3:season:${season}:${young.id}`]:[]);
  const breakthroughs=rows.flatMap(t=>{
    const before=priorRank(e,t.id,season),after=rankAt(e,t.id,season);
    const card=e.cards.find(c=>c.participant===t.id&&c.awardedSeason===season&&c.source.startsWith("Q_SCHOOL")&&!e.cards.some(p=>p.participant===t.id&&p.awardedSeason<season));
    const prior=e.totals.filter(p=>p.id===t.id&&p.season<season);
    if(card)return [{t,reason:"First recorded Tour Card through Q-School.",sources:[`A5:card:${card.id}`],priority:0}];
    if(before&&after&&before.position>=32&&before.position-after.position>=32&&after.position<=32)
      return [{t,reason:`Published World ranking improved from #${before.position} to #${after.position}.`,sources:[before.id,after.id],priority:1}];
    if(prior.some(p=>p.appearances>0)&&t.majorTitles>0&&!prior.some(p=>p.majorTitles>0))
      return [{t,reason:"First major/World title after an earlier recorded sporting season.",sources:[`A3:first-major:${t.id}:${season}`],priority:2}];
    return [];
  }).sort((a,b)=>a.priority-b.priority||sportingOrder(a.t,b.t))[0];
  add("Breakthrough Player",breakthroughs?.t,breakthroughs?.reason??"",breakthroughs?.sources??[]);
  const performance=e.results.filter(r=>r.season===season&&r.champion&&r.classification!=="QUALIFIER").sort(resultOrder)[0];
  if(performance)out.push({kind:"Performance of the Season",season,participant:performance.participant,name:nameOf(e,performance.participant),
    reason:`Champion at ${performance.name}; ordered by recorded stage tier, finishing position, event date and source ID.`,sources:[performance.id]});
  return out;
}
export function descriptors(t:Totals,best:Ranking|null,cards:Card[]):string[] {
  return [t.worlds?"World Champion":null,t.majorTitles?"Major Champion":null,best?.position===1?"Former World #1":null,
    t.amateurTitles>=20&&t.nationalTitles>=5?"Amateur Great":t.nationalTitles?"Open Circuit Champion":t.amateurTitles?"Amateur Champion":null,
    cards.length?"Tour Professional":null,t.proTitles?"Professional Champion":null,t.titles?"Tournament Winner":null].filter((x):x is string=>x!==null);
}
export function hall(e:Evidence,through=e.currentSeason):Induction[] {
  const totals=aggregate(e,through);
  return totals.flatMap(t=>{
    const p=e.players.find(p=>p.id===t.id);if(!p?.retiredSeason||p.retiredSeason>through)return [];
    const seasons=e.totals.filter(x=>x.id===t.id&&x.season<=through&&x.appearances>0).length;
    const route=t.worlds>=2||(t.majorTitles>=4&&t.proTitles>=8)?"Professional Great":
      t.amateurTitles>=20&&t.nationalTitles>=5&&seasons>=5?"Amateur Great":
      seasons>=12&&t.titles>=12&&(t.nationalTitles+t.proTitles+t.majorTitles)>=5?"Longevity + Achievement":null;
    return route?[{version:1 as const,participant:t.id,name:p.name,route,reasons:[`${seasons} seasons with recorded results`,`${t.worlds} World titles; ${t.majorTitles} major/World titles`,
      `${t.proTitles} professional titles; ${t.amateurTitles} amateur titles (${t.nationalTitles} national/open-circuit)`]}]:[];
  });
}
export function records(e:Evidence,through=e.currentSeason):RecordRow[] {
  const rows=aggregate(e,through),out:RecordRow[]=[];
  for(const metric of ["titles","majorTitles","worlds","appearances","finals"] as const) {
    const value=Math.max(0,...rows.map(t=>t[metric]));
    if(value>0)out.push({metric,value,holders:rows.filter(t=>t[metric]===value).map(t=>({id:t.id,name:nameOf(e,t.id)})),scope:"Recorded completed A3 results; main-event titles only"});
  }
  for(const metric of ["titles","majorTitles"] as const) {
    const rows=e.totals.filter(t=>t.season<=through),value=Math.max(0,...rows.map(t=>t[metric]));
    if(value>0)out.push({metric:`season-${metric}`,value,holders:rows.filter(t=>t[metric]===value).map(t=>({id:t.id,name:`${nameOf(e,t.id)} · Season ${t.season}`})),scope:"Single-season completed A3 results"});
  }
  // NPC cash is not a ledger authority: do not compare A5 ranking money with A4 cash.
  const money=e.money.filter(m=>m.season<=through);
  if(money.length)out.push({metric:"human-season-prize",value:Math.max(...money.map(m=>m.prizePence)),holders:[{id:"HUMAN",name:nameOf(e,"HUMAN")}],scope:"Human-only A4 ledger; no NPC cash comparison"});
  return out;
}
export function recordEvents(e:Evidence,season:number):RecordEvent[] {
  const before=records(e,season-1),after=records(e,season);
  return after.flatMap(r=>{
    const previous=before.find(b=>b.metric===r.metric);
    return previous&&r.value>previous.value?[{...r,season,previousValue:previous.value}]:[];
  });
}
export function review(e:Evidence,season:number,provenance:SeasonReview["provenance"]="RECONSTRUCTED",
  rivalry:SeasonReview["definingRival"]=null):SeasonReview {
  const human=e.totals.find(t=>t.id==="HUMAN"&&t.season===season)??zero("HUMAN",season);
  const start=priorRank(e,"HUMAN",season),end=rankAt(e,"HUMAN",season);
  const money=e.money.find(m=>m.season===season),results=e.results.filter(r=>r.participant==="HUMAN"&&r.season===season).sort(resultOrder);
  const major=results.find(r=>tier(r)>=3)??null,world=results.find(r=>r.circuit==="WORLD_CHAMPIONSHIP"&&r.classification!=="QUALIFIER")??null;
  const cards=e.cards.filter(c=>c.participant==="HUMAN"&&c.awardedSeason<=season);
  const active=cards.some(c=>c.startSeason<=season&&c.endSeason>=season&&(c.endedSeason===null||c.endedSeason>season));
  const cardChanges=e.cards.filter(c=>(c.awardedSeason===season&&c.source!=="FOUNDING")||c.endedSeason===season);
  const gained=cards.find(c=>c.awardedSeason===season&&c.source.startsWith("Q_SCHOOL"));
  const identity=human.worlds?"World Champion":human.majorTitles?"Major Champion":human.nationalTitles>=2?"An Outstanding Amateur Season":
    human.amateurTitles?"Amateur Success":gained?"The Q-School Breakthrough":major?"Major Arrival":
    start&&end&&start.position-end.position>=32?"Climbing the World Ranking":human.titles?"A Title-Winning Season":
    human.finals?"Reaching Finals":human.appearances&&human.losses>human.wins?"A Difficult Campaign":human.appearances?"Holding Ground":"A Quiet Season";
  const champions=e.results.filter(r=>r.season===season&&r.champion&&tier(r)>=3);
  const numberOne=e.rankings.filter(r=>r.season===season&&r.position===1).sort((a,b)=>b.week-a.week||a.id.localeCompare(b.id))[0];
  // No retroactive award ceremony is invented for seasons predating this phase.
  const awards=provenance==="CAPTURED"?seasonAwards(e,season):[],decisions=e.decisions.filter(d=>d.season===season),work=e.commitments.filter(c=>c.season===season&&c.status==="COMPLETED");
  const changes=[...cardChanges.filter(c=>c.participant==="HUMAN").map(c=>`Tour Card ${c.id}: ${c.awardedSeason===season?`awarded (${c.source})`:""}${c.endedSeason===season?` ended (${c.status})`:""}`),
    ...e.qualifications.filter(q=>q.participant==="HUMAN"&&q.season===season).map(q=>`Recorded qualification: ${q.target}`)];
  const story=[`${human.appearances} completed tournament results; ${human.titles} main-event titles and ${human.finals} final appearances.`,
    ...(start&&end?[`Published World position: #${start.position} before this season; last recorded position #${end.position} (week ${end.week}).`]:[]),
    ...(world?[`${world.name}: ${world.champion?"champion":`finishing position ${world.position}`}.`]:[]),
    ...changes.slice(0,3),...(work.length?[`${work.length} accepted off-board commitments completed.`]:[])];
  return {version:1,season,provenance,identity,story,human,startingRank:start,finalRank:end,rankingMovement:start&&end?start.position-end.position:null,
    prizePence:money?.prizePence??0,commercialPence:money?.commercialPence??0,bestMajor:major,worldResult:world,
    cardStatus:active?"Card held at season close":cards.some(c=>c.endedSeason===season)?"Recorded Card ended this season":"No recorded active Card at season close",
    changes,definingRival: rivalry,biggestMoment:results[0]??null,
    publicLife:{decisions:decisions.length,completedWork:work.length,threads:[...new Set(decisions.flatMap(d=>d.thread?[d.thread]:[]))]},
    sponsors:e.sponsors.filter(s=>s.startSeason<=season&&s.endSeason>=season).map(s=>({...s,status:provenance==="CAPTURED"?s.status:"Historical state not reconstructed"})),
    awards,world:{numberOne:numberOne?{id:numberOne.participant,name:nameOf(e,numberOne.participant),snapshot:numberOne.id,week:numberOne.week}:null,
      champions,leadingAmateur:awards.find(a=>a.kind==="Amateur Player of the Season")??null,
      retirements:e.players.filter(p=>p.retiredSeason===season),newEntrants:e.players.filter(p=>p.createdSeason===season+1),cardChanges:cardChanges.map(c=>c.endedSeason!==null&&c.endedSeason>season?
        {...c,status:"ACTIVE",endedSeason:null,endedWeek:null}:c)},records:records(e,season),recordEvents:provenance==="CAPTURED"?recordEvents(e,season):[],
    notes:["Rankings are the previous season's last and this season's last published snapshots, not invented January/December ranks.",
      provenance==="RECONSTRUCTED"?"Reconstructed from retained authorities; missing historical context is not invented.":"Captured after the existing season-transition authorities completed.",
      "No NPC cash/scoring comparison; no Legacy Score, XP or gameplay effect."]};
}
export function eraLabel(r:SeasonReview):string {
  return r.human.worlds?"World Championship Years":r.human.majorTitles?"Major Championship Years":
    r.human.amateurTitles?"Amateur Achievement Years":r.human.proTitles?"Professional Title Years":
    r.cardStatus==="Card held at season close"?"Tour Professional Years":r.human.appearances?"Competing Years":"Quiet Years";
}
export function legacy(e:Evidence,reviews:SeasonReview[],inductions:Induction[],pendingReview:number|null):LegacyView {
  const overview=aggregate(e).find(t=>t.id==="HUMAN")??zero("HUMAN");
  const best=e.rankings.filter(r=>r.participant==="HUMAN").sort((a,b)=>a.position-b.position||a.season-b.season||a.week-b.week)[0]??null;
  const ds=descriptors(overview,best,e.cards.filter(c=>c.participant==="HUMAN"));
  const eras:LegacyView["eras"]=[];
  for(const r of [...reviews].sort((a,b)=>a.season-b.season)) {
    const label=eraLabel(r),last=eras.at(-1);
    if(last&&last.label===label&&last.to===r.season-1)last.to=r.season;else eras.push({from:r.season,to:r.season,label});
  }
  const comparisons:string[]=[];
  const all=aggregate(e);
  for(const metric of ["titles","majorTitles","worlds","amateurTitles"] as const)if(overview[metric]>0) {
    const place=1+all.filter(t=>t[metric]>overview[metric]).length;
    comparisons.push(`Joint rank ${place} for ${metric.replace(/([A-Z])/g," $1").toLowerCase()} in this recorded Career universe (${overview[metric]}).`);
  }
  const ones=[...new Set(e.rankings.filter(r=>r.position===1).map(r=>r.participant))];
  if(ones.includes("HUMAN"))comparisons.push(`One of ${ones.length} players recorded at World #1; snapshot gaps are not counted as weeks.`);
  const prize=e.money.reduce((n,m)=>n+m.prizePence,0),commercial=e.money.reduce((n,m)=>n+m.commercialPence,0);
  return {careerSaveId:e.saveId,retired:e.retired,completedSeasons:reviews.map(r=>r.season),reviews:reviews.map(r=>({season:r.season,identity:r.identity,provenance:r.provenance})),
    overview,bestRanking:best,prizePence:prize,commercialPence:commercial,
    championships:e.results.filter(r=>r.participant==="HUMAN"&&tier(r)>=3&&r.classification!=="QUALIFIER"),
    descriptors:ds,eras,honours:reviews.flatMap(r=>r.awards),hallOfFame:inductions,
    records:records(e),comparisons,recordEvents:reviews.flatMap(r=>r.recordEvents),world:reviews.map(r=>r.world),
    players:e.players,eventKeys:[...new Map(e.results.map(r=>[r.key,{key:r.key,name:r.name}])).values()],
    cards:e.cards.filter(c=>c.participant==="HUMAN"),sponsors:e.sponsors,commercial:e.commitments,merchandise:e.merchandise,
    storiesLink:`/career/${e.saveId}/stories`,pendingReview,
    finalSummary:[ds.length?ds.join(" · "):"A recorded darts Career",`${reviews.length} completed seasons; ${e.retired?`retired in season ${e.currentSeason}, week ${e.currentWeek}`:"Career active"}.`,
      `${overview.wins} wins and ${overview.losses} losses in completed tournament results; ${overview.titles} main-event titles, ${overview.finals} finals.`,
      `${overview.amateurTitles} amateur titles; ${overview.proTitles} pro titles; ${overview.majorTitles} major/World titles; ${overview.worlds} World Championships.`,
      ...(best?[`Highest recorded World ranking: #${best.position}.`]:[]),`${prize} pence prize income and ${commercial} pence sponsor/commercial income (A4).`],
    notes:["Results/awards explain achievement, not an optimal route. Professional status is not required for a successful Career.",
      "World records cover retained completed tournament results, not invented pre-save biographies. Final appearances include champions.",
      "Human match totals here are completed-result aggregates; A7.1 remains the live-match/scoring authority.",
      "Partial retirement seasons remain partial and are not given end-of-season awards."]};
}
