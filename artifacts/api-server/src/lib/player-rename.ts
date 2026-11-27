import { sql } from "drizzle-orm";

type Exec = { execute: (q: any) => Promise<any> };

/**
 * Result rows keep a copy of each player's name from when the match was
 * played. After a rename, bring those copies (and any Doubles pairing name
 * built from it, "A & B") up to the player's current name, so result cards,
 * the Hub and Match Centre show who they are now.
 */
async function hasTable(tx: Exec, name: string): Promise<boolean> {
  const r = await tx.execute(sql`SELECT to_regclass(${name}) IS NOT NULL AS ok`);
  return !!((r.rows ?? r)[0] as any)?.ok;
}

export async function syncPlayerNames(tx: Exec, playerId?: number): Promise<void> {
  const only = playerId == null ? sql`` : sql` AND p.id = ${playerId}`;
  await tx.execute(sql`UPDATE matches m SET winner_name = p.name FROM players p WHERE p.id = m.winner_id AND m.winner_name IS DISTINCT FROM p.name${only}`);
  await tx.execute(sql`UPDATE matches m SET loser_name = p.name FROM players p WHERE p.id = m.loser_id AND m.loser_name IS DISTINCT FROM p.name${only}`);
  if (await hasTable(tx, "match_participants")) await tx.execute(sql`UPDATE match_participants x SET player_name = p.name FROM players p WHERE p.id = x.player_id AND x.player_name IS DISTINCT FROM p.name${only}`);
  if (await hasTable(tx, "team_match_participants")) await tx.execute(sql`UPDATE team_match_participants x SET player_name = p.name FROM players p WHERE p.id = x.player_id AND x.player_name IS DISTINCT FROM p.name${only}`);
  // Doubles pairing names are always generated as "A & B[ & C]" in member order
  // (doublesDraw.ts) and can't be renamed by hand, so rebuild them from members.
  const teamFilter = playerId == null ? sql`` : sql` AND ${playerId} IN (t.player1_id, t.player2_id, t.player3_id)`;
  if (await hasTable(tx, "doubles_teams")) await tx.execute(sql`
    UPDATE doubles_teams t SET team_name = n.name
    FROM (
      SELECT t2.id, concat_ws(' & ', p1.name, p2.name, p3.name) AS name
      FROM doubles_teams t2
      JOIN players p1 ON p1.id = t2.player1_id
      JOIN players p2 ON p2.id = t2.player2_id
      LEFT JOIN players p3 ON p3.id = t2.player3_id
    ) n
    WHERE n.id = t.id AND t.team_name IS DISTINCT FROM n.name
      AND t.team_name LIKE '% & %'${teamFilter}
  `);
}
