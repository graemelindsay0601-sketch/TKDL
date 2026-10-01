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

type DetailKind = "league" | "doubles" | "doubles-combined" | "doubles-multi" | "shift" | "shift-combined" | "shift-multi";
function parseDetailKey(value: string): { kind: DetailKind; id: number } | null {
  const match = /^(league|doubles-combined|doubles-multi|doubles|shift-combined|shift-multi|shift)-(\d+)$/.exec(value);
  if (!match || Number(match[2]) < 1) return null;
  return { kind: match[1] as DetailKind, id: Number(match[2]) };
}

router.get("/match-centre/:key", async (req, res): Promise<void> => {
  const parsed = parseDetailKey(String(req.params.key));
  if (!parsed) { res.status(400).json({ error: "Invalid match reference" }); return; }

  let result: any;
  if (parsed.kind === "league") {
    const [matchResult, participantResult] = await Promise.all([
      db.execute(sql`SELECT m.*, s.name AS season_name FROM matches m LEFT JOIN seasons s ON s.id=m.season_id WHERE m.id=${parsed.id}`),
      db.execute(sql`SELECT player_id, player_name, team, position, points_delta, elo_delta, caused_elimination FROM match_participants WHERE match_id=${parsed.id} ORDER BY team DESC, position`),
    ]);
    const row: any = matchResult.rows[0];
    if (row) {
      const participants = participantResult.rows as any[];
      const teamGame = String(row.game_type).startsWith("team_") || row.game_type === "multi_killer";
      const winnerPeople = participants.filter(p => p.team === "winner");
      const loserPeople = participants.filter(p => p.team === "loser");
      const sumDelta = (rows: any[], field: string, fallback: number) => rows.length && rows.every(p => p[field] != null)
        ? rows.reduce((total, p) => total + Number(p[field]), 0) : fallback;
      let context = null;
      if (!teamGame) {
        const h2h = await db.execute(sql`
          SELECT COUNT(*)::int prior_meetings,
            COUNT(*) FILTER (WHERE winner_id=${row.winner_id})::int winner_wins,
            COUNT(*) FILTER (WHERE winner_id=${row.loser_id})::int loser_wins
          FROM matches
          WHERE played_at < ${row.played_at}
            AND game_type NOT LIKE 'team_%' AND game_type <> 'multi_killer'
            AND ((winner_id=${row.winner_id} AND loser_id=${row.loser_id}) OR (winner_id=${row.loser_id} AND loser_id=${row.winner_id}))
        `);
        const history:any=h2h.rows[0];
        context={meetingNumber:Number(history.prior_meetings)+1,winnerWinsBefore:Number(history.winner_wins),loserWinsBefore:Number(history.loser_wins)};
      }
      result = {
        key: req.params.key, mode: teamGame ? "team" : "singles", isCombined: teamGame && winnerPeople.length !== loserPeople.length,
        playedAt: row.played_at, seasonName: row.season_name, gameType: row.game_type, notes: row.notes, stake: row.stake,
        winner: { name: row.winner_name, pointsDelta: sumDelta(winnerPeople, "points_delta", row.stake), eloDelta: sumDelta(winnerPeople, "elo_delta", row.elo_change) },
        loser: { name: row.loser_name, pointsDelta: sumDelta(loserPeople, "points_delta", -row.stake), eloDelta: sumDelta(loserPeople, "elo_delta", -row.elo_change) },
        participants,
        context,
        stats: {
          winner: { darts: row.winner_darts, scores100: row.winner_100s, scores140: row.winner_140s, scores170: row.winner_170s, scores180: row.winner_180s, checkoutAttempts: row.winner_checkout_attempts, checkoutHits: row.winner_checkout_hits },
          loser: { darts: row.loser_darts, scores100: row.loser_100s, scores140: row.loser_140s, scores170: row.loser_170s, scores180: row.loser_180s, checkoutAttempts: row.loser_checkout_attempts, checkoutHits: row.loser_checkout_hits },
        },
      };
    }
  } else if (parsed.kind === "doubles") {
    const q = await db.execute(sql`SELECT dm.*, s.name season_name, wt.team_name winner_name, lt.team_name loser_name FROM doubles_matches dm JOIN doubles_teams wt ON wt.id=dm.winner_team_id JOIN doubles_teams lt ON lt.id=dm.loser_team_id LEFT JOIN seasons s ON s.id=dm.season_id WHERE dm.id=${parsed.id}`);
    const row: any = q.rows[0];
    if (row) result = { key:req.params.key, mode:"doubles", isCombined:false, playedAt:row.played_at, seasonName:row.season_name, gameType:row.game_type, notes:row.notes, stake:row.stake, winner:{name:row.winner_name,pointsDelta:row.stake,eloDelta:row.winner_elo_delta ?? row.elo_change}, loser:{name:row.loser_name,pointsDelta:-row.stake,eloDelta:row.loser_elo_delta ?? -row.elo_change}, participants:[], stats:null };
  } else if (parsed.kind === "doubles-multi" || parsed.kind === "shift-multi") {
    // 3+ official teams, one live elimination match — last team standing
    // wins the full pot, everyone else pays the flat stake (see
    // routes/doubles.ts|shift-wars.ts's own /multi-matches endpoints and
    // lib/wager.ts's applyMultiWager). "winner" here is the single survivor;
    // "loser" aggregates every eliminated team, same join-the-names
    // convention the combined-match branch above uses for its own
    // multi-team opposition side.
    const multiDoubles = parsed.kind === "doubles-multi";
    const main = multiDoubles
      ? await db.execute(sql`SELECT m.*, s.name season_name, wt.team_name winner_name FROM doubles_multi_matches m JOIN doubles_teams wt ON wt.id=m.winner_team_id LEFT JOIN seasons s ON s.id=m.season_id WHERE m.id=${parsed.id}`)
      : await db.execute(sql`SELECT m.*, s.name season_name, wt.name winner_name FROM shift_wars_multi_matches m JOIN shift_wars_teams wt ON wt.id=m.winner_team_id LEFT JOIN seasons s ON s.id=m.season_id WHERE m.id=${parsed.id}`);
    const participantRows = multiDoubles
      ? await db.execute(sql`SELECT t.team_name name, p.is_winner, p.points_delta, p.elo_delta, p.eliminated FROM doubles_multi_match_participants p JOIN doubles_teams t ON t.id=p.team_id WHERE p.match_id=${parsed.id} ORDER BY p.is_winner DESC, p.id`)
      : await db.execute(sql`SELECT t.name, p.is_winner, p.points_delta, NULL::integer elo_delta, p.eliminated FROM shift_wars_multi_match_participants p JOIN shift_wars_teams t ON t.id=p.team_id WHERE p.match_id=${parsed.id} ORDER BY p.is_winner DESC, p.id`);
    const row: any = main.rows[0];
    const people = participantRows.rows as any[];
    if (row && people.length > 0) {
      const winnerRow = people.find(p => p.is_winner);
      const loserRows = people.filter(p => !p.is_winner);
      const loserNames = loserRows.map(p => p.name).join(" + ");
      result = {
        key: req.params.key, mode: multiDoubles ? "doubles" : "shift_wars", isCombined: false,
        playedAt: row.played_at, seasonName: row.season_name, gameType: row.game_type, notes: row.notes, stake: row.pot,
        winner: { name: row.winner_name, pointsDelta: winnerRow?.points_delta ?? row.pot, eloDelta: multiDoubles ? (winnerRow?.elo_delta ?? row.elo_change) : null },
        loser: { name: loserNames, pointsDelta: loserRows.reduce((n, p) => n + Number(p.points_delta), 0), eloDelta: multiDoubles ? loserRows.reduce((n, p) => n + Number(p.elo_delta), 0) : null },
        participants: people.map((p, i) => ({ playerName: p.name, team: p.is_winner ? "winner" : "loser", position: i, pointsDelta: p.points_delta, eloDelta: p.elo_delta, causedElimination: p.eliminated })),
        stats: null,
      };
    }
  } else {
    const doubles = parsed.kind === "doubles-combined";
    const shift = parsed.kind === "shift";
    if (shift) {
      const q = await db.execute(sql`SELECT sm.*, s.name season_name, wt.name winner_name, lt.name loser_name FROM shift_wars_matches sm JOIN shift_wars_teams wt ON wt.id=sm.winner_team_id JOIN shift_wars_teams lt ON lt.id=sm.loser_team_id LEFT JOIN seasons s ON s.id=sm.season_id WHERE sm.id=${parsed.id}`);
      const row:any=q.rows[0];
      if(row) result={key:req.params.key,mode:"shift_wars",isCombined:false,playedAt:row.played_at,seasonName:row.season_name,gameType:row.game_type,notes:row.notes,stake:row.stake,winner:{name:row.winner_name,pointsDelta:row.stake,eloDelta:null},loser:{name:row.loser_name,pointsDelta:-row.stake,eloDelta:null},participants:[],stats:null};
    } else {
      const main = doubles
        ? await db.execute(sql`SELECT m.*, s.name season_name, t.team_name solo_name FROM doubles_combined_matches m JOIN doubles_teams t ON t.id=m.solo_team_id LEFT JOIN seasons s ON s.id=m.season_id WHERE m.id=${parsed.id}`)
        : await db.execute(sql`SELECT m.*, s.name season_name, t.name solo_name FROM shift_wars_combined_matches m JOIN shift_wars_teams t ON t.id=m.solo_team_id LEFT JOIN seasons s ON s.id=m.season_id WHERE m.id=${parsed.id}`);
      const sides = doubles
        ? await db.execute(sql`SELECT t.team_name name, x.fielded_count, x.points_delta, x.elo_delta, x.eliminated FROM doubles_combined_match_sides x JOIN doubles_teams t ON t.id=x.team_id WHERE x.match_id=${parsed.id} ORDER BY x.id`)
        : await db.execute(sql`SELECT t.name, x.fielded_count, x.points_delta, NULL::integer elo_delta, false eliminated FROM shift_wars_combined_match_sides x JOIN shift_wars_teams t ON t.id=x.team_id WHERE x.match_id=${parsed.id} ORDER BY x.id`);
      const row:any=main.rows[0]; const sideRows=sides.rows as any[];
      if(row){ const opposition=sideRows.map(x=>x.name).join(" + "); result={key:req.params.key,mode:doubles?"doubles":"shift_wars",isCombined:true,playedAt:row.played_at,seasonName:row.season_name,gameType:row.game_type,notes:row.notes,stake:row.pot,winner:{name:row.solo_won?row.solo_name:opposition,pointsDelta:row.solo_won?row.solo_points_delta:sideRows.reduce((n,x)=>n+Number(x.points_delta),0),eloDelta:doubles?(row.solo_won?row.solo_elo_delta:sideRows.reduce((n,x)=>n+Number(x.elo_delta),0)):null},loser:{name:row.solo_won?opposition:row.solo_name,pointsDelta:row.solo_won?sideRows.reduce((n,x)=>n+Number(x.points_delta),0):row.solo_points_delta,eloDelta:doubles?(row.solo_won?sideRows.reduce((n,x)=>n+Number(x.elo_delta),0):row.solo_elo_delta):null},participants:[{playerName:row.solo_name,team:"solo",position:0,fieldedCount:row.solo_fielded_count,pointsDelta:row.solo_points_delta,eloDelta:doubles?row.solo_elo_delta:null},...sideRows.map((x,i)=>({playerName:x.name,team:"opposition",position:i,fieldedCount:x.fielded_count,pointsDelta:x.points_delta,eloDelta:x.elo_delta,causedElimination:x.eliminated}))],stats:null}; }
    }
  }
  if (!result) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(result);
});

// One read-only feed for the Match Centre. The league formats deliberately
// keep their own write paths and tables; this endpoint only normalises their
// public history after the fact, so it cannot affect scoring or standings.
router.get("/match-centre", async (_req, res): Promise<void> => {
  const [leagueResult, participantResult, doublesResult, doublesCombinedResult, doublesCombinedSidesResult, shiftResult, shiftCombinedResult, shiftCombinedSidesResult, doublesMultiResult, doublesMultiLosersResult, shiftMultiResult, shiftMultiLosersResult] = await Promise.all([
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
             wt.name AS winner_name, lt.name AS loser_name, s.name AS season_name
      FROM shift_wars_matches sm
      JOIN shift_wars_teams wt ON wt.id = sm.winner_team_id
      JOIN shift_wars_teams lt ON lt.id = sm.loser_team_id
      LEFT JOIN seasons s ON s.id = sm.season_id
      ORDER BY sm.played_at DESC
      LIMIT 500
    `),
    db.execute(sql`
      SELECT scm.id, scm.played_at, scm.solo_won, scm.pot, scm.game_type, scm.notes,
             st.name AS solo_name, s.name AS season_name
      FROM shift_wars_combined_matches scm
      JOIN shift_wars_teams st ON st.id = scm.solo_team_id
      LEFT JOIN seasons s ON s.id = scm.season_id
      ORDER BY scm.played_at DESC
      LIMIT 250
    `),
    db.execute(sql`
      SELECT ss.match_id, st.name AS team_name
      FROM shift_wars_combined_match_sides ss
      JOIN shift_wars_teams st ON st.id = ss.team_id
      ORDER BY ss.match_id, ss.id
    `),
    // 3+ official pairings/departments, one live elimination match (see
    // db/migrations/add_multi_matches.ts). One winner row per match plus a
    // "losers" side query (mirroring doublesCombinedSidesResult's pattern
    // above) to join every eliminated team's name for the feed label.
    db.execute(sql`
      SELECT dmm.id, dmm.played_at, dmm.stake, dmm.pot, dmm.elo_change, dmm.game_type, dmm.notes,
             wt.team_name AS winner_name, s.name AS season_name
      FROM doubles_multi_matches dmm
      JOIN doubles_teams wt ON wt.id = dmm.winner_team_id
      LEFT JOIN seasons s ON s.id = dmm.season_id
      ORDER BY dmm.played_at DESC
      LIMIT 250
    `),
    db.execute(sql`
      SELECT p.match_id, t.team_name
      FROM doubles_multi_match_participants p
      JOIN doubles_teams t ON t.id = p.team_id
      WHERE p.is_winner = false
      ORDER BY p.match_id, p.id
    `),
    db.execute(sql`
      SELECT smm.id, smm.played_at, smm.stake, smm.pot, smm.game_type, smm.notes,
             wt.name AS winner_name, s.name AS season_name
      FROM shift_wars_multi_matches smm
      JOIN shift_wars_teams wt ON wt.id = smm.winner_team_id
      LEFT JOIN seasons s ON s.id = smm.season_id
      ORDER BY smm.played_at DESC
      LIMIT 250
    `),
    db.execute(sql`
      SELECT p.match_id, t.name AS team_name
      FROM shift_wars_multi_match_participants p
      JOIN shift_wars_teams t ON t.id = p.team_id
      WHERE p.is_winner = false
      ORDER BY p.match_id, p.id
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
  const doublesMultiLosers = groupNames(doublesMultiLosersResult.rows as any[], "team_name");
  const shiftMultiLosers = groupNames(shiftMultiLosersResult.rows as any[], "team_name");

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
    seasonName: row.season_name, notes: row.notes, isCombined: false,
  });
  for (const row of shiftCombinedResult.rows as any[]) {
    const combinedName = (shiftSides.get(row.id) ?? []).join(" + ");
    items.push({
      key: `shift-combined-${row.id}`, id: row.id, mode: "shift_wars", playedAt: row.played_at,
      winnerName: row.solo_won ? row.solo_name : combinedName,
      loserName: row.solo_won ? combinedName : row.solo_name,
      winnerPlayerIds: [], loserPlayerIds: [], stake: row.pot, eloChange: null,
      gameType: row.game_type, seasonName: row.season_name, notes: row.notes, isCombined: true,
    });
  }
  // 3+-team multi-matches: not a handicap/combined-side match (every
  // participant is a full official team), so isCombined stays false — the
  // frontend's "HANDICAP" badge would be a misleading label here. The
  // joined loser names already communicate "more than one opponent" on
  // their own, the same way doubles/shift "combined" entries do.
  for (const row of doublesMultiResult.rows as any[]) items.push({
    key: `doubles-multi-${row.id}`, id: row.id, mode: "doubles", playedAt: row.played_at,
    winnerName: row.winner_name, loserName: (doublesMultiLosers.get(row.id) ?? []).join(" + "),
    winnerPlayerIds: [], loserPlayerIds: [], stake: row.pot, eloChange: row.elo_change,
    gameType: row.game_type, seasonName: row.season_name, notes: row.notes, isCombined: false,
  });
  for (const row of shiftMultiResult.rows as any[]) items.push({
    key: `shift-multi-${row.id}`, id: row.id, mode: "shift_wars", playedAt: row.played_at,
    winnerName: row.winner_name, loserName: (shiftMultiLosers.get(row.id) ?? []).join(" + "),
    winnerPlayerIds: [], loserPlayerIds: [], stake: row.pot, eloChange: null,
    gameType: row.game_type, seasonName: row.season_name, notes: row.notes, isCombined: false,
  });

  items.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.mode] = (acc[item.mode] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ items, counts: { all: items.length, ...counts } });
});

export default router;
