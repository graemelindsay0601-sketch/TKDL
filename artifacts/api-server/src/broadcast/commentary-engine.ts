// TKDL LIVE — Commentary Engine: the DB-facing half (handover doc section
// 12, Appendix C.3's renderConversation). commentary-math.ts owns every
// pure rule (phrase eligibility, interpolation, pace, banter gates);
// commentary-library.ts owns the actual phrase content; this file is what
// actually resolves real names from the database, reads/writes
// broadcast_memory for cooldown and callback bookkeeping, and ties phrase
// selection + interpolation + pace together into the dialogue turns one
// story's segment airs.
//
// DB-FACING, NOT UNIT TESTED — same convention as story-engine.ts, config.ts
// and every other orchestration file in this folder that talks to the real
// database: no dedicated test file, verified by typecheck + build clean and
// by construction from the already-tested pure layers underneath it
// (commentary-math.ts, commentary-library.ts, both fully unit tested).
//
// ── Name resolution ───────────────────────────────────────────────────────
// Every id-shaped fact key on a story resolves through the SAME leagueType
// the story itself carries (RESULT/FORM/H2H/PERFORMANCE/MILESTONE are
// singles-only by construction; DOUBLES ids are doubles team ids;
// SHIFT_WARS ids are shift_wars team ids; LEAGUE/ARCHIVE stories carry
// whichever leagueType that particular instance was detected for) — so one
// leagueType-dispatched lookup covers every id on every story, singles via
// the real Drizzle players table, doubles/shift_wars via the hand-rolled
// SQL tables the rest of this folder already queries the same way (see
// team-history-reconstruction.ts's own header for why those two aren't
// proper Drizzle schema).
//
// ── The exposure/banter split with edition-engine.ts (not yet written) ────
// isNegativeBanterAllowed (commentary-math.ts) needs three counters —
// negative jokes already this Edition for a subject, full segments since
// their last one, Editions since their last one — that only the Director/
// Edition Assembly layer can actually compute: "full segments" is a running-
// order-wide count this file has no visibility into (this file renders ONE
// story's dialogue at a time), exactly the same reasoning that already
// keeps 10.4's exposure-cap counters as pure-function inputs in
// director-math.ts rather than DB state owned there. `banterContext` below
// is therefore a REQUIRED parameter, not an optional one with a permissive
// default — forcing edition-engine.ts (task-tracked, not yet written) to
// actually wire it from broadcast_memory's own PLAYER_NEGATIVE rows plus its
// own running-order bookkeeping, rather than this file silently always
// allowing negative humour because nobody supplied the real counters yet.
//
// ── Phrase cooldown and CALLBACK bookkeeping THIS file does own ───────────
// Per-phrase reuse cooldown (12.3's own cooldownEditions field) and
// CALLBACK's "stored presenter/phrase history" (12.4) are both properly
// this file's job — they're per-subject, per-phrase facts entirely local to
// rendering one story's dialogue, using broadcast_memory's PHRASE and
// PRESENTER_CALL rows (13.4) exactly as that table's own header anticipated.
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db, playersTable, broadcastMemoryTable,
  type BroadcastStory, type LeagueType,
} from "@workspace/db";
import {
  BLUEPRINTS, blueprintNamesForTreatment, resolveTurnsForTreatment, commentaryRng, chooseBlueprint,
  interpolateTemplate, dialogueHoldSeconds,
  phraseFactsSatisfied, phraseTemplateSatisfiable, isPhraseOffCooldown,
  isNegativeBanterAllowed,
  scalarIdNameKey, arrayIdNamesJoinedKey, probabilityPctKey,
  type Phrase, type BlueprintName, type BlueprintTurn, type TemplateFacts,
} from "./commentary-math.ts";
import { phrasesForStoryType, UNIVERSAL_CALLBACK_PHRASES, UNIVERSAL_BANTER_PHRASES } from "./commentary-library.ts";
import type { StoryType, Treatment } from "./story-types.ts";
import { pickFrom } from "./seeded-rng.ts";

// ── Name resolution ───────────────────────────────────────────────────────

async function singlesPlayerName(playerId: number): Promise<string | null> {
  const [row] = await db.select({ name: playersTable.name }).from(playersTable).where(eq(playersTable.id, playerId));
  return row?.name ?? null;
}

async function doublesTeamName(teamId: number): Promise<string | null> {
  const result = await db.execute(sql`SELECT team_name FROM doubles_teams WHERE id = ${teamId}`);
  const row = result.rows[0] as { team_name: string } | undefined;
  return row?.team_name ?? null;
}

async function shiftWarsTeamName(teamId: number): Promise<string | null> {
  const result = await db.execute(sql`SELECT name FROM shift_wars_teams WHERE id = ${teamId}`);
  const row = result.rows[0] as { name: string } | undefined;
  return row?.name ?? null;
}

/** Dispatches on the story's own leagueType — every entity id on any one story shares it (see this file's own header). Falls back to a visible placeholder rather than throwing: one dialogue line reading "Unknown" is far better than losing the whole Edition build over a single dangling id (this codebase's established "no raw error" philosophy — see config.ts's own comment). */
async function resolveEntityName(leagueType: LeagueType, entityId: number): Promise<string> {
  const name =
    leagueType === "singles" ? await singlesPlayerName(entityId)
    : leagueType === "doubles" ? await doublesTeamName(entityId)
    : await shiftWarsTeamName(entityId);
  if (name === null) {
    console.warn(`commentary-engine: no ${leagueType} entity found for id ${entityId} — a story's fact firewall should make this impossible`);
    return "Unknown";
  }
  return name;
}

/**
 * Walks a story's own `facts` object and produces the full TemplateFacts a
 * template can interpolate from: every raw primitive fact passes through
 * unchanged, every id-shaped key additionally gets its resolved display
 * name, every id-array gets a joined display-names string, and every
 * probability-shaped key gets a rounded whole-number percent — exactly the
 * derivation contract commentary-library.ts's own header documents.
 * Null/undefined fact values are dropped entirely (never surfaced as a
 * usable placeholder) rather than interpolated as "null" — a phrase whose
 * template needs one of those keys is filtered out upstream by
 * phraseTemplateSatisfiable, never reaches here trying to use it.
 */
export async function buildTemplateFacts(leagueType: LeagueType, facts: Record<string, unknown>): Promise<TemplateFacts> {
  const result: TemplateFacts = {};

  const idLookups: Promise<void>[] = [];
  const namesJoinedLookups: Promise<void>[] = [];

  for (const [key, value] of Object.entries(facts)) {
    if (value === null || value === undefined) continue;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;

      const nameKey = scalarIdNameKey(key);
      if (nameKey && typeof value === "number") {
        idLookups.push(resolveEntityName(leagueType, value).then(name => { result[nameKey] = name; }));
      }

      const pctKey = probabilityPctKey(key);
      if (pctKey && typeof value === "number") {
        result[pctKey] = Math.round(value * 100);
      }
      continue;
    }

    if (Array.isArray(value)) {
      const namesJoinedKey = arrayIdNamesJoinedKey(key);
      if (namesJoinedKey && value.every((v): v is number => typeof v === "number")) {
        namesJoinedLookups.push(
          Promise.all(value.map(id => resolveEntityName(leagueType, id))).then(names => { result[namesJoinedKey] = names.join(", "); }),
        );
      }
      // A raw array (e.g. LEAGUE.TITLE_RACE's own `probabilities`) can never
      // be interpolated directly (TemplateFacts is string|number|boolean
      // only) — no phrase in commentary-library.ts references one, and any
      // that tried would be caught by phraseTemplateSatisfiable, so this is
      // correctly and silently dropped, not a gap.
      continue;
    }
    // Any other shape (nested object, etc.) — none of Appendix A's detector
    // facts ever produce one; dropped for the same reason arrays are.
  }

  await Promise.all([...idLookups, ...namesJoinedLookups]);
  return result;
}

/**
 * The `graphic.data` counterpart to buildTemplateFacts() above — same id
 * resolution, different destination. A dialogue template only ever reads
 * the specific `{{fooName}}` key a phrase references, so buildTemplateFacts
 * can afford to leave the raw `fooId` sitting unused right next to it. A
 * graphic (GraphicFrame.tsx) has no such filter: it renders EVERY key in
 * this object as its own labelled row, so a raw id left in here shows up to
 * a viewer as a literal database number ("Player A Id: 16") instead of the
 * name it identifies. This function therefore REPLACES each id-shaped key
 * with its resolved *Name/*NamesJoined counterpart rather than adding the
 * resolved key alongside the original, the way buildTemplateFacts does.
 * Every non-id fact (counts, dates, booleans, probabilities) passes through
 * unchanged — GraphicFrame's own formatFactValue() already renders those
 * correctly on its own.
 */
export async function buildGraphicFacts(leagueType: LeagueType, facts: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  const idLookups: Promise<void>[] = [];

  for (const [key, value] of Object.entries(facts)) {
    if (value === null || value === undefined) continue;

    const nameKey = typeof value === "number" ? scalarIdNameKey(key) : null;
    if (nameKey !== null) {
      idLookups.push(resolveEntityName(leagueType, value as number).then(name => { result[nameKey] = name; }));
      continue;
    }

    const namesJoinedKey = Array.isArray(value) ? arrayIdNamesJoinedKey(key) : null;
    if (namesJoinedKey !== null && Array.isArray(value) && value.every((v): v is number => typeof v === "number")) {
      idLookups.push(
        Promise.all(value.map(id => resolveEntityName(leagueType, id))).then(names => { result[namesJoinedKey] = names.join(", "); }),
      );
      continue;
    }

    result[key] = value;
  }

  await Promise.all(idLookups);
  return result;
}

// ── broadcast_memory: phrase cooldown + CALLBACK bookkeeping ─────────────

const CALLBACK_MEMORY_KEY = "callback";

type SubjectMemory = {
  /** Phrase.id -> editions since that phrase was last used for this subject. */
  phraseEditionsSinceLastUse: Map<string, number>;
  /** Set when a prior PRESENTER_CALL claim exists for this subject. */
  callback: { claimTag: string; editionsAgo: number } | null;
};

async function loadSubjectMemory(subjectKey: string, currentEditionId: number): Promise<SubjectMemory> {
  const rows = await db
    .select()
    .from(broadcastMemoryTable)
    .where(and(eq(broadcastMemoryTable.subjectKey, subjectKey), inArray(broadcastMemoryTable.memoryType, ["PHRASE", "PRESENTER_CALL"])));

  const phraseEditionsSinceLastUse = new Map<string, number>();
  let callback: SubjectMemory["callback"] = null;

  for (const row of rows) {
    if (row.memoryType === "PHRASE") {
      const lastEditionId = row.lastEditionId ?? currentEditionId;
      phraseEditionsSinceLastUse.set(row.memoryKey, Math.max(0, currentEditionId - lastEditionId));
    } else if (row.memoryType === "PRESENTER_CALL" && row.memoryKey === CALLBACK_MEMORY_KEY) {
      const payload = row.payload as { claimTag?: string } | null;
      if (payload?.claimTag) {
        const lastEditionId = row.lastEditionId ?? currentEditionId;
        callback = { claimTag: payload.claimTag, editionsAgo: Math.max(0, currentEditionId - lastEditionId) };
      }
    }
  }

  return { phraseEditionsSinceLastUse, callback };
}

async function recordPhraseUsage(phraseId: string, subjectKey: string, editionId: number): Promise<void> {
  await db
    .insert(broadcastMemoryTable)
    .values({ memoryType: "PHRASE", memoryKey: phraseId, subjectKey, lastUsedAt: new Date(), lastEditionId: editionId, usageCount: 1, payload: null })
    .onConflictDoUpdate({
      target: [broadcastMemoryTable.memoryType, broadcastMemoryTable.memoryKey, broadcastMemoryTable.subjectKey],
      set: { lastUsedAt: new Date(), lastEditionId: editionId, usageCount: sql`${broadcastMemoryTable.usageCount} + 1` },
    });
}

// A short, human-readable label per story type for a future CALLBACK turn
// to reference ("we flagged {{priorClaimTag}} a few editions back") — only
// used for stories substantial enough to air a full (Featured/Major)
// segment, per renderConversation's own call site below.
const CALLBACK_CLAIM_TAG: Partial<Record<StoryType, string>> = {
  UPSET: "an upset result", MAJOR_UPSET: "a major upset", MODEL_SHOCK: "a real model shock",
  HIGH_STAKE_WIN: "a big points win", HIGH_STAKE_LOSS: "a costly points loss",
  ELIMINATION: "an elimination", LEADER_BEATEN: "the leader getting beaten",
  STREAK_BREAKER: "a win streak coming to an end", DROUGHT_ENDED: "ending a losing run",
  FIRST_H2H_WIN: "finally getting past a tricky opponent", REVENGE: "turning a rivalry around",
  WIN_STREAK: "a growing win streak", LOSS_STREAK: "a difficult losing run",
  FORM_REVERSAL: "a shift in form", QUIET_CLIMBER: "a quiet climb up the table",
  FREEFALL: "a slide down the table", ABOVE_BASELINE: "form well above their own average",
  H2H_DOMINANCE: "one-sided head-to-head history", RIVALRY: "an even rivalry", RIVALRY_SWING: "a rivalry swinging direction",
  CLINICAL_FINISHING: "clinical finishing on the doubles", DOUBLE_TROUBLE: "trouble on the doubles",
  SCORING_POWER: "big scoring power", SCORING_WITHOUT_FINISHING: "scoring without finishing",
  SEASON_BEST: "a season-best mark", PERSONAL_BEST: "a career-best mark",
  NEW_LEADER: "a change at the top", LEAD_TIGHTENS: "a tightening lead", LEAD_WIDENS: "a widening lead",
  TITLE_SWING: "a swing in the title model", NEW_FAVOURITE: "a new title favourite", DEAD_HEAT: "a dead heat at the top",
  TITLE_RACE: "a wide-open title race", CHAMPION: "being crowned champion", TIE_PENDING: "a tie at the top",
  SEASON_RECAP: "a look back at the season that just finished",
  CAREER_MATCH_MILESTONE: "a career-match milestone", CAREER_WIN_MILESTONE: "a career-win milestone",
  "180_MILESTONE": "a maximums milestone", ELIMINATION_MILESTONE: "an eliminations milestone",
  UNBEATEN_PAIR: "an unbeaten doubles run", PAIR_SURGE: "a doubles pair surging up the table",
  PAIR_UPSET: "a doubles upset", PAIR_ELIMINATED: "a doubles elimination",
  SHIFT_LEAD_CHANGE: "a Shift Wars lead change", SHIFT_MOMENTUM: "Shift Wars momentum swinging",
  SHIFT_COMEBACK: "a Shift Wars comeback", SHIFT_DOMINANCE: "Shift Wars dominance",
  LAST_MEETING: "their last meeting", SEASON_COMPARISON: "a season-on-season comparison", HISTORICAL_H2H: "their long head-to-head history",
};

async function recordPresenterCall(subjectKey: string, storyType: StoryType, editionId: number): Promise<void> {
  const claimTag = CALLBACK_CLAIM_TAG[storyType];
  if (!claimTag) return; // no sensible label for this type — skip rather than record something meaningless
  await db
    .insert(broadcastMemoryTable)
    .values({ memoryType: "PRESENTER_CALL", memoryKey: CALLBACK_MEMORY_KEY, subjectKey, lastUsedAt: new Date(), lastEditionId: editionId, usageCount: 1, payload: { claimTag } })
    .onConflictDoUpdate({
      target: [broadcastMemoryTable.memoryType, broadcastMemoryTable.memoryKey, broadcastMemoryTable.subjectKey],
      set: { lastUsedAt: new Date(), lastEditionId: editionId, usageCount: sql`${broadcastMemoryTable.usageCount} + 1`, payload: { claimTag } },
    });
}

// ── Phrase pool assembly for one turn ─────────────────────────────────────

function eligiblePhrasesForTurn(params: {
  pool: readonly Phrase[];
  turn: BlueprintTurn;
  availableFactKeys: ReadonlySet<string>;
  phraseEditionsSinceLastUse: ReadonlyMap<string, number>;
  banterContext: {
    negativeJokesAlreadyThisEditionForSubject: number;
    fullSegmentsSinceLastNegativeJokeForSubject: number | null;
    editionsSinceLastNegativeJokeForSubject: number | null;
  };
  /**
   * 16.1's broadcast_banter_level setting (0 quieter, 1 balanced/default, 2
   * livelier). Only level 0 changes anything mechanically in v1 — it
   * excludes humour-tone and negative-sentiment phrases from the eligible
   * pool entirely, on top of (not instead of) 12.7's own hard gates. Levels
   * 1 and 2 behave identically here: 12.7's hard gates (one negative joke
   * per subject per Edition, four-segment/one-Edition cooldown) already set
   * the real ceiling on how much banter can appear, and the doc names no
   * further mechanical difference for a "livelier" setting beyond that
   * ceiling — inventing a selection-bias knob nothing in the spec asks for
   * would be scope creep, not faithfulness to 16.1. A real "livelier" bias
   * (weighting selection toward humour/personality tone rather than merely
   * allowing it) is a reasonable future enhancement, not a v1 gap: nothing
   * about it is undoable later without new schema work, unlike this
   * project's genuinely documented scope boundaries (9.6 cross-family
   * merging, ELIMINATION_MILESTONE) — it just isn't specified.
   */
  banterLevel: number;
}): Phrase[] {
  const { pool, turn, availableFactKeys, phraseEditionsSinceLastUse, banterContext, banterLevel } = params;
  return pool.filter(phrase => {
    if (phrase.speaker !== turn.speaker || phrase.intent !== turn.intent) return false;
    if (banterLevel <= 0 && (phrase.tone === "humour" || phrase.sentiment === "negative")) return false;
    if (!phraseFactsSatisfied(phrase, availableFactKeys)) return false;
    if (!phraseTemplateSatisfiable(phrase, availableFactKeys)) return false;
    const editionsSinceLastUse = phraseEditionsSinceLastUse.get(phrase.id) ?? null;
    if (!isPhraseOffCooldown(phrase, editionsSinceLastUse)) return false;
    if (!isNegativeBanterAllowed({ candidateSentiment: phrase.sentiment, ...banterContext })) return false;
    return true;
  });
}

// ── renderConversation (Appendix C.3) ─────────────────────────────────────

export type DialogueTurn = { speaker: "A" | "B"; text: string; holdSeconds: number; phraseId: string; intent: string; sentiment: Phrase["sentiment"] };

export type BanterContext = {
  negativeJokesAlreadyThisEditionForSubject: number;
  fullSegmentsSinceLastNegativeJokeForSubject: number | null;
  editionsSinceLastNegativeJokeForSubject: number | null;
};

export type RenderConversationParams = {
  storyKey: string;
  storyType: StoryType;
  leagueType: LeagueType;
  facts: Record<string, unknown>;
  /** story.subjectKeys[0] by convention (story-engine-math.ts's subjectKey() always produces at least one) — the one subject phrase cooldown and CALLBACK bookkeeping is tracked against for this story. */
  primarySubjectKey: string;
  treatment: Treatment;
  slotKey: string;
  commentaryVersion: number;
  editionId: number;
  banterContext: BanterContext;
  /** 16.1's broadcast_banter_level setting — see eligiblePhrasesForTurn's own comment for exactly what this does. */
  banterLevel: number;
};

/**
 * Renders one story's full dialogue: resolves real names, picks a
 * treatment-appropriate blueprint whose every required turn has at least
 * one real eligible phrase, then fills every turn — recording phrase usage
 * (and, for Featured/Major stories, a CALLBACK claim) into broadcast_memory
 * as it goes, exactly matching Appendix C.3's own renderConversation
 * pseudocode ("record phrase usage" after every turn). Returns `[]` if no
 * blueprint the treatment allows can be fully satisfied — e.g. Supporting
 * treatment's own QUICK_HIT is the only blueprint every catalogued story
 * type actually has (enforced by commentary-library.ts's own validation
 * test), so this should only ever happen for Featured/Major when the
 * story's specific facts are unusually sparse; the caller (edition-engine.ts,
 * not yet written) is responsible for falling back to a lower treatment or
 * dropping the story from this Edition's running order when that happens,
 * mirroring 11.6's own stale-segment-invalidation philosophy — this file's
 * job ends at reporting "can't be told" rather than guessing.
 */
export async function renderConversation(params: RenderConversationParams): Promise<DialogueTurn[]> {
  const { storyType, leagueType, facts, primarySubjectKey, treatment, slotKey, storyKey, commentaryVersion, editionId, banterContext, banterLevel } = params;

  const [templateFacts, memory] = await Promise.all([
    buildTemplateFacts(leagueType, facts),
    loadSubjectMemory(primarySubjectKey, editionId),
  ]);

  const callbackFacts: TemplateFacts = memory.callback
    ? { priorClaimTag: memory.callback.claimTag, priorClaimEditionsAgo: memory.callback.editionsAgo }
    : {};
  const availableFacts: TemplateFacts = { ...templateFacts, ...callbackFacts };
  const availableFactKeys = new Set(Object.keys(availableFacts));

  const typePool = phrasesForStoryType(storyType);
  const fullPool: Phrase[] = [...typePool, ...UNIVERSAL_CALLBACK_PHRASES, ...UNIVERSAL_BANTER_PHRASES];

  const rng = commentaryRng(slotKey, storyKey, commentaryVersion);

  // A headline tease (9.3's own separate treatment tier) previews a story
  // that's ALSO getting — or, per director.ts's own build-order, just got —
  // its own full segment THIS SAME EDITION. Reusing that segment's phrase
  // for the tease isn't the stale repetition 12.3's cross-Edition cooldown
  // exists to prevent (that's about a joke resurfacing weeks later, feeling
  // recycled); it's the ordinary case of a "coming up" mention mirroring the
  // content it's mentioning. Most story types carry exactly one phrase per
  // QUICK_HIT intent (commentary-library.ts), so without this bypass the
  // tease and its own full segment would always collide over that single
  // phrase, and whichever rendered second would come back empty — emptying
  // the headline reel specifically because the story it's teasing was
  // successful enough to also earn a full segment. Bypassing cooldown only
  // for this render (an empty lookup map — isPhraseOffCooldown treats an
  // absent entry as never-used) leaves the real cross-Edition guarantee
  // fully intact for every other treatment reading the same memory rows.
  const phraseEditionsSinceLastUse = treatment === "headline_ticker" ? new Map<string, number>() : memory.phraseEditionsSinceLastUse;

  const viableBlueprints: BlueprintName[] = [];
  const turnsByBlueprint = new Map<BlueprintName, BlueprintTurn[]>();
  for (const name of blueprintNamesForTreatment(treatment)) {
    const turns = resolveTurnsForTreatment(treatment, BLUEPRINTS[name]);
    const requiredTurns = turns.filter(t => !t.optional);
    const satisfiable = requiredTurns.every(
      turn => eligiblePhrasesForTurn({ pool: fullPool, turn, availableFactKeys, phraseEditionsSinceLastUse, banterContext, banterLevel }).length > 0,
    );
    if (satisfiable) {
      viableBlueprints.push(name);
      turnsByBlueprint.set(name, turns);
    }
  }

  if (viableBlueprints.length === 0) return [];

  const chosenName = chooseBlueprint(viableBlueprints, rng);
  const turns = turnsByBlueprint.get(chosenName)!;

  const dialogue: DialogueTurn[] = [];
  for (const turn of turns) {
    const candidates = eligiblePhrasesForTurn({ pool: fullPool, turn, availableFactKeys, phraseEditionsSinceLastUse, banterContext, banterLevel });
    if (candidates.length === 0) {
      if (turn.optional) continue;
      // Pre-checked above for every required turn of the chosen blueprint —
      // reachable only if two required turns share a phrase pool that a
      // single already-used phrase can't cover twice; skip rather than
      // break the whole segment over one thin turn.
      continue;
    }
    const phrase = pickFrom(candidates, rng);
    const text = interpolateTemplate(phrase.template, availableFacts);
    dialogue.push({ speaker: phrase.speaker, text, holdSeconds: dialogueHoldSeconds(text), phraseId: phrase.id, intent: phrase.intent, sentiment: phrase.sentiment });
    await recordPhraseUsage(phrase.id, primarySubjectKey, editionId);
  }

  if ((treatment === "featured" || treatment === "major") && dialogue.length > 0) {
    await recordPresenterCall(primarySubjectKey, storyType, editionId);
  }

  return dialogue;
}
