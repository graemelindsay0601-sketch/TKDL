import type { LeagueType } from "@workspace/db";

export type PowerRankingMatch = {
  leagueType: LeagueType;
  id: number;
  winnerId: number;
  winnerName: string;
  loserId: number;
  loserName: string;
  stake: number;
  playedAt: string;
  wasUpsetWin: boolean;
};

export type PowerRankingEntry = {
  id: number;
  name: string;
  rank: number;
  score: number;
  movement: number | null;
  recentForm: Array<"W" | "L">;
  wins: number;
  losses: number;
  pointsDelta: number;
  streak: { result: "W" | "L"; count: number };
  latestPlayedAt: string;
  chalkyVerdict: string;
  tonVerdict: string;
};

type Appearance = {
  result: "W" | "L";
  stake: number;
  opponentId: number;
  upset: boolean;
  playedAt: string;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreWindow(rows: Appearance[], opponentWinRates: Map<number, number>): number {
  let score = 50;
  for (const row of rows) {
    const stakeWeight = Math.min(Math.max(row.stake, 0), 20) * 0.3;
    if (row.result === "W") {
      score += 8 + stakeWeight + (opponentWinRates.get(row.opponentId) ?? 0.5) * 3 + (row.upset ? 4 : 0);
    } else {
      score -= 5 + stakeWeight;
    }
  }
  const first = rows[0];
  if (first) {
    const streak = rows.findIndex(row => row.result !== first.result);
    const count = streak === -1 ? rows.length : streak;
    score += (first.result === "W" ? 2 : -2) * Math.min(count, 4);
  }
  return clampScore(score);
}

function verdicts(entry: Omit<PowerRankingEntry, "chalkyVerdict" | "tonVerdict">): Pick<PowerRankingEntry, "chalkyVerdict" | "tonVerdict"> {
  const form = `${entry.wins} wins from the last ${entry.wins + entry.losses}`;
  const chalkyVerdict = entry.rank === 1
    ? `${entry.name} sets the current pace: ${form} is the strongest form line in this table.`
    : entry.streak.result === "W" && entry.streak.count >= 3
      ? `${entry.name} is climbing on a ${entry.streak.count}-match winning run. That momentum is real.`
      : entry.movement !== null && entry.movement > 0
        ? `${entry.name} has moved up ${entry.movement} place${entry.movement === 1 ? "" : "s"}; recent results are changing the picture.`
        : `${entry.name} sits at number ${entry.rank}, with ${form}.`;
  const tonVerdict = entry.pointsDelta > 0
    ? `The pressure numbers back it up: ${entry.pointsDelta} points gained across this form window.`
    : entry.pointsDelta < 0
      ? `${Math.abs(entry.pointsDelta)} points have gone the other way. The next response decides whether this is a dip or a slide.`
      : `The points balance is level across this window, so results provide the separation.`;
  return { chalkyVerdict, tonVerdict };
}

/**
 * A read-only form table. The newest five appearances form the current
 * window; appearances six to ten form the comparison window used for the
 * movement arrow. It needs no schedule or ranking snapshots and never
 * changes a league balance.
 */
export function buildPowerRankings(matches: PowerRankingMatch[], leagueType: LeagueType, limit = 12): PowerRankingEntry[] {
  const leagueMatches = matches.filter(match => match.leagueType === leagueType)
    .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt) || b.id - a.id);
  const records = new Map<number, { name: string; rows: Appearance[]; wins: number; games: number }>();
  const record = (id: number, name: string) => {
    const existing = records.get(id) ?? { name, rows: [], wins: 0, games: 0 };
    records.set(id, existing);
    return existing;
  };
  for (const match of leagueMatches) {
    const winner = record(match.winnerId, match.winnerName);
    winner.rows.push({ result: "W", stake: match.stake, opponentId: match.loserId, upset: match.wasUpsetWin, playedAt: match.playedAt });
    winner.wins++; winner.games++;
    const loser = record(match.loserId, match.loserName);
    loser.rows.push({ result: "L", stake: match.stake, opponentId: match.winnerId, upset: false, playedAt: match.playedAt });
    loser.games++;
  }
  const opponentWinRates = new Map([...records].map(([id, item]) => [id, item.games ? item.wins / item.games : 0.5]));
  const scored = [...records].map(([id, item]) => {
    const current = item.rows.slice(0, 5);
    const previous = item.rows.slice(5, 10);
    return { id, name: item.name, rows: item.rows, current, previous, score: scoreWindow(current, opponentWinRates), previousScore: scoreWindow(previous, opponentWinRates) };
  });
  scored.sort((a, b) => b.score - a.score || Date.parse(b.rows[0]?.playedAt ?? "") - Date.parse(a.rows[0]?.playedAt ?? "") || a.name.localeCompare(b.name));
  const previousOrder = [...scored].filter(item => item.previous.length > 0)
    .sort((a, b) => b.previousScore - a.previousScore || a.name.localeCompare(b.name));
  const previousRanks = new Map(previousOrder.map((item, index) => [item.id, index + 1]));
  return scored.slice(0, limit).map((item, index) => {
    const currentRank = index + 1;
    const previousRank = previousRanks.get(item.id);
    const first = item.current[0]?.result ?? "L";
    const breakAt = item.current.findIndex(row => row.result !== first);
    const streakCount = breakAt === -1 ? item.current.length : breakAt;
    const base = {
      id: item.id, name: item.name, rank: currentRank, score: item.score,
      movement: previousRank === undefined ? null : previousRank - currentRank,
      recentForm: item.current.map(row => row.result),
      wins: item.current.filter(row => row.result === "W").length,
      losses: item.current.filter(row => row.result === "L").length,
      pointsDelta: item.current.reduce((sum, row) => sum + (row.result === "W" ? row.stake : -row.stake), 0),
      streak: { result: first, count: streakCount }, latestPlayedAt: item.rows[0]?.playedAt ?? "",
    } satisfies Omit<PowerRankingEntry, "chalkyVerdict" | "tonVerdict">;
    return { ...base, ...verdicts(base) };
  });
}
