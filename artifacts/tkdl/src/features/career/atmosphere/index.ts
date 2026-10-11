/** Workstream F1 — broadcast atmosphere (presentation only; not yet connected to Career screens). */
export { CareerStageBackdrop, CareerEventAtmosphere, CareerMomentScene, spectacleSummary, type MomentFact } from "./components";
export { atmosphereFromTournament, atmosphereFromCalendarEvent, atmosphereFromLegacyMoment } from "./adapters";
export {
  ATMOSPHERE_LEVELS, LEVEL_PROFILE, MOMENTS, VENUE_FAMILIES, atLeast, levelFromMomentTier, momentEyebrow, resolveAtmosphere, spectacleFor, victoryVariant,
  type AtmosphereInput, type AtmosphereLevel, type AtmosphereVenue, type MatchStage, type MomentKind, type ResolvedAtmosphere, type Spectacle, type VictoryVariant,
} from "./model";
export { LAYERS, PLATES, atmosphereAsset } from "./manifest";
export { AtmosphereGallery, type GalleryEvent } from "./gallery";
