import { CAREER_DEVELOPMENT_CONFIG as D, CAREER_SIMULATION_CONFIG as S } from "./config.ts";
import { clamp, type MatchStats, type Performance } from "./types.ts";

export function formAfterMatch(form: number, performance: Performance, stats: MatchStats, opponent?: Performance): number {
  const scoringQuality = (stats.average - performance.expectedAverage) / S.form.averageScale;
  const finishingQuality = (stats.checkoutPercentage / 100 - performance.expectedCheckout) / S.form.checkoutScale;
  const opponentContext = opponent ? clamp((opponent.expectedAverage - performance.expectedAverage) / S.form.opponentAverageScale, -1, 1) * S.form.opponentContextWeight : 0;
  const quality = clamp(scoringQuality * S.form.scoringShare + finishingQuality * S.form.finishingShare + opponentContext, -1, 1);
  // Win/loss is intentionally not an input. A fine defeat can improve form.
  return clamp(form * D.formMatchRetention + quality * D.formSignalWeight, -D.formLimit, D.formLimit);
}
export const regressForm = (form: number, elapsedYears: number) => form * Math.exp(-D.formYearDecay * elapsedYears);
