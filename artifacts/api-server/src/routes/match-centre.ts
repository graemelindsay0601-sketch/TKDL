import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

type MatchMode = "singles" | "team" | "doubles" | "shift_wars";

type CentreMatch = {
  key: string;
  id: number;
  mode: MatchMode;
  playedAt: string | Date;
  winnerName: string;
  loserName: string;
  winnerPlayerIds: number[];
  loserPlayerIds: number[];
  stake: number;
  eloChange: number | null;
  gameType: string;
  seasonName: string | null;
  notes: string | null;
  isCombined: boolean;
};

const router = Router();

// One read-only feed for the Match Centre. The league formats deliberately
// keep their own write paths and tables; this endpoint only normalises their
// public history after the fact, so it cannot affect scoring or standings.
router.get("/match-centre", async (_req, res): Promise<void> => {
  const [leagueResult, participantResult, doublesResult, doublesCombinedResult, doublesCombinedSidesResult, shiftResult, shiftCombinedResult, shiftCombinedSidesResult] = await Promise.all([
    db.execute(sql`
      SELECT m.*, s.name AS season_name
      FROM matches m
      LEFT JOIN seasons s ON s.id = m.season_id
      ORDER BY m.played_at DESC
      LIMIT 500
    `),
    db.execute(sql`
      SELECT match_id, player_id, team, position
      FROM match_participants
      ORDER BY match_id, team, position
    `),
    db.execute(sql`
      SELECT dm.id, dm.played_at, dm.stake, dm.elo_change, dm.game_type, dm.notes,
             wt.team_name AS winner_name, lt.team_name AS loser_name,
             s.name AS season_name
      FROM doubles_matches dm
      JOIN doubles_teams wt ON wt.id = dm.winner_team_id
      JOIN doubles_teams lt ON lt.id = dm.loser_team_id
      LEFT JOIN seasons s ON s.id = dm.season_id
      ORDER BY dm.played_at DESC
      LIMIT 500
    `),
    db.execute(sql`
      SELECT dcm.id, dcm.played_at, dcm.solo_won, dcm.pot, dcm.game_type, dcm.notes,
             st.team_name AS solo_name, s.name AS season_name
      FROM doubles_combined_matches dcm
      JOIN doubles_teams st ON st.id = dcm.solo_team_id
      LEFT JOIN seasons s ON s.id = dcm.season_id
      ORDER BY dcm.played_at DESC
      LIMIT 250
    `),
    db.execute(sql`
      SELECT ds.match_id, dt.team_name
      FROM doubles_combined_match_sides ds
      JOIN doubles_teams dt ON dt.id = ds.team_id
      ORDER BY ds.match_id, ds.id
    `),
    db.execute(sql`
      SELECT sm.id, sm.played_at, sm.stake, sm.game_type, sm.notes,
             wt.name AS winner_name, lt.name AS loser_name
      FROM shift_wars_matches sm
      JOIN shift_wars_teams wt ON wt.id = sm.winner_team_id
      JOIN shift_wars_teams lt ON lt.id = sm.loser_team_id
      ORDER BY sm.played_at DESC
      LIMIT 500
    `),
    db.execute(sql`
      SELECT scm.id, scm.played_at, scm.solo_won, scm.pot, scm.game_type, scm.notes,
             st.name AS solo_name
      FROM shift_wars_combined_matches scm
      JOIN shift_wars_teams st ON st.id = scm.solo_team_id
      ORDER BY scm.played_at DESC
      LIMIT 250
    `),
    db.execute(sql`
      SELECT ss.match_id, st.name AS team_name
      FROM shift_wars_combined_match_sides ss
      JOIN shift_wars_teams st ON st.id = ss.team_id
      ORDER BY ss.match_id, ss.id
    `),
  ]);

  const participants = new Map<number, { winner: number[]; loser: number[] }>();
  for (const row of participantResult.rows as any[]) {
    const entry = participants.get(row.match_id) ?? { winner: [], loser: [] };
    entry[row.team === "winner" ? "winner" : "loser"].push(row.player_id);
    participants.set(row.match_id, entry);
  }

  const groupNames = (rows: any[], field: string) => {
    const map = new Map<number, string[]>();
    for (const row of rows) map.set(row.match_id, [...(map.get(row.match_id) ?? []), row[field]]);
    return map;
  };
  const doublesSides = groupNames(doublesCombinedSidesResult.rows as any[], "team_name");
  const shiftSides = groupNames(shiftCombinedSidesResult.rows as any[], "team_name");

  const items: CentreMatch[] = [];
  for (const row of leagueResult.rows as any[]) {
    const teamGame = String(row.game_type).startsWith("team_") || row.game_type === "multi_killer";
    const people = participants.get(row.id);
    items.push({
      key: `league-${row.id}`, id: row.id, mode: teamGame ? "team" : "singles",
      playedAt: row.played_at, winnerName: row.winner_name, loserName: row.loser_name,
      winnerPlayerIds: people?.winner ?? [row.winner_id], loserPlayerIds: people?.loser ?? [row.loser_id],
      stake: row.stake, eloChange: row.elo_change, gameType: row.game_type,
      seasonName: row.season_name, notes: row.notes, isCombined: teamGame && ((people?.winner.length ?? 1) !== (people?.loser.length ?? 1)),
    });
  }
  for (const row of doublesResult.rows as any[]) items.push({
    key: `doubles-${row.id}`, id: row.id, mode: "doubles", playedAt: row.played_at,
    winnerName: row.winner_name, loserName: row.loser_name, winnerPlayerIds: [], loserPlayerIds: [],
    stake: row.stake, eloChange: row.elo_change, gameType: row.game_type,
    seasonName: row.season_name, notes: row.notes, isCombined: false,
  });
  for (const row of doublesCombinedResult.rows as any[]) {
    const combinedName = (doublesSides.get(row.id) ?? []).join(" + ");
    items.push({
      key: `doubles-combined-${row.id}`, id: row.id, mode: "doubles", playedAt: row.played_at,
      winnerName: row.solo_won ? row.solo_name : combinedName,
      loserName: row.solo_won ? combinedName : row.solo_name,
      winnerPlayerIds: [], loserPlayerIds: [], stake: row.pot, eloChange: null,
      gameType: row.game_type, seasonName: row.season_name, notes: row.notes, isCombined: true,
    });
  }
  for (const row of shiftResult.rows as any[]) items.push({
    key: `shift-${row.id}`, id: row.id, mode: "shift_wars", playedAt: row.played_at,
    winnerName: row.winner_name, loserName: row.loser_name, winnerPlayerIds: [], loserPlayerIds: [],
    stake: row.stake, eloChange: null, gameType: row.game_type,
    seasonName: null, notes: row.notes, isCombined: false,
  });
  for (const row of shiftCombinedResult.rows as any[]) {
    const combinedName = (shiftSides.get(row.id) ?? []).join(" + ");
    items.push({
      key: `shift-combined-${row.id}`, id: row.id, mode: "shift_wars", playedAt: row.played_at,
      winnerName: row.solo_won ? row.solo_name : combinedName,
      loserName: row.solo_won ? combinedName : row.solo_name,
      winnerPlayerIds: [], loserPlayerIds: [], stake: row.pot, eloChange: null,
      gameType: row.game_type, seasonName: null, notes: row.notes, isCombined: true,
    });
  }

  items.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.mode] = (acc[item.mode] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ items, counts: { all: items.length, ...counts } });
});

export default router;
