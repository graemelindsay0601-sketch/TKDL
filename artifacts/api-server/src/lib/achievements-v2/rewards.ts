/**
 * Cosmetics earned from achievements (award-only: never in the shop for coins). Granted on every sync from the
 * player's current states, so history counts at launch and anything earned later arrives with the next sync.
 * Granting is idempotent: a player never gets the same cosmetic twice, and nothing is ever taken back.
 */
import { sql } from "drizzle-orm";
import type { Area } from "./catalogue.ts";
import type { AchievementState } from "./evaluate.ts";
import type { Exec } from "./report.ts";

type Seed = { id: string; category: string; name: string; rarity: string; color?: string; gradient?: string; glow?: string; iconKey?: string; sortOrder: number };
export type Reward = { cosmetic: Seed; earnedBy: string; earned: (states: AchievementState[]) => boolean };

const diamond = (area: Area) => (states: AchievementState[]) => states.some(s => s.kind === "TRACK" && s.area === area && s.level > 0 && s.level === s.levels);
const feat = (key: string) => (states: AchievementState[]) => states.some(s => s.kind === "FEAT" && s.key === key && !!s.earnedAt);
const trackAt = (key: string, level: number) => (states: AchievementState[]) => states.some(s => s.kind === "TRACK" && s.key === key && s.level >= level);

const frame = (area: Area, name: string, color: string, glow: string, n: number): Reward => ({
  cosmetic: { id: `frame-av2-${area.toLowerCase()}`, category: "FRAME", name, rarity: "LEGENDARY", color, glow, sortOrder: 100 + n },
  earnedBy: `Reach Diamond on any ${name.replace(" Diamond", "")} track`, earned: diamond(area) });
const nameStyle = (key: string, name: string, gradient: string, glow: string, n: number, earnedBy: string): Reward => ({
  cosmetic: { id: `name-av2-${key}`, category: "NAME_STYLE", name, rarity: "LEGENDARY", gradient, glow, sortOrder: 100 + n }, earnedBy, earned: feat(key) });

export const REWARDS: Reward[] = [
  frame("LEAGUE", "League Diamond", "#6fe9ff", "#6fe9ff", 0),
  frame("TEAMS", "Teams Diamond", "#8affc1", "#22c55e", 1),
  frame("PRACTICE", "Practice Diamond", "#c4b5fd", "#a855f7", 2),
  frame("MASTER501", "Master-501 Diamond", "#ffd24a", "#ff8c00", 3),
  frame("MODES", "Modes Diamond", "#ff6b9a", "#ff005c", 4),
  frame("CAREER", "Career Diamond", "#fff7d6", "#ffd24a", 5),
  nameStyle("clean-sweep", "The Grand Slam", "linear-gradient(90deg,#ffd24a,#fff7d6,#ff005c,#fff7d6,#ffd24a)", "#ffd24a", 0, "Earn The Grand Slam"),
  nameStyle("inseparable", "Inseparable", "linear-gradient(90deg,#22c55e,#ffd24a,#22c55e)", "#22c55e", 1, "Earn Inseparable"),
  nameStyle("iron-discipline", "Iron Discipline", "linear-gradient(90deg,#9ca3af,#f8fafc,#a855f7,#f8fafc,#9ca3af)", "#a855f7", 2, "Earn Iron Discipline"),
  nameStyle("m501-world-champion", "Master of 501", "linear-gradient(90deg,#ff8c00,#ffd24a,#fff7d6,#ffd24a,#ff8c00)", "#ff8c00", 3, "Become Master-501 World Champion"),
  nameStyle("boss-slayer", "Boss Slayer", "linear-gradient(90deg,#7f1d1d,#ff005c,#ffd24a,#ff005c,#7f1d1d)", "#ff005c", 4, "Earn Boss Slayer"),
  nameStyle("world-champion", "World Champion", "linear-gradient(90deg,#0066ff,#ffd24a,#fff7d6,#ffd24a,#0066ff)", "#ffd24a", 5, "Win the World Championship in Career"),
  { cosmetic: { id: "tag-av2-untouchable", category: "LEADERBOARD_TAG", name: "UNTOUCHABLE", rarity: "LEGENDARY", color: "#6fe9ff", sortOrder: 100 },
    earnedBy: "Reach Diamond on Untouchable (never eliminated in 8 seasons in a row)", earned: trackAt("untouchable", 5) },
  { cosmetic: { id: "tag-av2-full-house", category: "LEADERBOARD_TAG", name: "FULL HOUSE", rarity: "LEGENDARY", color: "#ffd24a", sortOrder: 101 },
    earnedBy: "Earn Full house (beat everyone in one season)", earned: feat("full-house") },
  { cosmetic: { id: "banner-av2-hall-of-fame", category: "BANNER", name: "Hall of Fame", rarity: "LEGENDARY",
      gradient: "linear-gradient(120deg,rgba(255,210,74,0.32) 0%,rgba(13,31,69,0.95) 45%,rgba(255,210,74,0.18) 100%)", glow: "#ffd24a", sortOrder: 100 },
    earnedBy: "Get inducted into the Career Hall of Fame", earned: feat("hall-of-famer") },
  { cosmetic: { id: "sticker-av2-black-cat", category: "STICKER", name: "Black Cat", rarity: "LEGENDARY", iconKey: "🐈‍⬛", sortOrder: 100 },
    earnedBy: "Earn the Friday the 13th secret feat", earned: feat("friday-13th") },
  { cosmetic: { id: "sticker-av2-nine", category: "STICKER", name: "Nine-Darter", rarity: "LEGENDARY", iconKey: "9️⃣", sortOrder: 101 },
    earnedBy: "Earn the Perfection secret feat in Career", earned: feat("perfection") },
];

/** cosmetic id -> how it's earned, for the shop. */
export const EARNED_BY: Record<string, string> = Object.fromEntries(REWARDS.map(r => [r.cosmetic.id, r.earnedBy]));
/** achievement key -> the cosmetic it unlocks (for the cabinet). Diamond frames are per area, so they're listed per area instead. */
export const REWARD_FOR_FEAT: Record<string, string> = {
  "clean-sweep": "The Grand Slam name style", "inseparable": "Inseparable name style", "iron-discipline": "Iron Discipline name style",
  "m501-world-champion": "Master of 501 name style", "boss-slayer": "Boss Slayer name style", "world-champion": "World Champion name style",
  "full-house": "FULL HOUSE leaderboard tag", "hall-of-famer": "Hall of Fame banner", "friday-13th": "Black Cat sticker", "perfection": "Nine-Darter sticker",
};

/** Make sure the award-only cosmetics exist (upsert; never deletes, so nothing a player owns can vanish). */
export async function seedRewardCosmetics(db: Exec) {
  for (const { cosmetic: c } of REWARDS) await db.execute(sql`INSERT INTO cosmetic_definitions (id, category, name, rarity, price, color, gradient, glow, icon_key, enabled, purchasable, sort_order)
    VALUES (${c.id}, ${c.category}, ${c.name}, ${c.rarity}, 0, ${c.color ?? null}, ${c.gradient ?? null}, ${c.glow ?? null}, ${c.iconKey ?? null}, true, false, ${c.sortOrder})
    ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, rarity = EXCLUDED.rarity, color = EXCLUDED.color, gradient = EXCLUDED.gradient,
      glow = EXCLUDED.glow, icon_key = EXCLUDED.icon_key, purchasable = false, sort_order = EXCLUDED.sort_order`);
}

/** Grant every reward each player has earned and doesn't own yet. Returns the new grants. */
export async function grantRewards(db: Exec, players: Map<number, AchievementState[]>): Promise<{ playerId: number; cosmeticId: string }[]> {
  const want: { playerId: number; cosmeticId: string }[] = [];
  for (const [playerId, states] of players) for (const r of REWARDS) if (r.earned(states)) want.push({ playerId, cosmeticId: r.cosmetic.id });
  if (!want.length) return [];
  await seedRewardCosmetics(db);
  const owned = new Set((await db.execute(sql`SELECT player_id, cosmetic_id FROM player_cosmetics WHERE cosmetic_id LIKE '%-av2-%'`)).rows.map(r => `${r.player_id}|${r.cosmetic_id}`));
  const fresh = want.filter(w => !owned.has(`${w.playerId}|${w.cosmeticId}`));
  for (const w of fresh) await db.execute(sql`INSERT INTO player_cosmetics (player_id, cosmetic_id) SELECT ${w.playerId}, ${w.cosmeticId}
    WHERE NOT EXISTS (SELECT 1 FROM player_cosmetics WHERE player_id = ${w.playerId} AND cosmetic_id = ${w.cosmeticId})`);
  return fresh;
}

/** How many players each reward would go to, from everyone's current states (read only; for the admin report). */
export function rewardCounts(all: Record<string, { playerId: number; states: AchievementState[] }[]>) {
  const byPlayer = new Map<number, AchievementState[]>();
  for (const list of Object.values(all)) for (const p of list) byPlayer.set(p.playerId, [...(byPlayer.get(p.playerId) ?? []), ...p.states]);
  return REWARDS.map(r => ({ name: r.cosmetic.name, category: r.cosmetic.category, earnedBy: r.earnedBy, players: [...byPlayer.values()].filter(r.earned).length }));
}
