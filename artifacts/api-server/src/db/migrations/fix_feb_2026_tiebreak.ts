import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

/**
 * February 2026 (301 round robin): Robert, Graeme and Sean all finished 9-2,
 * and a tiebreaker settled it. Sean beat both, Graeme beat Robert, so the
 * order of merit is Sean 1st, Graeme 2nd, Robert 3rd. The imported table had
 * them as Robert, Graeme, Sean.
 *
 * Only acts when the table still has exactly the old order (Robert 1, Graeme 2,
 * Sean 3), so it runs once and never touches a table someone has since edited.
 */
export async function fixFeb2026Tiebreak(): Promise<void> {
  const rows = (await db.execute(sql`
    SELECT ss.player_id, ss.position, p.name FROM season_standings ss
    JOIN seasons s ON s.id = ss.season_id JOIN players p ON p.id = ss.player_id
    WHERE s.name = 'February 2026' AND ss.position IN (1, 2, 3)`)).rows as { player_id: number; position: number; name: string }[];
  const at = (pos: number) => rows.find(r => Number(r.position) === pos)?.name?.trim().toLowerCase();
  if (rows.length !== 3 || at(1) !== "robert" || at(2) !== "graeme" || at(3) !== "sean") return;
  const id = (name: string) => Number(rows.find(r => r.name.trim().toLowerCase() === name)!.player_id);
  await db.execute(sql`
    UPDATE season_standings ss SET position = v.pos
    FROM (VALUES (${id("sean")}::int, 1), (${id("graeme")}::int, 2), (${id("robert")}::int, 3)) AS v(pid, pos), seasons s
    WHERE s.id = ss.season_id AND s.name = 'February 2026' AND ss.player_id = v.pid`);
  logger.info("February 2026 table: tiebreaker order applied (Sean, Graeme, Robert)");
}
