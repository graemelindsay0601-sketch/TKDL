// TKDL LIVE — Edition Engine: the top-level orchestrator (handover doc
// sections 16.3/16.4, Appendix C.1's own `buildEdition(slot)`). Everything
// below it is already built and independently verified — story-engine.ts
// (section 9, detection/persistence), director.ts/director-math.ts
// (sections 10-11, running-order selection + the quality gate rule),
// commentary-engine.ts/commentary-math.ts (section 12, dialogue rendering)
// — this file's own job is purely the ORCHESTRATION Appendix C.1 and 16.3
// describe: resolve which logical slot we're building for, decide whether a
// rebuild is even warranted, claim exclusive ownership of that build, walk
// the running order calling into the Commentary Engine for each real story,
// apply the quality gate, and persist the result — with 16.4's concurrency
// contract and 17's own failure-handling table honoured throughout.
//
// DB-FACING, NOT UNIT TESTED — same convention as story-engine.ts,
// director.ts, commentary-engine.ts and config.ts: no dedicated test file,
// verified by typecheck + build clean and by construction from the already-
// tested pure layers underneath (director-math.ts, commentary-math.ts,
// story-engine-math.ts, edition-slots.ts).
//
// ── Title Predictor caching — Appendix C.1's `titleSnapshots =
// runTitlePredictorsOnce()` needs NO separate call here ─────────────────────
// story-engine.ts's own module header ("TITLE PREDICTOR CACHING") already
// explains this precisely: the LEAGUE family's detectors need real title
// probabilities, so story-engine.ts's own processLeagueFamily() already runs
// the Title Predictor once per league/season as PART OF detectAndUpdateStories(),
// storing the result in broadcast_prediction_snapshots and embedding whatever
// a story actually needs straight into that story's own persisted `facts`.
// There is no separate "titleSnapshots" object directorSelect() takes as a
// parameter (its real signature is `{pool, previousProgramme}` — confirmed
// against director.ts's own source) — this pseudocode step is already fully
// covered by the detectAndUpdateStories() call below, not a gap.
//
// ── Why "playersWithRepeatedNegativeBanterInCooldown" and
// "hasFactsOutsideCutoffSnapshot" are always empty/false below, not stubs ───
// Both are structural guarantees of the layers underneath, not values this
// file merely defaults for convenience:
//   - hasFactsOutsideCutoffSnapshot: buildTemplateFacts() (commentary-
//     engine.ts) derives every interpolated fact solely from a story's own
//     persisted `facts` column, itself populated at the exact cutoffEnd this
//     same batch's detectAndUpdateStories() call used. No code path in this
//     pipeline can produce a fact from outside that snapshot.
//   - playersWithRepeatedNegativeBanterInCooldown: 12.7's hard gates are
//     enforced INSIDE commentary-engine.ts's eligiblePhrasesForTurn() before
//     a phrase is ever selectable, using the real per-subject banterContext
//     this file computes (buildBanterContext, from broadcast_memory's
//     PLAYER_NEGATIVE rows plus this build's own running counters) — so no
//     segment this file assembles can ever violate that gate, PROVIDED this
//     file's own banterContext is itself computed honestly, which is exactly
//     what buildBanterContext does.
// Both are still scanned defensively below (hasUnresolvedPlaceholders,
// hasInvalidFutureMatchLanguage) as cheap, genuine double-checks over the
// final rendered text — not the primary enforcement mechanism, which lives
// one layer down, but a real safety net per 17's own reliability table.
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  broadcastEditionsTable, broadcastStoriesTable, broadcastMemoryTable, seasonsTable,
  type BroadcastEdition, type EditionStatus,
} from "@workspace/db";
import { getBroadcastConfig, type BroadcastConfig } from "./config.ts";
import { maybeAutoResetLeagueSeasons } from "../lib/seasonReset.ts";
import { resolveLogicalSlot, type ResolvedSlot } from "./edition-slots.ts";
import { detectAndUpdateStories, collectNewAndActiveStories } from "./story-engine.ts";
import { directorSelect, type RunningOrderEntry } from "./director.ts";
import {
  editionChangeScore, newlyCreatedGroupTreatments, isForcedRefresh, mergeStoriesByAnchorAndNarrative,
  evaluateQualityGate, programmeSegmentId,
  type EditionProgramme, type ProgrammeSegment, type QualityGateInput, type QualityGateSegment,
} from "./director-math.ts";
import { validityRulesForStory } from "./live-events-math.ts";
import { renderConversation, buildGraphicFacts, buildTemplateFacts, type DialogueTurn, type BanterContext } from "./commentary-engine.ts";
import { commentaryRng, dialogueHoldSeconds, interpolateTemplate } from "./commentary-math.ts";
import { CLOSING_TEASE_TEMPLATES, hasClosingTease } from "./closing-tease-math.ts";
import { pickFrom } from "./seeded-rng.ts";
import type { StoryType, Treatment } from "./story-types.ts";

// ── Fixed utility dialogue (11.1's required "closing" slot, and slot 9's
// own documented no-LEAGUE-story fallback — see director.ts's own header) ──
// These reference no facts at all (deliberately — there is no story behind
// either slot for a template to interpolate from), so they're hand-written,
// finished lines rather than anything templated, picked with the same
// seeded-per-Edition RNG every other piece of commentary uses so a viewer
// doesn't hear the identical sign-off every single Edition.
const CLOSING_DIALOGUE_OPTIONS: readonly { a: string; b: string }[] = [
  { a: "That's everything from Kilbirnie for this Edition.", b: "We'll have the next update as soon as there's something worth saying." },
  { a: "And that wraps things up for now.", b: "Get those matches in — we'll be back with more." },
  { a: "That's your lot from us until the next Edition.", b: "Same place, same board, next time." },
];

const WHAT_TO_WATCH_FALLBACK_OPTIONS: readonly { a: string; b: string }[] = [
  { a: "Nothing firm to flag on the title front just yet.", b: "Give it a few more results and there'll be plenty to talk about." },
  { a: "Too early in the picture to call anything just now.", b: "We'll have a proper watch-list once more matches are in the books." },
  { a: "Not enough on the board yet for a real title steer.", b: "Check back once the standings have had a chance to move." },
];

function buildFixedDialogue(pair: { a: string; b: string }): ProgrammeSegment["dialogue"] {
  return [
    { speaker: "A", text: pair.a, holdSeconds: dialogueHoldSeconds(pair.a) },
    { speaker: "B", text: pair.b, holdSeconds: dialogueHoldSeconds(pair.b) },
  ];
}

/**
 * Slot 10's required sign-off (11.1) — always present, never a full segment
 * of its own. The A-line stays one of the fixed CLOSING_DIALOGUE_OPTIONS
 * wrap-ups exactly as before. The B-line is where "what's coming up" lives:
 * when director.ts has attached a genuinely forward-looking storyline to
 * this entry (the same LEAGUE story driving slot 9's "what to watch" recap,
 * or a live win/loss streak — see director.ts's own header on slot 10) AND
 * that story's type has a closing-tease-math.ts template, the B-line
 * becomes a real, fact-checked tease ("keep an eye on the title race...")
 * instead of always repeating the same handful of fixed generic lines —
 * direct response to player feedback that the show felt like "a constant
 * same episode loop" with no reason to check back. Any failure along that
 * path (a story type with no template, or — defensively — an interpolation
 * error) falls straight back to the original fixed B-line: a decorative
 * aside is never worth risking the segment over.
 *
 * storyId/storyType/leagueType/facts stay null exactly as before, even when
 * a tease renders successfully: this is presenter narration ABOUT a story
 * already given its own real segment elsewhere (or, for a streak, about to
 * get one via the normal FORM slot), not a second segment about it — so
 * findDuplicateStoryIds' and the frontend's "closing has no story of its
 * own" invariant is unchanged, and no 10.4 exposure/airtime accounting is
 * needed (director.ts never calls commit() for this attachment either).
 */
async function buildClosingSegment(entry: RunningOrderEntry, slotKey: string, config: BroadcastConfig): Promise<ProgrammeSegment> {
  const aLine = pickFrom(CLOSING_DIALOGUE_OPTIONS, commentaryRng(slotKey, "utility:closing:a", config.commentaryVersion)).a;

  let bLine: string | null = null;
  const story = entry.group?.primary ?? null;
  if (story && hasClosingTease(story.storyType as StoryType)) {
    try {
      const templates = CLOSING_TEASE_TEMPLATES[story.storyType as StoryType]!;
      const template = pickFrom(templates, commentaryRng(slotKey, "utility:closing:tease", config.commentaryVersion));
      const templateFacts = await buildTemplateFacts(story.leagueType, story.facts);
      bLine = interpolateTemplate(template, templateFacts);
    } catch {
      bLine = null; // e.g. MissingFactError — fall back below rather than ever throwing over a decorative aside.
    }
  }
  if (bLine === null) {
    bLine = pickFrom(CLOSING_DIALOGUE_OPTIONS, commentaryRng(slotKey, "utility:closing:b", config.commentaryVersion)).b;
  }

  return {
    slot: entry.slot, purpose: "closing", importance: "utility",
    storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
    dialogue: [
      { speaker: "A", text: aLine, holdSeconds: dialogueHoldSeconds(aLine) },
      { speaker: "B", text: bLine, holdSeconds: dialogueHoldSeconds(bLine) },
    ],
    validityRules: [],
    facts: null,
  };
}

// A lightweight defensive scan over final rendered text — see this file's
// own header for why this is a real (if simple) safety net, not the primary
// enforcement mechanism. TKDL has no fixture/scheduling system at all
// (matches are recorded after the fact, never scheduled ahead of time), so
// no detector or phrase template should ever produce future-fixture
// language in the first place (Appendix D's own acceptance checklist: "No
// code assumes a future fixture exists").
const FUTURE_MATCH_LANGUAGE_PATTERN = /\b(will (face|play|meet)|next (match|fixture|game)|upcoming (match|fixture|game)|is (scheduled|set) to (play|face)|forthcoming (match|fixture))\b/i;

function hasFutureMatchLanguage(segments: readonly ProgrammeSegment[]): boolean {
  return segments.some(seg => seg.dialogue.some(d => FUTURE_MATCH_LANGUAGE_PATTERN.test(d.text)));
}

/** Should always be false — interpolateTemplate() (commentary-math.ts) throws MissingFactError rather than ever emitting a raw "{{...}}" — kept as a genuine, cheap double-check rather than trusting that invariant blindly. */
function hasUnresolvedPlaceholderText(segments: readonly ProgrammeSegment[]): boolean {
  return segments.some(seg => seg.dialogue.some(d => d.text.includes("{{")));
}

/**
 * Guards against the real repetition bug — the SAME story airing as two
 * separate FULL segments in one Edition (director.ts's own slot-filling
 * already marks a group `used` precisely to prevent this, so seeing it here
 * would mean that guarantee broke). Two purposes are deliberately excluded
 * from this check because they're DESIGNED to repeat a storyId that already
 * has a full segment elsewhere, per director.ts's own header comments:
 * "opening_headlines" is explicitly "a brief tease of up to 3 of the stories
 * ALREADY placed above," and "what_to_watch" is explicitly allowed to
 * "legitimately re-reference the best LEAGUE candidate already placed
 * elsewhere (recapping the open question is real content, not duplication)"
 * when no unused LEAGUE story remains. Counting either of those as a
 * "duplicate" would fail the quality gate on the ordinary, intended case of
 * a successful story getting both a headline tease and its own segment —
 * discarding the whole Edition over the very thing the tease/recap slots
 * exist to do.
 */
function findDuplicateStoryIds(segments: readonly ProgrammeSegment[]): boolean {
  const seen = new Set<number>();
  for (const seg of segments) {
    if (seg.storyId === null) continue;
    if (seg.purpose === "opening_headlines" || seg.purpose === "what_to_watch") continue;
    if (seen.has(seg.storyId)) return true;
    seen.add(seg.storyId);
  }
  return false;
}

/** Exported for live-events.ts's own reuse when reading back the current published Edition's programme — the same runtime guard, not a second copy of it. */
export function isEditionProgramme(value: unknown): value is EditionProgramme {
  return typeof value === "object" && value !== null && Array.isArray((value as { segments?: unknown }).segments);
}

// ═══════════════════════════════════════════════════════════════════════
// broadcast_editions reads
// ═══════════════════════════════════════════════════════════════════════

/** Exported for live-events.ts's own reuse — the live endpoint needs the same "current published Edition" read this file already implements, rather than a second, potentially-drifting copy of the same query. */
export async function latestPublishedEdition(): Promise<BroadcastEdition | null> {
  const [row] = await db
    .select()
    .from(broadcastEditionsTable)
    .where(eq(broadcastEditionsTable.status, "PUBLISHED"))
    .orderBy(desc(broadcastEditionsTable.publishedAt), desc(broadcastEditionsTable.id))
    .limit(1);
  return row ?? null;
}

// ═══════════════════════════════════════════════════════════════════════
// 16.4 Concurrency — claim exclusive build ownership of one logical slot
// ═══════════════════════════════════════════════════════════════════════

type ClaimResult =
  | { kind: "owned"; row: BroadcastEdition }
  /** Already PUBLISHED or SKIPPED — nothing to build; the caller returns this (or the latest published Edition) directly. */
  | { kind: "terminal"; row: BroadcastEdition }
  /** Another request is BUILDING this exact slot right now — 16.4: "other requests serve the last published Edition while the build completes." */
  | { kind: "building_elsewhere" };

/**
 * INSERT ... ON CONFLICT DO NOTHING on the unique slot_key, exactly as 16.4
 * specifies, plus one real enhancement the doc leaves unspecified but the
 * existing schema already supports cleanly: a slot stuck FAILED from a
 * previous attempt is reclaimed via a conditional UPDATE ... WHERE
 * status='FAILED' rather than being permanently unbuildable (the unique
 * slot_key constraint would otherwise block every future INSERT for that
 * slot forever, meaning one bad build could never be retried even on the
 * very next lazy check).
 */
async function claimBuildOwnership(slot: ResolvedSlot, now: Date, programmeVersion: number): Promise<ClaimResult> {
  const [existing] = await db.select().from(broadcastEditionsTable).where(eq(broadcastEditionsTable.slotKey, slot.slotKey)).limit(1);

  if (existing) {
    if (existing.status === "PUBLISHED" || existing.status === "SKIPPED") return { kind: "terminal", row: existing };
    if (existing.status === "BUILDING") return { kind: "building_elsewhere" };

    // existing.status === "FAILED" — attempt to reclaim it for a fresh build.
    const [reclaimed] = await db
      .update(broadcastEditionsTable)
      .set({ status: "BUILDING" satisfies EditionStatus })
      .where(and(eq(broadcastEditionsTable.id, existing.id), eq(broadcastEditionsTable.status, "FAILED")))
      .returning();
    if (reclaimed) return { kind: "owned", row: reclaimed };

    // Lost the reclaim race to a concurrent retry — defer to whatever it now is.
    const [afterRace] = await db.select().from(broadcastEditionsTable).where(eq(broadcastEditionsTable.id, existing.id)).limit(1);
    if (afterRace?.status === "PUBLISHED" || afterRace?.status === "SKIPPED") return { kind: "terminal", row: afterRace };
    return { kind: "building_elsewhere" };
  }

  const [inserted] = await db
    .insert(broadcastEditionsTable)
    .values({
      slotKey: slot.slotKey, slotType: slot.slotType, scheduledFor: slot.scheduledFor,
      dataCutoff: now, status: "BUILDING", changeScore: 0, programmeVersion,
      programme: null, diagnostic: null, publishedAt: null,
    })
    .onConflictDoNothing({ target: broadcastEditionsTable.slotKey })
    .returning();
  if (inserted) return { kind: "owned", row: inserted };

  // Lost the INSERT race to a concurrent request — defer to whatever it is now.
  const [afterRace] = await db.select().from(broadcastEditionsTable).where(eq(broadcastEditionsTable.slotKey, slot.slotKey)).limit(1);
  if (afterRace?.status === "PUBLISHED" || afterRace?.status === "SKIPPED") return { kind: "terminal", row: afterRace };
  return { kind: "building_elsewhere" };
}

// ═══════════════════════════════════════════════════════════════════════
// 10.1 change score inputs — has a season boundary event occurred this batch?
// ═══════════════════════════════════════════════════════════════════════

/** True if any of the three leagues' seasons closed strictly within (cutoffStart, cutoffEnd] — the concrete, checkable proxy for 10.2's "seasonChampionOrResetEventOccurred", mirroring story-engine.ts's own private seasonEndedInWindow() (not exported, so re-derived here rather than reaching into that file's internals). */
async function anySeasonEndedInWindow(cutoffStart: Date, cutoffEnd: Date): Promise<boolean> {
  const closedSeasons = await db.select().from(seasonsTable).where(sql`${seasonsTable.endDate} IS NOT NULL`);
  for (const season of closedSeasons) {
    if (season.isActive || !season.endDate) continue;
    const endedAt = new Date(`${season.endDate}T00:00:00Z`);
    if (endedAt > cutoffStart && endedAt <= cutoffEnd) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// 12.7 banter guardrails — the real counters commentary-math.ts's
// isNegativeBanterAllowed() needs, which only this orchestration layer can
// supply (see commentary-engine.ts's own header on the exposure/banter
// split for exactly why)
// ═══════════════════════════════════════════════════════════════════════

/** A monotonic proxy for "how many full segments have ever aired across the show's history" — no dedicated counter exists in the schema, but SUM(full_count) across every broadcast_stories row (each incremented once per full segment that story itself received) serves the same ordinal purpose: comparing two readings of it tells you how many full segments elapsed in between. */
async function getGlobalFullSegmentCounter(): Promise<number> {
  const rows = (await db.execute(sql`SELECT COALESCE(SUM(full_count), 0)::int AS total FROM broadcast_stories`)).rows as { total: number }[];
  return rows[0]?.total ?? 0;
}

const PLAYER_NEGATIVE_MEMORY_KEY = "negative";

async function getPlayerNegativeState(subjectKey: string): Promise<{ lastEditionId: number; fullSegmentCounterAtUse: number } | null> {
  const [row] = await db
    .select()
    .from(broadcastMemoryTable)
    .where(and(
      eq(broadcastMemoryTable.memoryType, "PLAYER_NEGATIVE"),
      eq(broadcastMemoryTable.memoryKey, PLAYER_NEGATIVE_MEMORY_KEY),
      eq(broadcastMemoryTable.subjectKey, subjectKey),
    ))
    .limit(1);
  if (!row || row.lastEditionId === null) return null;
  const payload = row.payload as { fullSegmentCounterAtUse?: number } | null;
  if (!payload || typeof payload.fullSegmentCounterAtUse !== "number") return null;
  return { lastEditionId: row.lastEditionId, fullSegmentCounterAtUse: payload.fullSegmentCounterAtUse };
}

async function recordPlayerNegativeUse(subjectKey: string, editionId: number, fullSegmentCounterAtUse: number): Promise<void> {
  await db
    .insert(broadcastMemoryTable)
    .values({ memoryType: "PLAYER_NEGATIVE", memoryKey: PLAYER_NEGATIVE_MEMORY_KEY, subjectKey, lastUsedAt: new Date(), lastEditionId: editionId, usageCount: 1, payload: { fullSegmentCounterAtUse } })
    .onConflictDoUpdate({
      target: [broadcastMemoryTable.memoryType, broadcastMemoryTable.memoryKey, broadcastMemoryTable.subjectKey],
      set: { lastUsedAt: new Date(), lastEditionId: editionId, usageCount: sql`${broadcastMemoryTable.usageCount} + 1`, payload: { fullSegmentCounterAtUse } },
    });
}

async function buildBanterContext(
  subjectKey: string, editionId: number, negativeJokesThisEdition: ReadonlyMap<string, number>, currentGlobalFullSegmentCounter: number,
): Promise<BanterContext> {
  const state = await getPlayerNegativeState(subjectKey);
  return {
    negativeJokesAlreadyThisEditionForSubject: negativeJokesThisEdition.get(subjectKey) ?? 0,
    fullSegmentsSinceLastNegativeJokeForSubject: state ? Math.max(0, currentGlobalFullSegmentCounter - state.fullSegmentCounterAtUse) : null,
    editionsSinceLastNegativeJokeForSubject: state ? Math.max(0, editionId - state.lastEditionId) : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Per-story usage bookkeeping (broadcast_stories.fullCount/headlineCount)
// ═══════════════════════════════════════════════════════════════════════

async function updateStoryUsageBookkeeping(storyId: number, editionId: number, kind: "full" | "headline"): Promise<void> {
  if (kind === "full") {
    await db.update(broadcastStoriesTable)
      .set({ fullCount: sql`${broadcastStoriesTable.fullCount} + 1`, lastFullEditionId: editionId })
      .where(eq(broadcastStoriesTable.id, storyId));
  } else {
    await db.update(broadcastStoriesTable)
      .set({ headlineCount: sql`${broadcastStoriesTable.headlineCount} + 1`, lastHeadlineEditionId: editionId })
      .where(eq(broadcastStoriesTable.id, storyId));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Segment assembly — one running-order entry -> one ProgrammeSegment
// ═══════════════════════════════════════════════════════════════════════

type SegmentBuildContext = {
  editionId: number;
  slotKey: string;
  commentaryVersion: number;
  banterLevel: number;
  /** subjectKey -> negative-targeted jokes already used for it THIS Edition build — resets fresh on every call to buildEdition(), unlike the broadcast_memory-backed cross-Edition counters below. */
  negativeJokesThisEdition: Map<string, number>;
  globalFullSegmentCounter: { value: number };
};

/**
 * Renders one real story's segment (director.ts guarantees `entry.group` is
 * non-null here, so `entry.treatment` is always a genuine Treatment, never
 * "utility" — only a null-group entry ever carries "utility"). Falls back to
 * Supporting/QUICK_HIT once if the entry's own treatment couldn't produce
 * anything — 17's own "Commentary assembly fails for story -> Replace with
 * deterministic fact-only graphic/quick-hit": QUICK_HIT (Supporting's own,
 * only, blueprint) IS exactly that deterministic fact+reaction minimum, so
 * this fallback satisfies that requirement directly rather than needing a
 * second, hand-rolled "plain fact string" renderer that would duplicate what
 * QUICK_HIT already is. Returns null only if even that fails (e.g. this
 * exact story already exhausted its own QUICK_HIT pool earlier in this same
 * Edition) — 11.6's own stale-segment-invalidation philosophy: drop rather
 * than publish broken or empty content.
 */
async function buildSegmentForEntry(entry: RunningOrderEntry, ctx: SegmentBuildContext): Promise<ProgrammeSegment | null> {
  if (!entry.group) return null;

  const story = entry.group.primary;
  const subjectKey = story.subjectKeys[0];
  const isHeadlineTease = entry.purpose === "opening_headlines";

  async function attempt(treatment: Treatment): Promise<DialogueTurn[]> {
    const banterContext = await buildBanterContext(subjectKey, ctx.editionId, ctx.negativeJokesThisEdition, ctx.globalFullSegmentCounter.value);
    return renderConversation({
      storyKey: story.storyKey,
      storyType: story.storyType as StoryType,
      leagueType: story.leagueType,
      facts: story.facts,
      primarySubjectKey: subjectKey,
      treatment,
      slotKey: ctx.slotKey,
      commentaryVersion: ctx.commentaryVersion,
      editionId: ctx.editionId,
      banterContext,
      banterLevel: ctx.banterLevel,
    });
  }

  let dialogue = await attempt(entry.treatment as Treatment);
  if (dialogue.length === 0 && entry.treatment !== "supporting") {
    dialogue = await attempt("supporting");
  }
  if (dialogue.length === 0) return null;

  // See buildGraphicFacts's own header: graphic.data needs every id-shaped
  // fact resolved to a display name, not just the ones a dialogue template
  // happened to reference — computed only now that a segment is definitely
  // being produced, since a dropped (dialogue.length === 0) entry never
  // needs a graphic at all.
  const graphicFacts = await buildGraphicFacts(story.leagueType, story.facts);

  const hasNegativeTurn = dialogue.some(d => d.sentiment === "negative");
  if (isHeadlineTease) {
    await updateStoryUsageBookkeeping(story.id, ctx.editionId, "headline");
  } else {
    await updateStoryUsageBookkeeping(story.id, ctx.editionId, "full");
    ctx.globalFullSegmentCounter.value += 1;
    if (hasNegativeTurn) {
      ctx.negativeJokesThisEdition.set(subjectKey, (ctx.negativeJokesThisEdition.get(subjectKey) ?? 0) + 1);
      await recordPlayerNegativeUse(subjectKey, ctx.editionId, ctx.globalFullSegmentCounter.value);
    }
  }

  return {
    slot: entry.slot,
    purpose: entry.purpose,
    importance: entry.treatment,
    storyId: story.id,
    // 9.6's own merge contract: supporting stories are folded into ONE
    // shared segment (never given their own) but their facts are NOT blended
    // into the primary's own commentary facts — commentary-library.ts keys
    // phrases strictly by the PRIMARY's exact storyType, and no template
    // currently references another type's fact keys, so there is no safe,
    // documented namespacing convention for merging two differently-shaped
    // facts objects without risking a genuine key collision (e.g. both
    // stories independently having their own, differently-valued
    // "playerId"). supportingStoryIds is still persisted here so a future,
    // deliberately-designed cross-story fact scheme could use it — this file
    // just doesn't invent one blindly.
    supportingStoryIds: entry.group.supporting.map(s => s.id),
    storyType: story.storyType,
    leagueType: story.leagueType,
    lifecycleAtBroadcast: story.lifecycle,
    dialogue: dialogue.map(d => ({ speaker: d.speaker, text: d.text, holdSeconds: d.holdSeconds })),
    // 11.6: generated once, here, from the story's own already-known facts —
    // live-events.ts re-evaluates these against current state on every poll.
    validityRules: validityRulesForStory(story),
    // Carried forward for api-shapes.ts's own graphic.data serialization —
    // see ProgrammeSegment's own field comment (director-math.ts) for why
    // this is captured now rather than re-read at API-response time. Already
    // resolved to display-ready values (buildGraphicFacts, above) rather
    // than the story's own raw fact-firewalled ids — see that function's
    // own header for why a graphic needs that and dialogue doesn't.
    facts: graphicFacts,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// C.1 buildEdition
// ═══════════════════════════════════════════════════════════════════════

/**
 * Steps 5-7 of 16.3, plus C.1's own body, given an already-claimed BUILDING
 * row. Returns the fresh PUBLISHED row, the previous PUBLISHED row (on a
 * below-threshold skip, or a quality-gate failure — 17's own "keep previous
 * published Edition" rule), or null only when there is truly no previous
 * Edition AND this attempt still couldn't clear the quality gate (the
 * doc's own "No previous Edition exists ... if impossible, show live
 * standings/results fallback" row — a future routes/broadcast.ts's job to
 * render, not this file's).
 */
async function buildEdition(params: {
  claimedRow: BroadcastEdition;
  previous: BroadcastEdition | null;
  now: Date;
  config: BroadcastConfig;
  /** True only from forceRebuildCurrentEdition() (the admin regenerate endpoint, task 134) — threads straight into isForcedRefresh's own `adminForced` input, bypassing the change-score threshold exactly the way 14.2's "Force build current/manual Edition for testing" describes. Defaults false for the ordinary lazy-check path (ensureCurrentBroadcastEdition), which has no such admin request to honour. */
  adminForced?: boolean;
}): Promise<BroadcastEdition | null> {
  const { claimedRow, previous, now: cutoffEnd, config, adminForced = false } = params;

  // Appendix C.1: "cutoffStart = previous?.dataCutoff ?? beginningOfRelevantHistory".
  // Omitting cutoffStart entirely for a genuinely first-ever build lets
  // story-engine.ts's own resolveCutoffStart() apply ITS default (new Date(0)
  // when broadcast_stories is empty) — exactly "beginningOfRelevantHistory".
  const storyState = previous
    ? await detectAndUpdateStories({ cutoffStart: previous.dataCutoff, cutoffEnd })
    : await detectAndUpdateStories({ cutoffEnd });

  const pool = await collectNewAndActiveStories();
  const mergedForChangeScore = mergeStoriesByAnchorAndNarrative(pool);
  const newMatchCount = storyState.newMatchesProcessed.singles + storyState.newMatchesProcessed.doubles + storyState.newMatchesProcessed.shiftWars;
  const changeScore = editionChangeScore({
    newCompletedMatchCount: newMatchCount,
    newlyCreatedGroupTreatments: newlyCreatedGroupTreatments(mergedForChangeScore),
  });

  const seasonBoundaryEventOccurred = await anySeasonEndedInWindow(previous?.dataCutoff ?? new Date(0), cutoffEnd);
  const forced = isForcedRefresh({
    seasonChampionOrResetEventOccurred: seasonBoundaryEventOccurred,
    noPublishedEditionExists: previous === null,
    publishedEditionAgeHours: previous?.publishedAt ? (cutoffEnd.getTime() - previous.publishedAt.getTime()) / 3_600_000 : null,
    adminForced,
  });

  if (!forced && changeScore < config.changeThreshold) {
    const [skipped] = await db
      .update(broadcastEditionsTable)
      .set({ status: "SKIPPED", dataCutoff: cutoffEnd, changeScore, diagnostic: `change score ${changeScore} below threshold ${config.changeThreshold}` })
      .where(eq(broadcastEditionsTable.id, claimedRow.id))
      .returning();
    // 16.3 step 6: "return previous" — the previously PUBLISHED Edition is
    // still what viewers should see. previous is only null here if
    // noPublishedEditionExists also forced this build past the skip branch
    // above, so this fallback to the SKIPPED row itself is unreachable in
    // practice; kept only so the function stays well-typed rather than
    // asserting.
    return previous ?? skipped ?? null;
  }

  const previousProgramme = previous && isEditionProgramme(previous.programme) ? previous.programme : null;
  const directorResult = directorSelect({ pool, previousProgramme, slotKey: claimedRow.slotKey });

  const negativeJokesThisEdition = new Map<string, number>();
  const globalFullSegmentCounter = { value: await getGlobalFullSegmentCounter() };
  const segCtx: SegmentBuildContext = {
    editionId: claimedRow.id, slotKey: claimedRow.slotKey, commentaryVersion: config.commentaryVersion,
    banterLevel: config.banterLevel, negativeJokesThisEdition, globalFullSegmentCounter,
  };

  const segments: ProgrammeSegment[] = [];
  for (const entry of directorResult.runningOrder) {
    // 11.1's required "closing" sign-off (always present, slot 10) — handled
    // before the `!entry.group` branch below because, unlike every other
    // slot, "closing" can now carry a group (director.ts's own "what's
    // coming up" attachment) WITHOUT that meaning "render this as a full
    // segment about that story" — see buildClosingSegment's own header.
    if (entry.purpose === "closing") {
      segments.push(await buildClosingSegment(entry, claimedRow.slotKey, config));
      continue;
    }
    if (!entry.group) {
      // Slot 9's own documented no-LEAGUE-story fallback (director.ts's own
      // header) — no story behind it, so fixed hand-written dialogue rather
      // than anything templated.
      const rng = commentaryRng(claimedRow.slotKey, `utility:${entry.purpose}`, config.commentaryVersion);
      segments.push({
        slot: entry.slot, purpose: entry.purpose, importance: "utility",
        storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
        dialogue: buildFixedDialogue(pickFrom(WHAT_TO_WATCH_FALLBACK_OPTIONS, rng)),
        // No story behind a fixed fallback line — nothing about it can go stale, so genuinely no rules apply, not a placeholder.
        validityRules: [],
        facts: null,
      });
      continue;
    }
    const segment = await buildSegmentForEntry(entry, segCtx);
    if (segment) segments.push(segment);
  }

  const qualityGateSegments: QualityGateSegment[] = segments.map(seg => ({
    id: programmeSegmentId(seg.slot),
    leagueType: seg.leagueType,
    importance: seg.importance,
    sentiment: seg.storyId !== null ? (pool.find(s => s.id === seg.storyId)?.sentiment ?? null) : null,
    storyId: seg.storyId,
  }));

  const qualityInput: QualityGateInput = {
    segments: qualityGateSegments,
    isChampionOrSeasonBoundarySpecial: seasonBoundaryEventOccurred,
    hasFactsOutsideCutoffSnapshot: false, // structurally guaranteed — see this file's own header
    hasInvalidFutureMatchLanguage: hasFutureMatchLanguage(segments),
    hasUnresolvedPlaceholders: hasUnresolvedPlaceholderText(segments),
    hasDuplicateStoryIds: findDuplicateStoryIds(segments),
    playersWithRepeatedNegativeBanterInCooldown: [], // structurally guaranteed — see this file's own header
  };

  const qualityResult = evaluateQualityGate(qualityInput);
  const programme: EditionProgramme = { segments };

  if (qualityResult.pass) {
    const [published] = await db
      .update(broadcastEditionsTable)
      .set({ status: "PUBLISHED", dataCutoff: cutoffEnd, changeScore, programmeVersion: config.programmeVersion, programme, diagnostic: null, publishedAt: cutoffEnd })
      .where(eq(broadcastEditionsTable.id, claimedRow.id))
      .returning();
    return published ?? null;
  }

  await db
    .update(broadcastEditionsTable)
    .set({ status: "FAILED", dataCutoff: cutoffEnd, changeScore, diagnostic: qualityResult.reasons.join("; ") })
    .where(eq(broadcastEditionsTable.id, claimedRow.id));

  // 17's own table: "New Edition fails quality gate -> Keep previous
  // published Edition." A null return here means there truly is no previous
  // Edition AND even this forced bootstrap attempt couldn't clear the
  // quality gate (e.g. too little real story data exists yet) — the same
  // table's "No previous Edition exists" row says the caller falls back to a
  // live standings/results view in that case (routes/broadcast.ts, task 134,
  // not yet written).
  return previous;
}

// ═══════════════════════════════════════════════════════════════════════
// 16.3 ensureCurrentBroadcastEdition — the lazy slot check, top to bottom
// ═══════════════════════════════════════════════════════════════════════

/**
 * The full 8-step lazy slot check, verbatim against 16.3:
 *   1. resolve latest logical slot in Europe/London
 *   2. ensure monthly season state is current
 *   3. if slot row already PUBLISHED/SKIPPED -> return current published edition
 *   4. acquire build ownership using unique slot_key / transaction
 *   5. compute change score since last published cutoff
 *   6. if below threshold and no forced condition -> mark SKIPPED
 *   7. otherwise build and quality-gate Edition -> PUBLISHED
 *   8. on error -> FAILED; continue serving previous PUBLISHED Edition
 * Steps 5-7 live in buildEdition() above; this function is steps 1-4 plus
 * the step-8 error boundary around the call into it.
 */
export async function ensureCurrentBroadcastEdition(now: Date = new Date()): Promise<BroadcastEdition | null> {
  const config = await getBroadcastConfig();
  const slot = resolveLogicalSlot(now, { middayTime: config.middayTime, eveningTime: config.eveningTime, nightTime: config.nightTime, timezone: config.timezone, singleDailyEpisode: config.singleDailyEpisode });

  await maybeAutoResetLeagueSeasons();

  const claim = await claimBuildOwnership(slot, now, config.programmeVersion);
  if (claim.kind === "terminal") {
    return claim.row.status === "PUBLISHED" ? claim.row : latestPublishedEdition();
  }
  if (claim.kind === "building_elsewhere") {
    return latestPublishedEdition();
  }

  const previous = await latestPublishedEdition();
  try {
    return await buildEdition({ claimedRow: claim.row, previous, now, config });
  } catch (err) {
    console.error(`edition-engine: build failed for slot ${slot.slotKey}:`, err);
    try {
      await db
        .update(broadcastEditionsTable)
        .set({ status: "FAILED", diagnostic: err instanceof Error ? err.message : String(err) })
        .where(eq(broadcastEditionsTable.id, claim.row.id));
    } catch (markFailedErr) {
      console.error(`edition-engine: failed to mark slot ${slot.slotKey} as FAILED after a build error:`, markFailedErr);
    }
    return previous;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Admin regenerate — POST /api/admin/broadcast/regenerate (14.2)
// ═══════════════════════════════════════════════════════════════════════

export type ForceRebuildResult =
  | { kind: "built"; edition: BroadcastEdition | null }
  /** The current slot is already BUILDING (an ordinary lazy check landed on it at the same moment) — reclaiming it here would race two builds against the same row, so this defers rather than doing that; the caller should just tell the admin to retry shortly. */
  | { kind: "already_building" };

/**
 * The admin-only counterpart to ensureCurrentBroadcastEdition() above, for
 * 14.2's "force build current/manual Edition for testing." The ordinary lazy
 * check's claimBuildOwnership() deliberately only ever reclaims a FAILED row
 * (16.4's own concurrency contract) — an admin explicitly asking to
 * regenerate wants a fresh build even when the current slot is already
 * PUBLISHED or SKIPPED, which claimBuildOwnership() would otherwise treat as
 * terminal and refuse to touch. This claims the row unconditionally instead
 * (short of a genuine concurrent BUILDING race, handled above) and always
 * passes adminForced: true into buildEdition(), so the change-score
 * threshold from 10.1 never blocks an admin's own explicit request.
 *
 * `previous` is read BEFORE this slot's own row is reclaimed, so if the
 * current slot was already the latest PUBLISHED Edition, `previous` legally
 * IS that same row's prior state — buildEdition() then re-scans
 * (previous.dataCutoff, now] for anything new exactly as it would for any
 * other rebuild, which is exactly "regenerate with current settings/data"
 * for an admin who, say, just bumped commentaryVersion or banterLevel and
 * wants to see the effect immediately rather than waiting for the next
 * natural change-score-driven rebuild.
 */
export async function forceRebuildCurrentEdition(now: Date = new Date()): Promise<ForceRebuildResult> {
  const config = await getBroadcastConfig();
  const slot = resolveLogicalSlot(now, { middayTime: config.middayTime, eveningTime: config.eveningTime, nightTime: config.nightTime, timezone: config.timezone, singleDailyEpisode: config.singleDailyEpisode });

  await maybeAutoResetLeagueSeasons();

  const previous = await latestPublishedEdition();
  const [existing] = await db.select().from(broadcastEditionsTable).where(eq(broadcastEditionsTable.slotKey, slot.slotKey)).limit(1);

  let claimedRow: BroadcastEdition;
  if (existing) {
    if (existing.status === "BUILDING") return { kind: "already_building" };
    const [reclaimed] = await db
      .update(broadcastEditionsTable)
      .set({ status: "BUILDING" satisfies EditionStatus })
      .where(eq(broadcastEditionsTable.id, existing.id))
      .returning();
    if (!reclaimed) return { kind: "already_building" }; // lost a race to a concurrent request between the read above and this UPDATE
    claimedRow = reclaimed;
  } else {
    const [inserted] = await db
      .insert(broadcastEditionsTable)
      .values({
        slotKey: slot.slotKey, slotType: slot.slotType, scheduledFor: slot.scheduledFor,
        dataCutoff: now, status: "BUILDING", changeScore: 0, programmeVersion: config.programmeVersion,
        programme: null, diagnostic: null, publishedAt: null,
      })
      .onConflictDoNothing({ target: broadcastEditionsTable.slotKey })
      .returning();
    if (!inserted) return { kind: "already_building" }; // lost the INSERT race to a concurrent request
    claimedRow = inserted;
  }

  try {
    const edition = await buildEdition({ claimedRow, previous, now, config, adminForced: true });
    return { kind: "built", edition };
  } catch (err) {
    console.error(`edition-engine: admin-forced rebuild failed for slot ${slot.slotKey}:`, err);
    try {
      await db
        .update(broadcastEditionsTable)
        .set({ status: "FAILED", diagnostic: err instanceof Error ? err.message : String(err) })
        .where(eq(broadcastEditionsTable.id, claimedRow.id));
    } catch (markFailedErr) {
      console.error(`edition-engine: failed to mark slot ${slot.slotKey} as FAILED after an admin-forced rebuild error:`, markFailedErr);
    }
    return { kind: "built", edition: previous };
  }
}
