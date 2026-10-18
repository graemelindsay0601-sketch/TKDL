import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { HUMAN, type RootRow } from "../calendar/engine.ts";
import { zoneOf } from "../calendar/geography.ts";
import { BOOTSTRAP_STATUS } from "../calendar/providers.ts";
import { ageOn, careerWeekDate } from "../identity/age.ts";
import { loadFanFollowing } from "../fans/service.ts";
import { PATHWAY_FOR_ZONE, tourCardRulesFor, tourCardRulesVersionFor } from "./config.ts";
import { DEVELOPMENT_AGE } from "../content/season-v12.ts";
import { CHALLENGER_QUALIFIER_KEY } from "../content/season-v17.ts";
import { PRO_CIRCUIT_ASSOCIATE_TARGET } from "./qschool.ts";
import { CHALLENGER_ACCESS_KEPT } from "./cards.ts";
import { BREAKOUT } from "./breakout.ts";

/**
 * Road to the Tour: every route to a Tour Card and to the World Championship, where the human stands on each and
 * what happens next. Facts only (rankings, entitlements, calendar); the page decides the words.
 */
export async function pathwaysView(tx: CareerExecutor, root: RootRow) {
  const season = Number(root.current_season), week = Number(root.current_week);
  const rules = tourCardRulesFor(tourCardRulesVersionFor(Number(root.event_database_version)));
  const position = async (list: string) => {
    const r = (await tx.execute(sql`SELECT current_position FROM career_ranking_participants WHERE career_save_id = ${root.id} AND list_key = ${list} AND participant_key = ${HUMAN}`)).rows[0];
    return r?.current_position == null ? null : Number(r.current_position);
  };
  const held = new Map((await tx.execute(sql`SELECT target_key, source_kind, source_detail FROM career_qualification_entitlements WHERE career_save_id = ${root.id}
    AND recipient_key = ${HUMAN} AND target_season = ${season} AND status IN ('ACTIVE','CONSUMED')`)).rows.map(r => [String(r.target_key), r.source_detail as Record<string, unknown>]));
  const card = (await tx.execute(sql`SELECT source, start_season, end_season, human_offer FROM career_tour_cards WHERE career_save_id = ${root.id} AND participant_key = ${HUMAN}
    AND status = 'ACTIVE' LIMIT 1`)).rows[0];
  const country = BOOTSTRAP_STATUS.human(root).country, zone = zoneOf(country), pathway = PATHWAY_FOR_ZONE[zone];
  const upcoming = async (keys: readonly string[]) => (await tx.execute(sql`SELECT id, definition_key, name, start_week, status, zone FROM career_event_instances
    WHERE career_save_id = ${root.id} AND season = ${season} AND definition_key IN (${sql.join(keys.map(k => sql`${k}`), sql`, `)})
      AND status NOT IN ('COMPLETED','CANCELLED') AND start_week >= ${week} ORDER BY start_day`)).rows
    .map(r => ({ eventId: String(r.id), key: String(r.definition_key), name: String(r.name), week: Number(r.start_week), status: String(r.status), zone: String(r.zone) }));
  const profile = (await tx.execute(sql`SELECT to_char(date_of_birth, 'YYYY-MM-DD') AS dob, to_char(career_start_date, 'YYYY-MM-DD') AS start FROM career_profiles
    WHERE career_save_id = ${root.id}`)).rows[0];
  const age = profile?.dob && profile.start ? ageOn(String(profile.dob), careerWeekDate(String(profile.start), season, week)) : null;
  const qSchool = await upcoming([`q-school-first-${pathway.toLowerCase()}-d1`]);
  const worldsQualifiers = (await upcoming(["world-championship-qualifier", "amateur-world-qualifier"])).filter(e => e.key !== "world-championship-qualifier" || e.zone === zone);
  const worldsPlace = held.get("world-championship") ?? null;
  const fans = (await loadFanFollowing(tx, root.id)).total;
  const seasonOneOpen = season === 1 && Number(root.event_database_version) >= 6;
  return {
    season, week, age,
    tourCard: card ? { source: String(card.source), startSeason: Number(card.start_season), endSeason: Number(card.end_season),
      offer: (card.human_offer as { status?: string; decideBy?: unknown } | null)?.status === "PENDING" ? { decideBy: (card.human_offer as { decideBy: { season: number; week: number } }).decideBy } : null } : null,
    qSchool: { pathway, firstStageFeePence: 30000, finalStageFeePence: 45000, next: qSchool[0] ?? null, nextSeason: qSchool[0] ? null : season + 1,
      finalStage: held.has(`q-school-final:${pathway}`), proCircuitAssociate: held.has(PRO_CIRCUIT_ASSOCIATE_TARGET) },
    challenger: { access: seasonOneOpen ? "OPEN_SEASON" : held.has("challenger-tour") ? "PASS" : "NONE", position: await position("challenger"),
      cards: rules.challengerCards.count, worldsPlaces: BREAKOUT.rankings.find(r => r.list === "challenger")!.count, keepAccessTop: CHALLENGER_ACCESS_KEPT,
      qSchoolFinalStage: rules.qSchoolExemptions.challengerPositions, qualifiers: await upcoming([CHALLENGER_QUALIFIER_KEY]) },
    development: rules.developmentCards ? { eligible: age !== null && age >= DEVELOPMENT_AGE.minAge && age < DEVELOPMENT_AGE.maxAgeExclusive, minAge: DEVELOPMENT_AGE.minAge,
      maxAgeExclusive: DEVELOPMENT_AGE.maxAgeExclusive, position: await position("development"), cards: rules.developmentCards.count,
      worldsPlaces: BREAKOUT.rankings.find(r => r.list === "development")!.count } : null,
    vault: { position: await position("vault"), worldsPlaces: BREAKOUT.rankings.find(r => r.list === "vault")!.count },
    worlds: { place: worldsPlace ? { route: String(worldsPlace.reason ?? "QUALIFIED") } : null, breakoutWeek: BREAKOUT.fromWeek, qualifiers: worldsQualifiers,
      fans, fanFavouriteFans: BREAKOUT.fanFavouriteFans, worldRanking: await position("pro-world") },
  };
}
