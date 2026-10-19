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

type Root = { id: string; world_seed: string; world_generation_version: number | string; difficulty: string; current_season: number | string; current_week: number | string;
  settings_snapshot?: unknown; player_id?: number };
type Rubber = { home: string | null; away: string | null; homeLegs: number; awayLegs: number; averages: [number, number] | null };
const HUMAN = "HUMAN";

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

/**
 * Play this week's team nights (idempotent: a fixture is played once). Each side is its six strongest members free that
 * night (you always get a game when you're free): anyone booked into an event that day sits it out, you included.
 */
export async function playTeamNights(tx: CareerExecutor, root: Root, season: number, week: number) {
  if (!(await tx.execute(sql`SELECT to_regclass('career_club_fixtures') IS NOT NULL AS ok`)).rows[0]?.ok) return;
  const lg = await league(tx, root);
  if (!lg) return;
  const prior = (await tx.execute(sql`SELECT round,week,home_key,away_key,home_score,away_score FROM career_club_fixtures WHERE career_save_id=${root.id} AND season=${season}`)).rows;
  const results: FixtureResult[] = prior.map(r => ({ round: Number(r.round), week: Number(r.week), home: String(r.home_key), away: String(r.away_key), homeScore: Number(r.home_score), awayScore: Number(r.away_score) }));
  const fixtures = [...fixturesFor(lg.clubs), ...playoffFixtures(lg.clubs, results)]
    .filter(f => f.round >= 15 ? f.week <= week : f.week === week);
  if (!fixtures.length) return;
  const done = new Set(prior.filter(r => Number(r.week) === week).map(r => `${r.round}:${r.home_key}`));
  const todo = fixtures.filter(f => !done.has(`${f.round}:${f.home}`));
  if (!todo.length) return;
  const day = teamNightDay(week);
  const busy = new Set((await tx.execute(sql`SELECT DISTINCT participant_key FROM career_participant_bookings WHERE career_save_id=${root.id} AND season=${season} AND day=${day}`)).rows
    .map(r => String(r.participant_key)));
  const npcs = await loadNpcs(tx, root.id, { activeOnly: true, nationality: lg.country });
  const clubOf = (n: Npc) => localityByRegion(n.homeRegion)?.key ?? null;
  const level = (n: Npc) => (n.ability.scoring + n.ability.finishing) / 2;
  const form = await loadHumanForm(tx, root);
  const offset = CAREER_DIFFICULTY_CONFIG[root.difficulty as keyof typeof CAREER_DIFFICULTY_CONFIG]?.abilityOffset ?? 0;
  const youLevel = attributeForAverage(form.skillAverage) - offset;
  const youFree = await humanFree(tx, root.id, season, day);
  const side = (club: string): (string)[] => {
    const members = npcs.filter(n => clubOf(n) === club && !busy.has(n.id)).map(n => ({ key: n.id, level: level(n) }))
      .sort((a, b) => b.level - a.level || a.key.localeCompare(b.key));
    // You always get a game when you're free (it's your career); the rest of the side is the strongest free members, then in order of strength.
    const picked = club === lg.home && youFree ? [{ key: HUMAN, level: youLevel }, ...members.slice(0, TEAMS.singles - 1)] : members.slice(0, TEAMS.singles);
    return picked.sort((a, b) => b.level - a.level || a.key.localeCompare(b.key)).map(m => m.key);
  };
  const byId = new Map(npcs.map(n => [n.id, n]));
  for (const f of todo) {
    const home = side(f.home), away = side(f.away);
    const rubbers: Rubber[] = [];
    for (let i = 0; i < TEAMS.singles; i++) {
      const a = home[i] ?? null, b = away[i] ?? null;
      // An empty place is a walkover: the side that turned up wins the singles.
      if (!a || !b) { rubbers.push({ home: a, away: b, homeLegs: a ? 3 : 0, awayLegs: b ? 3 : 0, averages: null }); continue; }
      const npcA = a === HUMAN ? null : byId.get(a)!, npcB = b === HUMAN ? null : byId.get(b)!;
      const pa = npcA ?? humanSimulationPlayer(root, npcB!, form), pb = npcB ?? humanSimulationPlayer(root, npcA!, form);
      const key = `team-night:${season}:${f.round}:${f.home}:${i}`;
      const bull = simulateBullUp(pa, pb, root.world_seed, key);
      const r = simulateNpcMatch({ players: [pa, pb], seed: root.world_seed, generationVersion: Number(root.world_generation_version), matchKey: key,
        difficulty: root.difficulty as never, context: { category: "local", roundImportance: 0.5, elimination: false }, format: { bestOf: TEAMS.bestOf, firstThrow: bull.firstThrow } });
      rubbers.push({ home: a, away: b, homeLegs: r.stats[0].legsWon, awayLegs: r.stats[1].legsWon,
        averages: [Math.round(r.stats[0].average * 10) / 10, Math.round(r.stats[1].average * 10) / 10] });
    }
    const homeScore = rubbers.filter(r => r.homeLegs > r.awayLegs).length, awayScore = rubbers.filter(r => r.awayLegs > r.homeLegs).length;
    const youPlayed = rubbers.some(r => r.home === HUMAN || r.away === HUMAN);
    const youWereNeeded = f.home === lg.home || f.away === lg.home;
    await tx.execute(sql`INSERT INTO career_club_fixtures (career_save_id,season,round,week,home_key,away_key,home_score,away_score,rubbers,you_played,you_unavailable)
      VALUES (${root.id},${season},${f.round},${week},${f.home},${f.away},${homeScore},${awayScore},${JSON.stringify(rubbers)}::jsonb,${youPlayed},${youWereNeeded && !youFree})
      ON CONFLICT DO NOTHING`);
  }
}

export type TeamNightsView = {
  season: number; week: number; club: string | null; nation: string | null; available: boolean;
  next: { week: number; home: boolean; opponent: string; youFree: boolean; clash: string | null } | null;
  last: { week: number; home: boolean; opponent: string; us: number; them: number; youPlayed: boolean; youUnavailable: boolean;
    singles: { us: string; them: string; usLegs: number; themLegs: number; you: boolean }[] } | null;
  table: { club: string; name: string; played: number; won: number; drawn: number; lost: number; singlesFor: number; singlesAgainst: number; points: number; position: number; you: boolean }[];
  you: { played: number; won: number };
  firstWeek: number; lastWeek: number;
};

export function createCareerTeamNightsService(database: CareerDatabase) {
  return {
    async read(actor: CareerActor, saveId: string): Promise<TeamNightsView> {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const base = { season, week, firstWeek: TEAMS.firstWeek, lastWeek: TEAMS.lastWeek };
        const lg = await league(tx, root);
        if (!lg || lg.clubs.length < 2) return { ...base, club: lg ? clubNameOf(lg.home) : null, nation: lg?.nation ?? null, available: false, next: null, last: null, table: [], you: { played: 0, won: 0 } };
        const rows = (await tx.execute(sql`SELECT * FROM career_club_fixtures WHERE career_save_id=${root.id} AND season=${season} ORDER BY week, round`)).rows;
        const results: FixtureResult[] = rows.map(r => ({ round: Number(r.round), week: Number(r.week), home: String(r.home_key), away: String(r.away_key), homeScore: Number(r.home_score), awayScore: Number(r.away_score) }));
        const postseason = playoffFixtures(lg.clubs, results);
        const mine = [...fixturesFor(lg.clubs), ...postseason].filter(f => f.home === lg.home || f.away === lg.home);
        const played = new Set(results.map(r => `${r.round}:${r.home}`));
        const upcoming = mine.find(f => (f.week >= week || f.round >= 15) && !played.has(`${f.round}:${f.home}`));
        let next: TeamNightsView["next"] = null;
        if (upcoming) {
          const displayWeek = Math.max(upcoming.week, week);
          const day = teamNightDay(displayWeek);
          const clash = (await tx.execute(sql`SELECT i.name FROM career_participant_bookings b JOIN career_event_instances i ON i.career_save_id=b.career_save_id AND i.id=b.event_id
              WHERE b.career_save_id=${root.id} AND b.season=${season} AND b.day=${day} AND b.participant_key=${HUMAN}
            UNION ALL SELECT title FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season} AND day=${day} AND status='ACCEPTED' LIMIT 1`)).rows[0];
          next = { week: displayWeek, home: upcoming.home === lg.home, opponent: clubNameOf(upcoming.home === lg.home ? upcoming.away : upcoming.home),
            youFree: !clash, clash: clash ? String(clash.name) : null };
        }
        const lastRow = [...rows].reverse().find(r => r.home_key === lg.home || r.away_key === lg.home);
        let last: TeamNightsView["last"] = null;
        if (lastRow) {
          const home = lastRow.home_key === lg.home, rubbers = lastRow.rubbers as Rubber[];
          const keys = [...new Set(rubbers.flatMap(r => [r.home, r.away]).filter((k): k is string => !!k && k !== HUMAN))];
          const names = new Map(keys.length ? (await tx.execute(sql`SELECT id, first_name, surname FROM career_world_players WHERE career_save_id=${root.id}
            AND id IN (${sql.join(keys.map(k => sql`${k}::uuid`), sql`,`)})`)).rows.map(p => [String(p.id), `${p.first_name} ${p.surname}`]) : []);
          const name = (k: string | null) => k === HUMAN ? "You" : k ? names.get(k) ?? "Club member" : "Nobody (walkover)";
          last = { week: Number(lastRow.week), home, opponent: clubNameOf(String(home ? lastRow.away_key : lastRow.home_key)),
            us: Number(home ? lastRow.home_score : lastRow.away_score), them: Number(home ? lastRow.away_score : lastRow.home_score),
            youPlayed: lastRow.you_played === true, youUnavailable: lastRow.you_unavailable === true,
            singles: rubbers.map(r => ({ us: name(home ? r.home : r.away), them: name(home ? r.away : r.home), usLegs: home ? r.homeLegs : r.awayLegs, themLegs: home ? r.awayLegs : r.homeLegs,
              you: r.home === HUMAN || r.away === HUMAN })) };
        }
        let you = { played: 0, won: 0 };
        for (const r of rows) for (const x of r.rubbers as Rubber[]) {
          if (x.home === HUMAN) { you.played++; if (x.homeLegs > x.awayLegs) you.won++; }
          if (x.away === HUMAN) { you.played++; if (x.awayLegs > x.homeLegs) you.won++; }
        }
        return { ...base, club: clubNameOf(lg.home), nation: lg.nation, available: true, next, last,
          table: leagueTable(lg.clubs, results.filter(r => r.round < 15)).map(t => ({ ...t, name: clubNameOf(t.club), you: t.club === lg.home })), you };
      });
    },
  };
}

const clubNameOf = (key: string) => { const l = LOCALITIES.find(x => x.key === key); return l ? clubName(l) : key; };
