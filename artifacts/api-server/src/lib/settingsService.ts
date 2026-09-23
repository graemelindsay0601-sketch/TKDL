import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// League-scoped settings reads/writes — the single choke point that
// replaces the raw `SELECT value FROM settings WHERE key = ...` scattered
// across community.ts, communityNotify.ts, practice.ts, messages.ts and
// admin.ts (each read the same global-only table its own way). Every call
// site now takes an explicit leagueId — a route handler gets one from
// currentLeagueId(req) (see lib/currentLeague.ts), a background/event path
// with no req (communityNotify.ts) gets one from getDefaultLeagueId().

export async function getSetting(leagueId: number, key: string): Promise<string | null> {
  const rows = await db.execute(sql`
    SELECT value FROM settings WHERE league_id = ${leagueId} AND key = ${key}
  `);
  return (rows.rows[0] as { value: string } | undefined)?.value ?? null;
}

export async function getSettingBool(leagueId: number, key: string): Promise<boolean> {
  return (await getSetting(leagueId, key)) === "true";
}

export async function setSetting(leagueId: number, key: string, value: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO settings (league_id, key, value, updated_at)
    VALUES (${leagueId}, ${key}, ${value}, NOW())
    ON CONFLICT (league_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
}

export async function getAllSettings(leagueId: number): Promise<Record<string, string>> {
  const rows = await db.execute(sql`SELECT key, value FROM settings WHERE league_id = ${leagueId}`);
  const out: Record<string, string> = {};
  for (const r of rows.rows as { key: string; value: string }[]) out[r.key] = r.value;
  return out;
}
