/** Workstream E2 public surface: premium trophy art, award policy and renderer. */
export { PremiumTrophy, RecognitionMark, AwardPresentation, TrophyContactSheet, groupTrophyWins, awardLabel, trophyAssetUrl, plateScale } from "./components/PremiumTrophy";
export type { TrophySize, TrophyIdentityInput } from "./components/PremiumTrophy";
export { TROPHY_ART, RECOGNITION_ART, TROPHY_ART_VERSION, trophyArt } from "./manifest/trophy-manifest";
export type { TrophyArt } from "./manifest/trophy-manifest";
export { EVENT_AWARDS, AWARD_POLICY_VERSION, resolveAward, awardsPhysicalTrophy } from "./manifest/award-policy";
export type { AwardType, EventAward, EventAwardKind, ResolvedAward, AwardInput } from "./manifest/award-policy";
