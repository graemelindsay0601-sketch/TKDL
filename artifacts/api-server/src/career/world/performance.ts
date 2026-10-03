import type { CareerDifficulty } from "../config.ts";
import { CAREER_DIFFICULTY_CONFIG, CAREER_SIMULATION_CONFIG as S, CAREER_WORLD_CONFIG as W, ATTRIBUTES } from "./config.ts";
import { normal, type Random } from "./random.ts";
import { clamp, abilitySchema, matchContextSchema, type Npc, type Ability, type MatchContext, type Performance } from "./types.ts";

export function createPerformance(npc: Npc, context: MatchContext, difficulty: CareerDifficulty, rng: Random): Performance {
  abilitySchema.parse(npc.ability);
  matchContextSchema.parse(context);
  const preset = CAREER_DIFFICULTY_CONFIG[difficulty];
  if (!preset || !Number.isFinite(npc.form) || Math.abs(npc.form) > 1) throw new Error("Invalid performance state");
  const pressureIntensity = clamp(S.pressure[context.category] + context.roundImportance * S.roundPressure + (context.elimination ? S.eliminationPressure : 0), 0, 1);
  const daySd = S.daySdMin + (1 - npc.ability.consistency / W.attributeMax) * S.daySdRange;
  const dayDeviation = clamp(normal(rng) * daySd, -S.dayDeviationLimit, S.dayDeviationLimit);
  const pressureResponse = pressureIntensity * (
    -(1 - npc.ability.pressure / W.attributeMax) * S.pressurePenalty
    + Math.max(0, npc.ability.pressure - S.pressureBonusThreshold) / (W.attributeMax - S.pressureBonusThreshold) * S.pressureBonus
  );
  const shift = preset.abilityOffset + npc.form * S.formAbilityWeight + dayDeviation + npc.tendencies[context.category];
  const effective = Object.fromEntries(ATTRIBUTES.map(key => {
    const pressureWeight = key === "finishing" ? S.pressureFinishingWeight : key === "consistency" ? S.pressureConsistencyWeight : 1;
    return [key, clamp(npc.ability[key] + shift + pressureResponse * pressureWeight, W.attributeMin, W.attributeMax)];
  })) as Ability;
  const baselineShift = preset.abilityOffset + npc.tendencies[context.category];
  const expectedScoring = clamp(npc.ability.scoring + baselineShift + pressureResponse, W.attributeMin, W.attributeMax);
  const expectedFinishing = clamp(npc.ability.finishing + baselineShift + pressureResponse * S.pressureFinishingWeight, W.attributeMin, W.attributeMax);
  // Expectations are calibrated diagnostics for form, never a manufactured match average.
  return {
    npcId: npc.id, effective, dayDeviation, pressureIntensity,
    visitSd: S.visitSdMin + (1 - effective.consistency / W.attributeMax) * S.visitSdRange,
    expectedAverage: S.form.averageBaseline + expectedScoring * S.form.scoringWeight + expectedFinishing * S.form.finishingWeight,
    expectedCheckout: clamp(S.doubleBase + expectedFinishing * S.doubleWeight, S.minimumHit, S.maximumHit),
  };
}

export function finishingProbability(profile: Performance, decisive: boolean, momentum = 0, bull = false): number {
  const base = bull ? S.bullBase : S.doubleBase;
  const weight = bull ? S.bullWeight : S.doubleWeight;
  const clutch = decisive ? ((profile.effective.clutch - S.clutchNeutral) / S.clutchNeutral) * S.clutchWeight : 0;
  return clamp(base + (profile.effective.finishing + momentum) * weight + clutch, S.minimumHit, S.maximumHit);
}
