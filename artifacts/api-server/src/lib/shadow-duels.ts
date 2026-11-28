// When someone plays another player's shadow: tell the owner how their shadow got on,
// and count it for the Shadow Slayer table (wins against other people's shadows).
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { createNotification } from "./communityNotify";

export function duelMessage(challenger: string, won: boolean, detail: string | null, game: string | null): string {
  const g = game ? ` at ${game}` : "";
  const sc = detail && /^\d+\s*[-–]\s*\d+$/.test(detail.trim()) ? ` ${detail.trim()}` : "";
  return won ? `${challenger} beat your shadow${sc}${g}.` : `Your shadow held off ${challenger}${sc}${g}.`;
}

export async function afterShadowSession(s: { player1Id: number; shadowPlayerId: number; winnerIdx: number | null; detail: string | null; gameName: string | null }): Promise<void> {
  try {
    if (!s.shadowPlayerId || s.shadowPlayerId === s.player1Id || s.winnerIdx == null) return;
    const name = ((await db.execute(sql`SELECT name FROM players WHERE id = ${s.player1Id}`)).rows[0] as any)?.name ?? "Someone";
    await createNotification({ playerId: s.shadowPlayerId, type: "shadow_duel", actorId: s.player1Id,
      message: duelMessage(name, s.winnerIdx === 0, s.detail, s.gameName) });
  } catch (err) { logger.warn({ err }, "afterShadowSession failed (non-fatal)"); }
}

/** Shadow Slayer: wins against other players' shadows (distinct shadows beaten breaks ties). */
export async function shadowSlayers(limit = 10) {
  return ((await db.execute(sql`
    SELECT ps.player1_id player_id, pl.name,
      COUNT(*) FILTER (WHERE ps.winner_idx = 0)::int wins,
      COUNT(*)::int played,
      COUNT(DISTINCT (ps.session_data->>'shadowPlayerId')) FILTER (WHERE ps.winner_idx = 0)::int shadows_beaten
    FROM practice_sessions ps JOIN players pl ON pl.id = ps.player1_id
    WHERE ps.session_data ? 'shadowPlayerId' AND (ps.session_data->>'shadowPlayerId')::int <> ps.player1_id
    GROUP BY ps.player1_id, pl.name HAVING COUNT(*) FILTER (WHERE ps.winner_idx = 0) > 0
    ORDER BY wins DESC, shadows_beaten DESC, played ASC LIMIT ${limit}`)).rows as any[])
    .map(r => ({ playerId: Number(r.player_id), name: String(r.name), wins: Number(r.wins), played: Number(r.played), shadowsBeaten: Number(r.shadows_beaten) }));
}
