/**
 * Workstream F1 — atmosphere asset manifest.
 *
 * Plates: 14 venue photographs REUSED in place from public/images/career-venues/
 * (the venue atlas artwork, one per server venue family), plus two plates rendered
 * for F1: the Palace stage (the existing Palace photo is a trophy still-life, not a
 * venue plate) and a neutral studio for saves without metadata.
 * Layers: light (screen blend), celebration (alpha) and documentary grain, rendered
 * by scripts/atmosphere-render/ into public/assets/career-atmosphere/.
 *
 * focal = object-position for cover crops; stage = where the oche/stage sits in the
 * frame (0–1), used to land the follow-spot on the real stage of each plate.
 */
import type { PlateKey, VenueFamily } from "./model";

type Pt = { x: number; y: number };
export type PlateArt = { key: PlateKey; src: string; origin: "REUSED_VENUE_ART" | "F1_RENDER"; focal: Pt; stage: Pt; description: string };

const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const venue = (file: string) => `${BASE}images/career-venues/${file}`;
export const atmosphereAsset = (file: string) => `${BASE}assets/career-atmosphere/${file}`;

const V = (key: VenueFamily, file: string, focal: Pt, stage: Pt, description: string): PlateArt =>
  ({ key, src: venue(file), origin: "REUSED_VENUE_ART", focal, stage, description });

export const PLATES: Readonly<Record<PlateKey, PlateArt>> = Object.freeze({
  "pub-club": V("pub-club", "career-venue-club.jpg", { x: 0.52, y: 0.42 }, { x: 0.47, y: 0.72 }, "Pub club: a single board under a lamp, regulars at the bar"),
  "social-club": V("social-club", "career-venue-social-club.jpg", { x: 0.45, y: 0.5 }, { x: 0.4, y: 0.66 }, "Social club: boards along panelled walls, tables and bar"),
  "community-hall": V("community-hall", "career-venue-county-hall.jpg", { x: 0.6, y: 0.45 }, { x: 0.6, y: 0.58 }, "County hall: a raised stage board in a civic hall"),
  "sports-centre": V("sports-centre", "career-venue-sports-centre.jpg", { x: 0.55, y: 0.48 }, { x: 0.58, y: 0.6 }, "Sports centre: rows of boards on a sports-hall floor"),
  "hotel-ballroom": V("hotel-ballroom", "career-venue-hotel-ballroom.jpg", { x: 0.48, y: 0.45 }, { x: 0.48, y: 0.58 }, "Hotel ballroom: chandeliers and a feature board"),
  conference: V("conference", "career-venue-conference.jpg", { x: 0.52, y: 0.48 }, { x: 0.52, y: 0.62 }, "Conference hall: a lit runway to a feature stage"),
  "professional-floor": V("professional-floor", "career-venue-floor.jpg", { x: 0.45, y: 0.5 }, { x: 0.42, y: 0.62 }, "Professional floor: a long line of boards and scorers"),
  studio: V("studio", "career-venue-studio.jpg", { x: 0.5, y: 0.4 }, { x: 0.5, y: 0.8 }, "Darts studio: a compact feature board set"),
  "historic-theatre": V("historic-theatre", "career-venue-heritage-theatre.jpg", { x: 0.49, y: 0.5 }, { x: 0.49, y: 0.64 }, "Heritage theatre: gilded boxes around a stage board"),
  "modern-theatre": V("modern-theatre", "career-venue-modern-theatre.jpg", { x: 0.56, y: 0.55 }, { x: 0.58, y: 0.7 }, "Modern theatre: raked seating facing a stage set"),
  exhibition: V("exhibition", "career-venue-exhibition.jpg", { x: 0.5, y: 0.48 }, { x: 0.5, y: 0.6 }, "Exhibition hall: a long stage before rows of seating"),
  "small-arena": V("small-arena", "career-venue-arena.jpg", { x: 0.55, y: 0.42 }, { x: 0.55, y: 0.52 }, "Arena: a lit stage inside a full bowl"),
  "major-arena": V("major-arena", "career-venue-major-arena.jpg", { x: 0.5, y: 0.45 }, { x: 0.5, y: 0.6 }, "Major arena: arched stage, big screens, full house"),
  "international-arena": V("international-arena", "career-venue-international-arena.jpg", { x: 0.45, y: 0.45 }, { x: 0.43, y: 0.56 }, "International arena: stage ring and banked crowd"),
  palace: { key: "palace", src: atmosphereAsset("palace-stage.webp"), origin: "F1_RENDER", focal: { x: 0.5, y: 0.52 }, stage: { x: 0.5, y: 0.6 },
    description: "The Palace (Alexandra Grand Hall): vaulted hall, rose window, galleries and the championship stage" },
  "palace-stage": { key: "palace-stage", src: atmosphereAsset("palace-stage.webp"), origin: "F1_RENDER", focal: { x: 0.5, y: 0.52 }, stage: { x: 0.5, y: 0.6 },
    description: "The Palace (Alexandra Grand Hall): vaulted hall, rose window, galleries and the championship stage" },
  neutral: { key: "neutral", src: atmosphereAsset("neutral.webp"), origin: "F1_RENDER", focal: { x: 0.5, y: 0.55 }, stage: { x: 0.5, y: 0.66 },
    description: "A neutral broadcast studio (no venue recorded)" },
});

export const LAYERS = Object.freeze({
  lamp: atmosphereAsset("light-lamp.webp"), hall: atmosphereAsset("light-hall.webp"), floor: atmosphereAsset("light-floor.webp"),
  beams: atmosphereAsset("light-beams.webp"), "beams-major": atmosphereAsset("light-beams-major.webp"), "beams-palace": atmosphereAsset("light-beams-palace.webp"),
  spotlight: atmosphereAsset("spotlight.webp"), pyro: atmosphereAsset("pyro.webp"),
  "silver-light": atmosphereAsset("confetti-silver.webp"), "gold-dense": atmosphereAsset("confetti-gold.webp"), "palace-tickertape": atmosphereAsset("tickertape-palace.webp"),
  grain: atmosphereAsset("grain.webp"),
});
/** The spotlight layer's pool sits here in its own frame; the backdrop shifts it onto the plate's stage point. */
export const SPOTLIGHT_POOL = { x: 0.5, y: 0.78 };
