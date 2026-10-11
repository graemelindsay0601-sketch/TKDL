/**
 * Workstream F1 — broadcast atmosphere model. Pure, display-only functions.
 *
 * Resolves how much spectacle an event or Career moment receives from the
 * metadata the server already persisted (content.eventClass, calendar
 * presentation tier, tournament importance level, circuit, classification and
 * venueContent). It never decides a sporting outcome, never names a venue the
 * event did not use and never invents a result: a moment can only claim what
 * its real event context supports.
 */

/** Seven presentation levels, from a club oche to the World Championship. */
export const ATMOSPHERE_LEVELS = ["CLUB", "COUNTY", "NATIONAL", "FLOOR", "STAGE", "MAJOR", "PALACE"] as const;
export type AtmosphereLevel = typeof ATMOSPHERE_LEVELS[number];

/** Venue families authored by the server (content/world.ts VENUE_FAMILIES). */
export const VENUE_FAMILIES = [
  "pub-club", "social-club", "community-hall", "sports-centre", "hotel-ballroom", "conference", "professional-floor", "studio",
  "historic-theatre", "modern-theatre", "exhibition", "small-arena", "major-arena", "international-arena", "palace",
] as const;
export type VenueFamily = typeof VENUE_FAMILIES[number];

/** Subset of the server's venueContent() that atmosphere reads. Every field is optional for legacy saves. */
export type AtmosphereVenue = {
  id?: string | null; displayName?: string | null; nickname?: string | null; city?: string | null; region?: string | null;
  venueType?: string | null; capacityBand?: string | null; stageConfiguration?: string | null;
  atmosphereTags?: readonly string[] | null; permanentWorldHome?: boolean | null;
};

/**
 * Real event context. Pass whatever the current read provides:
 * tournament view → { eventName, eventClass: content.eventClass, circuit, classification, level, venue, venueFallback };
 * calendar event   → { eventName, eventClass: content.eventClass, circuit, classification, presentationTier: presentation.tier, venue }.
 */
export type AtmosphereInput = {
  eventName?: string | null; definitionKey?: string | null;
  eventClass?: string | null; circuit?: string | null; classification?: string | null;
  presentationTier?: string | null; level?: number | null;
  venue?: AtmosphereVenue | null; venueFallback?: { city?: string | null; country?: string | null } | null;
};

export type LevelSource = "EVENT_CLASS" | "PRESENTATION_TIER" | "IMPORTANCE_LEVEL" | "CIRCUIT" | "NONE";
export type ResolvedAtmosphere = {
  level: AtmosphereLevel | null;
  levelSource: LevelSource;
  qualifier: boolean;
  /** Venue family actually used by the event, or null when the save does not record one. */
  venueFamily: VenueFamily | null;
  /** Display name only when the event recorded a venue; never inferred. */
  venueName: string | null; venueCity: string | null;
  plate: PlateKey;
  /** Where the backdrop came from: the event's real venue, the level's neutral default, or a neutral studio. */
  plateSource: "VENUE" | "LEVEL_DEFAULT" | "NEUTRAL";
  multiBoardFloor: boolean;
};

const CLASS_LEVEL: Record<string, AtmosphereLevel> = {
  GRASSROOTS: "CLUB", REGIONAL: "COUNTY", NATIONAL: "NATIONAL", INTERNATIONAL_OPEN: "NATIONAL",
  SECONDARY_TOUR: "FLOOR", PROFESSIONAL_TOUR: "FLOOR", STAGE_SERIES: "STAGE", MAJOR: "MAJOR", WORLD_CHAMPIONSHIP: "PALACE",
};
const TIER_LEVEL: Record<string, AtmosphereLevel> = { LOCAL: "CLUB", STANDARD: "COUNTY", FEATURED: "NATIONAL", TELEVISED: "STAGE", MAJOR: "MAJOR", WORLD: "PALACE" };
const IMPORTANCE_LEVEL: Record<number, AtmosphereLevel> = { 1: "CLUB", 2: "NATIONAL", 3: "STAGE", 4: "MAJOR", 5: "PALACE" };
const CIRCUIT_LEVEL: Record<string, AtmosphereLevel> = {
  GRASSROOTS: "CLUB", SPECIAL: "CLUB", COUNTY: "COUNTY", REGIONAL: "COUNTY", NATIONAL_AMATEUR: "NATIONAL",
  CHALLENGER: "FLOOR", VAULT: "FLOOR", Q_SCHOOL: "FLOOR", PRO_CIRCUIT: "FLOOR",
  EUROPEAN_SERIES: "STAGE", WORLD_SERIES: "STAGE", INVITATIONAL: "STAGE", MAJOR: "MAJOR", WORLD_CHAMPIONSHIP: "PALACE",
};
const rank = (l: AtmosphereLevel) => ATMOSPHERE_LEVELS.indexOf(l);
export const atLeast = (l: AtmosphereLevel | null, min: AtmosphereLevel) => l !== null && rank(l) >= rank(min);

/** Plates: the 15 reused venue photographs, the rendered Palace stage, and a neutral studio for unknown context. */
export type PlateKey = VenueFamily | "palace-stage" | "neutral";
const LEVEL_DEFAULT_PLATE: Record<AtmosphereLevel, PlateKey> = {
  CLUB: "social-club", COUNTY: "community-hall", NATIONAL: "sports-centre", FLOOR: "professional-floor",
  STAGE: "modern-theatre", MAJOR: "major-arena", PALACE: "palace-stage",
};
const isFamily = (v: unknown): v is VenueFamily => typeof v === "string" && (VENUE_FAMILIES as readonly string[]).includes(v);

/**
 * Level = the highest of the persisted signals (prestige class, calendar
 * presentation tier, tournament importance level); the circuit is used only
 * when none is recorded. Qualifiers never receive championship spectacle:
 * capped at NATIONAL (Q-School at FLOOR). A non-qualifying World Championship
 * is always PALACE: The Palace is its permanent home in every catalogue.
 */
export function resolveAtmosphere(input: AtmosphereInput | null | undefined): ResolvedAtmosphere {
  const e = input ?? {};
  const qualifier = e.classification === "QUALIFIER" || e.circuit === "Q_SCHOOL";
  const signals: [AtmosphereLevel | undefined, LevelSource][] = [
    [e.eventClass ? CLASS_LEVEL[e.eventClass] : undefined, "EVENT_CLASS"],
    [e.presentationTier ? TIER_LEVEL[e.presentationTier] : undefined, "PRESENTATION_TIER"],
    [typeof e.level === "number" && Number.isFinite(e.level) ? IMPORTANCE_LEVEL[Math.max(1, Math.min(5, Math.round(e.level)))] : undefined, "IMPORTANCE_LEVEL"],
  ];
  let level: AtmosphereLevel | null = null; let levelSource: LevelSource = "NONE";
  for (const [l, src] of signals) if (l && (level === null || rank(l) > rank(level))) { level = l; levelSource = src; }
  if (level === null && e.circuit && CIRCUIT_LEVEL[e.circuit]) { level = CIRCUIT_LEVEL[e.circuit]; levelSource = "CIRCUIT"; }
  if (qualifier && level === null && e.circuit) level = e.circuit === "Q_SCHOOL" ? "FLOOR" : "NATIONAL";
  if (qualifier && level) {
    const cap: AtmosphereLevel = e.circuit === "Q_SCHOOL" ? "FLOOR" : "NATIONAL";
    if (rank(level) > rank(cap)) level = cap;
    // Championship qualifiers (World/Major) are a step above a club night even when their class is the default.
    if (["WORLD_CHAMPIONSHIP", "MAJOR"].includes(e.circuit ?? "") && rank(level) < rank("NATIONAL")) level = "NATIONAL";
  }
  if (!qualifier && (e.circuit === "WORLD_CHAMPIONSHIP" || e.presentationTier === "WORLD") && level !== "PALACE") {
    level = "PALACE"; if (levelSource === "NONE") levelSource = "CIRCUIT";
  }

  const v = e.venue ?? null;
  const venueFamily = isFamily(v?.venueType) ? v!.venueType as VenueFamily : null;
  const plate: PlateKey = venueFamily ? (venueFamily === "palace" ? "palace-stage" : venueFamily) : level ? LEVEL_DEFAULT_PLATE[level] : "neutral";
  return {
    level, levelSource, qualifier, venueFamily,
    venueName: venueFamily ? (v?.nickname && v?.displayName ? `${v.displayName} · ${v.nickname}` : v?.displayName ?? null) : null,
    venueCity: venueFamily ? v?.city ?? null : e.venueFallback?.city ?? null,
    plate, plateSource: venueFamily ? "VENUE" : level ? "LEVEL_DEFAULT" : "NEUTRAL",
    multiBoardFloor: v?.stageConfiguration === "MULTI_BOARD_FLOOR",
  };
}

// ---------------------------------------------------------------- spectacle

export type Light = "lamp" | "hall" | "floor" | "beams" | "beams-major" | "beams-palace";
export type Celebration = "none" | "silver-light" | "gold-dense" | "palace-tickertape";
export type Spectacle = {
  /** 0 = card only … 4 = full stage celebration. */
  intensity: 0 | 1 | 2 | 3 | 4;
  light: Light | null; spotlight: boolean; celebration: Celebration; pyro: boolean;
  /** Fraction of the scene height the backdrop occupies (taller = more spectacle). */
  scale: "inline" | "banner" | "stage" | "full";
};

export const LEVEL_PROFILE: Record<AtmosphereLevel, { label: string; kicker: string; light: Light; grade: string }> = {
  CLUB: { label: "Club", kicker: "Grassroots club darts", light: "lamp", grade: "tungsten" },
  COUNTY: { label: "County", kicker: "County & regional competition", light: "hall", grade: "hall" },
  NATIONAL: { label: "National", kicker: "Amateur & national tournament", light: "hall", grade: "hall" },
  FLOOR: { label: "Pro Floor", kicker: "Professional floor event", light: "floor", grade: "floor" },
  STAGE: { label: "Stage", kicker: "Televised stage event", light: "beams", grade: "stage" },
  MAJOR: { label: "Major", kicker: "Major championship", light: "beams-major", grade: "major" },
  PALACE: { label: "The Palace", kicker: "World Championship", light: "beams-palace", grade: "palace" },
};

export const MOMENTS = ["ARRIVAL", "MATCH_INTRO", "QUALIFICATION", "VICTORY", "MILESTONE", "DOCUMENTARY_CHAPTER"] as const;
export type MomentKind = typeof MOMENTS[number];
/** Victory variant is derived from the real event, never passed by the caller. */
export type VictoryVariant = "TOURNAMENT" | "MAJOR" | "WORLD";

/** Match significance from the real draw: "FINAL" | "SEMI_FINAL" | other rounds. */
export type MatchStage = "FINAL" | "SEMI_FINAL" | "QUARTER_FINAL" | "EARLY" | null;

/**
 * The same moment gets different spectacle at different levels. Unknown context
 * (legacy saves without metadata) always gets the restrained level-0/1 card.
 */
export function spectacleFor(moment: MomentKind, level: AtmosphereLevel | null, opts: { matchStage?: MatchStage } = {}): Spectacle {
  const r = level ? rank(level) : -1;
  const light = level ? LEVEL_PROFILE[level].light : null;
  const s = (intensity: Spectacle["intensity"], scale: Spectacle["scale"], extra: Partial<Spectacle> = {}): Spectacle =>
    ({ intensity, light: intensity === 0 ? null : light, spotlight: false, celebration: "none", pyro: false, scale, ...extra });
  switch (moment) {
    case "ARRIVAL": return r < 0 ? s(0, "inline") : r <= rank("NATIONAL") ? s(1, "banner") : r <= rank("STAGE") ? s(2, "banner") : s(3, "stage");
    case "MATCH_INTRO": {
      const big = opts.matchStage === "FINAL" || opts.matchStage === "SEMI_FINAL";
      if (r < rank("FLOOR")) return s(r < 0 ? 0 : 1, "inline");
      if (r === rank("FLOOR")) return s(big ? 2 : 1, "banner");
      return s(big ? (r >= rank("MAJOR") ? 4 : 3) : 2, big ? "stage" : "banner", { spotlight: true });
    }
    case "QUALIFICATION": return r < 0 ? s(0, "inline") : s(r >= rank("FLOOR") ? 2 : 1, "banner");
    case "VICTORY":
      if (r < 0) return s(1, "banner");
      if (r <= rank("COUNTY")) return s(1, "banner");
      if (r === rank("NATIONAL")) return s(2, "banner", { celebration: "silver-light" });
      if (r === rank("FLOOR")) return s(2, "banner");
      if (r === rank("STAGE")) return s(3, "stage", { spotlight: true, celebration: "silver-light" });
      if (r === rank("MAJOR")) return s(4, "full", { spotlight: true, celebration: "gold-dense", pyro: true });
      return s(4, "full", { spotlight: true, celebration: "palace-tickertape", pyro: true });
    case "MILESTONE": return r < 0 ? s(1, "banner") : s(r >= rank("MAJOR") ? 3 : 2, "banner");
    case "DOCUMENTARY_CHAPTER": return s(r < 0 ? 1 : 2, "stage");
  }
}

/** World/Major/Tournament victory is a fact of the event, not a caller choice. */
export function victoryVariant(a: Pick<ResolvedAtmosphere, "level" | "qualifier">): VictoryVariant {
  if (a.qualifier) return "TOURNAMENT";
  return a.level === "PALACE" ? "WORLD" : a.level === "MAJOR" ? "MAJOR" : "TOURNAMENT";
}

/** Eyebrow copy for a moment. Uses only the resolved level and the event's own name; never a result. */
export function momentEyebrow(moment: MomentKind, a: ResolvedAtmosphere): string {
  const tier = a.level ? LEVEL_PROFILE[a.level].kicker : "Career";
  switch (moment) {
    case "ARRIVAL": return a.venueName ? `Arrival · ${a.venueName}` : `Arrival · ${tier}`;
    case "MATCH_INTRO": return `Match introduction · ${tier}`;
    case "QUALIFICATION": return "Qualification";
    case "VICTORY": { const vv = victoryVariant(a); return vv === "WORLD" ? "World Champion" : vv === "MAJOR" ? "Major champion" : "Tournament winner"; }
    case "MILESTONE": return "Career milestone";
    case "DOCUMENTARY_CHAPTER": return "A Career Remembered";
  }
}

/** Documentary moments (legacy/player.ts) carry the event's presentation tier; map it without inventing one. */
export function levelFromMomentTier(tier: string | null | undefined): AtmosphereLevel | null {
  return tier ? TIER_LEVEL[tier] ?? CLASS_LEVEL[tier] ?? null : null;
}
