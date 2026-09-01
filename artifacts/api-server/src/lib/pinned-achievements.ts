import { db, achievementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { SHADOW_BOT_ACHIEVEMENT_DEFS } from "./shadow-bot-achievements";
import { CC_ACHIEVEMENT_DEFS } from "./card-clash-achievements";

/**
 * A player's "trophy case" — up to 5 pinned favourite achievements, shown on
 * their profile and on the Hub. Same four-system split as the unified trophy
 * detail page (/api/achievements/detail/:system/:key): a pin is always a
 * {system, key} pair since keys aren't coordinated across the four separate
 * storage systems.
 */
export const PINNABLE_SYSTEMS = ["core", "shadow-bot", "tour", "card-clash"] as const;
export type PinnableSystem = typeof PINNABLE_SYSTEMS[number];

export type PinnedAchievement = {
  system: PinnableSystem;
  key: string;
  name: string;
  icon: string;
  rarity: string | null;
};

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS player_pinned_achievements (
      player_id  INTEGER PRIMARY KEY,
      pins       JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableEnsured = true;
}

/** Looks up display info (name/icon/rarity) for one {system, key} pin. Returns null if it no longer resolves (achievement retired/renamed) so callers can drop it rather than show a broken pin. */
async function resolvePin(system: string, key: string): Promise<PinnedAchievement | null> {
  if (system === "core") {
    const [ach] = await db.select().from(achievementsTable).where(eq(achievementsTable.key, key));
    if (!ach) return null;
    return { system: "core", key, name: ach.name, icon: ach.icon ?? "🏆", rarity: ach.rarity };
  }
  if (system === "shadow-bot") {
    const def = SHADOW_BOT_ACHIEVEMENT_DEFS.find(d => d.key === key);
    if (!def) return null;
    return { system: "shadow-bot", key, name: def.name, icon: def.icon, rarity: def.rarity };
  }
  if (system === "tour") {
    const [def] = (await db.execute(sql`SELECT * FROM tour_achievement_definitions WHERE key = ${key}`)).rows as any[];
    if (!def) return null;
    return { system: "tour", key, name: def.name, icon: "🏆", rarity: null };
  }
  if (system === "card-clash") {
    const def = CC_ACHIEVEMENT_DEFS.find(d => d.key === key);
    if (!def) return null;
    return { system: "card-clash", key, name: def.name, icon: def.icon, rarity: def.rarity };
  }
  return null;
}

export async function getPinnedAchievements(playerId: number): Promise<PinnedAchievement[]> {
  await ensureTable();
  const [row] = (await db.execute(sql`
    SELECT pins FROM player_pinned_achievements WHERE player_id = ${playerId}
  `)).rows as { pins: { system: string; key: string }[] }[];
  if (!row) return [];

  const resolved = await Promise.all(row.pins.map(p => resolvePin(p.system, p.key).catch(() => null)));
  return resolved.filter((p): p is PinnedAchievement => p !== null);
}

export async function setPinnedAchievements(playerId: number, pins: { system: string; key: string }[]): Promise<void> {
  await ensureTable();
  await db.execute(sql`
    INSERT INTO player_pinned_achievements (player_id, pins, updated_at)
    VALUES (${playerId}, ${JSON.stringify(pins)}::jsonb, NOW())
    ON CONFLICT (player_id) DO UPDATE SET pins = EXCLUDED.pins, updated_at = NOW()
  `);
  logger.info({ playerId, count: pins.length }, "Pinned achievements updated");
}
