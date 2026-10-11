/** Workstream E2 public surface: premium trophy art, award policy and renderer. */
export { PremiumTrophy, RecognitionMark, AwardPresentation, TrophyContactSheet, groupTrophyWins, awardLabel, trophyAssetUrl, plateScale } from "./components/PremiumTrophy";
export type { TrophySize, TrophyIdentityInput, TrophyArtwork } from "./components/PremiumTrophy";
export { trophyRender } from "./components/PremiumTrophy";
export { TROPHY_RENDERS } from "./manifest/render-manifest";
export { TROPHY_ART, RECOGNITION_ART, TROPHY_ART_VERSION, trophyArt, FAMILY_IDS, EVENT_DESIGN_IDS } from "./manifest/trophy-manifest";
export type { TrophyArt } from "./manifest/trophy-manifest";
export { EVENT_AWARDS, EVENT_DESIGNS_V2, AWARD_POLICY_VERSION, resolveAward, awardsPhysicalTrophy } from "./manifest/award-policy";
export type { AwardType, EventAward, EventAwardKind, ResolvedAward, AwardInput, AwardPolicyVersion, DesignAllocation, ResolveOptions } from "./manifest/award-policy";
