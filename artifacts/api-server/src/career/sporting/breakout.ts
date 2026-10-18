import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { HUMAN, insertEntitlements, type RootRow } from "../calendar/engine.ts";
import { CALENDAR_GENERATION_VERSION } from "../calendar/config.ts";
import { stableUuid } from "../world/random.ts";
import { loadFanFollowing } from "../fans/service.ts";
import { recordMilestones } from "./state.ts";

/**
 * World Championship breakout places, decided once a season after week 44 (before the Worlds qualifiers and while its
 * registration is open). A big year below the Tour earns a Palace debut, the way the real Development Tour and
 * Challenge Tour rankings put unknowns on the World Championship stage:
 *  - the Challenger ranking top two and the Development Tour Order of Merit top two,
 *  - the Vault ranking leader and the Women's Order of Merit leader,
 *  - this season's Amateur World Masters champion,
 *  - a fan favourite: the human, if they have a national following (25,000+ fans) and no other way in.
 * Only players without a Tour Card who are not already in; a ranking place passes down to the next eligible player.
 * Each place is a World Championship entry (the human still enters it) and a milestone for the news.
 */
export const BREAKOUT = Object.freeze({
  fromWeek: 44, untilWeek: 49,
  rankings: [{ list: "challenger", count: 2, route: "CHALLENGER_RANKING" }, { list: "development", count: 2, route: "DEVELOPMENT_RANKING" },
    { list: "vault", count: 1, route: "VAULT_RANKING" }, { list: "women", count: 1, route: "WOMEN_RANKING" }] as const,
  championOf: { definitionKey: "amateur-world-masters", route: "AMATEUR_WORLD_MASTERS" },
  fanFavouriteFans: 25_000,
});
export type BreakoutRoute = typeof BREAKOUT.rankings[number]["route"] | "AMATEUR_WORLD_MASTERS" | "FAN_FAVOURITE";

export async function awardBreakoutPlaces(tx: CareerExecutor, root: RootRow, season: number, week: number) {
  if (week < BREAKOUT.fromWeek || week > BREAKOUT.untilWeek) return [];
  const worlds = (await tx.execute(sql`SELECT id FROM career_event_instances WHERE career_save_id = ${root.id} AND season = ${season}
    AND definition_key = 'world-darts-championship' AND status IN ('SCHEDULED','REGISTRATION_OPEN') LIMIT 1`)).rows[0];
  if (!worlds) return [];
  // Once a season: the places are given the first week anyone is eligible (idempotency keys carry the season).
  const given = (await tx.execute(sql`SELECT 1 FROM career_qualification_entitlements WHERE career_save_id = ${root.id}
    AND idempotency_key LIKE ${`provider:a5-worlds-breakout:${season}:%`} LIMIT 1`)).rows.length;
  if (given) return [];
  const cards = new Set((await tx.execute(sql`SELECT participant_key FROM career_tour_cards WHERE career_save_id = ${root.id} AND status = 'ACTIVE'
    AND start_season <= ${season} AND end_season >= ${season}`)).rows.map(r => String(r.participant_key)));
  const placed = new Set((await tx.execute(sql`SELECT recipient_key FROM career_qualification_entitlements WHERE career_save_id = ${root.id}
    AND target_key = 'world-championship' AND target_season = ${season}`)).rows.map(r => String(r.recipient_key)));
  const out: { participantKey: string; participantKind: string; npcId: string | null; route: BreakoutRoute; position: number | null }[] = [];
  const free = (key: string) => !cards.has(key) && !placed.has(key) && !out.some(o => o.participantKey === key);
  for (const r of BREAKOUT.rankings) {
    const rows = (await tx.execute(sql`SELECT participant_key, participant_kind, npc_id, current_position FROM career_ranking_participants
      WHERE career_save_id = ${root.id} AND list_key = ${r.list} AND current_position IS NOT NULL ORDER BY current_position LIMIT 40`)).rows;
    let given = 0;
    for (const row of rows) {
      if (given >= r.count) break;
      if (!free(String(row.participant_key))) continue;
      out.push({ participantKey: String(row.participant_key), participantKind: String(row.participant_kind), npcId: row.npc_id ? String(row.npc_id) : null, route: r.route, position: Number(row.current_position) });
      given++;
    }
  }
  const champion = (await tx.execute(sql`SELECT champion_participant_key AS k, champion_npc_id AS npc FROM career_event_instances WHERE career_save_id = ${root.id} AND season = ${season}
    AND definition_key = ${BREAKOUT.championOf.definitionKey} AND status = 'COMPLETED' AND champion_participant_key IS NOT NULL LIMIT 1`)).rows[0];
  if (champion && free(String(champion.k)))
    out.push({ participantKey: String(champion.k), participantKind: String(champion.k) === HUMAN ? "HUMAN" : "NPC", npcId: champion.npc ? String(champion.npc) : null, route: "AMATEUR_WORLD_MASTERS", position: 1 });
  if (free(HUMAN) && (await loadFanFollowing(tx, root.id)).total >= BREAKOUT.fanFavouriteFans)
    out.push({ participantKey: HUMAN, participantKind: "HUMAN", npcId: null, route: "FAN_FAVOURITE", position: null });
  if (!out.length) return out;
  await insertEntitlements(tx, root.id, season, out.map(o => {
    const idempotency = `provider:a5-worlds-breakout:${season}:${o.participantKey}`;
    return { id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "entitlement", idempotency), idempotency_key: idempotency, recipient_key: o.participantKey,
      recipient_kind: o.participantKind, npc_id: o.npcId, entitlement_type: "EVENT_ENTRY", source_event_id: null, source_position: o.position,
      source_detail: { providerId: "A5_SPORTING", reason: o.route, position: o.position }, target_key: "world-championship", target_season: season, consumption: "SINGLE_USE" };
  }), "PROVIDER");
  await recordMilestones(tx, root, out.map(o => ({ operationKey: `worlds-breakout:${season}:${o.participantKey}`, participantKey: o.participantKey, participantKind: o.participantKind,
    npcId: o.npcId, kind: "WORLDS_BREAKOUT_PLACE", season, week, detail: { route: o.route, position: o.position, eventId: String(worlds.id) } })));
  return out;
}
