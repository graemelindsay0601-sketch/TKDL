/**
 * DEV-ONLY NPC world balance audit (isolated in-memory PGlite). Creates one new Career and
 * advances N seasons with NO human entries (the human only lets time pass), so every event is
 * decided by the existing A2/A3 simulation. At the start of each season it records population,
 * hidden-ability distribution (analysis only — never player-facing), ages, retirements and
 * replacements, Tour Cards, ranking leadership and champion concentration.
 *
 *   node scripts/career-audit/world-run.ts --seasons=20 [--out=file.json]
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { auditDatabase } from "./db.ts";

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SEASONS = Number(arg("seasons", "20"));
const OUT = arg("out", "");
const n = (v: unknown) => Number(v ?? 0);
const a = await auditDatabase();
const { saves, career, rows, actor } = a;
const s = await saves.create(1, { slot: 1, careerName: "World audit", dateOfBirth: "2000-06-15", homeLocality: "ayrshire" });
const id = s.id as string;
await a.db.execute(sql`UPDATE career_saves SET world_seed = ${createHash("sha256").update("career-audit-world").digest("hex")} WHERE id = ${id}`);
await career.initialize(actor, id);
const ability = sql`(scoring + finishing + consistency + pressure + clutch) / 5.0`;

async function snapshot(season: number) {
  const byTier = await rows(sql`SELECT tier, COUNT(*)::int n, ROUND(AVG(${ability})::numeric, 1)::float mean_ability, ROUND(AVG(age)::numeric, 1)::float mean_age,
      ROUND(MIN(${ability})::numeric,1)::float min_ability, ROUND(MAX(${ability})::numeric,1)::float max_ability
    FROM career_world_players WHERE career_save_id = ${id} AND status = 'ACTIVE' GROUP BY 1 ORDER BY 1`);
  const ages = (await rows(sql`SELECT COUNT(*) FILTER (WHERE age < 23)::int u23, COUNT(*) FILTER (WHERE age BETWEEN 23 AND 34)::int a23_34,
      COUNT(*) FILTER (WHERE age BETWEEN 35 AND 44)::int a35_44, COUNT(*) FILTER (WHERE age >= 45)::int a45p, COUNT(*)::int total
    FROM career_world_players WHERE career_save_id = ${id} AND status = 'ACTIVE'`))[0];
  const stages = Object.fromEntries((await rows(sql`SELECT stage, COUNT(*)::int n FROM career_world_players WHERE career_save_id = ${id} AND status='ACTIVE' GROUP BY 1`)).map(r => [String(r.stage), n(r.n)]));
  const retiredLast = n((await rows(sql`SELECT COUNT(*)::int n FROM career_world_players WHERE career_save_id = ${id} AND retired_season = ${season - 1}`))[0]?.n);
  const createdNow = n((await rows(sql`SELECT COUNT(*)::int n FROM career_world_players WHERE career_save_id = ${id} AND created_season = ${season}`))[0]?.n);
  const pros = (await rows(sql`SELECT COUNT(*)::int n, ROUND(AVG(${ability})::numeric,1)::float mean FROM career_world_players WHERE career_save_id = ${id} AND status='ACTIVE' AND professional_status='PROFESSIONAL'`))[0];
  const cards = n((await rows(sql`SELECT COUNT(*)::int n FROM career_tour_cards WHERE career_save_id = ${id} AND status = 'ACTIVE' AND start_season <= ${season} AND end_season >= ${season}`))[0]?.n);
  const cardSources = Object.fromEntries((await rows(sql`SELECT source, COUNT(*)::int n FROM career_tour_cards WHERE career_save_id = ${id} AND awarded_season = ${season - 1} GROUP BY 1`)).map(r => [String(r.source), n(r.n)]));
  const top32 = (await rows(sql`SELECT ROUND(AVG(${ability})::numeric,1)::float mean_ability, ROUND(AVG(p.age)::numeric,1)::float mean_age,
      COUNT(*) FILTER (WHERE p.created_season > 1)::int generated_after_s1
    FROM career_ranking_participants r JOIN career_world_players p ON p.career_save_id = r.career_save_id AND p.id = r.npc_id
    WHERE r.career_save_id = ${id} AND r.list_key = 'pro-world' AND r.current_position <= 32`))[0];
  // champions of the season just finished
  const champs = await rows(sql`SELECT i.circuit, i.definition_key, i.champion_participant_key AS c FROM career_event_instances i
    WHERE i.career_save_id = ${id} AND i.season = ${season - 1} AND i.status = 'COMPLETED' AND i.circuit IN ('PRO_CIRCUIT','EUROPEAN_SERIES','MAJOR','WORLD_CHAMPIONSHIP')`);
  const titleCounts = new Map<string, number>(); for (const c of champs) titleCounts.set(String(c.c), (titleCounts.get(String(c.c)) ?? 0) + 1);
  const topWinner = [...titleCounts.values()].sort((x, y) => y - x)[0] ?? 0;
  const majorChamps = champs.filter(c => ["MAJOR", "WORLD_CHAMPIONSHIP"].includes(String(c.circuit))).map(c => `${c.definition_key}:${c.c}`);
  const statuses = Object.fromEntries((await rows(sql`SELECT status || COALESCE(':'||status_reason,'') k, COUNT(*)::int n FROM career_event_instances WHERE career_save_id = ${id} AND season = ${season - 1} GROUP BY 1`)).map(r => [String(r.k), n(r.n)]));
  const no1 = (await rows(sql`SELECT r.participant_key FROM career_ranking_participants r WHERE r.career_save_id = ${id} AND r.list_key='pro-world' AND r.current_position = 1`))[0]?.participant_key ?? null;
  const worldChamp = champs.find(c => c.definition_key === "world-darts-championship")?.c ?? null;
  return { season, population: n(ages.total), byTier, ages, stages, retiredLastSeason: retiredLast, createdThisSeason: createdNow,
    professionals: { n: n(pros.n), meanAbility: pros.mean }, liveCards: cards, cardsAwardedLastSeason: cardSources,
    worldTop32: top32, proTitlesLastSeason: { events: champs.length, distinctChampions: titleCounts.size, mostTitlesByOne: topWinner },
    majorChampionsLastSeason: majorChamps, worldNo1: no1, worldChampionLastSeason: worldChamp, lastSeasonEventStatuses: statuses };
}

const out: any[] = [await snapshot(1)];
let op = 0;
for (let season = 1; season <= SEASONS; season++) {
  const t = performance.now();
  for (let guard = 0; guard < 80; guard++) {
    const r = await saves.read(1, id);
    if (r.currentSeason > season) break;
    await a.beginPendingSeason(id);
    await career.calendar.advance(actor, id, { operationKey: `world-advance-${op++}`, expectedSeason: r.currentSeason, expectedWeek: r.currentWeek, target: { kind: "WEEKS", weeks: 52 } });
  }
  await a.beginPendingSeason(id);
  const snap = await snapshot(season + 1);
  (snap as any).secondsForSeason = Math.round((performance.now() - t) / 1000);
  out.push(snap);
  console.error(`season ${season} done in ${(snap as any).secondsForSeason}s pop=${snap.population} pros=${snap.professionals.n} cards=${snap.liveCards}`);
  if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
}
if (!OUT) console.log(JSON.stringify(out, null, 1));
await a.pg.close();
