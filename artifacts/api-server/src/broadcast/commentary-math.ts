// TKDL LIVE — Commentary Engine: pure math (handover doc section 12, plus
// the record-claim rule in 17.2). Zero `@workspace/db` runtime imports (see
// story-engine-math.ts's own header for exactly why that matters) — this
// file owns the Phrase/Blueprint types, template interpolation (the actual
// mechanical enforcement of 17.1's fact firewall, not just a convention),
// phrase eligibility (requires/forbids/cooldown), reading pace, and the
// banter-guardrail counting rules. commentary-engine.ts (DB-facing) resolves
// real names/facts and broadcast_memory state, then calls into this file to
// actually pick and assemble dialogue.
import { seededRng, pickFrom } from "./seeded-rng.ts";
import type { Treatment } from "./story-types.ts";

// ── 12.3 Phrase definition ───────────────────────────────────────────────
// Transcribed field-for-field from the doc, plus one additive field this
// file genuinely needs and the doc's own type doesn't preclude: `tone`.
// 12.7's "roughly 70% sports commentary / 20% light humour / 10% presenter
// personality" target is a content-CATEGORY split that has no home on any
// of the doc's other Phrase fields (sentiment is positive/neutral/negative,
// a completely different axis — a "light humour" phrase can easily be
// positive-sentiment). Defaults to "commentary" when omitted, so every
// phrase written without ever thinking about this field still behaves
// exactly as if the doc's type were used unmodified.
export type PhraseTone = "commentary" | "humour" | "personality";

export type Phrase = {
  id: string;
  speaker: "A" | "B";
  intent: string;
  template: string;
  requires?: string[];
  forbids?: string[];
  sentiment: "positive" | "neutral" | "negative";
  cooldownEditions: number;
  distinctive?: boolean;
  tone?: PhraseTone;
};

// ── 12.4 Conversation blueprints ─────────────────────────────────────────
export type BlueprintTurn = { speaker: "A" | "B"; intent: string; optional?: boolean };
export type BlueprintName = "ANALYST_LEADS" | "PUNDIT_LEADS" | "AGREEMENT" | "DISAGREEMENT" | "CALLBACK" | "QUICK_HIT";
export type Blueprint = { name: BlueprintName; turns: readonly BlueprintTurn[] };

export const BLUEPRINTS: Record<BlueprintName, Blueprint> = {
  ANALYST_LEADS: { name: "ANALYST_LEADS", turns: [
    { speaker: "A", intent: "fact" }, { speaker: "B", intent: "reaction" },
    { speaker: "A", intent: "context" }, { speaker: "B", intent: "closer", optional: true },
  ] },
  PUNDIT_LEADS: { name: "PUNDIT_LEADS", turns: [
    { speaker: "B", intent: "observation" }, { speaker: "A", intent: "data_check" }, { speaker: "B", intent: "response" },
  ] },
  AGREEMENT: { name: "AGREEMENT", turns: [
    { speaker: "A", intent: "performance_fact" }, { speaker: "B", intent: "credit" }, { speaker: "A", intent: "consequence" },
  ] },
  DISAGREEMENT: { name: "DISAGREEMENT", turns: [
    { speaker: "A", intent: "model_context" }, { speaker: "B", intent: "contrary_opinion" },
    { speaker: "A", intent: "evidence" }, { speaker: "B", intent: "disagree_close" },
  ] },
  CALLBACK: { name: "CALLBACK", turns: [
    { speaker: "A", intent: "callback_reference" }, { speaker: "B", intent: "admit_or_defend" }, { speaker: "A", intent: "current_evidence" },
  ] },
  // Third turn added deliberately (was a bare 2-turn quick_fact/
  // quick_reaction pair — see the git history on this file for the
  // original 12.6-only shape). Supporting treatment is the overwhelming
  // majority of any Edition's segments, and a flat "here's a fact, here's
  // one reaction" was reading as a stats readout rather than two hosts
  // actually talking — real user feedback ("i want some conversation
  // between the host not just raw data... like a talk show about the
  // league not just here the data"). This third turn is REQUIRED, not
  // optional: resolveTurnsForTreatment() below strips optional turns for
  // every non-major/featured treatment, so an optional turn here would
  // never actually reach Supporting, exactly the segments that needed it
  // most. Speaker "A" keeps the A-B-A shape (fact, reaction, handoff) —
  // see commentary-library.ts's UNIVERSAL_BANTER_PHRASES for why this is
  // always satisfiable regardless of broadcast_banter_level (fact-free,
  // never humour+negative at once).
  QUICK_HIT: { name: "QUICK_HIT", turns: [
    { speaker: "A", intent: "quick_fact" }, { speaker: "B", intent: "quick_reaction" },
    { speaker: "A", intent: "banter" },
  ] },
};

/**
 * 12.6: "Supporting story: 2 turns / Featured story: 3-4 turns / Major
 * story: 4-6 turns." QUICK_HIT was originally exactly 2 turns per that doc
 * line; it's now 3 (see QUICK_HIT's own comment above for why) — still
 * Supporting's only option, just a turn longer than the doc's original
 * baseline. The five 3-4-turn blueprints all fit Featured directly.
 * Major's 4-6 range has no single doc-given blueprint that reaches 6 turns
 * on its own — resolveBlueprintForTreatment() below is what stitches a
 * short coda onto a 3-4-turn blueprint to reach Major's target range,
 * rather than inventing a new, longer blueprint shape the doc never
 * defines.
 */
export function blueprintNamesForTreatment(treatment: Treatment): readonly BlueprintName[] {
  switch (treatment) {
    case "supporting": return ["QUICK_HIT"];
    case "featured": return ["ANALYST_LEADS", "PUNDIT_LEADS", "AGREEMENT", "DISAGREEMENT", "CALLBACK"];
    case "major": return ["ANALYST_LEADS", "DISAGREEMENT", "AGREEMENT"];
    // headline_ticker/archive stories don't get full segments at all (9.3);
    // QUICK_HIT is a safe, minimal fallback if a caller ever asks anyway
    // rather than throwing.
    default: return ["QUICK_HIT"];
  }
}

const MAJOR_TARGET_MIN_TURNS = 4;

/**
 * Resolves ONE chosen blueprint's turn count up into 12.6's target range
 * for the given treatment. Featured blueprints already land in [3,4]
 * unmodified. Major stories whose chosen blueprint has fewer than 4 turns
 * get one QUICK_HIT appended as a closing exchange (a natural "one more
 * reaction" beat), capped at 6 total turns as the doc's own upper bound.
 */
export function resolveTurnsForTreatment(treatment: Treatment, blueprint: Blueprint): BlueprintTurn[] {
  const requiredTurns = blueprint.turns.filter(t => !t.optional);
  const withOptionals = treatment === "major" || treatment === "featured" ? blueprint.turns : requiredTurns;

  if (treatment !== "major") return [...withOptionals];
  if (withOptionals.length >= MAJOR_TARGET_MIN_TURNS) return [...withOptionals];

  const coda = BLUEPRINTS.QUICK_HIT.turns;
  return [...withOptionals, ...coda].slice(0, 6);
}

// ── 12.5 Variation strategy: the shared selection PRNG ───────────────────
/** One seeded generator per (slotKey, storyKey, commentaryVersion) — same Edition, same viewer-independent result, every time, per 12.5's own requirement. */
export function commentaryRng(slotKey: string, storyKey: string, commentaryVersion: number): () => number {
  return seededRng(slotKey, storyKey, commentaryVersion);
}

/** Deterministically choose which blueprint to run, from whichever this treatment allows AND the caller has already filtered down to ones with at least one eligible phrase per required turn. */
export function chooseBlueprint(eligibleNames: readonly BlueprintName[], rng: () => number): BlueprintName {
  return pickFrom(eligibleNames, rng);
}

// ── 17.1 Fact firewall: template interpolation ───────────────────────────
export type TemplateFacts = Record<string, string | number | boolean>;

export class MissingFactError extends Error {
  constructor(key: string, template: string) {
    super(`template "${template}" references "{{${key}}}", which is not present in the supplied facts — the fact firewall (17.1) blocks this substitution rather than silently guessing or leaving the placeholder in`);
    this.name = "MissingFactError";
  }
}

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

/** Every `{{key}}` in a template MUST correspond to a key actually present (and non-nullish) in `facts` — this is the literal mechanism behind 17.1 ("templates may only interpolate keys explicitly present in that object"), not just a naming convention. Throws MissingFactError rather than ever emitting a raw, un-interpolated `{{...}}` into a viewer-facing dialogue card. */
export function interpolateTemplate(template: string, facts: TemplateFacts): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    const value = facts[key];
    if (value === undefined || value === null) throw new MissingFactError(key, template);
    return String(value);
  });
}

/** Every placeholder key a template references — used to pre-filter candidate phrases against a story's actual fact set before ever attempting (and risking a throw on) interpolation. */
export function templatePlaceholderKeys(template: string): string[] {
  const keys: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) keys.push(match[1]);
  return keys;
}

// ── Phrase eligibility ───────────────────────────────────────────────────

/** requires/forbids check KEY PRESENCE in the available facts, not any particular value — matching 12.3's own field names ("requires"/"forbids" a list of names, not a list of key=value conditions). */
export function phraseFactsSatisfied(phrase: Phrase, availableFactKeys: ReadonlySet<string>): boolean {
  if (phrase.requires) for (const key of phrase.requires) if (!availableFactKeys.has(key)) return false;
  if (phrase.forbids) for (const key of phrase.forbids) if (availableFactKeys.has(key)) return false;
  return true;
}

/** A template can only actually be used if every placeholder it interpolates is itself present — belt-and-braces alongside phraseFactsSatisfied() (a phrase might reference a key in its template that its author forgot to also list in `requires`). */
export function phraseTemplateSatisfiable(phrase: Phrase, availableFactKeys: ReadonlySet<string>): boolean {
  return templatePlaceholderKeys(phrase.template).every(key => availableFactKeys.has(key));
}

/** null = never used before (always off cooldown). */
export function isPhraseOffCooldown(phrase: Phrase, editionsSinceLastUse: number | null): boolean {
  return editionsSinceLastUse === null || editionsSinceLastUse >= phrase.cooldownEditions;
}

export function isPhraseEligible(params: {
  phrase: Phrase;
  turnSpeaker: "A" | "B";
  turnIntent: string;
  availableFactKeys: ReadonlySet<string>;
  editionsSinceLastUse: number | null;
}): boolean {
  const { phrase } = params;
  return (
    phrase.speaker === params.turnSpeaker &&
    phrase.intent === params.turnIntent &&
    phraseFactsSatisfied(phrase, params.availableFactKeys) &&
    phraseTemplateSatisfiable(phrase, params.availableFactKeys) &&
    isPhraseOffCooldown(phrase, params.editionsSinceLastUse)
  );
}

// ── 17.2 Record claims ───────────────────────────────────────────────────
const RECORD_CLAIM_PATTERN = /\b(first|best|worst|record|ever|highest|lowest|career-best)\b/i;

export function containsRecordClaimLanguage(template: string): boolean {
  return RECORD_CLAIM_PATTERN.test(template);
}

/** The one fact key every record-claim phrase must require — a story's facts only carry this key when story-engine.ts has already done real verification work (SEASON_BEST/PERSONAL_BEST's own isVerifiedSeasonBest/isVerifiedPersonalBest, MILESTONE's threshold-hit facts). Phrases WITHOUT this in `requires`, if their template uses record-claim language, are non-compliant with 17.2 — see the library-level test that scans for this. */
export const VERIFIED_RECORD_CLAIM_FACT_KEY = "verifiedRecordClaim";

export function isRecordClaimCompliant(phrase: Phrase): boolean {
  if (!containsRecordClaimLanguage(phrase.template)) return true;
  return (phrase.requires ?? []).includes(VERIFIED_RECORD_CLAIM_FACT_KEY);
}

// ── 12.6 Reading pace ─────────────────────────────────────────────────────
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** dialogueHoldSeconds = clamp(3.5, 9.0, 1.2 + wordCount / 3.2) — computed on the INTERPOLATED text (what a viewer actually reads), not the raw template. */
export function dialogueHoldSeconds(interpolatedText: string): number {
  const raw = 1.2 + wordCount(interpolatedText) / 3.2;
  return Math.max(3.5, Math.min(9.0, raw));
}

// ── 12.7 Banter guardrails ────────────────────────────────────────────────

/**
 * "Named negative humour max: one negative-targeted joke per player/team
 * per Edition. Negative target cooldown: at least four full segments and
 * one Edition before another negative-targeted joke." Both conditions are
 * hard gates (unlike the 70/20/10 tone split below, which is a soft target)
 * — a caller failing either check must pick a different phrase/turn or fall
 * back to a neutral/factual one instead.
 */
export function isNegativeBanterAllowed(params: {
  candidateSentiment: "positive" | "neutral" | "negative";
  negativeJokesAlreadyThisEditionForSubject: number;
  /** Full segments (not turns) since this subject's last negative-targeted joke, or null if there's never been one. */
  fullSegmentsSinceLastNegativeJokeForSubject: number | null;
  editionsSinceLastNegativeJokeForSubject: number | null;
}): boolean {
  if (params.candidateSentiment !== "negative") return true;
  if (params.negativeJokesAlreadyThisEditionForSubject >= 1) return false;
  if (params.fullSegmentsSinceLastNegativeJokeForSubject !== null && params.fullSegmentsSinceLastNegativeJokeForSubject < 4) return false;
  if (params.editionsSinceLastNegativeJokeForSubject !== null && params.editionsSinceLastNegativeJokeForSubject < 1) return false;
  return true;
}

/**
 * "Positive credit recovery: if a previously teased weakness materially
 * improves, prefer a fair-play/credit template" — a preference, not a hard
 * gate, so this returns a boolean a selection step can use to bias its
 * choice (e.g. filter to tone:"commentary"/sentiment:"positive" phrases
 * first) rather than something that can make a segment impossible to build.
 */
export function shouldPreferCreditTemplate(params: {
  subjectHadRecentNegativeStory: boolean;
  candidateMaterialImprovement: boolean;
}): boolean {
  return params.subjectHadRecentNegativeStory && params.candidateMaterialImprovement;
}

/** 12.7's 70/20/10 target, reported as actual shares for admin diagnostics (14.2) — a soft target the doc itself never calls a hard limit, unlike the negative-joke caps above. */
export function toneMixReport(tones: readonly PhraseTone[]): { commentary: number; humour: number; personality: number } {
  if (tones.length === 0) return { commentary: 0, humour: 0, personality: 0 };
  const counts = { commentary: 0, humour: 0, personality: 0 };
  for (const t of tones) counts[t]++;
  return {
    commentary: counts.commentary / tones.length,
    humour: counts.humour / tones.length,
    personality: counts.personality / tones.length,
  };
}

// ── Fact-to-TemplateFacts derivation ─────────────────────────────────────
// A story's own `facts` object (broadcast_stories.facts) stores IDs, not
// display names ("winnerId: 7", never "winnerName: Alice") — the Story
// Engine's own fact firewall (story-engine.ts's header) is exactly why:
// resolving a name is a DB lookup, and detectors are pure functions with no
// DB access. commentary-engine.ts is what actually resolves winnerId=7 to
// a real player name via the database; what it needs from THIS file is
// just the naming convention itself (given a fact key, what's the matching
// display-name key it should add?) so that decision is made in exactly one
// place and is independently testable without a database.
//
// The convention: any key ending "Id" gets a "Name" counterpart (winnerId
// -> winnerName); any key ending "Ids" (a numeric array) gets a
// "NamesJoined" counterpart (tiedEntityIds -> tiedEntityNamesJoined, a
// single comma-joined display string — TemplateFacts values must be
// primitives, never arrays, so a list of names has to already be flattened
// before it reaches interpolateTemplate()).

// Not every "...Id"-suffixed fact is a cross-entity reference resolvable to
// a player/team display name: seasonId, matchId, anchorMatchId and
// lastMeetingMatchId (Appendix A's own facts objects — see
// story-detectors-*.ts) are row references into seasons/matches, tables
// resolveEntityName() never queries. Naively treating every "...Id" key as
// an entity id used to send these into resolveEntityName() anyway, where
// they'd occasionally collide with a real player id by coincidence (a
// seasonId of 5 silently resolving to whichever player happens to have id
// 5) and otherwise just log "no singles entity found" and waste a query on
// an id that was never a player/team reference to begin with.
const NON_ENTITY_ID_KEY = /(?:match|season)id$/i;

/** Returns the display-name key a scalar id fact key should resolve to, or null if `key` isn't an id-shaped key at all (e.g. "stake", "points" pass through unresolved — they're already display-ready numbers) or is an internal row reference rather than a cross-entity one (seasonId, matchId — see NON_ENTITY_ID_KEY above). */
export function scalarIdNameKey(key: string): string | null {
  if (!/Id$/.test(key) || /Ids$/.test(key) || NON_ENTITY_ID_KEY.test(key)) return null;
  return key.replace(/Id$/, "Name");
}

/** Same idea for a plural id-array fact key (e.g. "tiedEntityIds", "viableEntityIds"). */
export function arrayIdNamesJoinedKey(key: string): string | null {
  if (!/Ids$/.test(key)) return null;
  return key.replace(/Ids$/, "NamesJoined");
}

/** Common percentage-display convenience: a 0..1 probability fact "xProbability" — or the bare key "probability" itself, as LEAGUE's NEW_FAVOURITE emits it — also gets an "xProbabilityPct" (rounded whole-number percent) — several phrases across RESULT/LEAGUE want to say "73%," not "0.73." Case-insensitive on purpose: NEW_FAVOURITE's own fact key is lowercase "probability" with no prefix at all, unlike every other *Probability-suffixed key in this catalogue. */
export function probabilityPctKey(key: string): string | null {
  if (!/probability$/i.test(key)) return null;
  return `${key}Pct`;
}

