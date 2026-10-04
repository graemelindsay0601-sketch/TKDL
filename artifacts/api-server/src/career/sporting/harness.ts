import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../database.ts";
import { createCareerService } from "../service.ts";
import { lockRoot } from "../world/service.ts";
import { HUMAN, type RootRow } from "../calendar/engine.ts";
import { zoneOf } from "../calendar/geography.ts";
import { Q_SCHOOL_PATHWAYS } from "../calendar/eligibility.ts";
import { post } from "../finance/ledger.ts";
import { createCareerSportingService } from "./service.ts";

/**
 * A5 multi-season sporting validation harness (dev only). Plays a deterministic
 * Career through the real A1–A5 services (A2 simulation, A3 events/results, A4
 * prize facts, A5 rankings/cards/Q-School). Every NPC outcome comes from A2/A3.
 * HARNESS FIXTURES (labelled): the human's match results (the live-play boundary,
 * decided by a fixed hash: ~50% wins) and one starting funding adjustment.
 * Nothing in A5 is forced: storylines are measured, never scripted.
 */
const q = async (db: CareerDatabase, query: ReturnType<typeof sql>) => (await db.execute(query)).rows;
const humanWins = (matchId: string) => parseInt(createHash("sha256").update(`a5:${matchId}`).digest("hex").slice(0, 2), 16) % 2 === 0;
const UK = new Set(["UK_IRELAND"]), EU = new Set(["EUROPE"]);
const share = (rows: { nationality: string; n: number }[]) => {
  const total = rows.reduce((t, r) => t + r.n, 0) || 1;
  const z = (set: Set<string>) => rows.filter(r => set.has(zoneOf(r.nationality))).reduce((t, r) => t + r.n, 0);
  const uk = z(UK), eu = z(EU);
  return { total, byNationality: Object.fromEntries(rows.map(r => [r.nationality, r.n])), ukIrelandShare: +(uk / total).toFixed(3), europeShare: +(eu / total).toFixed(3), restOfWorldShare: +((total - uk - eu) / total).toFixed(3) };
};

export async function runSportingHarness(db: CareerDatabase, seed: string, options: { seasons?: number } = {}) {
  const started = performance.now();
  const seasons = options.seasons ?? 10;
  const saves = createCareerService(db);
  const career = createCareerSportingService(db);
  const actor = { playerId: 1 };
  const save = await saves.create(1, { slot: 1 });
  const S = save.id;
  await db.execute(sql`UPDATE career_saves SET world_seed = ${seed} WHERE id = ${S}`);
  await career.initialize(actor, S);
  await db.transaction(async tx => post(tx, await lockRoot(tx, actor, S) as RootRow, { operationKey: "adjustment:harness-funding", category: "ADJUSTMENT",
    amountPence: 1_000_000, headline: "START", reason: "HARNESS FIXTURE funding" }));
  let humanMatches = 0, humanEntries = 0, op = 0, season1Hash = "";
  const seasonTimes: number[] = [];
  let seasonStart = performance.now();
  for (let guard = 0; guard < seasons * 120; guard++) {
    const root = await saves.read(1, S);
    // Stop one played week into season N+1, so the season-start publication (retirements removed) is included.
    if (root.currentSeason > seasons && root.currentWeek >= 2) break;
    // Entry policy (deterministic): no card -> UK & Ireland Q-School, Final Stage when entitled, Challenger when entitled;
    // card -> Pro Circuit and European Series events in the next two weeks. Denials (funds, eligibility) are accepted as outcomes.
    const card = (await career.tourCard(actor, S)).holdsCard;
    const keys = card ? ["pro-circuit-championship", "european-dart-series"]
      : ["q-school-first-uk_ireland-d1", "q-school-final-uk_ireland-d1", "challenger-event"];
    const candidates = await q(db, sql`SELECT id FROM career_event_instances WHERE career_save_id = ${S} AND season = ${root.currentSeason} AND status = 'REGISTRATION_OPEN'
      AND start_week BETWEEN ${root.currentWeek} AND ${root.currentWeek + 2} AND definition_key IN (${sql.join(keys.map(k => sql`${k}`), sql`, `)})
      AND NOT EXISTS (SELECT 1 FROM career_event_entries e WHERE e.career_save_id = ${S} AND e.event_id = career_event_instances.id AND e.participant_key = ${HUMAN}) ORDER BY start_day`);
    for (const c of candidates) if ((await career.calendar.enter(actor, S, { eventId: String(c.id) })).entered) humanEntries++;
    const r = await career.calendar.advance(actor, S, { operationKey: `a5-harness-${op++}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail!.matchIds) {
      const m = (await q(db, sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id = ${S} AND id = ${matchId}`))[0];
      const target = (Number(m.best_of) + 1) / 2, win = humanWins(matchId);
      await career.calendar.recordHumanMatchResult(actor, S, { matchId, humanLegs: win ? target : Math.floor(target / 2), opponentLegs: win ? Math.floor(target / 2) : target, humanThrewFirst: win });
      humanMatches++;
    }
    const now = await saves.read(1, S);
    if (now.currentSeason !== root.currentSeason) {
      seasonTimes.push(Math.round((performance.now() - seasonStart) / 1000)); seasonStart = performance.now();
      if (root.currentSeason === 1) season1Hash = await historyHash(db, S, 1);
    }
  }
  return { seed, seasons, runtimeSeconds: Math.round((performance.now() - started) / 1000), secondsPerSeason: seasonTimes, ...(await report(db, S, seasons, season1Hash, { humanMatches, humanEntries })) };
}

async function historyHash(db: CareerDatabase, S: string, season: number) {
  const r = await q(db, sql`SELECT snapshot_id, participant_key, position, value_pence, movement, career_high_position FROM career_ranking_snapshot_rows WHERE career_save_id = ${S} AND season = ${season} ORDER BY 1, 3`);
  return createHash("sha256").update(JSON.stringify(r)).digest("hex");
}

async function report(db: CareerDatabase, S: string, seasons: number, season1Hash: string, human: { humanMatches: number; humanEntries: number }) {
  const n = async (query: ReturnType<typeof sql>) => Number((await q(db, query))[0]?.n ?? 0);
  const seasonList = Array.from({ length: seasons }, (_, i) => i + 1);
  // ---------------------------------------------------------------- ranking integrity
  const latest = await q(db, sql`SELECT DISTINCT ON (list_key) list_key, id, season, week, participant_count, sequence FROM career_ranking_snapshots WHERE career_save_id = ${S} ORDER BY list_key, sequence DESC`);
  const proWorld = latest.find(l => l.list_key === "pro-world")!;
  const top = async (limit: number) => (await q(db, sql`SELECT r.position, r.participant_key, r.value_pence, p.first_name || ' ' || p.surname AS name, p.nationality, p.age
    FROM career_ranking_snapshot_rows r LEFT JOIN career_world_players p ON p.career_save_id = r.career_save_id AND p.id = r.npc_id
    WHERE r.career_save_id = ${S} AND r.snapshot_id = ${proWorld.id} AND r.position <= ${limit} ORDER BY r.position`))
    .map(r => ({ position: r.position, name: r.participant_key === HUMAN ? "HUMAN" : r.name, nationality: r.participant_key === HUMAN ? "GBR" : r.nationality, valuePence: Number(r.value_pence), age: r.age ?? null }));
  const leaders = await q(db, sql`SELECT s.season, s.week, s.sequence, r.participant_key, p.first_name || ' ' || p.surname AS name, p.nationality FROM career_ranking_snapshots s
    JOIN career_ranking_snapshot_rows r ON r.career_save_id = s.career_save_id AND r.snapshot_id = s.id AND r.position = 1
    LEFT JOIN career_world_players p ON p.career_save_id = r.career_save_id AND p.id = r.npc_id WHERE s.career_save_id = ${S} AND s.list_key = 'pro-world' ORDER BY s.sequence`);
  const reigns: { name: string; nationality: string; from: string; snapshots: number }[] = [];
  for (const l of leaders) {
    const last = reigns[reigns.length - 1];
    const name = l.participant_key === HUMAN ? "HUMAN" : String(l.name);
    if (last && last.name === name) last.snapshots++; else reigns.push({ name, nationality: String(l.nationality ?? "GBR"), from: `S${l.season}W${l.week}`, snapshots: 1 });
  }
  const seasonEnd = async (list: string, participant: string) => Object.fromEntries((await q(db, sql`SELECT s.season, r.position FROM career_ranking_snapshots s
    LEFT JOIN career_ranking_snapshot_rows r ON r.career_save_id = s.career_save_id AND r.snapshot_id = s.id AND r.participant_key = ${participant}
    WHERE s.career_save_id = ${S} AND s.list_key = ${list} AND s.sequence = (SELECT MAX(sequence) FROM career_ranking_snapshots x WHERE x.career_save_id = s.career_save_id AND x.list_key = s.list_key AND x.season = s.season)
    ORDER BY s.season`)).map(r => [`S${r.season}`, r.position ?? null]));
  const finalP = (Number(proWorld.season) - 1) * 52 + Number(proWorld.week);
  const unexplained = await n(sql`SELECT COUNT(*)::int n FROM career_ranking_snapshot_rows r JOIN career_ranking_snapshots s ON s.career_save_id = r.career_save_id AND s.id = r.snapshot_id
    WHERE r.career_save_id = ${S} AND s.id IN (${sql.join(latest.map(l => sql`${l.id}::uuid`), sql`, `)}) AND r.value_pence <> (SELECT COALESCE(SUM(c.amount_pence),0) FROM career_ranking_contributions c
      WHERE c.career_save_id = r.career_save_id AND c.list_key = r.list_key AND c.participant_key = r.participant_key AND c.completion_index <= s.publication_index AND c.expires_index > s.publication_index)`);
  const snapshotIntegrity = await n(sql`SELECT COUNT(*)::int n FROM career_ranking_snapshots s WHERE s.career_save_id = ${S} AND (s.participant_count <> (SELECT COUNT(*) FROM career_ranking_snapshot_rows r
    WHERE r.career_save_id = s.career_save_id AND r.snapshot_id = s.id) OR s.participant_count <> COALESCE((SELECT MAX(position) FROM career_ranking_snapshot_rows r WHERE r.career_save_id = s.career_save_id AND r.snapshot_id = s.id), 0))`);
  // Biggest climbers / fallers between consecutive season-end World Rankings (emergent movement).
  const ends = await q(db, sql`SELECT s.season, r.participant_key, r.position, p.first_name || ' ' || p.surname AS name FROM career_ranking_snapshots s
    JOIN career_ranking_snapshot_rows r ON r.career_save_id = s.career_save_id AND r.snapshot_id = s.id LEFT JOIN career_world_players p ON p.career_save_id = r.career_save_id AND p.id = r.npc_id
    WHERE s.career_save_id = ${S} AND s.list_key = 'pro-world' AND s.sequence = (SELECT MAX(sequence) FROM career_ranking_snapshots x WHERE x.career_save_id = s.career_save_id AND x.list_key = 'pro-world' AND x.season = s.season)`);
  const moves: { name: string; from: number; to: number; seasons: string }[] = [];
  for (const e of ends) { const prev = ends.find(x => x.participant_key === e.participant_key && Number(x.season) === Number(e.season) - 1); if (prev) moves.push({ name: String(e.name ?? "HUMAN"), from: Number(prev.position), to: Number(e.position), seasons: `S${prev.season}->S${e.season}` }); }
  moves.sort((a, b) => (b.from - b.to) - (a.from - a.to));
  // ---------------------------------------------------------------- Tour Cards
  const cardsPerSeason = [];
  for (const s of seasonList) cardsPerSeason.push({ season: s,
    holders: await n(sql`SELECT COUNT(DISTINCT participant_key)::int n FROM career_tour_cards WHERE career_save_id = ${S} AND start_season <= ${s} AND end_season >= ${s} AND (status = 'ACTIVE' OR ended_season >= ${s})`),
    awarded: Object.fromEntries((await q(db, sql`SELECT source, COUNT(*)::int n FROM career_tour_cards WHERE career_save_id = ${S} AND awarded_season = ${s} GROUP BY 1`)).map(r => [r.source, r.n])),
    ended: Object.fromEntries((await q(db, sql`SELECT status || ':' || end_reason AS k, COUNT(*)::int n FROM career_tour_cards WHERE career_save_id = ${S} AND ended_season = ${s} GROUP BY 1`)).map(r => [r.k, r.n])) });
  const regained = await n(sql`SELECT COUNT(*)::int n FROM career_sporting_milestones WHERE career_save_id = ${S} AND kind = 'TOUR_CARD_REGAINED'`);
  const overlapping = await n(sql`SELECT COUNT(*)::int n FROM career_tour_cards a JOIN career_tour_cards b ON a.career_save_id = b.career_save_id AND a.participant_key = b.participant_key AND a.id < b.id
    WHERE a.career_save_id = ${S} AND a.start_season <= COALESCE(b.ended_season, b.end_season) AND b.start_season <= COALESCE(a.ended_season, a.end_season)
      AND NOT (a.ended_season IS NOT NULL AND a.ended_season < b.start_season)`);
  const humanCards = (await q(db, sql`SELECT source, status, end_reason, start_season, end_season, awarded_week FROM career_tour_cards WHERE career_save_id = ${S} AND participant_key = ${HUMAN} ORDER BY created_at`));
  const starsLost = await q(db, sql`SELECT c.ended_season AS season, p.first_name || ' ' || p.surname AS name, rp.career_high_position AS career_high FROM career_tour_cards c
    JOIN career_ranking_participants rp ON rp.career_save_id = c.career_save_id AND rp.participant_key = c.participant_key AND rp.list_key = 'pro-world'
    LEFT JOIN career_world_players p ON p.career_save_id = c.career_save_id AND p.id = c.npc_id WHERE c.career_save_id = ${S} AND c.status = 'LOST' AND rp.career_high_position <= 16 ORDER BY 1`);
  const newPros = await n(sql`SELECT COUNT(DISTINCT c.participant_key)::int n FROM career_tour_cards c WHERE c.career_save_id = ${S} AND c.source <> 'FOUNDING'
    AND NOT EXISTS (SELECT 1 FROM career_tour_cards f WHERE f.career_save_id = c.career_save_id AND f.participant_key = c.participant_key AND f.source = 'FOUNDING')`);
  const generatedPros = await n(sql`SELECT COUNT(DISTINCT c.participant_key)::int n FROM career_tour_cards c JOIN career_world_players p ON p.career_save_id = c.career_save_id AND p.id = c.npc_id
    WHERE c.career_save_id = ${S} AND p.created_season > 1`);
  // ---------------------------------------------------------------- Q-School
  const qSchool = [];
  for (const s of seasonList) for (const pathway of ["UK_IRELAND", "EUROPE"]) {
    const alloc = (await q(db, sql`SELECT * FROM career_qschool_allocations WHERE career_save_id = ${S} AND season = ${s} AND pathway = ${pathway}`))[0];
    const standings = (alloc?.standings ?? []) as { points: number; carded: boolean; tieKey: string }[];
    const lastCarded = [...standings].reverse().find(x => x.carded);
    const firstOut = standings.find(x => !x.carded && x.points >= 1);
    qSchool.push({ season: s, pathway,
      firstStageParticipants: await n(sql`SELECT COUNT(DISTINCT participant_key)::int n FROM career_qschool_results WHERE career_save_id = ${S} AND season = ${s} AND pathway = ${pathway} AND stage = 'FIRST'`),
      finalStageParticipants: await n(sql`SELECT COUNT(DISTINCT participant_key)::int n FROM career_qschool_results WHERE career_save_id = ${S} AND season = ${s} AND pathway = ${pathway} AND stage = 'FINAL'`),
      directWinners: alloc ? Number(alloc.direct_cards) : null, unusedDirectRolledIntoOoM: alloc ? Number(alloc.unused_direct_cards) : null, orderOfMeritCards: alloc ? Number(alloc.order_of_merit_cards) : null,
      cardLineTieBrokenDeterministically: !!(lastCarded && firstOut && lastCarded.points === firstOut.points) });
  }
  const zoneViolations = (await q(db, sql`SELECT q.pathway, p.nationality FROM career_qschool_results q JOIN career_world_players p ON p.career_save_id = q.career_save_id AND p.id = q.npc_id
    WHERE q.career_save_id = ${S}`)).filter(r => !(Q_SCHOOL_PATHWAYS[String(r.pathway) as "UK_IRELAND"].zones as string[]).includes(zoneOf(String(r.nationality)))).length;
  // ---------------------------------------------------------------- international
  const nat = async (query: ReturnType<typeof sql>) => (await q(db, query)).map(r => ({ nationality: String(r.nationality), n: Number(r.n) }));
  const rankedNat = (limit: number) => nat(sql`SELECT COALESCE(p.nationality, 'GBR') AS nationality, COUNT(*)::int n FROM career_ranking_snapshot_rows r LEFT JOIN career_world_players p ON p.career_save_id = r.career_save_id AND p.id = r.npc_id
    WHERE r.career_save_id = ${S} AND r.snapshot_id = ${proWorld.id} AND r.position <= ${limit} GROUP BY 1 ORDER BY 2 DESC`);
  const finalSeason = seasons + 1;
  const holdersNat = await nat(sql`SELECT COALESCE(p.nationality, 'GBR') AS nationality, COUNT(*)::int n FROM career_tour_cards c LEFT JOIN career_world_players p ON p.career_save_id = c.career_save_id AND p.id = c.npc_id
    WHERE c.career_save_id = ${S} AND c.status = 'ACTIVE' GROUP BY 1 ORDER BY 2 DESC`);
  const populationNat = await nat(sql`SELECT nationality, COUNT(*)::int n FROM career_world_players WHERE career_save_id = ${S} AND status = 'ACTIVE' GROUP BY 1 ORDER BY 2 DESC`);
  // ---------------------------------------------------------------- sporting integrity
  const sources = ["config", "rankings", "cards", "qschool", "engine", "state", "service"].map(f => readFileSync(new URL(`./${f}.ts`, import.meta.url), "utf8")).join("\n");
  const integrity = {
    noXpOrUnlockScore: !/\bxp\w*\s*[:=(]|careerXp|xpLevel|unlockScore|tierUnlock/i.test(sources),
    noDifficultyInput: !/root\.difficulty|CAREER_DIFFICULTY/.test(sources),
    humanContributionsMatchPrizeTables: await n(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions c JOIN career_prize_awards a ON a.career_save_id = c.career_save_id AND a.event_id = c.event_id
      AND a.participant_key = c.participant_key WHERE c.career_save_id = ${S} AND c.amount_pence <> a.ranking_eligible_pence`) === 0,
    rankingFromNonRankingEvents: await n(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions c JOIN career_event_instances i ON i.career_save_id = c.career_save_id AND i.id = c.event_id
      WHERE c.career_save_id = ${S} AND i.classification <> 'RANKING'`),
    rankingFromSpecials: await n(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions c JOIN career_event_instances i ON i.career_save_id = c.career_save_id AND i.id = c.event_id
      WHERE c.career_save_id = ${S} AND i.circuit = 'SPECIAL'`),
    contributionsWithoutPrizeTable: await n(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions c WHERE c.career_save_id = ${S}
      AND NOT EXISTS (SELECT 1 FROM career_event_prize_tables t WHERE t.career_save_id = c.career_save_id AND t.event_id = c.event_id AND t.ranking_eligible)`),
    rankingFromSponsorOrBalance: "structurally impossible: contributions reference A3 results + A4 prize tables only (no ledger/balance column in A5)",
    unexplainedRankingTotals: unexplained,
    retiredActiveCompetitors: await n(sql`SELECT COUNT(*)::int n FROM career_ranking_snapshot_rows r JOIN career_world_players p ON p.career_save_id = r.career_save_id AND p.id = r.npc_id
      WHERE r.career_save_id = ${S} AND r.snapshot_id IN (${sql.join(latest.map(l => sql`${l.id}::uuid`), sql`, `)}) AND p.status = 'RETIRED'`),
    retiredWithLiveCard: await n(sql`SELECT COUNT(*)::int n FROM career_tour_cards c JOIN career_world_players p ON p.career_save_id = c.career_save_id AND p.id = c.npc_id
      WHERE c.career_save_id = ${S} AND c.status = 'ACTIVE' AND p.status = 'RETIRED'`),
    duplicateLiveCards: await n(sql`SELECT COUNT(*)::int n FROM (SELECT participant_key FROM career_tour_cards WHERE career_save_id = ${S} AND status = 'ACTIVE' GROUP BY 1 HAVING COUNT(*) > 1) d`),
    overlappingCardTerms: overlapping,
    duplicateMilestones: await n(sql`SELECT COUNT(*)::int n FROM (SELECT operation_key FROM career_sporting_milestones WHERE career_save_id = ${S} GROUP BY 1 HAVING COUNT(*) > 1) d`),
    duplicateContributions: await n(sql`SELECT COUNT(*)::int n FROM (SELECT list_key, event_id, participant_key FROM career_ranking_contributions WHERE career_save_id = ${S} GROUP BY 1,2,3 HAVING COUNT(*) > 1) d`),
    duplicateQSchoolAwards: await n(sql`SELECT COUNT(*)::int n FROM (SELECT season, participant_key FROM career_qschool_card_awards WHERE career_save_id = ${S} GROUP BY 1,2 HAVING COUNT(*) > 1) d`),
    brokenEntitlements: await n(sql`SELECT COUNT(*)::int n FROM career_qualification_entitlements e WHERE e.career_save_id = ${S} AND e.recipient_kind = 'NPC'
      AND NOT EXISTS (SELECT 1 FROM career_world_players p WHERE p.career_save_id = e.career_save_id AND p.id = e.npc_id)`),
    proCircuitEntrantsWithoutCard: await n(sql`SELECT COUNT(*)::int n FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
      WHERE e.career_save_id = ${S} AND i.circuit = 'PRO_CIRCUIT' AND e.status = 'CONFIRMED' AND NOT EXISTS (SELECT 1 FROM career_tour_cards c WHERE c.career_save_id = e.career_save_id
        AND c.participant_key = e.participant_key AND c.start_season <= i.season AND c.end_season >= i.season)`),
    qSchoolPathwayZoneViolations: zoneViolations,
    season1HistoryUnchanged: season1Hash === await historyHash(db, S, 1),
  };
  return {
    rankingIntegrity: {
      participantsByList: Object.fromEntries(latest.map(l => [l.list_key, { participants: l.participant_count, publishedAt: `S${l.season}W${l.week}`, snapshots: l.sequence }])),
      worldTop10: await top(10), worldTop32: await top(32),
      worldNumberOneReigns: reigns, numberOneChanges: Math.max(0, reigns.length - 1), distinctWorldNumberOnes: new Set(reigns.map(r => r.name)).size,
      contributionsByList: Object.fromEntries((await q(db, sql`SELECT list_key, COUNT(*)::int n FROM career_ranking_contributions WHERE career_save_id = ${S} GROUP BY 1`)).map(r => [r.list_key, r.n])),
      expiredContributions: await n(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions WHERE career_save_id = ${S} AND expires_index <= ${finalP}`),
      snapshotsWithIntegrityErrors: snapshotIntegrity, unexplainedTotals: unexplained,
      humanSeasonEnd: { worldRanking: await seasonEnd("pro-world", HUMAN), challenger: await seasonEnd("challenger", HUMAN), amateur: await seasonEnd("amateur", HUMAN) },
      biggestClimbers: moves.slice(0, 5), biggestFallers: moves.slice(-5).reverse(),
    },
    tourCards: { perSeason: cardsPerSeason, regained, overlappingInvalid: overlapping, humanCardHistory: humanCards, formerTop16WhoLostCards: starsLost.length, formerTop16LossExamples: starsLost.slice(0, 5),
      newProfessionalsSinceFounding: newPros, cardsWonByPlayersGeneratedAfterSeason1: generatedPros },
    qSchool: { perSeason: qSchool, pathwayZoneViolations: zoneViolations,
      humanQSchool: await q(db, sql`SELECT season, pathway, stage, COUNT(*)::int days, SUM(points)::int points, MIN(finishing_position)::int best FROM career_qschool_results WHERE career_save_id = ${S} AND participant_key = ${HUMAN} GROUP BY 1,2,3 ORDER BY 1,3`) },
    international: { population: share(populationNat), worldRanked: share(await rankedNat(100000)), worldTop32: share(await rankedNat(32)), worldTop10: share(await rankedNat(10)),
      currentCardHolders: share(holdersNat), note: `measured at season ${finalSeason} start; no target is enforced in code` },
    milestones: Object.fromEntries((await q(db, sql`SELECT kind, COUNT(*)::int n FROM career_sporting_milestones WHERE career_save_id = ${S} GROUP BY 1 ORDER BY 1`)).map(r => [r.kind, r.n])),
    humanMilestones: (await q(db, sql`SELECT season, week, kind, list_key FROM career_sporting_milestones WHERE career_save_id = ${S} AND participant_key = ${HUMAN} ORDER BY season, week, created_at`)).map(r => `S${r.season}W${r.week} ${r.kind}${r.list_key ? ` (${r.list_key})` : ""}`),
    human: { ...human, retirements: await n(sql`SELECT COUNT(*)::int n FROM career_world_players WHERE career_save_id = ${S} AND status = 'RETIRED'`) },
    sportingIntegrity: integrity,
  };
}
