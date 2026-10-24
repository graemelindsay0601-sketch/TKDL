import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { LOCALITIES, localityByRegion } from "../calendar/geography.ts";
import { dartsNation } from "../calendar/pairs.ts";
import { simulateBullUp } from "../calendar/engine.ts";
import { loadNpcs } from "../world/repository.ts";
import { simulateNpcMatch } from "../world/simulation.ts";
import { CAREER_DIFFICULTY_CONFIG } from "../world/config.ts";
import { attributeForAverage, humanSimulationPlayer, loadHumanForm } from "../form/human.ts";
import type { Npc } from "../world/types.ts";
import { clubName } from "./model.ts";
import { freeOn } from "../nights.ts";
import { TEAMS, fixturesFor, leagueTable, playoffFixtures, teamNightDay, type FixtureResult } from "./teams.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import { CareerError } from "../service.ts";
import { z } from "zod";

type Root = { id: string; world_seed: string; world_generation_version: number | string; difficulty: string; current_season: number | string; current_week: number | string;
  settings_snapshot?: unknown; player_id?: number };
type BotConfig = { avg: number; sd: number; checkoutPct: number; hitAcc: number };
type HumanMatch = { id: string; status: "LIVE" | "PLAYED"; homeSide: boolean; opponentName: string; bot: BotConfig; seed: string;
  bestOf: number; darts: unknown[]; won?: boolean };
type Rubber = { home: string | null; away: string | null; homeLegs: number; awayLegs: number; averages: [number, number] | null; humanMatch?: HumanMatch };
const HUMAN = "HUMAN";
export const TEAM_FORMAT: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: TEAMS.bestOf };
const BOT_CONTEXT = { category: "floor" as const, roundImportance: 0.5, elimination: false };

/** Your club and the clubs of your darts nation (the league), or nothing when you have no home club. */
async function league(tx: CareerExecutor, root: Root) {
  const home = String((await tx.execute(sql`SELECT home_locality FROM career_profiles WHERE career_save_id=${root.id}`)).rows[0]?.home_locality
    ?? (root.settings_snapshot as { homeLocality?: string } | undefined)?.homeLocality ?? "");
  const locality = LOCALITIES.find(l => l.key === home);
  if (!locality) return null;
  const nation = dartsNation(locality.country, locality.key);
  const clubs = LOCALITIES.filter(l => l.country === locality.country && dartsNation(l.country, l.key) === nation).map(l => l.key);
  return { home: locality.key, nation, country: locality.country, clubs };
}

/** Is the human free on this day (no event booking, no off-board commitment)? */
const humanFree = (tx: CareerExecutor, saveId: string, season: number, day: number) => freeOn(tx, saveId, season, day);

/** Resolve the other team rubbers and leave a joined player's single live when they are free. */
export async function playTeamNights(tx: CareerExecutor, root: Root, season: number, week: number) {
  if (!(await tx.execute(sql`SELECT to_regclass('career_club_fixtures') IS NOT NULL AS ok`)).rows[0]?.ok) return null;
  const lg = await league(tx, root);
  if (!lg) return null;
  const prior = (await tx.execute(sql`SELECT round,week,home_key,away_key,home_score,away_score,rubbers,status FROM career_club_fixtures WHERE career_save_id=${root.id} AND season=${season}`)).rows;
  const asRubbers = (r: Record<string, unknown>) => Array.isArray(r.rubbers) ? r.rubbers as Rubber[] : [];
  const pending = prior.flatMap(r => asRubbers(r as Record<string, unknown>)).find(r => r.humanMatch?.status === "LIVE");
  if (pending?.humanMatch) return pending.humanMatch.id;
  const results: FixtureResult[] = prior.filter(r => r.status === "COMPLETED").map(r => ({ round: Number(r.round), week: Number(r.week), home: String(r.home_key), away: String(r.away_key), homeScore: Number(r.home_score), awayScore: Number(r.away_score) }));
  const fixtures = [...fixturesFor(lg.clubs), ...playoffFixtures(lg.clubs, results)]
    .filter(f => f.round >= 15 ? f.week <= week : f.week === week);
  if (!fixtures.length) return null;
  const done = new Set(prior.filter(r => Number(r.week) === week).map(r => `${r.round}:${r.home_key}`));
  const todo = fixtures.filter(f => !done.has(`${f.round}:${f.home}`));
  if (!todo.length) return null;
  const joined = (await tx.execute(sql`SELECT 1 FROM career_club_team_memberships WHERE career_save_id=${root.id} AND season=${season} AND club_key=${lg.home}`)).rows.length > 0;
  const day = teamNightDay(week);
  const busy = new Set((await tx.execute(sql`SELECT DISTINCT participant_key FROM career_participant_bookings WHERE career_save_id=${root.id} AND season=${season} AND day=${day}`)).rows
    .map(r => String(r.participant_key)));
  const npcs = await loadNpcs(tx, root.id, { activeOnly: true, nationality: lg.country });
  const clubOf = (n: Npc) => localityByRegion(n.homeRegion)?.key ?? null;
  const level = (n: Npc) => (n.ability.scoring + n.ability.finishing) / 2;
  const form = await loadHumanForm(tx, root);
  const offset = CAREER_DIFFICULTY_CONFIG[root.difficulty as keyof typeof CAREER_DIFFICULTY_CONFIG]?.abilityOffset ?? 0;
  const youLevel = attributeForAverage(form.skillAverage) - offset;
  const youFree = joined && await humanFree(tx, root.id, season, day);
  const side = (club: string): (string)[] => {
    const members = npcs.filter(n => clubOf(n) === club && !busy.has(n.id)).map(n => ({ key: n.id, level: level(n) }))
      .sort((a, b) => b.level - a.level || a.key.localeCompare(b.key));
    // You always get a game when you're free (it's your career); the rest of the side is the strongest free members, then in order of strength.
    const picked = club === lg.home && youFree ? [{ key: HUMAN, level: youLevel }, ...members.slice(0, TEAMS.singles - 1)] : members.slice(0, TEAMS.singles);
    return picked.sort((a, b) => b.level - a.level || a.key.localeCompare(b.key)).map(m => m.key);
  };
  const byId = new Map(npcs.map(n => [n.id, n]));
  let humanMatchId: string | null = null;
  for (const f of todo) {
    const home = side(f.home), away = side(f.away);
    const rubbers: Rubber[] = [];
    for (let i = 0; i < TEAMS.singles; i++) {
      const a = home[i] ?? null, b = away[i] ?? null;
      // An empty place is a walkover: the side that turned up wins the singles.
      if (!a || !b) { rubbers.push({ home: a, away: b, homeLegs: a ? 3 : 0, awayLegs: b ? 3 : 0, averages: null }); continue; }
      const npcA = a === HUMAN ? null : byId.get(a)!, npcB = b === HUMAN ? null : byId.get(b)!;
      if (a === HUMAN || b === HUMAN) {
        const opponent = npcA ?? npcB!;
        const matchKey = `team-night:${season}:${f.round}:${f.home}:${i}`;
        const bot = toCareerBotConfig(createPerformance(opponent, BOT_CONTEXT, root.difficulty as never,
          scopedRandom(root.world_seed, Number(root.world_generation_version), "performance", SIMULATION_VERSION, matchKey, opponent.id)));
        const humanMatch: HumanMatch = { id: stableUuid(root.world_seed, SIMULATION_VERSION, "team-night-live", root.id, season, f.round, f.home, i),
          status: "LIVE", homeSide: a === HUMAN, opponentName: `${opponent.firstName} ${opponent.surname}`,
          bot: { avg: bot.avg, sd: bot.sd, checkoutPct: bot.checkoutPct, hitAcc: bot.hitAcc },
          seed: stableUuid(root.world_seed, SIMULATION_VERSION, "team-night-bot", root.id, season, f.round, f.home, i), bestOf: TEAMS.bestOf, darts: [] };
        rubbers.push({ home: a, away: b, homeLegs: 0, awayLegs: 0, averages: null, humanMatch });
        humanMatchId = humanMatch.id;
        continue;
      }
      const pa = npcA ?? humanSimulationPlayer(root, npcB!, form), pb = npcB ?? humanSimulationPlayer(root, npcA!, form);
      const key = `team-night:${season}:${f.round}:${f.home}:${i}`;
      const bull = simulateBullUp(pa, pb, root.world_seed, key);
      const r = simulateNpcMatch({ players: [pa, pb], seed: root.world_seed, generationVersion: Number(root.world_generation_version), matchKey: key,
        difficulty: root.difficulty as never, context: { category: "local", roundImportance: 0.5, elimination: false }, format: { bestOf: TEAMS.bestOf, firstThrow: bull.firstThrow } });
      rubbers.push({ home: a, away: b, homeLegs: r.stats[0].legsWon, awayLegs: r.stats[1].legsWon,
        averages: [Math.round(r.stats[0].average * 10) / 10, Math.round(r.stats[1].average * 10) / 10] });
    }
    const homeScore = rubbers.filter(r => r.homeLegs > r.awayLegs).length, awayScore = rubbers.filter(r => r.awayLegs > r.homeLegs).length;
    const youPlayed = rubbers.some(r => r.humanMatch?.status === "PLAYED");
    const youWereNeeded = joined && (f.home === lg.home || f.away === lg.home);
    const inProgress = rubbers.some(r => r.humanMatch?.status === "LIVE");
    await tx.execute(sql`INSERT INTO career_club_fixtures (career_save_id,season,round,week,home_key,away_key,home_score,away_score,rubbers,you_played,you_unavailable)
      VALUES (${root.id},${season},${f.round},${week},${f.home},${f.away},${homeScore},${awayScore},${JSON.stringify(rubbers)}::jsonb,${youPlayed},${youWereNeeded && !youFree})
      ON CONFLICT DO NOTHING`);
    if (inProgress) await tx.execute(sql`UPDATE career_club_fixtures SET status='IN_PROGRESS' WHERE career_save_id=${root.id} AND season=${season} AND round=${f.round} AND home_key=${f.home}`);
  }
  return humanMatchId;
}

export type TeamNightsView = {
  season: number; week: number; club: string | null; nation: string | null; available: boolean; joined: boolean; liveMatchId: string | null;
  next: { week: number; home: boolean; opponent: string; youFree: boolean; clash: string | null } | null;
  last: { week: number; home: boolean; opponent: string; us: number; them: number; youPlayed: boolean; youUnavailable: boolean;
    singles: { us: string; them: string; usLegs: number; themLegs: number; you: boolean }[] } | null;
  table: { club: string; name: string; played: number; won: number; drawn: number; lost: number; singlesFor: number; singlesAgainst: number; points: number; position: number; you: boolean }[];
  you: { played: number; won: number; losses: number; reputation: number; reputationTier: "LOCAL" | "KNOWN" | "REGULAR" | "NEW" };
  localProfile: { appearances: number; wins: number; reputation: number; reputationTier: "LOCAL" | "KNOWN" | "REGULAR" | "NEW" };
  firstWeek: number; lastWeek: number;
};

export type TeamMatchSession = { id: string; status: "LIVE" | "PLAYED"; you: string; opponent: { name: string; bot: { config: BotConfig; seed: string } };
  format: X01Format; firstThrower: 0; darts: unknown[]; legs: [number, number] | null; won: boolean | null };
const rubbers = (fixture: Record<string, unknown>): Rubber[] => Array.isArray(fixture.rubbers) ? fixture.rubbers as Rubber[] : [];
async function findHumanTeamMatch(tx: CareerExecutor, saveId: string, matchId: string) {
  const rows = (await tx.execute(sql`SELECT * FROM career_club_fixtures WHERE career_save_id=${saveId} AND status IN ('IN_PROGRESS','COMPLETED') ORDER BY season DESC,week DESC`)).rows;
  for (const fixture of rows) {
    const rubber = rubbers(fixture as Record<string, unknown>).find(r => r.humanMatch?.id === matchId);
    if (rubber?.humanMatch) return { fixture: fixture as Record<string, unknown>, rubber };
  }
  throw new CareerError(404, "Club team match not found");
}
async function teamSession(saveId: string, tx: CareerExecutor, fixture: Record<string, unknown>, rubber: Rubber): Promise<TeamMatchSession> {
  const match = rubber.humanMatch!;
  const name = (await tx.execute(sql`SELECT career_name FROM career_saves WHERE id=${saveId}`)).rows[0]?.career_name;
  const legs: [number, number] | null = match.status === "PLAYED"
    ? (match.homeSide ? [rubber.homeLegs, rubber.awayLegs] : [rubber.awayLegs, rubber.homeLegs]) : null;
  return { id: match.id, status: match.status, you: String(name ?? "You"),
    opponent: { name: match.opponentName, bot: { config: match.bot, seed: match.seed } },
    format: TEAM_FORMAT, firstThrower: 0, darts: match.darts, legs, won: match.status === "PLAYED" ? !!match.won : null };
}

export function createCareerTeamNightsService(database: CareerDatabase) {
  return {
    async read(actor: CareerActor, saveId: string): Promise<TeamNightsView> {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const base = { season, week, firstWeek: TEAMS.firstWeek, lastWeek: TEAMS.lastWeek };
        const lg = await league(tx, root);
        if (!lg || lg.clubs.length < 2) return { ...base, club: lg ? clubNameOf(lg.home) : null, nation: lg?.nation ?? null, available: false,
          joined: false, liveMatchId: null, next: null, last: null, table: [], you: { played: 0, won: 0, losses: 0, reputation: 0, reputationTier: "NEW" as const },
          localProfile: { appearances: 0, wins: 0, reputation: 0, reputationTier: "NEW" as const } };
        const joined = (await tx.execute(sql`SELECT 1 FROM career_club_team_memberships WHERE career_save_id=${root.id} AND season=${season} AND club_key=${lg.home}`)).rows.length > 0;
        const rows = (await tx.execute(sql`SELECT * FROM career_club_fixtures WHERE career_save_id=${root.id} AND season=${season} ORDER BY week, round`)).rows;
        const completedRows = rows.filter(r => r.status === "COMPLETED");
        const results: FixtureResult[] = completedRows.map(r => ({ round: Number(r.round), week: Number(r.week), home: String(r.home_key), away: String(r.away_key), homeScore: Number(r.home_score), awayScore: Number(r.away_score) }));
        const liveMatchId = rows.flatMap(r => Array.isArray(r.rubbers) ? r.rubbers as Rubber[] : [])
          .find(r => r.humanMatch?.status === "LIVE")?.humanMatch?.id ?? null;
        const postseason = playoffFixtures(lg.clubs, results);
        const mine = [...fixturesFor(lg.clubs), ...postseason].filter(f => f.home === lg.home || f.away === lg.home);
        const playedFixtures = new Set(results.map(r => `${r.round}:${r.home}`));
        const upcoming = mine.find(f => (f.week >= week || f.round >= 15) && !playedFixtures.has(`${f.round}:${f.home}`));
        let next: TeamNightsView["next"] = null;
        if (upcoming) {
          const displayWeek = Math.max(upcoming.week, week);
          const day = teamNightDay(displayWeek);
          const clash = (await tx.execute(sql`SELECT i.name FROM career_participant_bookings b JOIN career_event_instances i ON i.career_save_id=b.career_save_id AND i.id=b.event_id
              WHERE b.career_save_id=${root.id} AND b.season=${season} AND b.day=${day} AND b.participant_key=${HUMAN}
            UNION ALL SELECT title FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season} AND day=${day} AND status='ACCEPTED' LIMIT 1`)).rows[0];
          next = { week: displayWeek, home: upcoming.home === lg.home, opponent: clubNameOf(upcoming.home === lg.home ? upcoming.away : upcoming.home),
            youFree: joined && !clash, clash: joined && clash ? String(clash.name) : null };
        }
        const lastRow = [...completedRows].reverse().find(r => r.home_key === lg.home || r.away_key === lg.home);
        let last: TeamNightsView["last"] = null;
        if (lastRow) {
          const home = lastRow.home_key === lg.home, rubbers = lastRow.rubbers as Rubber[];
          const keys = [...new Set(rubbers.flatMap(r => [r.home === HUMAN && r.humanMatch?.status !== "PLAYED" ? null : r.home,
            r.away === HUMAN && r.humanMatch?.status !== "PLAYED" ? null : r.away]).filter((k): k is string => !!k && k !== HUMAN))];
          const names = new Map(keys.length ? (await tx.execute(sql`SELECT id, first_name, surname FROM career_world_players WHERE career_save_id=${root.id}
            AND id IN (${sql.join(keys.map(k => sql`${k}::uuid`), sql`,`)})`)).rows.map(p => [String(p.id), `${p.first_name} ${p.surname}`]) : []);
          const name = (k: string | null) => k === HUMAN ? "You" : k ? names.get(k) ?? "Club member" : "Club team-mate";
          last = { week: Number(lastRow.week), home, opponent: clubNameOf(String(home ? lastRow.away_key : lastRow.home_key)),
            us: Number(home ? lastRow.home_score : lastRow.away_score), them: Number(home ? lastRow.away_score : lastRow.home_score),
            youPlayed: lastRow.you_played === true, youUnavailable: lastRow.you_unavailable === true,
          singles: rubbers.map(r => {
            const actualHuman = r.humanMatch?.status === "PLAYED";
            const usKey = home ? r.home : r.away, themKey = home ? r.away : r.home;
            return { us: name(actualHuman ? usKey : usKey === HUMAN ? null : usKey),
              them: name(actualHuman ? themKey : themKey === HUMAN ? null : themKey),
              usLegs: home ? r.homeLegs : r.awayLegs, themLegs: home ? r.awayLegs : r.homeLegs, you: actualHuman };
          }) };
        }
        let played = 0, won = 0;
        for (const r of completedRows) for (const x of (Array.isArray(r.rubbers) ? r.rubbers as Rubber[] : [])) {
          if (x.humanMatch?.status === "PLAYED") { played++; if (x.humanMatch.won) won++; }
        }
        const reputation = Math.min(100, played * 5 + won * 3);
        const you = { played, won, losses: played - won, reputation,
          reputationTier: reputation >= 60 ? "LOCAL" as const : reputation >= 30 ? "KNOWN" as const : reputation >= 10 ? "REGULAR" as const : "NEW" as const };
        const historic = (await tx.execute(sql`SELECT rubbers FROM career_club_fixtures WHERE career_save_id=${root.id} AND status='COMPLETED'`)).rows;
        let appearances = 0, wins = 0;
        for (const row of historic) for (const match of (Array.isArray(row.rubbers) ? row.rubbers as Rubber[] : [])) {
          if (match.humanMatch?.status === "PLAYED") { appearances++; if (match.humanMatch.won) wins++; }
        }
        const localReputation = Math.min(100, appearances * 5 + wins * 3);
        const localProfile = { appearances, wins, reputation: localReputation,
          reputationTier: localReputation >= 60 ? "LOCAL" as const : localReputation >= 30 ? "KNOWN" as const : localReputation >= 10 ? "REGULAR" as const : "NEW" as const };
        return { ...base, club: clubNameOf(lg.home), nation: lg.nation, available: true, joined, liveMatchId, next, last,
          table: leagueTable(lg.clubs, results.filter(r => r.round < 15)).map(t => ({ ...t, name: clubNameOf(t.club), you: t.club === lg.home })), you, localProfile };
      });
    },
    async join(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const lg = await league(tx, root);
        if (!lg || lg.clubs.length < 2) throw new CareerError(409, "There is no local team league for this home club");
        if (Number(root.current_week) > TEAMS.lastWeek) throw new CareerError(409, "The club team season has finished; join again next season");
        await tx.execute(sql`INSERT INTO career_club_team_memberships(career_save_id,season,club_key,joined_week)
          VALUES (${root.id},${Number(root.current_season)},${lg.home},${Number(root.current_week)}) ON CONFLICT(career_save_id,season) DO NOTHING`);
        return { joined: true, season: Number(root.current_season), club: clubNameOf(lg.home) };
      });
    },
    async liveMatch(actor: CareerActor, saveId: string, matchId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const found = await findHumanTeamMatch(tx, root.id, matchId);
        return teamSession(root.id, tx, found.fixture, found.rubber);
      });
    },
    async darts(actor: CareerActor, saveId: string, matchId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(400) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const found = await findHumanTeamMatch(tx, root.id, matchId);
        const { fixture, rubber } = found;
        const m = rubber.humanMatch!;
        if (m.status === "LIVE") {
          let state;
          try { state = replay(TEAM_FORMAT, 0, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
          m.darts = darts;
          if (state.complete) {
            m.status = "PLAYED"; m.won = state.winner === 0;
            rubber.homeLegs = m.homeSide ? state.totalLegs[0] : state.totalLegs[1];
            rubber.awayLegs = m.homeSide ? state.totalLegs[1] : state.totalLegs[0];
            fixture.home_score = rubbers(fixture).filter(r => r.homeLegs > r.awayLegs).length;
            fixture.away_score = rubbers(fixture).filter(r => r.awayLegs > r.homeLegs).length;
            fixture.you_played = true; fixture.status = "COMPLETED";
          }
          await tx.execute(sql`UPDATE career_club_fixtures SET rubbers=${JSON.stringify(rubbers(fixture))}::jsonb,
            home_score=${Number(fixture.home_score)},away_score=${Number(fixture.away_score)},you_played=${fixture.you_played === true},
            status=${String(fixture.status)} WHERE career_save_id=${root.id} AND season=${Number(fixture.season)} AND round=${Number(fixture.round)} AND home_key=${String(fixture.home_key)}`);
        }
        const updated = await findHumanTeamMatch(tx, root.id, matchId);
        return teamSession(root.id, tx, updated.fixture, updated.rubber);
      });
    },
  };
}

const clubNameOf = (key: string) => { const l = LOCALITIES.find(x => x.key === key); return l ? clubName(l) : key; };
