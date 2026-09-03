// TKDL LIVE — FILLER family detectors (story-types.ts's own header explains
// why this family exists: content this show can air when there isn't
// enough real match news, and — independently — a standing reminder slot
// so players hear about game modes they might not otherwise notice).
//
// All three detectors here are unconditionally re-evaluated on EVERY
// detectAndUpdateStories() pass (story-engine.ts's own FILLER section),
// never gated behind "did anything change since the last cutoff" the way
// every match-derived family is — there is no real "new since X" concept
// for "here's how to try practice mode." PRACTICE_ACTIVITY is the one
// exception with a real gate (a minimum session count, so a genuinely dead
// week correctly produces no story rather than a hollow "0 sessions this
// week" one) — everything else always returns a candidate.
//
// Same "evergreen, upsert-only, never resolved" contract as ARCHIVE's
// LAST_MEETING/HISTORICAL_H2H (story-detectors-archive.ts's own header) —
// story-engine.ts never calls resolveUndetectedStories for this family.
//
// leagueType is tagged "singles" on all three as a nominal home league —
// none of this content is really league-scoped (LeagueType has no 4th,
// cross-league value, and widening it would ripple into seasons/standings
// far outside this feature's scope), matching this file's own header
// reasoning. Accepted simplification: a FILLER segment counts toward the
// Singles airtime tally in director-math.ts's 55% soft cap. Harmless today
// (Singles is the only league with real content at all, so the "only one
// league with content" bypass already applies), worth revisiting once
// Doubles/Shift Wars have their own real activity.
import type { StoryCandidate } from "./story-types.ts";

// ── PRACTICE_ACTIVITY ────────────────────────────────────────────────────
// Real, verified aggregate practice/M-501 activity (never Shadow Bot
// sessions — those are deliberately excluded so Shadow Bot stays pure
// promotional content with no real-result reporting, per this feature's
// own product decision; see the caller's session_data->>'shadowPlayerId'
// filter). The fact firewall (17.1) is respected the same way every other
// detector respects it: everything in `facts` below is a real COUNT(*)/
// COUNT(DISTINCT ...) result, nothing invented.

export type PracticeActivityFacts = {
  windowDays: number;
  sessionCount: number;
  distinctPlayerCount: number;
  /** The single most active player this window, or null if there were zero sessions (detectPracticeActivity() already returns null before this matters, but kept honestly typed). */
  topPlayerId: number | null;
  topPlayerSessionCount: number;
};

// Below this, "N practice sessions this week" reads as thin rather than as
// a genuine activity story — better to let this family's other two types
// (or real match news) fill the slot instead of a hollow-feeling segment.
const PRACTICE_ACTIVITY_MIN_SESSIONS = 3;

export function detectPracticeActivity(facts: PracticeActivityFacts): StoryCandidate | null {
  if (facts.sessionCount < PRACTICE_ACTIVITY_MIN_SESSIONS) return null;

  return {
    storyType: "PRACTICE_ACTIVITY",
    leagueType: "singles",
    subjectKeys: ["filler:practice_activity"],
    sentiment: "positive",
    tags: ["filler", "practice"],
    facts: {
      windowDays: facts.windowDays,
      sessionCount: facts.sessionCount,
      distinctPlayerCount: facts.distinctPlayerCount,
      // Presence-only (commentary-math.ts's phraseFactsSatisfied() checks
      // key presence, not value) — omitted entirely rather than null so a
      // phrase requiring topPlayerId can't accidentally fire with nothing
      // to interpolate. topPlayerId is a real players.id, so it resolves
      // to a name for free via commentary-engine.ts's generic *Id handling
      // (leagueType: "singles" above is exactly what makes that lookup work).
      ...(facts.topPlayerId !== null ? { topPlayerId: facts.topPlayerId, topPlayerSessionCount: facts.topPlayerSessionCount } : {}),
    },
    components: {
      competitiveImportance: 3,
      unexpectedness: 0,
      historicalSignificance: 2,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  };
}

// ── SHADOW_BOT_PROMO ─────────────────────────────────────────────────────
// Pure explainer/teaser copy — no player-specific stats or names, by this
// feature's own product decision (only a handful of players have Shadow
// Bot unlocked so far; reporting real results at that sample size would
// read as singling players out rather than as a league update). Always
// returns a candidate: there is nothing to "detect," this mode either
// exists in the app or it doesn't, so it's always eligible content —
// director.ts's slot 8 priority (not this file) is what decides whether
// and how OFTEN it actually gets a segment.

export function detectShadowBotPromo(): StoryCandidate {
  return {
    storyType: "SHADOW_BOT_PROMO",
    leagueType: "singles",
    subjectKeys: ["filler:shadow_bot_promo"],
    sentiment: "positive",
    tags: ["filler", "promo", "shadow_bot"],
    facts: {},
    components: {
      competitiveImportance: 1,
      unexpectedness: 0,
      historicalSignificance: 1,
      performanceAnomaly: 0,
      entertainmentValue: 3,
    },
  };
}

// ── FEATURE_SPOTLIGHT ────────────────────────────────────────────────────
// One candidate per row in the broadcast_feature_spotlights registry
// (feature-spotlight-registry.ts) that is currently `enabled` — whether
// that row was auto-created from feature_flags/game_types going live, or
// hand-entered by an admin. subjectKeys is keyed by the registry row's own
// stable `key`, so multiple showcased features can all hold their own
// persistent story/priority independently rather than one overwriting
// another.

export type FeatureSpotlightFacts = {
  featureKey: string;
  featureName: string;
  featureBlurb: string;
};

export function detectFeatureSpotlight(facts: FeatureSpotlightFacts): StoryCandidate {
  return {
    storyType: "FEATURE_SPOTLIGHT",
    leagueType: "singles",
    subjectKeys: [`filler:feature_spotlight:${facts.featureKey}`],
    sentiment: "positive",
    tags: ["filler", "promo", "feature_spotlight"],
    facts: {
      featureKey: facts.featureKey,
      featureName: facts.featureName,
      featureBlurb: facts.featureBlurb,
    },
    components: {
      competitiveImportance: 1,
      unexpectedness: 0,
      historicalSignificance: 1,
      performanceAnomaly: 0,
      entertainmentValue: 3,
    },
  };
}
