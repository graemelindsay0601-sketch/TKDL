import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Road trips: each trip (a booked night in another town) and every money match on the road (or with a visitor at your club). Every startup; checks first. */
export async function ensureRoadTrips(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_road_trips (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, week integer NOT NULL, day integer NOT NULL, locality_key text NOT NULL, cost_pence bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY(career_save_id, id), UNIQUE(career_save_id, season, week))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_road_matches (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, week integer NOT NULL, trip_id uuid, locality_key text, opponent_key uuid NOT NULL,
    role text NOT NULL CHECK(role IN ('LOCAL','CHAMPION','VISITOR')), status text NOT NULL CHECK(status IN ('TALKING','WALKED','PLAYED')),
    asks integer NOT NULL DEFAULT 0, their_offer_pence bigint, agreed_pence bigint, log jsonb,
    stake_pence bigint, won boolean, legs_you integer, legs_them integer, detail jsonb, created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id, id), UNIQUE(career_save_id, season, week, opponent_key))`);
}
