import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerEvents } from "../../db/migrations/create_career_events.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerEventService } from "../../career/events/service.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { harnessProvider } from "../../career/events/harness.ts";
import type { SportingProvider } from "../../career/events/types.ts";
export async function fixture(provider: SportingProvider = harnessProvider) {
  const pg = new PGlite(), db = drizzle(pg), actor = { playerId: 1 };
  await pg.exec("CREATE TABLE players(id INTEGER PRIMARY KEY); INSERT INTO players VALUES(1),(2); CREATE TABLE feature_flags(feature_name TEXT UNIQUE,enabled BOOLEAN,admin_test_mode BOOLEAN,description TEXT)");
  await createCareerSaves(db); await createCareerWorld(db); await createCareerEvents(db);
  await pg.exec("UPDATE feature_flags SET enabled=true");
  const saves = createCareerService(db), events = createCareerEventService(db, provider);
  const save = await saves.create(1, { slot: 1 });
  await db.execute(sql`UPDATE career_saves SET world_seed=${HARNESS_SEED} WHERE id=${save.id}`);
  await events.initialize(actor, save.id);
  return { pg, db, actor, saves, events, save };
}
