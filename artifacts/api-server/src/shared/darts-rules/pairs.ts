/**
 * Pairs (doubles) throwing order. Both players of a team share one score and visits alternate between
 * them: A1, B1, A2, B2, A1… The order carries on across legs for the whole match (the next player of the
 * team throws the team's next visit, whichever team starts the leg).
 *
 * Member 0 is the team's captain (in singles every visit is member 0). `memberVisit` counts only that
 * player's own visits, so a captain's seeded visits are indexed exactly as in singles.
 */
import type { PlayerIdx } from "./x01.ts";

export type PairsSeat = { team: PlayerIdx; member: 0 | 1; memberVisit: number };

/** Seat of the visit that follows `visits` (completed visits, in order) when `team` throws next. */
export function pairsSeat(visits: readonly { thrower: PlayerIdx }[], team: PlayerIdx, sideSize: 1 | 2 = 2): PairsSeat {
  const prior = visits.reduce((n, v) => n + (v.thrower === team ? 1 : 0), 0);
  return sideSize === 1 ? { team, member: 0, memberVisit: prior } : { team, member: (prior % 2) as 0 | 1, memberVisit: Math.floor(prior / 2) };
}

/** Seats of every completed visit, in order. */
export function pairsSeats(visits: readonly { thrower: PlayerIdx }[], sideSize: 1 | 2 = 2): PairsSeat[] {
  const count: [number, number] = [0, 0];
  return visits.map(v => {
    const prior = count[v.thrower]++;
    return sideSize === 1 ? { team: v.thrower, member: 0, memberVisit: prior } : { team: v.thrower, member: (prior % 2) as 0 | 1, memberVisit: Math.floor(prior / 2) };
  });
}
