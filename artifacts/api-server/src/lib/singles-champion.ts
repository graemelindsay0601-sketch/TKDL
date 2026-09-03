// Pure decision logic for who (if anyone) is crowned Singles champion at
// season close. Deliberately has zero further imports so it can be unit
// tested directly with Node's built-in test runner (see
// __tests__/singles-champion.test.ts) without dragging in the database,
// logger, or anything else performSeasonReset() depends on.
//
// `contenders` is every ACTIVE player in any order; ties are decided on
// points alone, never Elo — the previous behavior (sort by points then Elo,
// crown whoever's first) silently let Elo settle a tie the Rules page says
// should go to a one-off no-stake tiebreaker match instead.
export type SinglesChampionDecision<P> =
  | { kind: "champion"; player: P }
  | { kind: "tied"; tied: P[]; points: number }
  | { kind: "none" };

export function decideSinglesChampion<P extends { id: number; points: number }>(
  contenders: P[],
  recordedChampionId: number | null
): SinglesChampionDecision<P> {
  if (recordedChampionId) {
    const recorded = contenders.find(p => p.id === recordedChampionId);
    // Found among current contenders -> use it. Not found (e.g. they've
    // since gone inactive) -> "none" tells the caller to fall back to the
    // championId/Name already stored on the season row rather than losing it.
    return recorded ? { kind: "champion", player: recorded } : { kind: "none" };
  }
  if (contenders.length === 0) return { kind: "none" };
  const topPoints = Math.max(...contenders.map(p => p.points));
  const tied = contenders.filter(p => p.points === topPoints);
  return tied.length > 1
    ? { kind: "tied", tied, points: topPoints }
    : { kind: "champion", player: tied[0] };
}
