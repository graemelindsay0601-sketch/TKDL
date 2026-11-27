/**
 * Player Walk-Ons: a nickname, two colours and an entrance style, set up in the Clubhouse and played on the
 * match-night walk-on screen. Visual only (no audio).
 */
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();
export const WALKON_COLOURS = ["pink", "blue", "gold", "green", "red", "purple", "orange", "white", "teal", "black"] as const;
export const WALKON_STYLES = ["spotlights", "smoke", "sparks", "confetti"] as const;

let ready: Promise<unknown> | null = null;
const ensure = () => (ready ??= db.execute(sql`CREATE TABLE IF NOT EXISTS player_walkons (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL DEFAULT '', colour_a TEXT NOT NULL, colour_b TEXT NOT NULL, style TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(e => { ready = null; throw e; }));

const shape = (r: any) => ({ playerId: Number(r.player_id), nickname: r.nickname as string, colourA: r.colour_a as string, colourB: r.colour_b as string, style: r.style as string });

router.get("/walkons", async (req, res): Promise<void> => {
  const ids = String(req.query.ids ?? "").split(",").map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 12);
  if (!ids.length) { res.json({}); return; }
  await ensure();
  const rows = (await db.execute(sql`SELECT * FROM player_walkons WHERE player_id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`)).rows;
  res.json(Object.fromEntries(rows.map(r => [Number((r as any).player_id), shape(r)])));
});

router.put("/walkons/me", async (req, res): Promise<void> => {
  const playerId = (req.session as any)?.playerId as number | undefined;
  if (!playerId) { res.status(401).json({ error: "Sign in to set up your walk-on" }); return; }
  const b = req.body ?? {};
  const nickname = String(b.nickname ?? "").replace(/\s+/g, " ").trim().slice(0, 24);
  const colourA = String(b.colourA), colourB = String(b.colourB), style = String(b.style);
  if (!WALKON_COLOURS.includes(colourA as any) || !WALKON_COLOURS.includes(colourB as any) || !WALKON_STYLES.includes(style as any)) {
    res.status(400).json({ error: "Pick a colour pair and a style" }); return;
  }
  await ensure();
  const row = (await db.execute(sql`INSERT INTO player_walkons (player_id, nickname, colour_a, colour_b, style) VALUES (${playerId}, ${nickname}, ${colourA}, ${colourB}, ${style})
    ON CONFLICT (player_id) DO UPDATE SET nickname = EXCLUDED.nickname, colour_a = EXCLUDED.colour_a, colour_b = EXCLUDED.colour_b, style = EXCLUDED.style, updated_at = NOW() RETURNING *`)).rows[0];
  res.json(shape(row));
});

export default router;
