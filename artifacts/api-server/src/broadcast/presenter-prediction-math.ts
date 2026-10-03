// TKDL LIVE — Presenter Predictions: Chalky and Ton make a genuine call on
// air about a player currently on a win streak ("we reckon this one keeps
// going"), and a later Edition follows up on whether that specific call
// actually held up, using the player's own real, live win-streak number —
// never a fabricated outcome.
//
// Deliberately scoped to WIN_STREAK continuation only, never a specific
// upcoming match result: edition-engine.ts's own header (see
// FUTURE_MATCH_LANGUAGE_PATTERN / hasFutureMatchLanguage) already documents
// that TKDL has no fixture/scheduling system at all — matches are recorded
// after the fact, never scheduled ahead of time — so "will beat so-and-so
// next time out" is never a claim this feature (or anything else in this
// codebase) is allowed to make. "Keeps the run going" is checkable purely
// from the player's own live state and never assumes a specific future
// fixture exists.
//
// Both the call and the follow-up are presenter narration ABOUT a real
// player's real, already-public number (their own win-streak column) —
// never a word put in that player's own mouth, same convention as every
// other utility beat in this folder (cold-open-math.ts, guest-cameo-math.ts,
// running-jokes-math.ts).

export type PredictionLinePair = { a: string; b: string };

/** Variants for making the call, read right after the player's own WIN_STREAK
 * segment airs. {{playerName}} and {{currentWinStreak}} both come straight
 * off that same story's own facts via buildTemplateFacts, exactly like
 * cold-open-math.ts/guest-cameo-math.ts reuse the real story's facts. */
export const PREDICTION_MAKE_TEMPLATES: readonly PredictionLinePair[] = [
  {
    a: "Before we move on, we're making a call: {{playerName}}'s run of {{currentWinStreak}} keeps rolling next time out.",
    b: "Bold shout. We'll see if that one stands up.",
  },
  {
    a: "Here's a prediction for you — {{currentWinStreak}} in a row for {{playerName}}, and we don't see it stopping yet.",
    b: "Noted. We're both on record with that one now.",
  },
];

/** Variants for the follow-up when the earlier call held up — the streak
 * kept growing past {{streakAtPrediction}}, its value at the time of the
 * original call. */
export const PREDICTION_CORRECT_TEMPLATES: readonly PredictionLinePair[] = [
  {
    a: "Quick follow-up on a call we made — {{playerName}}'s streak was sitting at {{streakAtPrediction}} last time, and it's still growing. Good shout.",
    b: "I'll take that one. Not every call lands, but that one did.",
  },
  {
    a: "We said {{playerName}}'s run wouldn't stop there, and it hasn't.",
    b: "Credit where it's due — that prediction held up.",
  },
];

/** Variants for the follow-up when the earlier call didn't hold up — the
 * streak has since reset. Framed entirely as the presenters marking their
 * own record, never as anything about the player's result itself (that
 * result gets its own real, separate coverage elsewhere in the running
 * order, per this file's own header). */
export const PREDICTION_INCORRECT_TEMPLATES: readonly PredictionLinePair[] = [
  {
    a: "Follow-up on a call we made a while back — we backed {{playerName}}'s run to keep going. It didn't.",
    b: "Can't win them all. That one's on us.",
  },
  {
    a: "In the interest of honesty — the prediction we made on {{playerName}}'s streak didn't come off.",
    b: "Every pundit gets one wrong eventually. Today's the day.",
  },
];

/**
 * Pure grading rule, comparing the player's live win-streak now against its
 * value at the moment the call was made:
 * - still growing past that value  -> "correct"
 * - dropped below it (reset, however far it's since rebuilt) -> "incorrect"
 * - unchanged -> "pending" (this player simply hasn't had a new result yet
 *   since the call was made — try again at a later Edition rather than
 *   grading prematurely).
 */
export function gradeWinStreakPrediction(streakAtPrediction: number, currentWinStreak: number): "correct" | "incorrect" | "pending" {
  if (currentWinStreak > streakAtPrediction) return "correct";
  if (currentWinStreak < streakAtPrediction) return "incorrect";
  return "pending";
}

/** A pending call this stale is dropped silently rather than graded — a
 * follow-up on a prediction from many Editions ago would read as confused
 * continuity rather than a timely callback. Chosen to comfortably outlast
 * the gap between even a quiet week's Editions without ever accumulating an
 * unbounded backlog of ancient, unresolved calls. */
export const MAX_EDITIONS_BEFORE_PREDICTION_EXPIRES = 6;

/** Minimum win streak before a call is worth making at all — matches
 * WIN_STREAK's own detector threshold in spirit (a short streak is too
 * routine to stake a prediction on), kept here as this feature's own
 * explicit gate rather than silently inheriting whatever threshold the
 * detector happens to use today. */
export const MIN_WIN_STREAK_FOR_PREDICTION = 3;
