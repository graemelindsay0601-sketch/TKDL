import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { CAREER_DEFAULTS, CAREER_FEATURE, CAREER_SLOTS, CAREER_VERSIONS } from "./config.ts";
import type { CareerDifficulty } from "./config.ts";
import type { CareerDatabase, CareerExecutor } from "./database.ts";
import { careerIdSchema, createCareerSchema } from "./validation.ts";
import type { CreateCareerInput } from "./validation.ts";
import { careerStartDateFor, validateDateOfBirth } from "./identity/age.ts";
import { LOCALITIES } from "./calendar/geography.ts";

/** A6.5 Career profile schema version (career_profiles.profile_version). */
export const PROFILE_VERSION = 1;

type CareerRow = {
  id: string; player_id: number; slot_number: number; career_name: string | null;
  status: "ACTIVE" | "RETIRED"; difficulty: CareerDifficulty;
  current_season: number; current_week: number;
  created_at: Date | string; updated_at: Date | string; retired_at: Date | string | null;
  career_schema_version: number; world_generation_version: number;
  event_database_version: number; player_database_version: number;
  world_seed: string; settings_snapshot: Record<string, unknown>;
  balance_pence: number; standing: string; professional_ranking: number | null;
  professional_ranking_money_pence: number; sponsor: string | null; has_tour_card: boolean;
};

export class CareerError extends Error {
  readonly status: 404 | 409;
  constructor(status: 404 | 409, message: string) {
    super(message);
    this.name = "CareerError";
    this.status = status;
  }
}

// Explicit public projection: seed, ownership and config snapshot stay server-side.
function present(row: CareerRow) {
  return {
    id: row.id, slotNumber: row.slot_number, careerName: row.career_name,
    status: row.status, difficulty: row.difficulty,
    currentSeason: row.current_season, currentWeek: row.current_week,
    createdAt: row.created_at, updatedAt: row.updated_at, retiredAt: row.retired_at,
    careerSchemaVersion: row.career_schema_version, worldGenerationVersion: row.world_generation_version,
    eventDatabaseVersion: row.event_database_version, playerDatabaseVersion: row.player_database_version,
    balancePence: row.balance_pence, currency: "GBP",
    standing: row.standing, professionalRanking: row.professional_ranking,
    professionalRankingMoneyPence: row.professional_ranking_money_pence,
    sponsor: row.sponsor, hasTourCard: row.has_tour_card,
  };
}

function isSlotConflict(error: unknown): boolean {
  // Drizzle wraps PostgreSQL errors in a query error's cause.
  for (let depth = 0; error && typeof error === "object" && depth < 5; depth++) {
    const detail = error as { code?: string; constraint?: string; cause?: unknown };
    if (detail.code === "23505" && detail.constraint === "career_saves_active_slot_unique") return true;
    error = detail.cause;
  }
  return false;
}

async function ownedSave(tx: CareerExecutor, playerId: number, id: string, lock = false): Promise<CareerRow> {
  careerIdSchema.parse(id);
  const result = await tx.execute(sql`
    SELECT * FROM career_saves WHERE id = ${id} AND player_id = ${playerId}
    ${lock ? sql`FOR UPDATE` : sql``}
  `);
  const row = result.rows[0] as CareerRow | undefined;
  if (!row) throw new CareerError(404, "Career not found");
  return row;
}

function requireActive(row: CareerRow): void {
  if (row.status !== "ACTIVE") throw new CareerError(409, "Career is retired");
}

type CloneIdentity = { dateOfBirth: string | null; careerStartDate: string; homeLocality: string | null; displayName: string | null };

async function insertCareer(tx: CareerExecutor, playerId: number, input: CreateCareerInput, clone?: CloneIdentity | null): Promise<CareerRow> {
  const defaults = CAREER_DEFAULTS;
  const versions = CAREER_VERSIONS;
  // A6.5 identity. A restart carries the same identity (incl. start date) so the DOB/age can never drift.
  const startDate = clone?.careerStartDate ?? careerStartDateFor(new Date());
  const dateOfBirth = clone ? clone.dateOfBirth : input.dateOfBirth ?? null;
  const homeLocality = clone ? clone.homeLocality : input.homeLocality ?? null;
  if (dateOfBirth && !clone) {
    try { validateDateOfBirth(dateOfBirth, startDate); } catch (error) { throw new CareerError(409, (error as Error).message); }
  }
  if (homeLocality && !LOCALITIES.some(l => l.key === homeLocality)) throw new CareerError(409, "Unknown home locality");
  const snapshot = { ...defaults, difficulty: input.difficulty, competitionCategory:input.competitionCategory??"OPEN",
    careerStartPolicy:"ESTABLISHMENT_V1",travelVersion:2, ...(homeLocality ? { homeLocality } : {}) };
  const result = await tx.execute(sql`
    INSERT INTO career_saves (
      id, player_id, slot_number, career_name, status, difficulty, current_season, current_week,
      career_schema_version, world_generation_version, event_database_version, player_database_version,
      world_seed, settings_snapshot, balance_pence, standing, professional_ranking,
      professional_ranking_money_pence, sponsor, has_tour_card
    ) VALUES (
      ${randomUUID()}, ${playerId}, ${input.slot}, ${input.careerName ?? null}, 'ACTIVE', ${input.difficulty},
      ${defaults.currentSeason}, ${defaults.currentWeek},
      ${versions.careerSchemaVersion}, ${versions.worldGenerationVersion}, ${versions.eventDatabaseVersion}, ${versions.playerDatabaseVersion},
      ${randomBytes(32).toString("hex")}, ${JSON.stringify(snapshot)}::jsonb,
      ${defaults.balancePence}, ${defaults.standing}, ${defaults.professionalRanking},
      ${defaults.professionalRankingMoneyPence}, ${defaults.sponsor}, ${defaults.hasTourCard}
    ) RETURNING *
  `);
  const row = result.rows[0] as CareerRow;
  await tx.execute(sql`
    INSERT INTO career_finance_entries (id, career_save_id, kind, amount_pence)
    VALUES (${randomUUID()}, ${row.id}, 'CAREER_START', ${defaults.balancePence})
  `);
  // Profile row only when an identity exists; a save without one is PROFILE_INCOMPLETE.
  if (dateOfBirth) {
    await tx.execute(sql`INSERT INTO career_profiles (career_save_id, profile_version, display_name, date_of_birth, career_start_date, home_locality)
      VALUES (${row.id}, ${PROFILE_VERSION}, ${clone?.displayName ?? input.careerName ?? null}, ${dateOfBirth}::date, ${startDate}::date, ${homeLocality})`);
  }
  return row;
}

export function createCareerService(database: CareerDatabase,options:{onRetired?:(tx:CareerExecutor,root:CareerRow)=>Promise<void>}={}) {
  return {
    async isAvailable(isAdmin: boolean): Promise<boolean> {
      const { rows } = await database.execute(sql`
        SELECT enabled, admin_test_mode FROM feature_flags WHERE feature_name = ${CAREER_FEATURE}
      `);
      return rows[0]?.enabled === true || (isAdmin && rows[0]?.admin_test_mode === true);
    },

    async list(playerId: number) {
      // One statement gives slots and archive a consistent snapshot during retirement.
      const { rows } = await database.execute(sql`
        SELECT * FROM career_saves WHERE player_id = ${playerId} ORDER BY created_at DESC, id
      `);
      const saves = rows as CareerRow[];
      return {
        slots: CAREER_SLOTS.map(slotNumber => ({
          slotNumber,
          career: saves.filter(row => row.status === "ACTIVE" && row.slot_number === slotNumber).map(present)[0] ?? null,
        })),
        archived: saves.filter(row => row.status === "RETIRED").map(present),
      };
    },

    async read(playerId: number, id: string) {
      return present(await ownedSave(database, playerId, id));
    },

    async create(playerId: number, body: unknown) {
      const input = createCareerSchema.parse(body);
      try {
        return present(await database.transaction(tx => insertCareer(tx, playerId, input)));
      } catch (error) {
        if (isSlotConflict(error)) throw new CareerError(409, "Career slot is occupied");
        throw error;
      }
    },

    async restart(playerId: number, id: string) {
      return database.transaction(async tx => {
        const old = await ownedSave(tx, playerId, id, true);
        requireActive(old);
        const identity = (await tx.execute(sql`SELECT to_char(date_of_birth, 'YYYY-MM-DD') AS dob, to_char(career_start_date, 'YYYY-MM-DD') AS start, home_locality, display_name
          FROM career_profiles WHERE career_save_id = ${old.id}`)).rows[0];
        // New universe ID prevents stale requests from mutating the restarted world.
        // Every future child FK must cascade from this root; no table list to maintain.
        await tx.execute(sql`DELETE FROM career_saves WHERE id = ${old.id} AND player_id = ${playerId}`);
        return present(await insertCareer(tx, playerId, {
          slot: old.slot_number, difficulty: old.difficulty, careerName: old.career_name ?? undefined,
          competitionCategory:old.settings_snapshot?.competitionCategory==="WOMEN"?"WOMEN":"OPEN",
        }, identity ? { dateOfBirth: identity.dob as string | null, careerStartDate: String(identity.start), homeLocality: (identity.home_locality as string | null) ?? null,
          displayName: (identity.display_name as string | null) ?? null } : null));
      });
    },

    async retire(playerId: number, id: string) {
      return database.transaction(async tx => {
        const row = await ownedSave(tx, playerId, id, true);
        if(row.status==="RETIRED")return present(row);
        const result = await tx.execute(sql`
          UPDATE career_saves SET status = 'RETIRED', retired_at = NOW(), updated_at = NOW()
          WHERE id = ${id} AND player_id = ${playerId} RETURNING *
        `);
        const retired=result.rows[0] as CareerRow;
        await options.onRetired?.(tx,retired);
        return present(retired);
      });
    },

    async delete(playerId: number, id: string) {
      await database.transaction(async tx => {
        await ownedSave(tx, playerId, id, true);
        await tx.execute(sql`DELETE FROM career_saves WHERE id = ${id} AND player_id = ${playerId}`);
      });
    },
  };
}

export type CareerService = ReturnType<typeof createCareerService>;
