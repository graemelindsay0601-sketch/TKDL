import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { loadNpcs } from "../world/repository.ts";
import { scopedRandom } from "../world/random.ts";
import { type Entrant, type SportingProvider, type StoredEvent, type SportingFacts, HUMAN } from "./types.ts";
import { evaluate } from "./eligibility.ts";
import { conflicts, entitlementKeys, putEntry, saveEvent, type Root } from "./repository.ts";
import { createDraw } from "./draw.ts";
import { capability } from "./capability.ts";

export async function humanEntrant(root: Root, provider: SportingProvider): Promise<Entrant> {
  const profile = await provider.human?.(root.id) ?? { country: "GBR", region: "Scotland", professionalStatus: "AMATEUR" as const };
  return { key: HUMAN, npcId: null, name: "You", ...profile, status: "ACTIVE", tier: profile.professionalStatus === "PROFESSIONAL" ? "PROFESSIONAL" : "GRASSROOTS" };
}
export async function participants(tx: CareerExecutor, root: Root, provider: SportingProvider): Promise<Entrant[]> {
  return [await humanEntrant(root, provider),
    ...(await loadNpcs(tx, root.id)).map(n => ({ key: n.id, npcId: n.id, name: `${n.firstName} ${n.surname}`, country: n.nationality, region: n.homeRegion, status: n.status, tier: n.tier, professionalStatus: n.professionalStatus }))];
}
export async function eligibilityInputs(tx: CareerExecutor, root: Root, event: StoredEvent, people: Entrant[], provider: SportingProvider) {
  const facts = await provider.facts(root.id, event.season, people, event);
  facts[HUMAN] = { ...facts[HUMAN], tourCard: root.has_tour_card };
  // Previous results and defending champions remain A3-owned facts, not invented provider history.
  const rules = JSON.stringify(event.definition.eligibility);
  const needsHistory = rules.includes('"PREVIOUS_RESULT"') || rules.includes('"DEFENDING_CHAMPION"');
  const prior = needsHistory ? (await tx.execute(sql`SELECT snapshot,result,season FROM career_events WHERE career_save_id=${root.id} AND status='COMPLETED'
    AND (season<${event.season} OR (season=${event.season} AND end_day<${event.startDay}))`)).rows : [];
  for (const who of people) {
    const previous: Record<string, number> = {};
    let defendingChampion = false;
    for (const row of prior) {
      const old = row.snapshot as StoredEvent, result = row.result as NonNullable<StoredEvent["result"]>;
      const finish = result.finishes.find(f => f.participant === who.key);
      if (finish) previous[old.definition.family] = Math.min(previous[old.definition.family] ?? Infinity, finish.position);
      if (row.season === event.season - 1 && old.definition.family === event.definition.family && result.champion === who.key) defendingChampion = true;
    }
    facts[who.key] = { ...facts[who.key], previous, defendingChampion };
  }
  return { facts, entitled: await entitlementKeys(tx, root.id, event), booked: await conflicts(tx, root.id, event) };
}
export function selectionScore(who: Entrant, event: StoredEvent, seed: string, version: number) {
  const level = { GRASSROOTS: 0, AMATEUR: 1, PROFESSIONAL: 2, ELITE: 3 }[who.tier];
  const target = event.definition.prestige >= 75 ? 3 : event.definition.prestige >= 60 ? 2 : event.definition.prestige >= 25 ? 1 : 0;
  const localWeight = event.definition.prestige < 35 ? 8 : 1;
  const geo = who.region === event.venue.region ? 2 : who.country === event.venue.country ? 1 : 0;
  return -Math.abs(level - target) * 8 + geo * localWeight + scopedRandom(seed, version, "participation", event.id, who.key)() * 9;
}
export async function lockDraw(tx: CareerExecutor, root: Root, event: StoredEvent, day: number, provider: SportingProvider) {
  if (event.draw || event.status === "CANCELLED") return { status: "LOCKED" as const, event };
  const support = capability(event.definition.format);
  if (support.status !== "SUPPORTED") return support;
  if (event.season !== root.current_season || day < event.closesDay) throw new CareerError(409, "Draw cannot lock before registration deadline");
  const people = await participants(tx, root, provider);
  const { facts, entitled, booked } = await eligibilityInputs(tx, root, event, people, provider);
  const busy = new Set(booked.map(r => String(r.participant_key)));
  const entered = (await tx.execute(sql`SELECT participant_key,status FROM career_event_entries WHERE career_save_id=${root.id} AND event_id=${event.id}`)).rows;
  const enteredKeys = new Set(entered.filter(r => r.status === "ENTERED").map(r => String(r.participant_key)));
  const withdrawn = new Set(entered.filter(r => r.status === "WITHDRAWN").map(r => String(r.participant_key)));
  const priority = (who: Entrant) => entitled.has(who.key) ? 10000 : facts[who.key]?.invited ? 9000 : enteredKeys.has(who.key) ? 8000 : 0;
  const field = people.filter(who => (who.key !== HUMAN || enteredKeys.has(HUMAN)) && !withdrawn.has(who.key) && !busy.has(who.key)
    && evaluate(event.definition.eligibility, who, facts[who.key] ?? {}, entitled.has(who.key)).eligible)
    .sort((a, b) => priority(b) - priority(a) || selectionScore(b, event, root.world_seed, root.event_database_version) - selectionScore(a, event, root.world_seed, root.event_database_version) || a.key.localeCompare(b.key))
    .slice(0, event.definition.fieldSize);
  for (const old of enteredKeys) if (!field.some(p => p.key === old)) await tx.execute(sql`UPDATE career_event_entries SET status='MISSED' WHERE career_save_id=${root.id} AND event_id=${event.id} AND participant_key=${old}`);
  if (field.length < 2) {
    event.status = "CANCELLED"; event.cancellationReason = "INSUFFICIENT_ELIGIBLE_FIELD"; await saveEvent(tx, root.id, event);
    return { status: "LOCKED" as const, event };
  }
  for (const who of field) await putEntry(tx, root.id, event.id, who, "CONFIRMED");
  event.draw = createDraw(field, root.world_seed, root.event_database_version, event.id, await provider.seeds?.(root.id, event, field) ?? []);
  event.status = "DRAWN";
  await saveEvent(tx, root.id, event);
  return { status: "LOCKED" as const, event };
}
