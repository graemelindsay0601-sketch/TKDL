/** Generation v1 is immutable once shipped. New rules require a new version branch. */
export const WORLD_GENERATION_VERSION = 1;
export const SIMULATION_VERSION = 1;
export const ATTRIBUTES = ["scoring", "finishing", "consistency", "pressure", "powerScoring", "clutch"] as const;
export const TIERS = ["GRASSROOTS", "AMATEUR", "PROFESSIONAL", "ELITE"] as const;
export const CONTEXTS = ["local", "floor", "stage", "qualifier", "major"] as const;
export const CAREER_WORLD_CONFIG = {
  attributeMin: 1, attributeMax: 100, minimumAge: 16, maximumAge: 110,
  population: { GRASSROOTS: 75, AMATEUR: 50, PROFESSIONAL: 63, ELITE: 32 },
  ability: { GRASSROOTS: [28, 8], AMATEUR: [43, 7], PROFESSIONAL: [59, 6], ELITE: [73, 5] },
  ages: { GRASSROOTS: [17, 63], AMATEUR: [19, 58], PROFESSIONAL: [22, 52], ELITE: [24, 48] },
  attributeSpread: 7, tendencyLimit: 2, leftHandedShare: 0.14,
  tierThresholds: { AMATEUR: 38, PROFESSIONAL: 53, ELITE: 68 },
} as const;

/** Modest opposition calibration; never applied to human scores. */
export const CAREER_DIFFICULTY_CONFIG = {
  ACCESSIBLE: { abilityOffset: -4 }, STANDARD: { abilityOffset: 0 }, CHALLENGING: { abilityOffset: 4 },
} as const;

export const CAREER_DEVELOPMENT_CONFIG = {
  formLimit: 1, formYearDecay: 2.4, formLabelThreshold: 0.3, formMatchRetention: 0.8, formSignalWeight: 0.2,
  peakStart: [27, 45], peakLength: [4, 10], lateBloomShare: 0.18,
  lateBreakthroughAge: [30, 43], earlyBreakthroughAge: [18, 25],
  developmentRate: [0.5, 3.5], volatility: [0.2, 1.2], potentialHeadroom: [3, 24],
  plateauChance: 0.3, preBreakthroughFactor: 0.08, peakGrowthFactor: 0.25,
  opportunityFloor: 0.15, headroomScale: 18, attributeDeltaSpread: 0.25,
  decline: {
    GRADUAL: { grace: 0, rate: 0.7, acceleration: 0.06 },
    PLATEAU: { grace: 6, rate: 0.35, acceleration: 0.04 },
    SHARP: { grace: 1, rate: 1.8, acceleration: 0.12 },
    EARLY: { grace: -3, rate: 1.0, acceleration: 0.08 },
  },
  retirement: { ageStart: 45, base: 0.005, ageWeight: 0.003, lowAbilityWeight: 0.03,
    declineWeight: 0.015, lowYearsWeight: 0.02, veteranWeight: 0.01,
    amateurMultiplier: 1.3, maximumChance: 0.7, lowAbilityThreshold: 32 },
  prospectAge: [16, 23],
  prospects: [
    { weight: 0.82, ability: [20, 36], potential: [40, 65] },
    { weight: 0.15, ability: [32, 46], potential: [60, 80] },
    { weight: 0.028, ability: [42, 58], potential: [78, 94] },
    { weight: 0.002, ability: [50, 68], potential: [95, 100] },
  ],
} as const;

export const CAREER_SIMULATION_CONFIG = {
  startingScore: 501, maxBestOf: 101, maxVisitsPerLeg: 600,
  formAbilityWeight: 3, daySdMin: 2, daySdRange: 9, dayDeviationLimit: 25,
  visitSdMin: 2, visitSdRange: 12,
  pressure: { local: 0.05, floor: 0.15, stage: 0.35, qualifier: 0.45, major: 0.65 },
  eliminationPressure: 0.15, roundPressure: 0.2, pressurePenalty: 5, pressureBonus: 1,
  pressureBonusThreshold: 85, pressureFinishingWeight: 1.3, pressureConsistencyWeight: 1.5,
  trebleBase: 0.015, trebleScoringWeight: 0.0023, treblePowerWeight: 0.0005,
  trebleSingleBase: 0.35, trebleSingleWeight: 0.0025,
  singleBase: 0.45, singleWeight: 0.004,
  doubleBase: 0.045, doubleWeight: 0.0045, bullBase: 0.025, bullWeight: 0.0025,
  minimumHit: 0.03, maximumHit: 0.92, doubleMissSingleShare: 0.55,
  clutchWeight: 0.035, clutchNeutral: 50,
  momentumLimit: 1.8, momentumDecay: 0.8, maximumMomentum: 0.5,
  largeCheckoutMomentum: 0.5, breakMomentum: 0.4, missedDoubleMomentum: 0.08,
  largeCheckout: 100,
  form: { averageBaseline: 24, scoringWeight: 0.55, finishingWeight: 0.12,
    averageScale: 22, checkoutScale: 0.35, scoringShare: 0.75, finishingShare: 0.25,
    opponentAverageScale: 50, opponentContextWeight: 0.05 },
  adapter: { avgMin: 22, avgScoringWeight: 0.65, powerDifferenceWeight: 0.1, sdMin: 5, sdRange: 15,
    checkoutMin: 0.06, checkoutWeight: 0.005, accuracyMin: 0.1, accuracyWeight: 0.006 },
} as const;

export const targetPopulation = () => Object.values(CAREER_WORLD_CONFIG.population).reduce((a, b) => a + b, 0);
