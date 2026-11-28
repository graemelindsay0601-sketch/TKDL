// Boss Battle rewards: each boss's exclusive loot (first win), the Nemesis revenge bonus,
// and a League moment when someone clears a world. Rules in shared/darts-rules/boss-roster.ts.
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { createNotification } from "./communityNotify";
import { postHighlight } from "./community-highlights-db";
import { addCoinsToPlayer } from "../services/card-shop-service";
import { BOSS_LOOT, BOSS_ROSTER, WORLDS, REVENGE_COINS, lootFor, nemesisOf, rosterById } from "../shared/darts-rules/boss-roster";

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { return (await db.execute(q)).rows as any[]; }

let ready: Promise<unknown> | null = null;
export const ensureBossRewards = () => (ready ??= (async () => {
  for (const c of BOSS_LOOT) await db.execute(sql`INSERT INTO cosmetic_definitions (id, category, name, rarity, price, color, gradient, glow, enabled, purchasable, sort_order)
    VALUES (${c.id}, ${c.category}, ${c.name}, ${c.rarity}, 0, ${c.color ?? null}, ${c.gradient ?? null}, ${c.glow ?? null}, true, false, ${c.sortOrder})
    ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, rarity = EXCLUDED.rarity, color = EXCLUDED.color,
      gradient = EXCLUDED.gradient, glow = EXCLUDED.glow, purchasable = false, sort_order = EXCLUDED.sort_order`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS boss_revenge (player_id INTEGER NOT NULL, boss_id TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (player_id, boss_id))`);
})().catch(e => { ready = null; throw e; }));


/** The player's Nemesis right now (before this fight is recorded). */
export async function currentNemesis(pid: number): Promise<string | null> {
  const st = await rows(sql`SELECT boss_id, attempts, wins FROM boss_battle_stats WHERE player_id = ${pid}`);
  const done = (await rows(sql`SELECT boss_id FROM boss_battle_progress WHERE player_id = ${pid}`)).map(r => String(r.boss_id));
  return nemesisOf(Object.fromEntries(st.map(r => [r.boss_id, { attempts: Number(r.attempts), wins: Number(r.wins) }])), done)?.bossId ?? null;
}

export type BossWinRewards = { loot?: { id: string; name: string; category: string }; revenge?: { coins: number } };

export async function afterBossWin(pid: number, playerName: string, bossId: string, firstDefeat: boolean, nemesisId: string | null): Promise<BossWinRewards> {
  const out: BossWinRewards = {};
  try {
    await ensureBossRewards();
    const boss = rosterById(bossId)!;
    const loot = lootFor(bossId);
    if (loot) {
      const g = await db.execute(sql`INSERT INTO player_cosmetics (player_id, cosmetic_id) SELECT ${pid}, ${loot.id}
        WHERE NOT EXISTS (SELECT 1 FROM player_cosmetics WHERE player_id = ${pid} AND cosmetic_id = ${loot.id}) RETURNING cosmetic_id`);
      if (g.rows.length) {
        out.loot = { id: loot.id, name: loot.name, category: loot.category };
        void createNotification({ playerId: pid, type: "achievement_unlocked", message: `You beat ${boss.name}! Loot: ${loot.name}.` });
      }
    }
    if (nemesisId === bossId) {
      const r = await db.execute(sql`INSERT INTO boss_revenge (player_id, boss_id) VALUES (${pid}, ${bossId}) ON CONFLICT DO NOTHING RETURNING boss_id`);
      if (r.rows.length) {
        await addCoinsToPlayer(pid, REVENGE_COINS, "achievement", `boss-revenge:${bossId}`);
        out.revenge = { coins: REVENGE_COINS };
        await postHighlight({ key: `boss-revenge:${pid}:${bossId}`, kind: "boss_revenge", playerId: pid, players: [pid], link: "/boss-battle",
          title: "REVENGE", line: `${playerName} finally beat their Nemesis, ${boss.name}.`, stat: "😤", statLabel: "Boss Battle" });
      }
    }
    // The last boss of a world, beaten for the first time: the world is cleared.
    const world = WORLDS.find(w => w.id === boss.world)!;
    const last = BOSS_ROSTER.filter(b => b.world === boss.world).at(-1)!;
    if (firstDefeat && last.id === bossId) {
      await postHighlight({ key: `boss-world:${pid}:${world.id}`, kind: "boss_world", playerId: pid, players: [pid], link: "/boss-battle",
        title: bossId === "the-reckoning" ? "BOSS BATTLE CONQUERED" : "WORLD CLEARED",
        line: bossId === "the-reckoning" ? `${playerName} beat The Reckoning and cleared all four worlds of Boss Battle.` : `${playerName} beat ${boss.name} and cleared ${world.name}.`,
        stat: "🗺️", statLabel: "Boss Battle" });
    }
  } catch (err) { logger.warn({ err }, "Boss win rewards failed (non-fatal)"); }
  return out;
}
