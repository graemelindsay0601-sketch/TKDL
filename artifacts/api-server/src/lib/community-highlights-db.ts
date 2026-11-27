// Database side of the Off the Oche "league moments" (see community-highlights.ts).
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { RECORD_LABELS, type RecordKey } from "./league-records";
import { logger } from "./logger";
import { getDefaultLeagueId } from "./currentLeague";
import { getSettingBool } from "./settingsService";
import { bigFinish, ordinal, singlesHighlights, CAPPED_KINDS, DAILY_CAP, type Highlight } from "./community-highlights";

let ready: Promise<unknown> | null = null;
export const ensureHighlightIndex = () => (ready ??= db.execute(sql`
  CREATE UNIQUE INDEX IF NOT EXISTS community_posts_highlight_key_idx
  ON community_posts ((auto_meta->>'hkey')) WHERE post_type = 'highlight'`).catch(e => { ready = null; throw e; }));


/** Post a league moment. Safe to call from anywhere: never throws, never posts twice. */
export async function postHighlight(h: Highlight): Promise<number | null> {
  try {
    if (!(await getSettingBool(await getDefaultLeagueId(), "community_enabled"))) return null;
    await ensureHighlightIndex();
    if (CAPPED_KINDS.includes(h.kind)) {
      const today = (await db.execute(sql`SELECT COUNT(*)::int n FROM community_posts WHERE post_type = 'highlight'
        AND auto_meta->>'kind' IN (${sql.join(CAPPED_KINDS.map(k => sql`${k}`), sql`, `)})
        AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London'`)).rows[0] as { n: number };
      if (Number(today.n) >= DAILY_CAP) return null;
    }
    const meta = { hkey: h.key, kind: h.kind, title: h.title, line: h.line, stat: h.stat ?? null, statLabel: h.statLabel ?? null,
      players: h.players ?? [h.playerId], matchId: h.matchId ?? null, link: h.link ?? null };
    const r = await db.execute(sql`
      INSERT INTO community_posts (player_id, content, post_type, auto_meta, status, approved_at)
      VALUES (${h.playerId}, ${h.line}, 'highlight', ${JSON.stringify(meta)}::jsonb, 'approved', NOW())
      ON CONFLICT ((auto_meta->>'hkey')) WHERE post_type = 'highlight' DO NOTHING
      RETURNING id`);
    return (r.rows[0] as { id: number } | undefined)?.id ?? null;
  } catch (err) {
    logger.warn({ err, key: h.key }, "postHighlight failed (non-fatal)");
    return null;
  }
}

type Broken = { key: string; playerId: number; playerName: string; value: number; previous: number; previousHolder: string | null };

/** Rank (1 = top) of each player by points, using the two players' points from before this match. */
async function ranksBefore(ids: [number, number], before: [number, number]): Promise<[number | null, number | null]> {
  const rows = (await db.execute(sql`SELECT id, points FROM players WHERE status <> 'INACTIVE'`)).rows as { id: number; points: number }[];
  const pts = new Map(rows.map(r => [Number(r.id), Number(r.points)]));
  pts.set(ids[0], before[0]); pts.set(ids[1], before[1]);
  const rank = (id: number) => (pts.has(id) ? 1 + [...pts.values()].filter(v => v > pts.get(id)!).length : null);
  return [rank(ids[0]), rank(ids[1])];
}

export async function postMatchHighlights(r: {
  matchId: number; gameType: string; winnerId: number; winnerName: string; loserId: number; loserName: string;
  winner180s: number; loser180s: number; wasUpset: boolean; winnerPointsBefore: number; loserPointsBefore: number;
  winnerStreakAfter: number; loserStreakBefore: number; loserEliminated: boolean;
}, broken: Broken[]): Promise<void> {
  const [wr, lr] = r.wasUpset ? await ranksBefore([r.winnerId, r.loserId], [r.winnerPointsBefore, r.loserPointsBefore]) : [null, null];
  for (const h of singlesHighlights({ ...r, winnerRankBefore: wr, loserRankBefore: lr })) await postHighlight(h);
  for (const b of broken) {
    const label = RECORD_LABELS[b.key as RecordKey];
    await postHighlight({
      key: `record:${b.key}:${r.matchId}`, kind: "record", playerId: b.playerId, matchId: r.matchId, link: "/records", players: [b.playerId],
      title: "NEW LEAGUE RECORD", stat: b.value, statLabel: label?.unit ?? "",
      line: `${b.playerName} set a new record for ${(label?.title ?? b.key).toLowerCase()}: ${b.value}${b.previousHolder ? `, beating ${b.previousHolder}'s ${b.previous}` : ` (was ${b.previous})`}.`,
    });
  }
}

/** Called once a scorer match's dart log is saved: a ton-plus winning finish becomes a moment. */
export async function postFinishHighlight(matchId: number, winnerLog: { val: number }[]): Promise<void> {
  const v = bigFinish(winnerLog);
  if (v == null) return;
  const m = (await db.execute(sql`SELECT winner_id, winner_name, loser_name, game_type FROM matches WHERE id = ${matchId}`)).rows[0] as any;
  if (!m || !/^(301|501|701)/.test(String(m.game_type))) return;
  await postHighlight({
    key: `finish:${matchId}`, kind: "big_finish", playerId: Number(m.winner_id), matchId, link: `/match-centre/league-${matchId}`,
    title: v === 170 ? "THE BIG FISH!" : "TON-PLUS FINISH", stat: v, statLabel: "checkout",
    line: `${m.winner_name} checked out ${v} to beat ${m.loser_name}.`,
  });
}

export async function postTargetHitHighlight(month: string, monthLabel: string, value: number, target: number, unit: string, players: number[]): Promise<void> {
  if (!players.length) return;
  await postHighlight({
    key: `target:${month}`, kind: "target_hit", playerId: players[0], players, link: "/",
    title: "LEAGUE TARGET HIT", stat: value, statLabel: unit,
    line: `The league hit ${monthLabel}'s target: ${value} of ${target} ${unit}. Everyone who played their part shares the reward.`,
  });
}

export async function postGafferHighlight(month: string, monthLabel: string, gafferId: number, name: string, how: string): Promise<void> {
  await postHighlight({
    key: `gaffer:${month}`, kind: "gaffer", playerId: gafferId, players: [gafferId], link: "/",
    title: "THE GAFFER", line: `${name} is ${monthLabel}'s Gaffer. ${how}`,
  });
}

export { ordinal };
