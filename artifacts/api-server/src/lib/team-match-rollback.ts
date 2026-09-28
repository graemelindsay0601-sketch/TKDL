export type TeamLedgerSnapshot = {
  points: number;
  elo?: number;
  wins: number;
  losses: number;
  isEliminated?: boolean;
};

export function reverseTeamLedger(
  current: TeamLedgerSnapshot,
  recorded: { pointsDelta: number; eloDelta?: number; won: boolean; causedElimination?: boolean },
): TeamLedgerSnapshot {
  const points = current.points - recorded.pointsDelta;
  if (points < 0) throw new RangeError("Team balance changed after this result");
  return {
    points,
    ...(current.elo !== undefined ? { elo: current.elo - (recorded.eloDelta ?? 0) } : {}),
    wins: Math.max(0, current.wins - (recorded.won ? 1 : 0)),
    losses: Math.max(0, current.losses - (recorded.won ? 0 : 1)),
    ...(current.isEliminated !== undefined
      ? { isEliminated: recorded.causedElimination && points > 0 ? false : current.isEliminated }
      : {}),
  };
}
