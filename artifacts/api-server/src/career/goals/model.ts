import { z } from "zod";
import { FOCUSES, type Focus, type GoalDefinition, type GoalRow, type GoalSources, type GoalView, type Opportunity } from "./types.ts";
import type { Fact } from "../facts/types.ts";
import { chronological } from "../facts/model.ts";
import { ageOn } from "../identity/age.ts";

export const ACTIVE_GOAL_LIMIT = 5;
export const focusSchema = z.object({ focus: z.enum(Object.keys(FOCUSES) as [Focus, ...Focus[]]) }).strict();
const simple = <T extends GoalDefinition["type"]>(type: T) => z.object({ type: z.literal(type) }).strict();
export const goalSchema = z.discriminatedUnion("type", [
  simple("WIN_TITLE"),simple("REACH_FINAL"),simple("WIN_MAJOR"),simple("WIN_WORLD"),simple("WIN_AMATEUR_TITLE"),simple("EARN_TOUR_CARD"),
  z.object({ type: z.literal("WIN_EVENT"), eventId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("REACH_WORLD_RANK"), target: z.number().int().min(1).max(10000) }).strict(),
  z.object({ type: z.literal("EARNINGS"), target: z.number().int().min(100).max(2000000000) }).strict(),
  z.object({ type: z.literal("MAXIMUMS"), target: z.number().int().min(1).max(100000) }).strict(),
  z.object({ type: z.literal("BEAT_OPPONENT"), opponentId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("IMPROVE_H2H"), opponentId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("BEAT_RELATIONSHIP"), opponentId: z.string().uuid(), relationship: z.enum(["Career Rival","Nemesis"]) }).strict(),
]);
export const createGoalSchema = z.object({ requestKey: z.string().uuid(), definition: goalSchema }).strict();
export const targetKey = (d: GoalDefinition) => `${d.type}:${"eventId" in d ? d.eventId : "opponentId" in d ? `${d.opponentId}:${"relationship" in d ? d.relationship : ""}` : "target" in d ? d.target : ""}`;
/** Thin immutable supporting record; age at known completion date, not event start. */
export function completionFact(e: Fact, dob?: string): Fact {
  return {id:e.id,source:e.source,label:e.label,season:e.season,day:e.day,week:e.week,date:e.date,
    age:e.date && dob ? ageOn(dob,e.date) : e.age,...(e.eventId?{eventId:e.eventId}:{})};
}

export function goalLabel(d: GoalDefinition, s: GoalSources, events: Opportunity[] = []): string {
  const name = "opponentId" in d ? s.relationships.world.players.find(p=>p.id===d.opponentId)?.name ?? "Recorded opponent" : "";
  switch (d.type) {
    case "WIN_TITLE": return "Win a Career title";
    case "REACH_FINAL": return "Reach a Career final";
    case "WIN_MAJOR": return "Win a major title";
    case "WIN_WORLD": return "Win the World Championship";
    case "WIN_AMATEUR_TITLE": return "Win an amateur / secondary-circuit title";
    case "EARN_TOUR_CARD": return "Earn a first Tour Card";
    case "WIN_EVENT": return `Win ${events.find(e=>e.id===d.eventId)?.name ?? s.eventNames?.[d.eventId] ?? s.facts.results.find(e=>e.eventId===d.eventId)?.name ?? "the selected event"}`;
    case "REACH_WORLD_RANK": return `Reach World top ${d.target}`;
    case "EARNINGS": return `Career prize earnings £${(d.target/100).toLocaleString("en-GB")}`;
    case "MAXIMUMS": return `Record ${d.target} maximum${d.target===1?"":"s"} (180)`;
    case "BEAT_OPPONENT": return `Beat ${name}`;
    case "IMPROVE_H2H": return `Improve H2H against ${name} by one net win`;
    case "BEAT_RELATIONSHIP": return `Beat ${name} — selected ${d.relationship}`;
  }
}
const amateur = (c: string) => ["GRASSROOTS","COUNTY","REGIONAL","NATIONAL_AMATEUR","VAULT","CHALLENGER"].includes(c);
export function evidenceFor(d: GoalDefinition, s: GoalSources): Fact[] {
  switch (d.type) {
    case "WIN_TITLE": return s.facts.results.filter(r=>r.champion);
    case "REACH_FINAL": return s.facts.results.filter(r=>r.champion || r.stageReached==="FINAL");
    case "WIN_MAJOR": return s.facts.results.filter(r=>r.champion && r.presentationTier==="MAJOR");
    case "WIN_WORLD": return s.facts.results.filter(r=>r.champion && r.circuit==="WORLD_CHAMPIONSHIP");
    case "WIN_AMATEUR_TITLE": return s.facts.results.filter(r=>r.champion && amateur(r.circuit));
    case "WIN_EVENT": return s.facts.results.filter(r=>r.champion && r.eventId===d.eventId);
    case "EARN_TOUR_CARD": return s.facts.records.firstTourCard ? [s.facts.records.firstTourCard] : [];
    case "REACH_WORLD_RANK": return s.facts.records.bestWorldRanking && s.facts.records.bestWorldRanking.position<=d.target ? [s.facts.records.bestWorldRanking] : [];
    case "EARNINGS": {
      let total=0;
      return s.earningsEvidence.filter(e=>{total+=e.amountPence;return total>=d.target;}).map(e=>e.fact);
    }
    case "MAXIMUMS": return []; // Aggregate authority does not expose an exact threshold-crossing match.
    default: return (s.relationships.opponents.find(o=>o.player.id===d.opponentId)?.history ?? []).map(m=>({
      id:`match:${m.id}`,source:"A3 played match / A7.2 H2H",label:`${m.won?"Won":"Lost"} against selected opponent`,season:m.season,day:m.day,
      week:Math.ceil(m.day/7),date:m.date,age:m.humanAge,eventId:m.eventId,
    }));
  }
}
export function goalProgress(row: GoalRow, s: GoalSources): { progress: GoalView["progress"]; evidence: Fact | null } {
  const d=row.definition, seen=new Set(row.baseline_evidence), facts=evidenceFor(d,s).filter(f=>!seen.has(f.id)).sort(chronological);
  let current: number | null=0, target=1, unit="achievement", evidence: Fact | null=null, note: string | null=null;
  if (d.type==="REACH_WORLD_RANK") { current=s.currentRank;target=d.target;unit="World position";evidence=facts[0]??null; }
  else if (d.type==="EARNINGS") { current=s.earningsPence;target=d.target;unit="pence in Career prize earnings";evidence=facts[0]??null; }
  else if (d.type==="MAXIMUMS") {
    current=s.facts.performance.maximums;target=d.target;unit="verified maximums";
    // Aggregate evidence has no exact threshold-crossing match. Do not invent it.
    if (current!==null && current>=target) note="Verified aggregate milestone; exact crossing match/date is not available.";
  } else if ("opponentId" in d) {
    const o=s.relationships.opponents.find(o=>o.player.id===d.opponentId), history=(o?.history ?? []).filter(m=>!seen.has(`match:${m.id}`));
    if (d.type==="IMPROVE_H2H") {
      unit="net wins since selection";
      for (const m of history) { current=(current??0)+(m.won?1:-1);if (!evidence && current>=1) evidence=facts.find(f=>f.id===`match:${m.id}`)??null; }
    } else { const win=history.find(m=>m.won);current=win?1:0;evidence=win ? facts.find(f=>f.id===`match:${win.id}`)??null : null; }
    const identity=s.relationships.world.players.find(p=>p.id===d.opponentId)??o?.player;
    if (!identity || identity.status==="RETIRED") note="Opponent retired or unavailable. Existing played evidence remains valid; this goal may be abandoned without penalty.";
  } else { current=facts.length?1:0;evidence=facts[0]??null; }
  if (d.type==="WIN_EVENT" && !s.facts.results.some(r=>r.eventId===d.eventId && r.champion)) note=s.facts.results.some(r=>r.eventId===d.eventId) ?
    "Eliminated from the selected event. The goal is no longer achievable; abandon it without penalty." : "Selected event only; cancellation/elimination does not count as completion.";
  return { progress:{current,target,unit,note},evidence };
}
export function recommend(focus: Focus, events: Opportunity[]): (Opportunity & {reason:string})[] {
  const upcoming=events.filter(e=>["SCHEDULED","REGISTRATION_OPEN","REGISTRATION_CLOSED","DRAW_PENDING","DRAWN","IN_PROGRESS"].includes(e.status));
  const relevant=upcoming.filter(e=>focus==="OPEN_SCHEDULE" || focus==="PRIZE_MONEY" ||
    (focus==="AMATEUR_CIRCUIT" ? amateur(e.circuit) : focus==="MAJOR_QUALIFICATION" ? e.majorRoute || ["MAJOR","WORLD"].includes(e.tier) :
      ["Q_SCHOOL","PRO_CIRCUIT","CHALLENGER"].includes(e.circuit) || e.classification==="RANKING"));
  const sorted=focus==="OPEN_SCHEDULE" ? relevant : [...relevant].sort((a,b)=>Number(b.canEnter)-Number(a.canEnter) ||
    (focus==="PRIZE_MONEY" ? (b.firstPrizePence??-1)-(a.firstPrizePence??-1) || (a.estimatedCostPence??Infinity)-(b.estimatedCostPence??Infinity) : a.startDay-b.startDay) || a.id.localeCompare(b.id));
  return sorted.slice(0,6).map(e=>({...e,reason:focus==="OPEN_SCHEDULE" ? "Normal upcoming calendar" : focus==="PRIZE_MONEY" ?
    "Published first prize and estimated costs; winning and profit are not guaranteed" : e.circuit==="Q_SCHOOL" ? "Q-School pathway — optional" :
    e.majorRoute ? "Authored qualification output to a major/world event" : focus==="MAJOR_QUALIFICATION" ? "Major/world event; existing eligibility applies" :
    focus==="AMATEUR_CIRCUIT" ? "Amateur / open / secondary-circuit competition" : "Published ranking or professional opportunity; see its existing route"}));
}
