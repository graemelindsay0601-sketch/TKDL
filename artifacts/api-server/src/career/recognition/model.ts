import type { Fact } from "../facts/types.ts";
import { CONTEXTS, LEVELS, LEVEL_LABELS, type RecognitionContext, type RecognitionEvent, type RecognitionLevel,
  type RecognitionMilestone, type RecognitionSources, type RecognitionView } from "./types.ts";

// Internal interpretation only: neither scores nor thresholds are returned to the browser.
const THRESHOLDS = [0, 3, 15, 40, 80];
type Contribution = { fact: Fact; weight: number; category: "appearance" | "qualification" | "result" | "card" | "ranking"; precision: "DAY" | "WEEK" | "SEASON" };
const local = new Set(["GRASSROOTS", "COUNTY"]);
const amateur = new Set(["COUNTY", "REGIONAL", "NATIONAL_AMATEUR", "VAULT", "CHALLENGER"]);
const pro = new Set(["PRO_CIRCUIT", "EUROPEAN_SERIES", "MAJOR", "WORLD_CHAMPIONSHIP"]);
const international = new Set(["EUROPEAN_SERIES", "WORLD_SERIES", "WORLD_CHAMPIONSHIP"]);
const stage = new Set(["TELEVISED", "MAJOR", "WORLD"]);
const order = (a: Fact, b: Fact) => a.season-b.season || (a.day ?? (a.week ? (a.week-1)*7+1 : 365))-(b.day ?? (b.week ? (b.week-1)*7+1 : 365)) || a.id.localeCompare(b.id);
function contexts(e: RecognitionEvent): RecognitionContext[] {
  const out: RecognitionContext[] = [];
  if (local.has(e.circuit)) out.push("LOCAL");
  if (amateur.has(e.circuit)) out.push("AMATEUR");
  // A qualifier's presentation/circuit is not proof of attendance at its target.
  if (e.classification !== "QUALIFIER") {
    if (pro.has(e.circuit)) out.push("PROFESSIONAL");
    if (stage.has(e.tier)) out.push("MAJOR_STAGE");
    if (international.has(e.circuit) || (e.international && stage.has(e.tier))) out.push("INTERNATIONAL");
  }
  return out;
}
function titleWeight(context: RecognitionContext, e: RecognitionEvent) {
  if (e.classification === "QUALIFIER") return 3; // Local/amateur qualifier success only.
  if (context === "LOCAL") return e.circuit === "COUNTY" ? 12 : 8;
  if (context === "AMATEUR") return e.circuit === "COUNTY" ? 8 : e.circuit === "REGIONAL" ? 12 : 20;
  if (e.tier === "WORLD") return 45;
  if (e.tier === "MAJOR") return 28;
  if (context === "PROFESSIONAL") return 20;
  if (context === "INTERNATIONAL") return 18;
  return 12;
}
const levelOf = (score: number): RecognitionLevel => LEVELS[THRESHOLDS.reduce((level, threshold, i) => score >= threshold ? i : level, 0)];
/** Bounded participation/qualification/card recognition; repeated appearances alone never establish a Career. */
function score(items: Contribution[]) {
  let results=0, appearances=0, qualifications=0, card=0, rank=0;
  for (const i of items) {
    if (i.category === "result") results += i.weight;
    else if (i.category === "appearance") appearances += i.weight;
    else if (i.category === "qualification") qualifications += i.weight;
    else if (i.category === "card") card = Math.max(card, i.weight);
    else rank = Math.max(rank, i.weight);
  }
  return results + Math.min(6, appearances) + Math.min(6, qualifications) + card + rank;
}
function contributions(s: RecognitionSources): Record<RecognitionContext, Contribution[]> {
  const out: Record<RecognitionContext, Contribution[]> = {LOCAL:[],AMATEUR:[],PROFESSIONAL:[],MAJOR_STAGE:[],INTERNATIONAL:[]};
  const add = (context: RecognitionContext, fact: Fact, weight: number, category: Contribution["category"], precision?: Contribution["precision"]) => {
    if (!out[context].some(i=>i.fact.id===fact.id && i.category===category))
      out[context].push({fact, weight, category, precision:precision ?? (fact.day !== null ? "DAY" : fact.week !== null ? "WEEK" : "SEASON")});
  };
  for (const e of s.appearances) for (const c of contexts(e)) add(c, e.fact, 1, "appearance");
  for (const e of s.results) {
    const weight = e.champion ? null : e.stageReached === "FINAL" ? 5 : e.stageReached === "SEMI_FINAL" ? 3 : e.stageReached === "QUARTER_FINAL" ? 1 : 0;
    for (const c of contexts(e)) if (e.champion || weight) add(c, e.fact, e.champion ? titleWeight(c,e) : weight!, "result");
  }
  // Qualification uses the authored TARGET context, not the source event's tier.
  // A SERIES_ACCESS route to an arbitrary family is not invented major recognition.
  for (const q of s.qualifications) for (const c of contexts(q)) add(c, q.fact, 3, "qualification");
  for (const f of s.cards) add("PROFESSIONAL", f, 5, "card", "WEEK");
  for (const f of s.rankings) {
    const weight = f.position === 1 ? 35 : f.position <= 8 ? 24 : f.position <= 32 ? 15 : f.position <= 64 ? 8 : f.position <= 128 ? 3 : 0;
    if (weight) add("PROFESSIONAL", f, weight, "ranking", "WEEK");
  }
  return out;
}
function milestoneHistory(context: RecognitionContext, items: Contribution[]): RecognitionMilestone[] {
  // One season-only entitlement could have crossed a threshold before another
  // dated fact. Do not fabricate historical first-crossing dates in that context.
  if (!items.length || items.some(i=>i.precision === "SEASON")) return [];
  const weekly = items.some(i=>i.precision === "WEEK");
  const groups = new Map<string, Contribution[]>();
  for (const item of [...items].sort((a,b)=>order(a.fact,b.fact))) {
    const f=item.fact, key=`${f.season}:${weekly ? f.week : f.day}`;
    groups.set(key,[...(groups.get(key) ?? []),item]);
  }
  const history: RecognitionMilestone[]=[], accumulated: Contribution[]=[];
  let prior: RecognitionLevel="UNKNOWN";
  for (const group of groups.values()) {
    accumulated.push(...group);
    const level=levelOf(score(accumulated));
    if (level === prior) continue;
    const f=group[0].fact;
    history.push({id:`recognition:${context}:${level}`,source:`A7.4 derived threshold from public sporting facts (${weekly ? "Career week" : "sporting day"} precision)`,
      label:`${CONTEXTS[context]} recognition — ${LEVEL_LABELS[level]}`,context,level,precision:weekly ? "WEEK" : "DAY",
      season:f.season,week:f.week,day:weekly ? null : f.day,date:weekly ? null : f.date,age:weekly ? null : f.age,
      ...(group.length === 1 && f.eventId ? {eventId:f.eventId} : {}),supportingFactIds:group.map(i=>i.fact.id).sort()});
    prior=level;
  }
  return history;
}
export function careerStanding(states: Record<RecognitionContext, RecognitionLevel>): RecognitionView["standing"] {
  const rank=(c:RecognitionContext)=>LEVELS.indexOf(states[c]);
  if (rank("MAJOR_STAGE") >= 3 && rank("INTERNATIONAL") >= 3)
    return {label:"International stage performer",description:"Significant major-stage and international achievements remain part of this Career's standing."};
  const strongest=(Object.keys(CONTEXTS) as RecognitionContext[]).sort((a,b)=>rank(b)-rank(a) || Object.keys(CONTEXTS).indexOf(a)-Object.keys(CONTEXTS).indexOf(b))[0];
  if (rank(strongest) === 0) return {label:"Building a sporting record",description:"Recognition follows evidenced sporting achievements. Every eligible Career pathway remains open."};
  const domain={LOCAL:"local competitor",AMATEUR:"amateur",PROFESSIONAL:"professional",MAJOR_STAGE:"stage performer",INTERNATIONAL:"international competitor"}[strongest];
  return {label:`${LEVEL_LABELS[states[strongest]]} ${domain}`,description:`Earned recognition is strongest in the ${CONTEXTS[strongest].toLowerCase()} context. Other contexts develop independently; turning professional is optional.`};
}
/** Pure read model; no writes, RNG, wall clock, economy or gameplay dependencies. */
export function recognitionModel(s: RecognitionSources): Pick<RecognitionView,"standing"|"contexts"|"strongest"|"milestones"|"historyNote"> {
  const items=contributions(s), states={} as Record<RecognitionContext,RecognitionLevel>;
  const views=(Object.keys(CONTEXTS) as RecognitionContext[]).map(context=>{
    const level=levelOf(score(items[context]));states[context]=level;
    const evidence=[...items[context]].sort((a,b)=>b.weight-a.weight || order(b.fact,a.fact) || a.fact.id.localeCompare(b.fact.id))
      .filter((item,i,all)=>all.findIndex(v=>v.fact.id===item.fact.id)===i).slice(0,4).map(i=>i.fact);
    return {context,label:CONTEXTS[context],level,levelLabel:LEVEL_LABELS[level],evidence};
  });
  return {standing:careerStanding(states),contexts:views,
    strongest:[...views].filter(v=>v.level!=="UNKNOWN").sort((a,b)=>LEVELS.indexOf(b.level)-LEVELS.indexOf(a.level) ||
      Object.keys(CONTEXTS).indexOf(a.context)-Object.keys(CONTEXTS).indexOf(b.context)).slice(0,2).map(v=>v.context),
    milestones:views.flatMap(v=>milestoneHistory(v.context,items[v.context])).sort(order),
    historyNote:"Earned recognition does not decay with age or recent losses. Milestones are reconstructed only where the source chronology is complete; weekly facts do not imply an exact day. Season-only evidence supports current standing without invented past crossing dates."};
}
