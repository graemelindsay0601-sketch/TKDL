import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { npcSchema, type Npc } from "./types.ts";
import { CAREER_DEVELOPMENT_CONFIG as D } from "./config.ts";

// Trusted column/type map only: never interpolate client-provided identifiers.
const columns = {
  id: "uuid", world_key: "text", first_name: "text", surname: "text", nickname: "text", nationality: "text", home_region: "text",
  dominant_hand: "text", starting_age: "integer", age: "integer", stage: "text", tier: "text", professional_status: "text", detail_tier: "text",
  template_key: "text", status: "text", created_season: "integer", retired_season: "integer",
  scoring: "double precision", finishing: "double precision", consistency: "double precision", pressure: "double precision", power_scoring: "double precision", clutch: "double precision",
  form: "double precision", potential: "double precision", development_rate: "double precision", development_volatility: "double precision",
  peak_start: "integer", peak_end: "integer", breakthrough_age: "integer", decline_profile: "text", low_ability_years: "double precision", recent_development: "double precision", tendencies: "jsonb",
} as const;

function toRow(npc: Npc) {
  npcSchema.parse(npc);
  return { id: npc.id, world_key: npc.worldKey, first_name: npc.firstName, surname: npc.surname, nickname: npc.nickname, nationality: npc.nationality, home_region: npc.homeRegion,
    dominant_hand: npc.dominantHand, starting_age: npc.startingAge, age: npc.age, stage: npc.stage, tier: npc.tier, professional_status: npc.professionalStatus, detail_tier: npc.detailTier,
    template_key: npc.templateKey, status: npc.status, created_season: npc.createdSeason, retired_season: npc.retiredSeason,
    scoring: npc.ability.scoring, finishing: npc.ability.finishing, consistency: npc.ability.consistency, pressure: npc.ability.pressure, power_scoring: npc.ability.powerScoring, clutch: npc.ability.clutch,
    form: npc.form, potential: npc.development.potential, development_rate: npc.development.rate, development_volatility: npc.development.volatility,
    peak_start: npc.development.peakStart, peak_end: npc.development.peakEnd, breakthrough_age: npc.development.breakthroughAge,
    decline_profile: npc.development.declineProfile, low_ability_years: npc.development.lowAbilityYears, recent_development: npc.development.recentDelta, tendencies: npc.tendencies };
}
function fromRow(row: Record<string, unknown>): Npc {
  return npcSchema.parse({ id: row.id, worldKey: row.world_key, firstName: row.first_name, surname: row.surname, nickname: row.nickname,
    nationality: row.nationality, homeRegion: row.home_region, dominantHand: row.dominant_hand, startingAge: row.starting_age, age: row.age,
    stage: row.stage, tier: row.tier, professionalStatus: row.professional_status, detailTier: row.detail_tier, templateKey: row.template_key,
    status: row.status, createdSeason: row.created_season, retiredSeason: row.retired_season,
    ability: { scoring: row.scoring, finishing: row.finishing, consistency: row.consistency, pressure: row.pressure, powerScoring: row.power_scoring, clutch: row.clutch },
    form: row.form, tendencies: row.tendencies,
    development: { potential: row.potential, rate: row.development_rate, volatility: row.development_volatility, peakStart: row.peak_start, peakEnd: row.peak_end,
      breakthroughAge: row.breakthrough_age, declineProfile: row.decline_profile, lowAbilityYears: row.low_ability_years, recentDelta: row.recent_development },
  });
}

/** Bulk insert/update, one statement for a complete population, never per dart. */
export async function persistNpcs(tx: CareerExecutor, saveId: string, players: readonly Npc[]): Promise<void> {
  if (!players.length) return;
  const keys = Object.keys(columns);
  await tx.execute(sql`
    INSERT INTO career_world_players (career_save_id, ${sql.raw(keys.join(", "))})
    SELECT ${saveId}::uuid, ${sql.raw(keys.map(key => `p.${key}`).join(", "))}
    FROM jsonb_to_recordset(${JSON.stringify(players.map(toRow))}::jsonb)
      AS p(${sql.raw(Object.entries(columns).map(([key, type]) => `${key} ${type}`).join(", "))})
    ON CONFLICT (career_save_id, id) DO UPDATE SET
      ${sql.raw(keys.filter(key => key !== "id").map(key => `${key} = EXCLUDED.${key}`).join(", "))}
  `);
}
export async function loadNpcs(tx: CareerExecutor, saveId: string, options: { ids?: readonly string[]; activeOnly?: boolean } = {}): Promise<Npc[]> {
  if (options.ids?.length === 0) return [];
  return (await tx.execute(sql`SELECT * FROM career_world_players WHERE career_save_id = ${saveId}
    ${options.ids ? sql`AND id IN (${sql.join(options.ids.map(id => sql`${id}::uuid`), sql`, `)})` : sql``}
    ${options.activeOnly ? sql`AND status = 'ACTIVE'` : sql``}
    ORDER BY world_key`)).rows.map(fromRow);
}

/** Public identity projection. No ability, potential, development seed or arbitrary story tags. */
export function presentNpc(npc: Npc) {
  return { id: npc.id, firstName: npc.firstName, surname: npc.surname, nickname: npc.nickname, nationality: npc.nationality,
    homeRegion: npc.homeRegion, dominantHand: npc.dominantHand, age: npc.age, stage: npc.stage, tier: npc.tier,
    professionalStatus: npc.professionalStatus, detailTier: npc.detailTier, status: npc.status,
    createdSeason: npc.createdSeason, retiredSeason: npc.retiredSeason,
    womenEligible: npc.worldKey.startsWith("women:"),
    form: npc.form > D.formLabelThreshold ? "HOT" : npc.form < -D.formLabelThreshold ? "COLD" : "NORMAL" };
}
