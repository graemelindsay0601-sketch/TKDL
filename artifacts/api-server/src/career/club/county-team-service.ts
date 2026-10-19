import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { LOCALITIES, localityByRegion } from "../calendar/geography.ts";
import { dartsNation } from "../calendar/pairs.ts";
import { simulateBullUp } from "../calendar/engine.ts";
import { loadNpcs } from "../world/repository.ts";
import { simulateNpcMatch } from "../world/simulation.ts";
import { CAREER_DIFFICULTY_CONFIG } from "../world/config.ts";
import { humanSimulationPlayer, loadHumanForm } from "../form/human.ts";
import type { Npc } from "../world/types.ts";
import { freeOn } from "../nights.ts";
import { teamNightDay } from "./teams.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { CLUB, memberPoints, type ClubResult } from "./model.ts";
import { countyCupFixtures, countyFixtures, selectCountySquads, COUNTY_SQUAD_FORMAT, type CountyCategory } from "./county-squads.ts";

type Root = { id: string; world_seed: string; world_generation_version: number | string; difficulty: string; settings_snapshot?: unknown };
export const countyWeeksFor = (rounds: number) => Array.from({ length: rounds }, (_, i) => 4 + i * 3);
const level = (n: Npc) => (n.ability.scoring + n.ability.finishing) / 2;
const BOT_CONTEXT = { category: "floor" as const, roundImportance: 0.55, elimination: false };

/**
 * Simulate this week's scheduled UKDA-style county fixtures. The player's
 * selected single is included in the appropriate squad and resolved by the
 * same Career match simulator used for club team nights.
 */
export async function playCountyFixtures(tx: CareerExecutor, root: Root, season: number, week: number): Promise<void> {
  const homeLocality = String((await tx.execute(sql`SELECT home_locality FROM career_profiles WHERE career_save_id=${root.id}`)).rows[0]?.home_locality
    ?? (root.settings_snapshot as { homeLocality?: string } | undefined)?.homeLocality ?? "");
  const home = LOCALITIES.find(l => l.key === homeLocality);
  if (!home) return;
  const nation = dartsNation(home.country, home.key);
  const localities = LOCALITIES.filter(l => l.country === home.country && dartsNation(l.country, l.key) === nation);
  const counties = localities.map(l => l.key);
  const allFixtures = countyFixtures(counties, countyWeeksFor(localities.length - 1));
  const hasSchedule = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_county_fixtures WHERE career_save_id=${root.id} AND season=${season}`)).rows[0]?.n ?? 0) > 0;
  if (!hasSchedule) for (const fixture of allFixtures) await tx.execute(sql`INSERT INTO career_county_fixtures
      (career_save_id,season,round,week,home_key,away_key,status,matches)
      VALUES (${root.id},${season},${fixture.round},${fixture.week},${fixture.home},${fixture.away},'SCHEDULED','[]'::jsonb)
      ON CONFLICT DO NOTHING`);
  const cupRows = (await tx.execute(sql`SELECT round,week,home_key,away_key,status,matches FROM career_county_fixtures
    WHERE career_save_id=${root.id} AND season=${season} AND round>=100`)).rows;
  const cup = countyCupFixtures(counties, cupRows.map(r => ({ round: Number(r.round), week: Number(r.week), home: String(r.home_key), away: String(r.away_key),
    status: String(r.status), matches: (Array.isArray(r.matches) ? r.matches : []) as { homeSets: number; awaySets: number }[] })));
  for (const f of cup) await tx.execute(sql`INSERT INTO career_county_fixtures
    (career_save_id,season,round,week,home_key,away_key,status,matches)
    VALUES (${root.id},${season},${f.round},${f.week},${f.home},${f.away},'SCHEDULED','[]'::jsonb) ON CONFLICT DO NOTHING`);
  const scheduled = [...allFixtures.filter(f => f.week === week), ...cup.filter(f => f.week <= week)];
  if (!scheduled.length) return;
  const already = new Set((await tx.execute(sql`SELECT round,home_key FROM career_county_fixtures
    WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND status IN ('COMPLETED','IN_PROGRESS')`)).rows
    .map(r => `${Number(r.round)}:${String(r.home_key)}`));
  const todo = scheduled.filter(f => !already.has(`${f.round}:${f.home}`));
  if (!todo.length) return;

  const categoryRow = (await tx.execute(sql`SELECT category FROM career_county_eligibility WHERE career_save_id=${root.id}`)).rows[0];
  const humanCategory: CountyCategory | null = categoryRow?.category === "MEN" || categoryRow?.category === "WOMEN" ? categoryRow.category : null;
  const humanAvailable = await freeOn(tx, root.id, season, teamNightDay(week));
  const npcs = await loadNpcs(tx, root.id, { activeOnly: true, nationality: home.country });
  const localityOf = new Map(npcs.map(n => [n.id, localityByRegion(n.homeRegion)?.key ?? null]));
  const priorRows = season > 1 ? (await tx.execute(sql`SELECT r.participant_key,r.finishing_position,i.season FROM career_event_results r
    JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
    WHERE r.career_save_id=${root.id} AND i.status='COMPLETED' AND i.country=${home.country} AND i.classification<>'QUALIFIER'
      AND i.circuit IN (${sql.join(CLUB.circuits.map(c => sql`${c}`), sql`,`)}) AND i.season=${season - 1}`)).rows : [];
  const results: ClubResult[] = priorRows.map(r => {
    const key = String(r.participant_key);
    return { season: Number(r.season), participantKey: key, locality: key === "HUMAN" ? home.key : localityOf.get(key) ?? null, position: Number(r.finishing_position) };
  });
  const points = memberPoints(results, season - 1);
  const playersByLocality = new Map<string, Npc[]>(localities.map(l => [l.key, npcs.filter(n => localityOf.get(n.id) === l.key)]));
  const categoryOf = (npc: Npc) => npc.worldKey.startsWith("women:") ? "WOMEN" : "MEN";
  const squads = (locality: string, category: CountyCategory) => {
    const contestants = (playersByLocality.get(locality) ?? []).filter(n => n.status === "ACTIVE" && categoryOf(n) === category)
      .map(n => ({ key: n.id, points: points.get(n.id)?.points ?? 0, women: category === "WOMEN" }));
    if (locality === home.key && humanCategory === category && humanAvailable) contestants.push({ key: "HUMAN", points: points.get("HUMAN")?.points ?? 0, women: category === "WOMEN" });
    return selectCountySquads(contestants);
  };
  const npcById = new Map(npcs.map(n => [n.id, n]));
  const form = await loadHumanForm(tx, root);
  for (const fixture of todo) {
    let hasLiveRubber = false;
    const resultsForFixture = [];
    for (const category of COUNTY_SQUAD_FORMAT.categories) for (const team of COUNTY_SQUAD_FORMAT.teams) {
      const homePlayers = squads(fixture.home, category)[category][team];
      const awayPlayers = squads(fixture.away, category)[category][team];
      const count = category === "MEN" ? COUNTY_SQUAD_FORMAT.menPlayersPerTeam : COUNTY_SQUAD_FORMAT.womenPlayersPerTeam;
      const bestOf = category === "WOMEN" ? COUNTY_SQUAD_FORMAT.womenBestOf : team === "A" ? COUNTY_SQUAD_FORMAT.menABestOf : COUNTY_SQUAD_FORMAT.menBBestOfByDivision.TWO;
      let homeSets = 0, awaySets = 0, homeLegs = 0, awayLegs = 0, homeAverage = 0, awayAverage = 0, played = 0;
      let youPlayed = false, youWon: boolean | undefined, humanMatch: Record<string, unknown> | null = null;
      for (let i = 0; i < count; i++) {
        const a = homePlayers[i]?.key ?? null, b = awayPlayers[i]?.key ?? null;
        if (!a || !b) { if (a) homeSets++; else if (b) awaySets++; continue; }
        const npcA = a === "HUMAN" ? null : npcById.get(a), npcB = b === "HUMAN" ? null : npcById.get(b);
        if ((!npcA && a !== "HUMAN") || (!npcB && b !== "HUMAN")) continue;
        if (a === "HUMAN" || b === "HUMAN") {
          const opponent = a === "HUMAN" ? npcB! : npcA!;
          const matchKey = `county:${season}:${fixture.round}:${fixture.home}:${category}:${team}:${i}`;
          const bot = toCareerBotConfig(createPerformance(opponent, BOT_CONTEXT, root.difficulty as never,
            scopedRandom(root.world_seed, Number(root.world_generation_version), "performance", SIMULATION_VERSION, matchKey, opponent.id)));
          humanMatch = { id: stableUuid(root.world_seed, SIMULATION_VERSION, "county-live", root.id, season, fixture.round, fixture.home, category, team, i),
            category, team, homeSide: a === "HUMAN", opponentKey: opponent.id, opponentName: `${opponent.firstName} ${opponent.surname}`,
            bot: { avg: bot.avg, sd: bot.sd, checkoutPct: bot.checkoutPct, hitAcc: bot.hitAcc },
            seed: stableUuid(root.world_seed, SIMULATION_VERSION, "county-live-bot", root.id, season, fixture.round, fixture.home, category, team, i),
            bestOf, darts: [], status: "LIVE" };
          youPlayed = true; hasLiveRubber = true;
          continue;
        }
        const pa = npcA ?? humanSimulationPlayer(root, npcB!, form), pb = npcB ?? humanSimulationPlayer(root, npcA!, form);
        const matchKey = `county:${season}:${fixture.round}:${fixture.home}:${category}:${team}:${i}`;
        const bull = simulateBullUp(pa, pb, root.world_seed, matchKey);
        const match = simulateNpcMatch({ players: [pa, pb], seed: root.world_seed, generationVersion: Number(root.world_generation_version), matchKey,
          difficulty: root.difficulty as never, context: { category: "local", roundImportance: fixture.round >= 100 ? 0.85 : 0.55, elimination: fixture.round >= 100 }, format: { bestOf, firstThrow: bull.firstThrow } });
        const ha = match.stats[0].legsWon, aa = match.stats[1].legsWon;
        if (ha > aa) homeSets++; else if (aa > ha) awaySets++;
        if (a === "HUMAN" || b === "HUMAN") { youPlayed = true; youWon = a === "HUMAN" ? ha > aa : aa > ha; }
        homeLegs += ha; awayLegs += aa; homeAverage += match.stats[0].average; awayAverage += match.stats[1].average; played++;
      }
      resultsForFixture.push({ category, team, home: fixture.home, away: fixture.away, homeSets, awaySets, homeLegs, awayLegs,
        homeAverage: played ? homeAverage / played : 0, awayAverage: played ? awayAverage / played : 0, youPlayed, ...(youWon === undefined ? {} : { youWon }),
        ...(humanMatch ? { humanMatch } : {}) });
    }
    await tx.execute(sql`UPDATE career_county_fixtures SET week=${week},status=${hasLiveRubber ? "IN_PROGRESS" : "COMPLETED"},matches=${JSON.stringify(resultsForFixture)}::jsonb
      WHERE career_save_id=${root.id} AND season=${season} AND round=${fixture.round} AND home_key=${fixture.home} AND status='SCHEDULED'`);
  }
}
