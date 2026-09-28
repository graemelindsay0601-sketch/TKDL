import { ELO_FLOOR } from "./elo.ts";

export type RollbackBalance = { elo: number; points: number; careerPoints: number };

/** Reverse exact signed changes recorded when a participant's match settled. */
export function reverseRecordedParticipant(
  current: RollbackBalance,
  pointsDelta: number,
  eloDelta: number,
): RollbackBalance {
  return {
    elo: Math.max(ELO_FLOOR, current.elo - eloDelta),
    points: Math.max(0, current.points - pointsDelta),
    careerPoints: current.careerPoints - pointsDelta,
  };
}
