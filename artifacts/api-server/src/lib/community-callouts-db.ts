// Database side of Off the Oche call-outs and predictions (rules in community-callouts.ts).
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { createNotification } from "./communityNotify";
import { postHighlight } from "./community-highlights-db";
import { calloutLine, expired, type CalloutMeta } from "./community-callouts";

let ready: Promise<unknown> | null = null;
export const ensureCalloutTables = () => (ready ??= (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS community_predictions (
    post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    pick_id INTEGER NOT NULL,
    correct BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, player_id))`);
})().catch(e => { ready = null; throw e; }));

type Row = { id: number; auto_meta: CalloutMeta };

const pairSql = (a: number, b: number) => sql`(
  ((cp.auto_meta->>'challengerId')::int = ${a} AND (cp.auto_meta->>'targetId')::int = ${b}) OR
  ((cp.auto_meta->>'challengerId')::int = ${b} AND (cp.auto_meta->>'targetId')::int = ${a}))`;

async function setMeta(id: number, patch: Partial<CalloutMeta>) {
  await db.execute(sql`UPDATE community_posts SET auto_meta = auto_meta || ${JSON.stringify(patch)}::jsonb WHERE id = ${id}`);
}

/** Lapse any call-outs past their time (cheap; called before reads and writes). */
export async function sweepExpired(now = new Date()): Promise<void> {
  const rows = (await db.execute(sql`SELECT id, auto_meta FROM community_posts cp WHERE post_type = 'callout' AND auto_meta->>'status' IN ('open', 'accepted')`)).rows as Row[];
  for (const r of rows) if (expired(r.auto_meta, now)) await setMeta(r.id, { status: "expired" });
}

export async function openBetween(a: number, b: number): Promise<number> {
  const r = (await db.execute(sql`SELECT COUNT(*)::int n FROM community_posts cp WHERE post_type = 'callout' AND auto_meta->>'status' IN ('open', 'accepted') AND ${pairSql(a, b)}`)).rows[0] as { n: number };
  return Number(r.n);
}

export async function createCallout(me: { id: number; name: string }, target: { id: number; name: string }, game: string | null, message: string | null): Promise<number> {
  const meta: CalloutMeta = { challengerId: me.id, challengerName: me.name, targetId: target.id, targetName: target.name, game, message, status: "open", createdAt: new Date().toISOString() };
  const r = await db.execute(sql`INSERT INTO community_posts (player_id, content, post_type, auto_meta, status, approved_at)
    VALUES (${me.id}, ${[calloutLine(meta), message].filter(Boolean).join(" ")}, 'callout', ${JSON.stringify(meta)}::jsonb, 'approved', NOW()) RETURNING id`);
  const id = Number((r.rows[0] as { id: number }).id);
  void createNotification({ playerId: target.id, type: "callout", actorId: me.id, entityId: id, entityType: "post",
    message: `${me.name} has called you out${game ? ` to ${game}` : ""}. Accept or duck it on Off the Oche.` });
  return id;
}

export async function getCallout(id: number): Promise<Row | null> {
  return ((await db.execute(sql`SELECT id, auto_meta FROM community_posts WHERE id = ${id} AND post_type = 'callout'`)).rows[0] as Row) ?? null;
}

export async function respond(row: Row, accept: boolean): Promise<void> {
  const m = row.auto_meta;
  await setMeta(row.id, { status: accept ? "accepted" : "declined", respondedAt: new Date().toISOString() });
  void createNotification({ playerId: m.challengerId, type: "callout", actorId: m.targetId, entityId: row.id, entityType: "post",
    message: accept ? `${m.targetName} accepted your call-out. Game on.` : `${m.targetName} declined your call-out.` });
}

export async function predict(postId: number, playerId: number, pickId: number): Promise<void> {
  await db.execute(sql`INSERT INTO community_predictions (post_id, player_id, pick_id) VALUES (${postId}, ${playerId}, ${pickId})
    ON CONFLICT (post_id, player_id) DO UPDATE SET pick_id = EXCLUDED.pick_id, created_at = NOW()`);
}

/**
 * After a singles result: settle the live call-out between these two (made before the
 * match; playing it counts as accepting an open one), mark predictions, post the moment and tell everyone involved.
 */
export async function settleCallouts(match: { id: number; winnerId: number; loserId: number; winnerName: string; loserName: string; playedAt: Date }): Promise<void> {
  try {
    await ensureCalloutTables();
    const rows = (await db.execute(sql`SELECT id, auto_meta FROM community_posts cp WHERE post_type = 'callout'
      AND auto_meta->>'status' IN ('open', 'accepted') AND created_at <= ${match.playedAt} AND ${pairSql(match.winnerId, match.loserId)} ORDER BY created_at LIMIT 1`)).rows as Row[];
    const row = rows[0];
    if (!row) return;
    const m = row.auto_meta;
    const claimed = await db.execute(sql`UPDATE community_posts SET auto_meta = auto_meta || ${JSON.stringify({ status: "settled", matchId: match.id, winnerId: match.winnerId, settledAt: new Date().toISOString() })}::jsonb
      WHERE id = ${row.id} AND auto_meta->>'status' IN ('open', 'accepted') RETURNING id`);
    if (!claimed.rows.length) return;
    await db.execute(sql`UPDATE community_predictions SET correct = (pick_id = ${match.winnerId}) WHERE post_id = ${row.id}`);
    const answered = match.winnerId === m.targetId;
    await postHighlight({
      key: `callout:${row.id}`, kind: "callout_result", playerId: match.winnerId, matchId: match.id, players: [match.winnerId, match.loserId],
      link: `/match-centre/league-${match.id}`, title: answered ? "CALL-OUT ANSWERED" : "CALL-OUT BACKED UP",
      line: answered ? `${match.winnerName} answered ${match.loserName}'s call-out and won.` : `${match.winnerName} called out ${match.loserName} and backed it up.`,
    });
    await import("./oche-extras-db").then(x => x.afterCalloutSettled(row.id, match.winnerId, match.winnerName));
    for (const pid of [m.challengerId, m.targetId]) void createNotification({ playerId: pid, type: "callout", entityId: row.id, entityType: "post",
      message: `Call-out settled: ${match.winnerName} beat ${match.loserName}.` });
    const right = (await db.execute(sql`SELECT player_id FROM community_predictions WHERE post_id = ${row.id} AND correct`)).rows as { player_id: number }[];
    for (const r of right) void createNotification({ playerId: Number(r.player_id), type: "callout", entityId: row.id, entityType: "post",
      message: `You called it: ${match.winnerName} beat ${match.loserName}.` });
  } catch (err) {
    logger.warn({ err, matchId: match.id }, "settleCallouts failed (non-fatal)");
  }
}

/** Prediction table: right / settled picks per player, best first (at least 1 settled pick). */
export async function predictionLeaders(): Promise<{ playerId: number; name: string; right: number; total: number }[]> {
  await ensureCalloutTables();
  const rows = (await db.execute(sql`SELECT p.player_id, pl.name, COUNT(*) FILTER (WHERE p.correct)::int AS right_n, COUNT(*)::int AS total
    FROM community_predictions p JOIN players pl ON pl.id = p.player_id WHERE p.correct IS NOT NULL
    GROUP BY p.player_id, pl.name ORDER BY right_n DESC, total ASC, pl.name LIMIT 10`)).rows as any[];
  return rows.map(r => ({ playerId: Number(r.player_id), name: String(r.name), right: Number(r.right_n), total: Number(r.total) }));
}
