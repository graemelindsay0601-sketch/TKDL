import { CAREER_SIMULATION_CONFIG as S } from "./config.ts";
import { clamp, type Performance } from "./types.ts";

/** Structural match for existing GameScorer BotConfig. No client engine dependency. */
export type CareerBotConfig = { avg: number; sd: number; checkoutPct: number; hitAcc: number };
export function toCareerBotConfig(performance: Performance, decisive = false): CareerBotConfig {
  const { scoring, consistency, finishing, powerScoring, clutch } = performance.effective;
  const a = S.adapter;
  return {
    avg: a.avgMin + scoring * a.avgScoringWeight + (powerScoring - scoring) * a.powerDifferenceWeight,
    sd: a.sdMin + (1 - consistency / 100) * a.sdRange,
    checkoutPct: clamp(a.checkoutMin + finishing * a.checkoutWeight + (decisive ? (clutch - S.clutchNeutral) / S.clutchNeutral * S.clutchWeight : 0), S.minimumHit, S.maximumHit),
    hitAcc: clamp(a.accuracyMin + scoring * a.accuracyWeight, S.minimumHit, S.maximumHit),
  };
}
