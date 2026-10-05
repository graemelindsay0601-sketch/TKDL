import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { ageOn, careerDate } from "../identity/age.ts";
import { createCareerFactsService } from "../facts/service.ts";
import { createCareerRelationshipsService } from "../relationships/service.ts";
import { createCareerLifeService } from "../life/service.ts";
import { aggregate, hall, legacy, nameOf, review } from "./model.ts";
import type { Card, Evidence, Induction, LegacyView, Ranking, Result, SeasonReview, Totals } from "./types.ts";

export type LegacyRoot={id:string;current_season:number;current_week:number;status:string;player_id?:number;career_name?:string|null};
type Row=Record<string,unknown>;
const n=(r:Row,k:string)=>Number(r[k]??0);
export async function loadEvidence(tx:CareerExecutor,root:LegacyRoot):Promise<Evidence> {
  const id=root.id;
  const profile=(await tx.execute(sql`SELECT display_name,to_char(date_of_birth,'YYYY-MM-DD') dob,
    to_char(career_start_date,'YYYY-MM-DD') start FROM career_profiles WHERE career_save_id=${id}`)).rows[0];
  const npcs=(await tx.execute(sql`SELECT id,first_name,surname,starting_age,created_season,retired_season
    FROM career_world_players WHERE career_save_id=${id} ORDER BY id`)).rows;
  const players=[{id:"HUMAN",name:String(profile?.display_name??root.career_name??"You"),
    retiredSeason:root.status==="RETIRED"?Number(root.current_season):null,
    startingAge:profile?.dob&&profile?.start?ageOn(String(profile.dob),String(profile.start)):null,createdSeason:1},
    ...npcs.map(r=>({id:String(r.id),name:`${r.first_name} ${r.surname}`,startingAge:n(r,"starting_age"),
      createdSeason:n(r,"created_season"),retiredSeason:r.retired_season?n(r,"retired_season"):null}))];
  // Aggregate immutable results in SQL; do not snapshot full NPC/match databases.
  const totals:Totals[]=(await tx.execute(sql`SELECT r.participant_key id,i.season,COUNT(*)::int appearances,
    COUNT(*) FILTER(WHERE r.is_champion AND i.classification<>'QUALIFIER')::int titles,
    COUNT(*) FILTER(WHERE (r.is_champion OR r.stage_reached='FINAL') AND i.classification<>'QUALIFIER')::int finals,
    COUNT(*) FILTER(WHERE r.is_champion AND i.classification<>'QUALIFIER' AND i.presentation_tier IN ('MAJOR','WORLD'))::int "majorTitles",
    COUNT(*) FILTER(WHERE r.is_champion AND i.classification<>'QUALIFIER' AND i.circuit='WORLD_CHAMPIONSHIP')::int worlds,
    COUNT(*) FILTER(WHERE r.is_champion AND i.classification<>'QUALIFIER' AND i.circuit IN ('JUNIOR','COUNTY','REGIONAL','NATIONAL_AMATEUR','VAULT','CHALLENGER'))::int "amateurTitles",
    COUNT(*) FILTER(WHERE r.is_champion AND i.classification<>'QUALIFIER' AND i.circuit IN ('NATIONAL_AMATEUR','VAULT','CHALLENGER'))::int "nationalTitles",
    COUNT(*) FILTER(WHERE r.is_champion AND i.classification<>'QUALIFIER' AND i.circuit IN ('PRO_CIRCUIT','EUROPEAN_SERIES'))::int "proTitles",
    COALESCE(SUM(r.wins),0)::int wins,COALESCE(SUM(r.losses),0)::int losses
    FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
    WHERE r.career_save_id=${id} AND i.status='COMPLETED'
    GROUP BY r.participant_key,i.season ORDER BY i.season,r.participant_key`)).rows.map(r=>({
      id:String(r.id),season:n(r,"season"),appearances:n(r,"appearances"),titles:n(r,"titles"),finals:n(r,"finals"),
      majorTitles:n(r,"majorTitles"),worlds:n(r,"worlds"),amateurTitles:n(r,"amateurTitles"),nationalTitles:n(r,"nationalTitles"),
      proTitles:n(r,"proTitles"),wins:n(r,"wins"),losses:n(r,"losses")}));
  const results:Result[]=(await tx.execute(sql`SELECT i.id,i.definition_key,i.name,i.season,i.end_day,i.circuit,i.presentation_tier,i.classification,
    r.participant_key,r.finishing_position,r.is_champion,r.stage_reached
    FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
    WHERE r.career_save_id=${id} AND i.status='COMPLETED' AND
      (r.is_champion OR r.stage_reached='FINAL' OR r.participant_key='HUMAN')
    ORDER BY i.season,i.end_day,i.id,r.participant_key`)).rows.map(r=>({
      id:`result:${r.id}:${r.participant_key}`,key:String(r.definition_key),name:String(r.name),season:n(r,"season"),day:n(r,"end_day"),
      participant:String(r.participant_key),participantName:players.find(p=>p.id===String(r.participant_key))?.name??"Recorded participant",
      position:n(r,"finishing_position"),champion:r.is_champion===true,
      final:r.is_champion===true||r.stage_reached==="FINAL",circuit:String(r.circuit),tier:String(r.presentation_tier),classification:String(r.classification)}));
  // Only season endpoints, #1s and human ranks are needed, not all weekly rows.
  const rankings:Ranking[]=(await tx.execute(sql`WITH endpoints AS (
      SELECT season,MIN(week) first_week,MAX(week) last_week FROM career_ranking_snapshots
      WHERE career_save_id=${id} AND list_key='pro-world' GROUP BY season)
    SELECT p.id,p.season,p.week,r.participant_key,r.position FROM career_ranking_snapshots p
    JOIN endpoints e ON e.season=p.season JOIN career_ranking_snapshot_rows r ON r.career_save_id=p.career_save_id AND r.snapshot_id=p.id
    WHERE p.career_save_id=${id} AND p.list_key='pro-world'
      AND (p.week=e.first_week OR p.week=e.last_week OR r.position=1 OR r.participant_key='HUMAN')
    ORDER BY p.season,p.week,r.position,r.participant_key`)).rows.map(r=>({
      id:String(r.id),season:n(r,"season"),week:n(r,"week"),participant:String(r.participant_key),position:n(r,"position")}));
  const cards:Card[]=(await tx.execute(sql`SELECT id,participant_key,source,awarded_season,awarded_week,start_season,end_season,ended_season,ended_week,status
    FROM career_tour_cards WHERE career_save_id=${id} ORDER BY awarded_season,awarded_week,id`)).rows.map(r=>({
      id:String(r.id),participant:String(r.participant_key),participantName:players.find(p=>p.id===String(r.participant_key))?.name??"Recorded participant",
      source:String(r.source),awardedSeason:n(r,"awarded_season"),awardedWeek:n(r,"awarded_week"),
      startSeason:n(r,"start_season"),endSeason:n(r,"end_season"),endedSeason:r.ended_season?n(r,"ended_season"):null,
      endedWeek:r.ended_week?n(r,"ended_week"):null,status:String(r.status)}));
  const money=(await tx.execute(sql`SELECT season,
      COALESCE(SUM(amount_pence) FILTER(WHERE category='PRIZE'),0)::bigint prize,
      COALESCE(SUM(amount_pence) FILTER(WHERE headline='SPONSOR'),0)::bigint commercial
    FROM career_finance_entries WHERE career_save_id=${id} AND season IS NOT NULL GROUP BY season ORDER BY season`)).rows.map(r=>({
      season:n(r,"season"),prizePence:n(r,"prize"),commercialPence:n(r,"commercial")}));
  const sponsors=(await tx.execute(sql`SELECT id,sponsor_key,start_season,end_season,status FROM career_sponsor_contracts
    WHERE career_save_id=${id} ORDER BY start_season,start_week,id`)).rows.map(r=>({
      id:String(r.id),name:String(r.sponsor_key),startSeason:n(r,"start_season"),endSeason:n(r,"end_season"),status:String(r.status)}));
  const qualifications=(await tx.execute(sql`SELECT id,recipient_key,awarded_season,target_key FROM career_qualification_entitlements
    WHERE career_save_id=${id} ORDER BY awarded_season,id`)).rows.map(r=>({
      id:String(r.id),participant:String(r.recipient_key),season:n(r,"awarded_season"),target:String(r.target_key)}));
  const decisions=(await tx.execute(sql`SELECT id,season,kind,data->>'thread' thread FROM career_life_decisions
    WHERE career_save_id=${id} ORDER BY season,week,id`)).rows.map(r=>({id:String(r.id),season:n(r,"season"),kind:String(r.kind),thread:r.thread?String(r.thread):null}));
  const commitments=(await tx.execute(sql`SELECT id,season,title,status FROM career_life_commitments
    WHERE career_save_id=${id} ORDER BY season,day,id`)).rows.map(r=>({id:String(r.id),season:n(r,"season"),title:String(r.title),status:String(r.status)}));
  const merch=(await tx.execute(sql`SELECT category,signed_season,active FROM career_life_merchandise WHERE career_save_id=${id}`)).rows[0];
  return {saveId:id,currentSeason:Number(root.current_season),currentWeek:Number(root.current_week),retired:root.status==="RETIRED",
    players,totals,results,rankings,cards,money,sponsors,qualifications,decisions,commitments,
    ages:profile?.dob&&profile?.start?[...new Set(totals.filter(t=>t.id==="HUMAN").map(t=>t.season))].map(season=>({
      participant:"HUMAN",season,atStart:ageOn(String(profile.dob),careerDate(String(profile.start),season,1))})):[],
    merchandise:merch?{category:String(merch.category),signedSeason:n(merch,"signed_season"),active:merch.active===true}:null};
}
export async function definingRival(tx:CareerExecutor,e:Evidence,season:number):Promise<SeasonReview["definingRival"]> {
  const r=(await tx.execute(sql`SELECT CASE WHEN m.a_key='HUMAN' THEN m.b_key ELSE m.a_key END opponent,
    COUNT(*)::int meetings,COUNT(*) FILTER(WHERE m.winner_key='HUMAN')::int wins
    FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
    WHERE m.career_save_id=${e.saveId} AND i.season=${season} AND m.status='COMPLETED' AND (m.a_key='HUMAN' OR m.b_key='HUMAN')
    GROUP BY opponent HAVING COUNT(*)>=2 ORDER BY meetings DESC,opponent LIMIT 1`)).rows[0];
  return r?{id:String(r.opponent),name:nameOf(e,String(r.opponent)),meetings:n(r,"meetings"),wins:n(r,"wins"),losses:n(r,"meetings")-n(r,"wins")}:null;
}
export async function readReviews(tx:CareerExecutor,e:Evidence):Promise<SeasonReview[]> {
  const seasons=(await tx.execute(sql`SELECT s.season,r.snapshot FROM career_seasons s LEFT JOIN career_legacy_reviews r
    ON r.career_save_id=s.career_save_id AND r.season=s.season WHERE s.career_save_id=${e.saveId} AND s.status='COMPLETED' ORDER BY s.season`)).rows;
  const out:SeasonReview[]=[];
  for(const r of seasons)out.push(r.snapshot?r.snapshot as SeasonReview:review(e,n(r,"season"),"RECONSTRUCTED",await definingRival(tx,e,n(r,"season"))));
  return out;
}
export async function persistInductions(tx:CareerExecutor,e:Evidence) {
  for(const h of hall(e))await tx.execute(sql`INSERT INTO career_legacy_inductions(career_save_id,participant_key,evidence)
    VALUES (${e.saveId},${h.participant},${JSON.stringify({...h,inductedSeason:e.currentSeason})}::jsonb) ON CONFLICT DO NOTHING`);
}
export async function captureSeasonReview(tx:CareerExecutor,root:LegacyRoot,season:number) {
  const exists=(await tx.execute(sql`SELECT 1 FROM career_legacy_reviews WHERE career_save_id=${root.id} AND season=${season}`)).rows[0];
  if(exists)return;
  const closed=(await tx.execute(sql`SELECT 1 FROM career_seasons WHERE career_save_id=${root.id} AND season=${season} AND status='COMPLETED'`)).rows[0];
  if(!closed)throw new Error("Cannot snapshot an unfinished Career season");
  const e=await loadEvidence(tx,root),r=review(e,season,"CAPTURED",await definingRival(tx,e,season));
  if(root.player_id)r.publicLife.profile=(await createCareerLifeService({execute:q=>tx.execute(q),transaction:w=>w(tx)}).read({playerId:root.player_id,isAdmin:true},root.id)).profile;
  await tx.execute(sql`INSERT INTO career_legacy_reviews(career_save_id,season,version,snapshot)
    VALUES (${root.id},${season},1,${JSON.stringify(r)}::jsonb) ON CONFLICT DO NOTHING`);
  await persistInductions(tx,e);
}
export async function projectLegacy(tx:CareerExecutor,root:LegacyRoot):Promise<LegacyView> {
  const e=await loadEvidence(tx,root),reviews=await readReviews(tx,e);
  const stored=(await tx.execute(sql`SELECT evidence FROM career_legacy_inductions WHERE career_save_id=${root.id} ORDER BY participant_key`)).rows.map(r=>r.evidence as Induction);
  // Historical retired saves can show eligibility without pretending an induction occurred.
  const eligibility=hall(e).filter(h=>!stored.some(s=>s.participant===h.participant)).map(h=>({...h,route:`${h.route} — derived eligibility; no recorded induction`}));
  const pending=(await tx.execute(sql`SELECT season FROM career_legacy_reviews WHERE career_save_id=${root.id} AND acknowledged=false ORDER BY season LIMIT 1`)).rows[0];
  return legacy(e,reviews,[...stored,...eligibility],root.status==="ACTIVE"&&pending?n(pending,"season"):null);
}
export async function captureRetirement(tx:CareerExecutor,root:LegacyRoot) {
  const e=await loadEvidence(tx,root);await persistInductions(tx,e);
  const snapshot=await projectLegacy(tx,root);
  if(root.player_id) {
    const db={execute:tx.execute.bind(tx),transaction:<T>(work:(executor:CareerExecutor)=>Promise<T>)=>work(tx)};
    const actor={playerId:root.player_id,isAdmin:true},facts=await createCareerFactsService(db).read(actor,root.id);
    const relationships=await createCareerRelationshipsService(db).read(actor,root.id);
    const life=await createCareerLifeService(db).read(actor,root.id);
    snapshot.finalSummary.push(`A7.1 actual played matches: ${facts.statistics.matchesPlayed}; ${facts.statistics.wins} wins, ${facts.statistics.losses} defeats.`);
    const rival=[...relationships.opponents].sort((a,b)=>b.meetings-a.meetings||a.player.id.localeCompare(b.player.id))[0];
    if(rival) {
      snapshot.finalSummary.push(`Most-met opponent: ${rival.player.name}, ${rival.meetings} played meetings; ${rival.humanWins} human wins and ${rival.npcWins} opponent wins.`);
      const ordered=[...rival.history].sort((a,b)=>a.season-b.season||a.day-b.day);
      const first=ordered[0],last=ordered.at(-1);
      if(first&&last)snapshot.finalSummary.push(`First meeting: ${first.name}, season ${first.season}. Final meeting: ${last.name}, season ${last.season}.`);
    }
    snapshot.finalSummary.push(`Final public presentation: ${life.profile.persona.label}; ${life.profile.awareness}, ${life.profile.reception}.`,
      `Commercial Career: ${life.profile.commercial.activity}. A7.5 threads and decisions remain in Career Life & Stories.`);
    const successes=new Map<string,{name:string;count:number}>();
    for(const result of e.results.filter(r=>r.participant==="HUMAN"&&r.champion&&r.classification!=="QUALIFIER")) {
      const row=successes.get(result.key)??{name:result.name,count:0};row.count++;successes.set(result.key,row);
    }
    const bestEvent=[...successes.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))[0];
    if(bestEvent)snapshot.finalSummary.push(`Most titles at one recurring event: ${bestEvent.name}, ${bestEvent.count}.`);
    const sponsor=[...e.sponsors].sort((a,b)=>(b.endSeason-b.startSeason)-(a.endSeason-a.startSeason)||a.id.localeCompare(b.id))[0];
    if(sponsor)snapshot.finalSummary.push(`Longest signed sponsor term: ${sponsor.name}, seasons ${sponsor.startSeason}–${sponsor.endSeason}; actual attendance/duration is not inferred.`);
  }
  await tx.execute(sql`INSERT INTO career_legacy_retirements(career_save_id,snapshot)
    VALUES (${root.id},${JSON.stringify(snapshot)}::jsonb) ON CONFLICT DO NOTHING`);
}
export function eventHistory(e:Evidence,key:string) {
  const rows=e.results.filter(r=>r.key===key&&r.classification!=="QUALIFIER");
  const count=(predicate:(r:Result)=>boolean)=>e.players.map(p=>({id:p.id,name:p.name,count:rows.filter(r=>r.participant===p.id&&predicate(r)).length}))
    .filter(p=>p.count>0).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
  const champions=rows.filter(r=>r.champion);
  return {key,champions,defendingChampion:champions.find(r=>r.season===e.currentSeason-1)??null,
    mostTitles:count(r=>r.champion),mostFinals:count(r=>r.final),human:rows.filter(r=>r.participant==="HUMAN"),
    note:"Exact A3 definition-key lineage only. Missing seasons are not filled."};
}
export function npcHistory(e:Evidence,id:string,reviews:SeasonReview[],inductions:Induction[]) {
  const p=e.players.find(p=>p.id===id)!;
  return {player:p,totals:aggregate(e).find(t=>t.id===id)??null,
    rankings:e.rankings.filter(r=>r.participant===id),titles:e.results.filter(r=>r.participant===id&&r.champion&&r.classification!=="QUALIFIER"),
    awards:reviews.flatMap(r=>r.awards).filter(a=>a.participant===id),cards:e.cards.filter(c=>c.participant===id),
    hallOfFame:inductions.find(h=>h.participant===id)??null};
}
