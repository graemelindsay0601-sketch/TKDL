// Per-player stats for non-X01 games played on the live scorer, sent with a
// league result so League Records and the Halls can cover Cricket and
// Around the World. Built from each player's own dart log, so they only
// exist for games scored live from the first dart (a resumed game sends none).

export type GameDart = { seg: number; mult: number; newVisit: boolean; advance?: number; onBull?: boolean };

export type CricketGameStats = {
  game: "cricket"; darts: number; visits: number; marks: number;
  bestVisit: number; nineMarkVisits: number; blankVisits: number;
};

export type AtwGameStats = {
  game: "atw"; darts: number; visits: number;
  bestVisit: number; trebleSkips: number; doubleSkips: number; bullDarts: number; blankVisits: number;
};

export type GameStats = CricketGameStats | AtwGameStats;

function visitsOf(log: GameDart[]): GameDart[][] {
  const out: GameDart[][] = [];
  for (const d of log) {
    if (d.newVisit || out.length === 0) out.push([]);
    out[out.length - 1].push(d);
  }
  return out;
}

/** Marks = hits on the game's cricket numbers (outer bull 1, bullseye 2), the usual marks-per-round measure. */
export function cricketGameStats(log: GameDart[], nums: number[]): CricketGameStats {
  const markOf = (d: GameDart) => (d.seg > 0 && nums.includes(d.seg) ? Math.min(d.mult, d.seg === 25 ? 2 : 3) : 0);
  const visits = visitsOf(log).map(v => v.reduce((n, d) => n + markOf(d), 0));
  return {
    game: "cricket",
    darts: log.length,
    visits: visits.length,
    marks: visits.reduce((a, b) => a + b, 0),
    bestVisit: visits.length ? Math.max(...visits) : 0,
    nineMarkVisits: visits.filter(m => m >= 9).length,
    blankVisits: visits.filter(m => m === 0).length,
  };
}

export function atwGameStats(log: GameDart[]): AtwGameStats {
  const visits = visitsOf(log);
  return {
    game: "atw",
    darts: log.length,
    visits: visits.length,
    bestVisit: visits.length ? Math.max(...visits.map(v => v.reduce((n, d) => n + (d.advance ?? 0), 0))) : 0,
    trebleSkips: log.filter(d => d.mult === 3 && (d.advance ?? 0) > 1).length,
    doubleSkips: log.filter(d => d.mult === 2 && (d.advance ?? 0) > 1).length,
    bullDarts: log.filter(d => d.onBull).length,
    blankVisits: visits.filter(v => v.every(d => !(d.advance ?? 0))).length,
  };
}
