// TKDL LIVE — Commentary Engine: the phrase library (handover doc section
// 12 + Appendix A's Story Catalogue). Pure data — zero `@workspace/db`
// imports, same reasoning as every other `*-math.ts` file in this folder —
// but importing ONLY the `Phrase`/`PhraseTone` type from commentary-math.ts
// (type-only, erased at runtime) so this file stays directly testable.
//
// 12.1 gives the two presenters' language behaviour, transcribed here as
// the actual voice each phrase below is written in:
//   Presenter A ("Alex"), host/analyst — facts first, measured, contextual,
//   probability-aware, challenges unsupported narratives.
//   Presenter B ("Ton"), pundit/personality — faster reactions, bolder
//   opinions, light banter, underdog sympathy, still constrained to
//   supplied facts.
// (Names/artwork are configuration per 12.1's own closing line — this file
// only needs the two roles, not the eventual visual identity, which is
// explicitly paused pending the user's own design pass on the presenters.)
//
// ── How this library is organised ───────────────────────────────────────
// 12.3's own `Phrase` type (transcribed verbatim in commentary-math.ts) has
// no `storyType` field, and that is not an oversight to patch here: several
// Appendix A story types share raw fact keys (e.g. QUIET_CLIMBER and
// FREEFALL both carry playerId/positionBefore/currentPosition/matches), so
// a phrase's `requires` alone can't always safely disambiguate which type
// it belongs to — a QUIET_CLIMBER phrase whose `requires` only lists those
// shared keys could, if pooled flat, wrongly become "satisfiable" for a
// FREEFALL story too, putting positive climbing language on a sliding
// player. Rather than pool every phrase into one flat array and lean on
// fact-shape overlap to sort it out, this file keys the library explicitly
// by exact `story_type` (the schema's own `broadcast_stories.story_type`
// string) via `COMMENTARY_LIBRARY`, and commentary-engine.ts is expected to
// look phrases up that way — `phrasesForStoryType()` below is the one
// intended entry point. Within one story type's own phrase list, `requires`
// still does real work: it's what lets phraseFactsSatisfied/
// phraseTemplateSatisfiable (commentary-math.ts) filter out a phrase whose
// specific fact (e.g. a milestone's `career180s`, which is nullable) isn't
// actually present for a particular instance of that type.
//
// ── The name/percentage-resolution contract this library assumes ────────
// Every template below freely interpolates derived display keys — e.g.
// {{winnerName}} alongside a raw {{winnerId}}-shaped fact, or
// {{winnerProbabilityPct}} alongside {{winnerProbability}} — using exactly
// the convention commentary-math.ts's scalarIdNameKey/
// arrayIdNamesJoinedKey/probabilityPctKey helpers define. `requires` below
// lists the RAW fact key (what the story's own `facts` jsonb genuinely
// contains, and therefore the real substantive dependency a phrase has),
// never the derived key — commentary-engine.ts (DB-facing, not yet
// written) is responsible for resolving every id/array/probability key
// present on a story into its derived counterpart(s) and folding ALL of
// them (raw + derived) into the single `availableFactKeys` set/
// `TemplateFacts` object it passes into commentary-math.ts's eligibility
// and interpolation functions. A phrase is therefore only ever wired to a
// fact that a real detector actually produced — the fact firewall (17.1)
// holds structurally, not just by author discipline.
//
// ── Record-claim compliance (17.2) ───────────────────────────────────────
// Only SEASON_BEST and PERSONAL_BEST templates below use "best"/"record"-
// type language, and only because story-detectors-performance.ts's own
// detectors now expose `verifiedRecordClaim: true` on those two story
// types' facts (added alongside this file, for exactly this reason — see
// that file's own comment) — those phrases declare
// `requires: [..., "verifiedRecordClaim"]`. Every other story type in this
// catalogue that could tempt record-claim language (FIRST_H2H_WIN's "first
// win", MILESTONE's cumulative counters) is deliberately phrased with
// softer, non-triggering wording instead ("ends a run of N losses" rather
// than "first win"; "career win number N" rather than "record"), per
// 17.2's own escape hatch ("If verification is unavailable, use softer
// factual wording") — these are ordinary counters, not superlative claims,
// so inventing a verifiedRecordClaim fact for them would be dishonest
// (nothing about them was specially historically verified). This is
// mechanically checked, not just asserted here — see
// __tests__/commentary-library.test.ts's library-validation scan.
//
// ── Scope: a real, modest v1 set, not "hundreds of scripts" ──────────────
// 12.5 explicitly says not to write thousands of complete scripts, but to
// build reusable tagged fragments across a handful of blueprints. Every one
// of Appendix A's 50 v1 story types gets: a QUICK_HIT pair (quick_fact/
// quick_reaction — the ONLY blueprint Supporting treatment ever uses, so
// every type needs at least this to be tellable at all) plus one further,
// narratively-fitting blueprint's phrases (chosen per type below, and
// reused automatically for Major treatment too, since resolveTurnsForTreat
// -ment() in commentary-math.ts appends a QUICK_HIT coda onto whichever of
// ANALYST_LEADS/AGREEMENT/DISAGREEMENT a Major story's blueprint choice
// lands on). PUNDIT_LEADS and CALLBACK are each covered by a smaller,
// deliberately reusable set rather than being duplicated per type — see
// their own sections below.
import type { Phrase, PhraseTone } from "./commentary-math.ts";
import type { StoryType } from "./story-types.ts";

type Sentiment = Phrase["sentiment"];

/** Small builder so every phrase below reads as one line of real content, not a 10-line object literal. `id` is a caller-supplied, story-type-namespaced string (e.g. "UPSET.qf.1"), not auto-generated, so IDs stay stable across edits to this file (stable IDs matter for broadcast_memory's own per-phrase cooldown bookkeeping, keyed on Phrase.id). */
function ph(
  id: string,
  speaker: "A" | "B",
  intent: string,
  template: string,
  sentiment: Sentiment,
  opts?: { requires?: string[]; forbids?: string[]; cooldownEditions?: number; distinctive?: boolean; tone?: PhraseTone },
): Phrase {
  return {
    id,
    speaker,
    intent,
    template,
    sentiment,
    cooldownEditions: opts?.cooldownEditions ?? 2,
    ...(opts?.requires ? { requires: opts.requires } : {}),
    ...(opts?.forbids ? { forbids: opts.forbids } : {}),
    ...(opts?.distinctive !== undefined ? { distinctive: opts.distinctive } : {}),
    ...(opts?.tone ? { tone: opts.tone } : {}),
  };
}

// ════════════════════════════════════════════════════════════════════════
// RESULT family (11 types) — match-anchored. UPSET/MAJOR_UPSET/MODEL_SHOCK
// share one fact shape (matchId, winnerId, loserId, winnerProbability,
// stake) and only differ by how low winnerProbability is, so their
// commentary differs only in how strongly Alex/Ton react to the number —
// handled here as three separate phrase sets keyed to the same facts, not
// three copies of one template, since the actual WORDING should escalate.
// ════════════════════════════════════════════════════════════════════════

const UPSET_REQUIRES = ["winnerId", "loserId", "winnerProbability"];

const UPSET_PHRASES: Phrase[] = [
  ph("UPSET.qf.1", "A", "quick_fact", "{{winnerName}} beats {{loserName}} — the model had {{winnerName}} at just {{winnerProbabilityPct}}% coming in.", "positive", { requires: UPSET_REQUIRES }),
  ph("UPSET.qr.1", "B", "quick_reaction", "Didn't see that coming — {{loserName}} will want to forget that one.", "neutral", { requires: UPSET_REQUIRES, tone: "humour" }),
  ph("UPSET.model.1", "A", "model_context", "Going in, our model gave {{winnerName}} a {{winnerProbabilityPct}}% chance against {{loserName}}.", "neutral", { requires: UPSET_REQUIRES }),
  ph("UPSET.contrary.1", "B", "contrary_opinion", "Numbers or no numbers, {{winnerName}} always fancied this one — I said as much last time out.", "positive", { requires: UPSET_REQUIRES }),
  ph("UPSET.evidence.1", "A", "evidence", "Fair, but a {{winnerProbabilityPct}}% shot landing is exactly why we call it an upset, {{stake}} points on the line as well.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("UPSET.close.1", "B", "disagree_close", "Model can recalculate — {{winnerName}} just made it look easy.", "positive", { requires: UPSET_REQUIRES }),
];

const MAJOR_UPSET_PHRASES: Phrase[] = [
  ph("MAJOR_UPSET.qf.1", "A", "quick_fact", "A major upset — {{winnerName}} was rated only {{winnerProbabilityPct}}% to beat {{loserName}}, and did it anyway.", "positive", { requires: UPSET_REQUIRES }),
  ph("MAJOR_UPSET.qr.1", "B", "quick_reaction", "That's a proper shock, that. {{loserName}} won't enjoy watching that back.", "neutral", { requires: UPSET_REQUIRES, tone: "humour" }),
  ph("MAJOR_UPSET.model.1", "A", "model_context", "The model had {{loserName}} winning this comfortably — {{winnerName}} at just {{winnerProbabilityPct}}%.", "neutral", { requires: UPSET_REQUIRES }),
  ph("MAJOR_UPSET.contrary.1", "B", "contrary_opinion", "The model doesn't watch {{winnerName}} throw under pressure — I do, and I'm not remotely stunned.", "positive", { requires: UPSET_REQUIRES }),
  ph("MAJOR_UPSET.evidence.1", "A", "evidence", "Under 25% and it landed regardless — with {{stake}} points at stake too, that's a genuinely big result.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("MAJOR_UPSET.close.1", "B", "disagree_close", "Stick that one on the highlights reel.", "positive", { requires: UPSET_REQUIRES, tone: "personality" }),
];

const MODEL_SHOCK_PHRASES: Phrase[] = [
  ph("MODEL_SHOCK.qf.1", "A", "quick_fact", "That is a genuine model shock — {{winnerName}} was given only {{winnerProbabilityPct}}% against {{loserName}}.", "positive", { requires: UPSET_REQUIRES }),
  ph("MODEL_SHOCK.qr.1", "B", "quick_reaction", "Even I didn't have {{winnerName}} winning that one, and I back the underdog most weeks.", "neutral", { requires: UPSET_REQUIRES, tone: "humour" }),
  ph("MODEL_SHOCK.model.1", "A", "model_context", "Sub-15% for {{winnerName}} pre-match — about as heavy an underdog tag as the model hands out.", "neutral", { requires: UPSET_REQUIRES }),
  ph("MODEL_SHOCK.contrary.1", "B", "contrary_opinion", "This is exactly why you don't play the percentages against a player who fancies the big occasion.", "positive", { requires: UPSET_REQUIRES }),
  ph("MODEL_SHOCK.evidence.1", "A", "evidence", "Fifteen percent, beaten — with {{stake}} points changing hands, the model will be recalculating tonight.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("MODEL_SHOCK.close.1", "B", "disagree_close", "Sometimes the board doesn't care what the model says.", "positive", { requires: UPSET_REQUIRES, tone: "personality", distinctive: true }),
];

const HIGH_STAKE_WIN_REQUIRES = ["winnerId", "loserId", "stake"];
const HIGH_STAKE_WIN_PHRASES: Phrase[] = [
  ph("HIGH_STAKE_WIN.qf.1", "A", "quick_fact", "{{winnerName}} takes {{stake}} points off {{loserName}} — one of the bigger hauls of the night.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
  ph("HIGH_STAKE_WIN.qr.1", "B", "quick_reaction", "That's a proper points swing for {{winnerName}}.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
  ph("HIGH_STAKE_WIN.fact.1", "A", "fact", "{{winnerName}} beats {{loserName}} for {{stake}} points, comfortably above the usual stake on a night like this.", "positive", { requires: [...HIGH_STAKE_WIN_REQUIRES, "highStakeThreshold"] }),
  ph("HIGH_STAKE_WIN.reaction.1", "B", "reaction", "You take those points whenever they're on the table.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
  ph("HIGH_STAKE_WIN.context.1", "A", "context", "That result alone could shift things further up the table.", "neutral", { requires: HIGH_STAKE_WIN_REQUIRES }),
  ph("HIGH_STAKE_WIN.closer.1", "B", "closer", "{{loserName}} will feel that one for a while.", "neutral", { requires: HIGH_STAKE_WIN_REQUIRES }),
];

const HIGH_STAKE_LOSS_REQUIRES = ["winnerId", "loserId", "stake"];
const HIGH_STAKE_LOSS_PHRASES: Phrase[] = [
  ph("HIGH_STAKE_LOSS.qf.1", "A", "quick_fact", "{{loserName}} drops {{stake}} points to {{winnerName}} — a costly night for a contender.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
  ph("HIGH_STAKE_LOSS.qr.1", "B", "quick_reaction", "That's the kind of loss that lingers in a title race.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
  ph("HIGH_STAKE_LOSS.fact.1", "A", "fact", "{{stake}} points is well above the usual stake — {{loserName}} will feel that loss in the table.", "negative", { requires: [...HIGH_STAKE_LOSS_REQUIRES, "highStakeThreshold"] }),
  ph("HIGH_STAKE_LOSS.reaction.1", "B", "reaction", "Credit to {{winnerName}} for taking full advantage of the occasion.", "positive", { requires: HIGH_STAKE_LOSS_REQUIRES }),
  ph("HIGH_STAKE_LOSS.context.1", "A", "context", "That's the sort of result that can reshape a run-in.", "neutral", { requires: HIGH_STAKE_LOSS_REQUIRES }),
  ph("HIGH_STAKE_LOSS.closer.1", "B", "closer", "Onwards for {{loserName}} — plenty of season left.", "neutral", { requires: HIGH_STAKE_LOSS_REQUIRES }),
];

const ELIMINATION_REQUIRES = ["winnerId", "loserId"];
const ELIMINATION_PHRASES: Phrase[] = [
  ph("ELIMINATION.qf.1", "A", "quick_fact", "That's it for {{loserName}} — eliminated after this loss to {{winnerName}}.", "negative", { requires: ELIMINATION_REQUIRES }),
  ph("ELIMINATION.qr.1", "B", "quick_reaction", "Tough way to go out, that.", "negative", { requires: ELIMINATION_REQUIRES }),
  ph("ELIMINATION.fact.1", "A", "fact", "{{loserName}}'s run comes to an end, beaten by {{winnerName}} for {{stake}} points.", "negative", { requires: [...ELIMINATION_REQUIRES, "stake"] }),
  ph("ELIMINATION.reaction.1", "B", "reaction", "Every campaign ends somewhere — at least {{loserName}} goes down fighting.", "neutral", { requires: ELIMINATION_REQUIRES }),
  ph("ELIMINATION.context.1", "A", "context", "That result also has knock-on effects further up the standings.", "neutral", { requires: ELIMINATION_REQUIRES }),
  ph("ELIMINATION.closer.1", "B", "closer", "Chin up, {{loserName}} — there's always next season.", "neutral", { requires: ELIMINATION_REQUIRES }),
];

const LEADER_BEATEN_REQUIRES = ["winnerId", "loserId", "leaderPointsBefore"];
const LEADER_BEATEN_PHRASES: Phrase[] = [
  ph("LEADER_BEATEN.qf.1", "A", "quick_fact", "The points leader falls — {{winnerName}} beats {{loserName}}, who came in on {{leaderPointsBefore}} points.", "positive", { requires: LEADER_BEATEN_REQUIRES }),
  ph("LEADER_BEATEN.qr.1", "B", "quick_reaction", "Nobody's untouchable at the top, are they.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
  ph("LEADER_BEATEN.fact.1", "A", "fact", "{{loserName}} led the way on {{leaderPointsBefore}} points coming in, but {{winnerName}} has beaten them regardless.", "positive", { requires: LEADER_BEATEN_REQUIRES }),
  ph("LEADER_BEATEN.reaction.1", "B", "reaction", "Every leader gets tested eventually — that's the one for {{loserName}}.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
  ph("LEADER_BEATEN.context.1", "A", "context", "That result puts the whole top of the table back in play.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
  ph("LEADER_BEATEN.closer.1", "B", "closer", "Suddenly it's a race again.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
];

const STREAK_BREAKER_REQUIRES = ["winnerId", "loserId", "brokenWinStreak"];
const STREAK_BREAKER_PHRASES: Phrase[] = [
  ph("STREAK_BREAKER.qf.1", "A", "quick_fact", "{{winnerName}} ends {{loserName}}'s run of {{brokenWinStreak}} straight wins.", "positive", { requires: STREAK_BREAKER_REQUIRES }),
  ph("STREAK_BREAKER.qr.1", "B", "quick_reaction", "Every streak ends somewhere — credit to {{winnerName}} for being the one to do it.", "positive", { requires: STREAK_BREAKER_REQUIRES }),
  ph("STREAK_BREAKER.fact.1", "A", "fact", "That's {{brokenWinStreak}} consecutive wins for {{loserName}} brought to a close by {{winnerName}}.", "positive", { requires: STREAK_BREAKER_REQUIRES }),
  ph("STREAK_BREAKER.reaction.1", "B", "reaction", "Takes some nerve to be the one who steps in and stops that.", "positive", { requires: STREAK_BREAKER_REQUIRES }),
  ph("STREAK_BREAKER.context.1", "A", "context", "A run like that was always going to end eventually — question now is how {{loserName}} responds.", "neutral", { requires: STREAK_BREAKER_REQUIRES }),
  ph("STREAK_BREAKER.closer.1", "B", "closer", "Good while it lasted, {{loserName}}.", "neutral", { requires: STREAK_BREAKER_REQUIRES }),
];

const DROUGHT_ENDED_REQUIRES = ["winnerId", "loserId", "endedLossStreak"];
const DROUGHT_ENDED_PHRASES: Phrase[] = [
  ph("DROUGHT_ENDED.qf.1", "A", "quick_fact", "{{winnerName}} finally back in the win column, ending a run of {{endedLossStreak}} straight losses.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
  ph("DROUGHT_ENDED.qr.1", "B", "quick_reaction", "About time — you could see that one coming for a couple of weeks.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
  ph("DROUGHT_ENDED.perf.1", "A", "performance_fact", "{{endedLossStreak}} losses on the spin, snapped tonight against {{loserName}}.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
  ph("DROUGHT_ENDED.credit.1", "B", "credit", "Credit where it's due — that's not an easy run to break out of.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
  ph("DROUGHT_ENDED.consequence.1", "A", "consequence", "A result like that can turn a season back around.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
];

const FIRST_H2H_WIN_REQUIRES = ["winnerId", "loserId", "priorLossesToThisOpponent"];
const FIRST_H2H_WIN_PHRASES: Phrase[] = [
  ph("FIRST_H2H_WIN.qf.1", "A", "quick_fact", "{{winnerName}} finally gets past {{loserName}}, ending a run of {{priorLossesToThisOpponent}} straight losses in this head-to-head.", "positive", { requires: FIRST_H2H_WIN_REQUIRES }),
  ph("FIRST_H2H_WIN.qr.1", "B", "quick_reaction", "That head-to-head has been one-way traffic — good to see {{winnerName}} finally get over the line.", "positive", { requires: FIRST_H2H_WIN_REQUIRES }),
  ph("FIRST_H2H_WIN.fact.1", "A", "fact", "{{winnerName}} had lost {{priorLossesToThisOpponent}} in a row to {{loserName}} before tonight.", "positive", { requires: FIRST_H2H_WIN_REQUIRES }),
  ph("FIRST_H2H_WIN.reaction.1", "B", "reaction", "That's a real monkey off the back for {{winnerName}}.", "positive", { requires: FIRST_H2H_WIN_REQUIRES, tone: "humour" }),
  ph("FIRST_H2H_WIN.context.1", "A", "context", "Whether that changes the pattern of this rivalry is one to watch.", "neutral", { requires: FIRST_H2H_WIN_REQUIRES }),
  ph("FIRST_H2H_WIN.closer.1", "B", "closer", "{{loserName}} won't want a rematch any time soon.", "neutral", { requires: FIRST_H2H_WIN_REQUIRES }),
];

const REVENGE_REQUIRES = ["winnerId", "loserId", "consecutivePriorLosses"];
const REVENGE_PHRASES: Phrase[] = [
  ph("REVENGE.qf.1", "A", "quick_fact", "{{winnerName}} turns the tables on {{loserName}}, reversing their last meeting.", "positive", { requires: REVENGE_REQUIRES }),
  ph("REVENGE.qr.1", "B", "quick_reaction", "Sweet result for {{winnerName}}, that.", "positive", { requires: REVENGE_REQUIRES }),
  ph("REVENGE.fact.1", "A", "fact", "{{winnerName}} had lost {{consecutivePriorLosses}} straight to {{loserName}} before turning it around tonight.", "positive", { requires: REVENGE_REQUIRES }),
  ph("REVENGE.reaction.1", "B", "reaction", "You wait for that one, don't you.", "positive", { requires: REVENGE_REQUIRES }),
  ph("REVENGE.context.1", "A", "context", "A meaningful reversal given how one-sided this fixture has been.", "neutral", { requires: REVENGE_REQUIRES }),
  ph("REVENGE.closer.1", "B", "closer", "{{loserName}} will want that one back.", "neutral", { requires: REVENGE_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// FORM family (6 types) — subject-anchored, Singles-only.
// ════════════════════════════════════════════════════════════════════════

const WIN_STREAK_REQUIRES = ["playerId", "currentWinStreak"];
const WIN_STREAK_PHRASES: Phrase[] = [
  ph("WIN_STREAK.qf.1", "A", "quick_fact", "{{playerName}} makes it {{currentWinStreak}} wins in a row.", "positive", { requires: WIN_STREAK_REQUIRES }),
  ph("WIN_STREAK.qr.1", "B", "quick_reaction", "{{playerName}} is flying right now.", "positive", { requires: WIN_STREAK_REQUIRES }),
  ph("WIN_STREAK.perf.1", "A", "performance_fact", "That's {{currentWinStreak}} consecutive wins for {{playerName}}.", "positive", { requires: WIN_STREAK_REQUIRES }),
  ph("WIN_STREAK.credit.1", "B", "credit", "Nobody wants to be drawn against {{playerName}} while that run's going.", "positive", { requires: WIN_STREAK_REQUIRES }),
  ph("WIN_STREAK.consequence.1", "A", "consequence", "Keep that up and {{playerName}} climbs the table fast.", "positive", { requires: WIN_STREAK_REQUIRES }),
];

const LOSS_STREAK_REQUIRES = ["playerId", "currentLossStreak"];
const LOSS_STREAK_PHRASES: Phrase[] = [
  ph("LOSS_STREAK.qf.1", "A", "quick_fact", "{{playerName}} has now lost {{currentLossStreak}} in a row.", "negative", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.qr.1", "B", "quick_reaction", "Rough spell for {{playerName}} at the minute.", "negative", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.fact.1", "A", "fact", "That's {{currentLossStreak}} straight defeats now for {{playerName}}.", "negative", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.reaction.1", "B", "reaction", "Everyone hits a wall like this at some point in a season.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.context.1", "A", "context", "The underlying numbers will tell us whether that's a blip or something more concerning.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.closer.1", "B", "closer", "One win turns that around completely.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
];

const FORM_REVERSAL_REQUIRES = ["playerId", "direction", "recentFiveWins", "priorFiveWins"];
const FORM_REVERSAL_PHRASES: Phrase[] = [
  ph("FORM_REVERSAL.qf.1", "A", "quick_fact", "{{playerName}}'s form has shifted — {{recentFiveWins}} wins from the last five, against {{priorFiveWins}} in the five before that.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.qr.1", "B", "quick_reaction", "That's a proper swing in form, that.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.fact.1", "A", "fact", "Five matches ago {{playerName}} had {{priorFiveWins}} wins in a five-match window — now it's {{recentFiveWins}}.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.reaction.1", "B", "reaction", "Form's a funny thing in this game — can flip in a fortnight.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.context.1", "A", "context", "Worth watching whether that trend holds over the next few matches.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.closer.1", "B", "closer", "Either way, {{playerName}}'s worth keeping an eye on.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
];

const QUIET_CLIMBER_REQUIRES = ["playerId", "positionBefore", "currentPosition", "matches"];
const QUIET_CLIMBER_PHRASES: Phrase[] = [
  ph("QUIET_CLIMBER.qf.1", "A", "quick_fact", "{{playerName}} has quietly climbed from {{positionBefore}} to {{currentPosition}} over the last {{matches}} matches.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
  ph("QUIET_CLIMBER.qr.1", "B", "quick_reaction", "Nobody's really talking about {{playerName}}, but look at that table move.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
  ph("QUIET_CLIMBER.perf.1", "A", "performance_fact", "From {{positionBefore}} up to {{currentPosition}} without one single major shock along the way.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
  ph("QUIET_CLIMBER.credit.1", "B", "credit", "That's the sign of someone quietly putting a season together.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
  ph("QUIET_CLIMBER.consequence.1", "A", "consequence", "Keep that steady rise going and {{playerName}} becomes a real factor.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
];

const FREEFALL_REQUIRES = ["playerId", "positionBefore", "currentPosition", "matches", "currentLossStreak"];
const FREEFALL_PHRASES: Phrase[] = [
  ph("FREEFALL.qf.1", "A", "quick_fact", "{{playerName}} has slipped from {{positionBefore}} to {{currentPosition}} over the last {{matches}} matches.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.qr.1", "B", "quick_reaction", "That's a table position sliding the wrong way.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.fact.1", "A", "fact", "{{currentLossStreak}} losses in that spell have pulled {{playerName}} down to {{currentPosition}}.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.reaction.1", "B", "reaction", "Every player goes through a spell like this — it's what comes next that matters.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.context.1", "A", "context", "Plenty of matches left to arrest that slide.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.closer.1", "B", "closer", "Backing {{playerName}} to steady the ship soon enough.", "neutral", { requires: FREEFALL_REQUIRES }),
];

const ABOVE_BASELINE_REQUIRES = ["playerId", "recentRate", "seasonRate"];
const ABOVE_BASELINE_PHRASES: Phrase[] = [
  ph("ABOVE_BASELINE.qf.1", "A", "quick_fact", "{{playerName}} is performing well above their own season average right now.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
  ph("ABOVE_BASELINE.qr.1", "B", "quick_reaction", "{{playerName}}'s a different player at the minute.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
  ph("ABOVE_BASELINE.perf.1", "A", "performance_fact", "Recent form is running well clear of {{playerName}}'s own season baseline.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
  ph("ABOVE_BASELINE.credit.1", "B", "credit", "Whatever's changed, it's clearly working.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
  ph("ABOVE_BASELINE.consequence.1", "A", "consequence", "Sustain that and {{playerName}}'s numbers for the season improve significantly.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// H2H family (3 types) — Singles-only.
// ════════════════════════════════════════════════════════════════════════

const H2H_DOMINANCE_REQUIRES = ["dominantPlayerId", "dominatedPlayerId", "wins", "gamesPlayed"];
const H2H_DOMINANCE_PHRASES: Phrase[] = [
  ph("H2H_DOMINANCE.qf.1", "A", "quick_fact", "{{dominantPlayerName}} has won {{wins}} of their {{gamesPlayed}} meetings with {{dominatedPlayerName}}.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
  ph("H2H_DOMINANCE.qr.1", "B", "quick_reaction", "That's a proper hoodoo {{dominantPlayerName}}'s got over {{dominatedPlayerName}}.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
  ph("H2H_DOMINANCE.fact.1", "A", "fact", "{{wins}} wins from {{gamesPlayed}} — a clear head-to-head edge for {{dominantPlayerName}}.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
  ph("H2H_DOMINANCE.reaction.1", "B", "reaction", "You wonder if {{dominatedPlayerName}} thinks about that walking up to the oche.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
  ph("H2H_DOMINANCE.context.1", "A", "context", "Head-to-head history like that doesn't guarantee anything on the night, but it's a real pattern.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
  ph("H2H_DOMINANCE.closer.1", "B", "closer", "{{dominatedPlayerName}} will fancy being the one to change that story.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
];

const RIVALRY_REQUIRES = ["playerAId", "playerBId", "aWins", "bWins", "gamesPlayed"];
const RIVALRY_PHRASES: Phrase[] = [
  ph("RIVALRY.qf.1", "A", "quick_fact", "{{playerAName}} and {{playerBName}} are locked at {{aWins}}-{{bWins}} across {{gamesPlayed}} meetings.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.qr.1", "B", "quick_reaction", "That's about as even a rivalry as you'll find in this league.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.fact.1", "A", "fact", "Neither side has pulled clear across {{gamesPlayed}} matches between them.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.reaction.1", "B", "reaction", "Genuinely can't call this one — that's what makes it worth watching.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.context.1", "A", "context", "A rivalry this balanced tends to come down to whoever's sharper on the night.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.closer.1", "B", "closer", "Never a dull one between these two.", "neutral", { requires: RIVALRY_REQUIRES }),
];

const RIVALRY_SWING_REQUIRES = ["careerLeaderPlayerId", "recentLeaderPlayerId", "recentWindowSize", "aWins", "bWins"];
const RIVALRY_SWING_PHRASES: Phrase[] = [
  ph("RIVALRY_SWING.qf.1", "A", "quick_fact", "{{recentLeaderPlayerName}} has taken control of the recent meetings, even with {{careerLeaderPlayerName}} still ahead across the full history.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.qr.1", "B", "quick_reaction", "The tide's turning in that one, isn't it.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.fact.1", "A", "fact", "Over the last {{recentWindowSize}} meetings the pattern has flipped from the long-run head-to-head.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.reaction.1", "B", "reaction", "Long-term head-to-head is one thing — right now, {{recentLeaderPlayerName}}'s clearly got the edge.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.context.1", "A", "context", "Worth watching whether that recent trend becomes the new normal for this fixture.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.closer.1", "B", "closer", "This rivalry's got a bit of a plot twist in it now.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// PERFORMANCE family (6 types) — match-anchored, Singles-only.
// ════════════════════════════════════════════════════════════════════════

const CLINICAL_FINISHING_REQUIRES = ["playerId", "checkoutRate", "checkoutPercentile"];
const CLINICAL_FINISHING_PHRASES: Phrase[] = [
  ph("CLINICAL_FINISHING.qf.1", "A", "quick_fact", "{{playerName}} was clinical on the doubles tonight, checking out at a rate well above their own baseline.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
  ph("CLINICAL_FINISHING.qr.1", "B", "quick_reaction", "Doubles like that win matches on their own.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
  ph("CLINICAL_FINISHING.perf.1", "A", "performance_fact", "That checkout rate sits right up among the league's top marks tonight.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
  ph("CLINICAL_FINISHING.credit.1", "B", "credit", "That's the difference between a good night and a great one — hitting the outs.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
  ph("CLINICAL_FINISHING.consequence.1", "A", "consequence", "Keep finishing at that rate and results like tonight's become the norm.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
];

const DOUBLE_TROUBLE_REQUIRES = ["playerId", "checkoutRate", "checkoutAttempts", "ownBaselineCheckoutRate"];
const DOUBLE_TROUBLE_PHRASES: Phrase[] = [
  ph("DOUBLE_TROUBLE.qf.1", "A", "quick_fact", "{{playerName}} struggled on the doubles tonight — well down on their usual checkout rate across {{checkoutAttempts}} attempts.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
  ph("DOUBLE_TROUBLE.qr.1", "B", "quick_reaction", "Those missed doubles will sting more than the scoreline suggests.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES, tone: "humour" }),
  ph("DOUBLE_TROUBLE.fact.1", "A", "fact", "A checkout night well below {{playerName}}'s own baseline, from a reasonable {{checkoutAttempts}} attempts.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
  ph("DOUBLE_TROUBLE.reaction.1", "B", "reaction", "Everyone has a night where the doubles just won't fall.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
  ph("DOUBLE_TROUBLE.context.1", "A", "context", "Nothing in the scoring to suggest this becomes a pattern — one to watch next time out, though.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
  ph("DOUBLE_TROUBLE.closer.1", "B", "closer", "Backing {{playerName}} to sort that out sharpish.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
];

const SCORING_POWER_REQUIRES = ["playerId", "scoringRate30", "scoringPercentile"];
const SCORING_POWER_PHRASES: Phrase[] = [
  ph("SCORING_POWER.qf.1", "A", "quick_fact", "{{playerName}}'s scoring power tonight sits well up in the league's percentile marks.", "positive", { requires: SCORING_POWER_REQUIRES }),
  ph("SCORING_POWER.qr.1", "B", "quick_reaction", "Big scoring from {{playerName}} — that puts real pressure on.", "positive", { requires: SCORING_POWER_REQUIRES }),
  ph("SCORING_POWER.perf.1", "A", "performance_fact", "A three-dart average that ranks near the top of the league tonight.", "positive", { requires: SCORING_POWER_REQUIRES }),
  ph("SCORING_POWER.credit.1", "B", "credit", "That's the sort of scoring that leaves an opponent chasing the game.", "positive", { requires: SCORING_POWER_REQUIRES }),
  ph("SCORING_POWER.consequence.1", "A", "consequence", "Sustain that scoring rate and the results tend to follow.", "positive", { requires: SCORING_POWER_REQUIRES }),
];

const SCORING_WITHOUT_FINISHING_REQUIRES = ["playerId", "scoringPercentile", "checkoutPercentile"];
const SCORING_WITHOUT_FINISHING_PHRASES: Phrase[] = [
  ph("SCORING_WITHOUT_FINISHING.qf.1", "A", "quick_fact", "{{playerName}} scored well tonight but couldn't convert it on the doubles.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.qr.1", "B", "quick_reaction", "All that scoring, and the outs just wouldn't drop.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.fact.1", "A", "fact", "Strong scoring percentile, but a checkout percentile a long way behind it tonight.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.reaction.1", "B", "reaction", "That's the most frustrating way to lose a set, that.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.context.1", "A", "context", "The raw scoring suggests this result could easily have gone the other way.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.closer.1", "B", "closer", "Sort the finishing out and {{playerName}}'s a real problem for anyone.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
];

const SEASON_BEST_REQUIRES = ["playerId", "metric", "value", "verifiedRecordClaim"];
const SEASON_BEST_PHRASES: Phrase[] = [
  ph("SEASON_BEST.qf.1", "A", "quick_fact", "That's a season-best {{metric}} for {{playerName}} — {{value}}.", "positive", { requires: SEASON_BEST_REQUIRES }),
  ph("SEASON_BEST.qr.1", "B", "quick_reaction", "New season high for {{playerName}} — take a bow.", "positive", { requires: SEASON_BEST_REQUIRES, tone: "personality" }),
  ph("SEASON_BEST.perf.1", "A", "performance_fact", "A season-best {{metric}} for {{playerName}} tonight — {{value}}, verified against their own season record.", "positive", { requires: SEASON_BEST_REQUIRES }),
  ph("SEASON_BEST.credit.1", "B", "credit", "That's the top {{metric}} {{playerName}}'s put up all season.", "positive", { requires: SEASON_BEST_REQUIRES }),
  ph("SEASON_BEST.consequence.1", "A", "consequence", "A season-best mark like that is a real confidence boost heading into the run-in.", "positive", { requires: SEASON_BEST_REQUIRES }),
];

const PERSONAL_BEST_REQUIRES = ["playerId", "metric", "value", "verifiedRecordClaim"];
const PERSONAL_BEST_PHRASES: Phrase[] = [
  ph("PERSONAL_BEST.qf.1", "A", "quick_fact", "A career-best {{metric}} for {{playerName}} tonight — {{value}}.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
  ph("PERSONAL_BEST.qr.1", "B", "quick_reaction", "Career highest for {{playerName}} — that's one to remember.", "positive", { requires: PERSONAL_BEST_REQUIRES, tone: "personality", distinctive: true }),
  ph("PERSONAL_BEST.perf.1", "A", "performance_fact", "A career-best {{metric}} for {{playerName}} tonight — {{value}}, verified against their full career record.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
  ph("PERSONAL_BEST.credit.1", "B", "credit", "That's the best {{metric}} {{playerName}}'s ever produced in this league.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
  ph("PERSONAL_BEST.consequence.1", "A", "consequence", "A genuine career mark like that will stand for a while.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// LEAGUE family (9 types) — applies across all three leagues.
// ════════════════════════════════════════════════════════════════════════

const NEW_LEADER_REQUIRES = ["newLeaderEntityId", "previousLeaderEntityId", "points"];
const NEW_LEADER_PHRASES: Phrase[] = [
  ph("NEW_LEADER.qf.1", "A", "quick_fact", "There's a new leader — {{newLeaderEntityName}} moves top on {{points}} points, past {{previousLeaderEntityName}}.", "positive", { requires: NEW_LEADER_REQUIRES }),
  ph("NEW_LEADER.qr.1", "B", "quick_reaction", "New name at the top of the table — always changes the mood.", "positive", { requires: NEW_LEADER_REQUIRES }),
  ph("NEW_LEADER.fact.1", "A", "fact", "{{newLeaderEntityName}} overtakes {{previousLeaderEntityName}} at the summit, now on {{points}} points.", "positive", { requires: NEW_LEADER_REQUIRES }),
  ph("NEW_LEADER.reaction.1", "B", "reaction", "{{previousLeaderEntityName}} will want to answer that back quickly.", "neutral", { requires: NEW_LEADER_REQUIRES }),
  ph("NEW_LEADER.context.1", "A", "context", "That's exactly the kind of change that keeps a title race alive.", "neutral", { requires: NEW_LEADER_REQUIRES }),
  ph("NEW_LEADER.closer.1", "B", "closer", "New leader, same pressure.", "neutral", { requires: NEW_LEADER_REQUIRES }),
];

const LEAD_TIGHTENS_REQUIRES = ["leaderEntityId", "previousGap", "currentGap"];
const LEAD_TIGHTENS_PHRASES: Phrase[] = [
  ph("LEAD_TIGHTENS.qf.1", "A", "quick_fact", "{{leaderEntityName}}'s lead has shrunk from {{previousGap}} points down to {{currentGap}}.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.qr.1", "B", "quick_reaction", "That gap's closing fast now.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.fact.1", "A", "fact", "Down from {{previousGap}} to just {{currentGap}} at the top.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.reaction.1", "B", "reaction", "{{leaderEntityName}} can feel the breath on the back of the neck now.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.context.1", "A", "context", "A gap that size can disappear in a single weekend of results.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.closer.1", "B", "closer", "This one's getting interesting.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
];

const LEAD_WIDENS_REQUIRES = ["leaderEntityId", "previousGap", "currentGap"];
const LEAD_WIDENS_PHRASES: Phrase[] = [
  ph("LEAD_WIDENS.qf.1", "A", "quick_fact", "{{leaderEntityName}} stretches the lead from {{previousGap}} points out to {{currentGap}}.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.qr.1", "B", "quick_reaction", "That's real breathing room at the top now.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.fact.1", "A", "fact", "Up from {{previousGap}} to {{currentGap}} clear at the summit.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.reaction.1", "B", "reaction", "The rest of the league needs to find an answer, and quickly.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.context.1", "A", "context", "A gap that size starts to change how the run-in gets played.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.closer.1", "B", "closer", "{{leaderEntityName}} making this look comfortable.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
];

const TITLE_SWING_REQUIRES = ["entityId", "previousProbability", "currentProbability", "deltaPoints"];
const TITLE_SWING_PHRASES: Phrase[] = [
  ph("TITLE_SWING.qf.1", "A", "quick_fact", "{{entityName}}'s title chance has moved from {{previousProbabilityPct}}% to {{currentProbabilityPct}}%.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.qr.1", "B", "quick_reaction", "That's a serious jump in the title picture.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.model.1", "A", "model_context", "The title model now has {{entityName}} at {{currentProbabilityPct}}%, up from {{previousProbabilityPct}}% before this round of results.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.contrary.1", "B", "contrary_opinion", "Models move fast — I'd want to see that backed up on the board a few more weeks before I fully buy it.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.evidence.1", "A", "evidence", "A shift that size doesn't happen without real results behind it — this wasn't a rounding error.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.close.1", "B", "disagree_close", "Fine — I'll believe it if it's still true next week.", "neutral", { requires: TITLE_SWING_REQUIRES }),
];

const NEW_FAVOURITE_REQUIRES = ["newFavouriteEntityId", "previousFavouriteEntityId", "probability"];
const NEW_FAVOURITE_PHRASES: Phrase[] = [
  ph("NEW_FAVOURITE.obs.1", "B", "observation", "{{newFavouriteEntityName}} feels like the team to beat for the title right now.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
  ph("NEW_FAVOURITE.check.1", "A", "data_check", "The title model agrees — {{newFavouriteEntityName}} is the new favourite at {{probabilityPct}}%, ahead of {{previousFavouriteEntityName}}.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
  ph("NEW_FAVOURITE.response.1", "B", "response", "Good to have the numbers on my side for once.", "neutral", { requires: NEW_FAVOURITE_REQUIRES, tone: "humour" }),
  ph("NEW_FAVOURITE.qf.1", "A", "quick_fact", "{{newFavouriteEntityName}} is the new favourite for the title, overtaking {{previousFavouriteEntityName}}.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
  ph("NEW_FAVOURITE.qr.1", "B", "quick_reaction", "About time someone else got a look-in at the top of that model.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
];

const DEAD_HEAT_REQUIRES = ["firstEntityId", "firstProbability", "secondEntityId", "secondProbability"];
const DEAD_HEAT_PHRASES: Phrase[] = [
  ph("DEAD_HEAT.qf.1", "A", "quick_fact", "{{firstEntityName}} and {{secondEntityName}} are separated by almost nothing at the top of the title model — {{firstProbabilityPct}}% to {{secondProbabilityPct}}%.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.qr.1", "B", "quick_reaction", "You could not call that title race with a coin right now.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.fact.1", "A", "fact", "Barely a percentage point in it between {{firstEntityName}} and {{secondEntityName}}.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.reaction.1", "B", "reaction", "This is exactly the kind of run-in that makes the whole season worth it.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.context.1", "A", "context", "Every remaining fixture for either side now carries real title weight.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.closer.1", "B", "closer", "Can't wait for the next round between these two.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
];

const TITLE_RACE_REQUIRES = ["viableEntityIds"];
const TITLE_RACE_PHRASES: Phrase[] = [
  ph("TITLE_RACE.obs.1", "B", "observation", "This title race has got real width to it — {{viableEntityNamesJoined}} all still have a genuine shout.", "neutral", { requires: TITLE_RACE_REQUIRES }),
  ph("TITLE_RACE.check.1", "A", "data_check", "The model agrees — {{viableEntityNamesJoined}} are all within a viable range of the title.", "neutral", { requires: TITLE_RACE_REQUIRES }),
  ph("TITLE_RACE.response.1", "B", "response", "Makes every remaining fixture must-watch.", "neutral", { requires: TITLE_RACE_REQUIRES }),
  ph("TITLE_RACE.qf.1", "A", "quick_fact", "Several sides are still viable for the title: {{viableEntityNamesJoined}}.", "neutral", { requires: TITLE_RACE_REQUIRES }),
  ph("TITLE_RACE.qr.1", "B", "quick_reaction", "Wide open — love a title race like this.", "neutral", { requires: TITLE_RACE_REQUIRES }),
];

const CHAMPION_REQUIRES = ["seasonId", "championEntityId"];
const CHAMPION_PHRASES: Phrase[] = [
  // "{{championEntityName}} are/is this season's champion(s)" needs
  // singular agreement for a singles player's own name but plural for a
  // doubles/shift_wars team name ("Richard is..." vs "Team Fresh are...") —
  // rather than picking one and getting the other league type wrong, this
  // puts "is" on "champion" instead, which stays singular either way since
  // there's always exactly one, regardless of what kind of entity holds it.
  ph("CHAMPION.qf.1", "A", "quick_fact", "It's official — this season's champion is {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES }),
  ph("CHAMPION.qr.1", "B", "quick_reaction", "Take a bow, {{championEntityName}} — fully deserved.", "positive", { requires: CHAMPION_REQUIRES, tone: "personality" }),
  ph("CHAMPION.perf.1", "A", "performance_fact", "A season-long effort confirmed with the title now mathematically settled.", "positive", { requires: CHAMPION_REQUIRES }),
  ph("CHAMPION.credit.1", "B", "credit", "That's a champion earned over the course of a whole season, not one lucky night.", "positive", { requires: CHAMPION_REQUIRES }),
  ph("CHAMPION.consequence.1", "A", "consequence", "The trophy's decided — attention turns to who challenges next season.", "positive", { requires: CHAMPION_REQUIRES }),
];

const TIE_PENDING_REQUIRES = ["seasonId", "tiedEntityIds", "points"];
const TIE_PENDING_PHRASES: Phrase[] = [
  ph("TIE_PENDING.qf.1", "A", "quick_fact", "We have a tie at the top on {{points}} points — {{tiedEntityNamesJoined}} — an official tiebreak will be needed.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.qr.1", "B", "quick_reaction", "Love a tiebreak, me — nothing else settles it fairly.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.fact.1", "A", "fact", "{{tiedEntityNamesJoined}} finish level on {{points}} points, so the rules go to a tiebreak.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.reaction.1", "B", "reaction", "However it's settled, nobody can say it wasn't earned.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.context.1", "A", "context", "We'll confirm the tiebreak format as soon as it's officially run.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.closer.1", "B", "closer", "Can't ask for a tighter finish than that.", "neutral", { requires: TIE_PENDING_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// MILESTONE family (4 types) — match-anchored, Singles-only. Cumulative
// career counters, not superlative claims — see this file's own header for
// why none of these use record-claim language.
// ════════════════════════════════════════════════════════════════════════

const CAREER_MATCH_MILESTONE_REQUIRES = ["playerId", "careerGamesPlayed"];
const CAREER_MATCH_MILESTONE_PHRASES: Phrase[] = [
  ph("CAREER_MATCH_MILESTONE.qf.1", "A", "quick_fact", "{{playerName}} has just played career match number {{careerGamesPlayed}}.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
  ph("CAREER_MATCH_MILESTONE.qr.1", "B", "quick_reaction", "That's proper staying power, that.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
  ph("CAREER_MATCH_MILESTONE.perf.1", "A", "performance_fact", "{{careerGamesPlayed}} TKDL matches and counting for {{playerName}}.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
  ph("CAREER_MATCH_MILESTONE.credit.1", "B", "credit", "Turning up week after week counts for a lot in this league.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
  ph("CAREER_MATCH_MILESTONE.consequence.1", "A", "consequence", "A milestone worth marking, whatever happens the rest of the season.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
];

const CAREER_WIN_MILESTONE_REQUIRES = ["playerId", "careerWins"];
const CAREER_WIN_MILESTONE_PHRASES: Phrase[] = [
  ph("CAREER_WIN_MILESTONE.qf.1", "A", "quick_fact", "That's career win number {{careerWins}} for {{playerName}}.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
  ph("CAREER_WIN_MILESTONE.qr.1", "B", "quick_reaction", "Big number, that.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
  ph("CAREER_WIN_MILESTONE.perf.1", "A", "performance_fact", "{{careerWins}} career wins now on the board for {{playerName}}.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
  ph("CAREER_WIN_MILESTONE.credit.1", "B", "credit", "That tally doesn't build itself — years of work in that number.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
  ph("CAREER_WIN_MILESTONE.consequence.1", "A", "consequence", "A genuine landmark in {{playerName}}'s TKDL career.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
];

const MILESTONE_180_REQUIRES = ["playerId", "career180s", "matchThrown180s"];
const MILESTONE_180_PHRASES: Phrase[] = [
  ph("180_MILESTONE.qf.1", "A", "quick_fact", "{{playerName}} throws {{matchThrown180s}} maximums tonight, taking the career tally to {{career180s}}.", "positive", { requires: MILESTONE_180_REQUIRES }),
  ph("180_MILESTONE.qr.1", "B", "quick_reaction", "One-hundred-and-eighty! Love hearing that called out.", "positive", { requires: MILESTONE_180_REQUIRES, tone: "personality" }),
  ph("180_MILESTONE.perf.1", "A", "performance_fact", "{{career180s}} career maximums now for {{playerName}}.", "positive", { requires: MILESTONE_180_REQUIRES }),
  ph("180_MILESTONE.credit.1", "B", "credit", "Every one of those takes real composure to hit.", "positive", { requires: MILESTONE_180_REQUIRES }),
  ph("180_MILESTONE.consequence.1", "A", "consequence", "A tally like that puts {{playerName}} right up among the league's biggest scorers.", "positive", { requires: MILESTONE_180_REQUIRES }),
];

const ELIMINATION_MILESTONE_REQUIRES = ["playerId", "careerEliminations"];
const ELIMINATION_MILESTONE_PHRASES: Phrase[] = [
  ph("ELIMINATION_MILESTONE.qf.1", "A", "quick_fact", "That's career elimination number {{careerEliminations}} for {{playerName}}.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
  ph("ELIMINATION_MILESTONE.qr.1", "B", "quick_reaction", "Not the number anyone wants to see go up, that one.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES, tone: "humour" }),
  ph("ELIMINATION_MILESTONE.fact.1", "A", "fact", "{{careerEliminations}} career eliminations now on the books for {{playerName}}.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
  ph("ELIMINATION_MILESTONE.reaction.1", "B", "reaction", "Comes with the territory in a knockout format — happens to everyone eventually.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
  ph("ELIMINATION_MILESTONE.context.1", "A", "context", "Plenty of players on that same list who've bounced straight back the following season.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
  ph("ELIMINATION_MILESTONE.closer.1", "B", "closer", "Back stronger next time, no doubt.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// DOUBLES family (4 types).
// ════════════════════════════════════════════════════════════════════════

const PAIR_UPSET_REQUIRES = ["winnerTeamId", "loserTeamId", "winnerProbability"];
const PAIR_UPSET_PHRASES: Phrase[] = [
  ph("PAIR_UPSET.qf.1", "A", "quick_fact", "{{winnerTeamName}} beat {{loserTeamName}} as underdogs — rated just {{winnerProbabilityPct}}% coming in.", "positive", { requires: PAIR_UPSET_REQUIRES }),
  ph("PAIR_UPSET.qr.1", "B", "quick_reaction", "Love an upset in the doubles — pairs feed off that energy.", "positive", { requires: PAIR_UPSET_REQUIRES }),
  ph("PAIR_UPSET.model.1", "A", "model_context", "The team model gave {{winnerTeamName}} only {{winnerProbabilityPct}}% against {{loserTeamName}}.", "neutral", { requires: PAIR_UPSET_REQUIRES }),
  ph("PAIR_UPSET.contrary.1", "B", "contrary_opinion", "Chemistry counts for more than the model gives it credit for in doubles.", "positive", { requires: PAIR_UPSET_REQUIRES }),
  ph("PAIR_UPSET.evidence.1", "A", "evidence", "Whatever the reason, a sub-40% shot landing is a genuine result.", "neutral", { requires: PAIR_UPSET_REQUIRES }),
  ph("PAIR_UPSET.close.1", "B", "disagree_close", "{{winnerTeamName}} will take that all day long.", "positive", { requires: PAIR_UPSET_REQUIRES }),
];

const PAIR_ELIMINATED_REQUIRES = ["winnerTeamId", "loserTeamId"];
const PAIR_ELIMINATED_PHRASES: Phrase[] = [
  ph("PAIR_ELIMINATED.qf.1", "A", "quick_fact", "{{loserTeamName}} are out, beaten by {{winnerTeamName}}.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.qr.1", "B", "quick_reaction", "Tough end to the campaign for that pairing.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.fact.1", "A", "fact", "That result confirms {{loserTeamName}}'s elimination, with {{winnerTeamName}} through.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.reaction.1", "B", "reaction", "Doubles is a cruel format sometimes — one bad night and it's over.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.context.1", "A", "context", "That also reshapes who's still in the running elsewhere in the draw.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.closer.1", "B", "closer", "Good run while it lasted for {{loserTeamName}}.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
];

const UNBEATEN_PAIR_REQUIRES = ["teamId", "wins"];
const UNBEATEN_PAIR_PHRASES: Phrase[] = [
  ph("UNBEATEN_PAIR.qf.1", "A", "quick_fact", "{{teamName}} remain unbeaten after {{wins}} matches this season.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
  ph("UNBEATEN_PAIR.qr.1", "B", "quick_reaction", "Nobody's found an answer for {{teamName}} yet.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
  ph("UNBEATEN_PAIR.perf.1", "A", "performance_fact", "An unbeaten run still intact after {{wins}} matches for {{teamName}}.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
  ph("UNBEATEN_PAIR.credit.1", "B", "credit", "That kind of consistency as a pair is genuinely hard to build.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
  ph("UNBEATEN_PAIR.consequence.1", "A", "consequence", "Keep that run going and {{teamName}} are the team everyone else is chasing.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
];

const PAIR_SURGE_REQUIRES = ["teamId", "currentWinStreak"];
const PAIR_SURGE_PHRASES: Phrase[] = [
  ph("PAIR_SURGE.qf.1", "A", "quick_fact", "{{teamName}} are picking up serious momentum, on a run of {{currentWinStreak}} wins.", "positive", { requires: PAIR_SURGE_REQUIRES }),
  ph("PAIR_SURGE.qr.1", "B", "quick_reaction", "{{teamName}} are the pairing nobody wants to draw right now.", "positive", { requires: PAIR_SURGE_REQUIRES }),
  ph("PAIR_SURGE.perf.1", "A", "performance_fact", "{{currentWinStreak}} wins on the spin has {{teamName}} moving fast up the table.", "positive", { requires: PAIR_SURGE_REQUIRES }),
  ph("PAIR_SURGE.credit.1", "B", "credit", "That's a partnership properly clicking at the right time.", "positive", { requires: PAIR_SURGE_REQUIRES }),
  ph("PAIR_SURGE.consequence.1", "A", "consequence", "Keep that surge going and {{teamName}} force their way into the title picture.", "positive", { requires: PAIR_SURGE_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// SHIFT_WARS family (4 types).
// ════════════════════════════════════════════════════════════════════════

const SHIFT_LEAD_CHANGE_REQUIRES = ["newLeaderTeamId", "previousLeaderTeamId", "points"];
const SHIFT_LEAD_CHANGE_PHRASES: Phrase[] = [
  ph("SHIFT_LEAD_CHANGE.qf.1", "A", "quick_fact", "{{newLeaderTeamName}} go top of Shift Wars on {{points}} points, past {{previousLeaderTeamName}}.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
  ph("SHIFT_LEAD_CHANGE.qr.1", "B", "quick_reaction", "Bragging rights on the shop floor just changed hands.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES, tone: "humour" }),
  ph("SHIFT_LEAD_CHANGE.fact.1", "A", "fact", "{{newLeaderTeamName}} overtake {{previousLeaderTeamName}} at the top of the department standings.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
  ph("SHIFT_LEAD_CHANGE.reaction.1", "B", "reaction", "{{previousLeaderTeamName}} won't enjoy losing that one.", "neutral", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
  ph("SHIFT_LEAD_CHANGE.context.1", "A", "context", "Shift Wars has a way of swinging on just a couple of results.", "neutral", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
  ph("SHIFT_LEAD_CHANGE.closer.1", "B", "closer", "New leaders on the shop floor.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
];

const SHIFT_MOMENTUM_REQUIRES = ["leaderTeamId", "previousGap", "currentGap", "direction"];
const SHIFT_MOMENTUM_PHRASES: Phrase[] = [
  ph("SHIFT_MOMENTUM.qf.1", "A", "quick_fact", "The gap at the top of Shift Wars has moved from {{previousGap}} to {{currentGap}} points.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
  ph("SHIFT_MOMENTUM.qr.1", "B", "quick_reaction", "Real momentum shift building there.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
  ph("SHIFT_MOMENTUM.fact.1", "A", "fact", "That gap has gone from {{previousGap}} to {{currentGap}} in recent results.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
  ph("SHIFT_MOMENTUM.reaction.1", "B", "reaction", "The department chat will be buzzing about that one.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES, tone: "humour" }),
  ph("SHIFT_MOMENTUM.context.1", "A", "context", "Worth watching whether that momentum carries into next week's fixtures.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
  ph("SHIFT_MOMENTUM.closer.1", "B", "closer", "Shift Wars never sits still for long.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
];

const SHIFT_COMEBACK_REQUIRES = ["teamId", "deficitBefore", "deficitNow", "matches"];
const SHIFT_COMEBACK_PHRASES: Phrase[] = [
  ph("SHIFT_COMEBACK.qf.1", "A", "quick_fact", "{{teamName}} have cut their deficit from {{deficitBefore}} to {{deficitNow}} points over the last {{matches}} matches.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
  ph("SHIFT_COMEBACK.qr.1", "B", "quick_reaction", "That's a proper fightback from {{teamName}}.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
  ph("SHIFT_COMEBACK.perf.1", "A", "performance_fact", "A deficit of {{deficitBefore}} is down to just {{deficitNow}} now.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
  ph("SHIFT_COMEBACK.credit.1", "B", "credit", "Clawing back a gap like that takes real consistency across the department.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
  ph("SHIFT_COMEBACK.consequence.1", "A", "consequence", "Keep that recovery going and {{teamName}} are right back in this.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
];

const SHIFT_DOMINANCE_REQUIRES = ["teamId", "wins", "losses", "winShare"];
const SHIFT_DOMINANCE_PHRASES: Phrase[] = [
  ph("SHIFT_DOMINANCE.qf.1", "A", "quick_fact", "{{teamName}} have {{wins}} wins against just {{losses}} losses this season — a genuinely dominant win share.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
  ph("SHIFT_DOMINANCE.qr.1", "B", "quick_reaction", "Nobody else in the department is close to that.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
  ph("SHIFT_DOMINANCE.perf.1", "A", "performance_fact", "{{wins}} wins against just {{losses}} losses — a real gulf to the rest of Shift Wars.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
  ph("SHIFT_DOMINANCE.credit.1", "B", "credit", "That's a team playing at a different level to everyone else right now.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
  ph("SHIFT_DOMINANCE.consequence.1", "A", "consequence", "At that win rate, the title conversation in Shift Wars starts and ends with {{teamName}}.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// ARCHIVE family (3 types) — evergreen supporting context, cross-league.
// ════════════════════════════════════════════════════════════════════════

const LAST_MEETING_REQUIRES = ["entityAId", "entityBId", "lastMeetingWinnerId", "lastMeetingStake"];
const LAST_MEETING_PHRASES: Phrase[] = [
  ph("LAST_MEETING.qf.1", "A", "quick_fact", "These two last met with {{lastMeetingWinnerName}} coming out on top, {{lastMeetingStake}} points on the line.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.qr.1", "B", "quick_reaction", "Good bit of context going into this one.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.fact.1", "A", "fact", "{{lastMeetingWinnerName}} won the last meeting between {{entityAName}} and {{entityBName}}.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.reaction.1", "B", "reaction", "Whether that means anything tonight is a different question entirely.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.context.1", "A", "context", "History's one thing — form on the night usually has the final say.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.closer.1", "B", "closer", "Let's see if that pattern holds.", "neutral", { requires: LAST_MEETING_REQUIRES }),
];

// Split into requires:["improved"]/["declined"] variants (story-detectors-
// archive.ts's detectSeasonComparison() now emits exactly one of those two
// presence-only facts, never both) — this used to be one phrase pool
// written only for an improvement ("running well clear", "step up"), which
// a materially WORSE season also fell into since there was nowhere else for
// it to go, narrating a decline as if it were good news. The direction-
// neutral phrases (fact/reaction/context/closer below) read fine either way
// and stay shared, matching FREEFALL's own even-handed "neutral" tone for
// reporting a downturn factually rather than unkindly.
const SEASON_COMPARISON_REQUIRES = ["entityId", "currentSeasonWinRate", "previousSeasonWinRate"];
const SEASON_COMPARISON_IMPROVED_REQUIRES = [...SEASON_COMPARISON_REQUIRES, "improved"];
const SEASON_COMPARISON_DECLINED_REQUIRES = [...SEASON_COMPARISON_REQUIRES, "declined"];
const SEASON_COMPARISON_PHRASES: Phrase[] = [
  ph("SEASON_COMPARISON.qf.improved.1", "A", "quick_fact", "{{entityName}}'s win rate this season is running well clear of last season's mark.", "neutral", { requires: SEASON_COMPARISON_IMPROVED_REQUIRES }),
  ph("SEASON_COMPARISON.qf.declined.1", "A", "quick_fact", "{{entityName}}'s win rate this season is well down on last season's mark.", "neutral", { requires: SEASON_COMPARISON_DECLINED_REQUIRES }),
  ph("SEASON_COMPARISON.qr.improved.1", "B", "quick_reaction", "Proper step up from last season, that.", "neutral", { requires: SEASON_COMPARISON_IMPROVED_REQUIRES }),
  ph("SEASON_COMPARISON.qr.declined.1", "B", "quick_reaction", "That's a real step back from last season.", "neutral", { requires: SEASON_COMPARISON_DECLINED_REQUIRES }),
  ph("SEASON_COMPARISON.fact.1", "A", "fact", "A material change from last season's win rate to this one for {{entityName}}.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
  ph("SEASON_COMPARISON.reaction.1", "B", "reaction", "Season-on-season numbers like that don't happen by accident.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
  ph("SEASON_COMPARISON.context.1", "A", "context", "Worth remembering as the season goes on — that trajectory tells its own story.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
  ph("SEASON_COMPARISON.closer.1", "B", "closer", "Different season, different {{entityName}}.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
];

const HISTORICAL_H2H_REQUIRES = ["entityAId", "entityBId", "aWins", "bWins", "gamesPlayed"];
const HISTORICAL_H2H_PHRASES: Phrase[] = [
  ph("HISTORICAL_H2H.qf.1", "A", "quick_fact", "{{entityAName}} and {{entityBName}} have met {{gamesPlayed}} times across their history — {{aWins}} wins to {{bWins}}.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.qr.1", "B", "quick_reaction", "Good bit of history between this pair.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.fact.1", "A", "fact", "A long-running head-to-head, {{gamesPlayed}} meetings deep now.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.reaction.1", "B", "reaction", "Always adds a bit of spice when there's history like that behind it.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.context.1", "A", "context", "Worth keeping in mind as this fixture comes around again this season.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.closer.1", "B", "closer", "One more chapter in that story tonight.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// Universal CALLBACK phrases — the one blueprint that isn't keyed to a
// specific story type's own facts, by design. "A references stored
// presenter/phrase history -> B admits/defends -> current evidence" (12.4)
// depends on what a presenter said in an EARLIER Edition, not on any single
// story's own detected facts — that history lives in broadcast_memory
// (13.4)'s PRESENTER_CALL rows, a table already defined for exactly this
// but not yet read/written by anything (it postdates the Story Engine).
//
// The contract commentary-engine.ts (not yet written) must fulfil before
// offering CALLBACK as an eligible blueprint for a story: read that
// subject's most recent PRESENTER_CALL memory row and, when one exists,
// synthesize exactly two facts onto the TemplateFacts object alongside the
// story's own real facts —
//   priorClaimTag: string   (a short label for what was said before, e.g.
//                            "a cooling run" or "growing streak" — sourced
//                            from that memory row's own stored payload, not
//                            invented at read time)
//   priorClaimEditionsAgo: number
// current_evidence then deliberately reuses whatever generic facts the
// CURRENT story already offers (playerId/teamId/entityId -> its Name) so
// the closing turn stays anchored to real, present-day evidence rather than
// needing a third invented fact.
// ════════════════════════════════════════════════════════════════════════

const CALLBACK_REQUIRES = ["priorClaimTag", "priorClaimEditionsAgo"];
const UNIVERSAL_CALLBACK_PHRASES: Phrase[] = [
  ph("CALLBACK.ref.1", "A", "callback_reference", "We talked about {{priorClaimTag}} not long back — {{priorClaimEditionsAgo}} editions ago now.", "neutral", { requires: CALLBACK_REQUIRES }),
  ph("CALLBACK.ref.2", "A", "callback_reference", "Ton, you had a strong take on {{priorClaimTag}} a few editions back.", "neutral", { requires: CALLBACK_REQUIRES }),
  ph("CALLBACK.admit.1", "B", "admit_or_defend", "I stand by it — but tonight's evidence is worth a look regardless.", "neutral", { requires: CALLBACK_REQUIRES }),
  ph("CALLBACK.admit.2", "B", "admit_or_defend", "Fair enough — I'll take that one on the chin if the numbers say otherwise.", "neutral", { requires: CALLBACK_REQUIRES, tone: "humour" }),
  ph("CALLBACK.evidence.playerId.1", "A", "current_evidence", "Either way, {{playerName}}'s latest numbers are the real story tonight.", "neutral", { requires: ["playerId", ...CALLBACK_REQUIRES] }),
  ph("CALLBACK.evidence.teamId.1", "A", "current_evidence", "Either way, {{teamName}}'s latest form is the real story tonight.", "neutral", { requires: ["teamId", ...CALLBACK_REQUIRES] }),
  ph("CALLBACK.evidence.entityId.1", "A", "current_evidence", "Either way, {{entityName}}'s latest position is the real story tonight.", "neutral", { requires: ["entityId", ...CALLBACK_REQUIRES] }),
];

// ════════════════════════════════════════════════════════════════════════
// UNIVERSAL_BANTER_PHRASES — QUICK_HIT's third turn (commentary-math.ts's
// own comment on BLUEPRINTS.QUICK_HIT explains why it's required, not
// optional). Real user feedback, verbatim: "i want some conversation
// between the host not just raw data i want this like a talk show about
// the league not just here the data enjoy." Supporting treatment is by far
// the most common treatment an Edition hands out, and until this pool
// existed it only ever got a bare quick_fact/quick_reaction pair — every
// other blueprint (AGREEMENT, DISAGREEMENT, PUNDIT_LEADS, CALLBACK) already
// gave Featured/Major segments real back-and-forth shape; Supporting had
// none. Writing 40 bespoke third-turn lines (one set per story type,
// matching every other section in this file) would repeat 12.5's own
// warning against "thousands of complete scripts" for content that isn't
// actually about any one story's specific facts anyway — Alex handing back
// to Ton, or reacting to the SHOW rather than to the number just read out,
// reads the same regardless of which story type triggered it. So this is
// ONE small reusable pool (same shape as UNIVERSAL_CALLBACK_PHRASES right
// below), not per-type content.
//
// Three hard constraints, by design:
//   1. `requires` is never set — a banter line about the show/the league/
//      the co-host's rapport is deliberately about NOTHING in the current
//      story's own facts, so it's always eligible no matter which of the
//      ~40 story types (or FILLER's three) triggered this segment. This
//      also means every one of these is trivially template-placeholder-free
//      and therefore trivially compliant with this file's own
//      placeholder-derivability test.
//   2. `sentiment` is only ever "positive" or "neutral" — this turn talks
//      about the SHOW, never makes a claim about which way an individual
//      result cut, so there's no factual basis for a "negative" banter line
//      here in the first place (and 12.7's negative-banter cooldown has
//      nothing to do with this turn's content anyway).
//   3. At least a few entries use `tone: "personality"` rather than
//      "humour" — commentary-engine.ts's eligiblePhrasesForTurn() drops
//      every humour/negative-sentiment phrase outright at
//      broadcast_banter_level 0 ("quieter"). Since this turn is REQUIRED
//      (not optional) for Supporting — the only treatment that ever uses
//      QUICK_HIT on its own — a pool that was ALL humour-toned would make
//      QUICK_HIT itself unsatisfiable at banter_level 0, which would silently
//      drop every Supporting segment's dialogue entirely
//      (renderConversation returns [] when no blueprint the treatment
//      allows is satisfiable). Mixing in plain personality-toned lines
//      guarantees this turn survives every banter_level setting.
// ════════════════════════════════════════════════════════════════════════

const UNIVERSAL_BANTER_PHRASES: Phrase[] = [
  ph("BANTER.a.1", "A", "banter", "That's the joy of covering a league like this, Ton — no two Tuesdays play out the same way.", "positive", { tone: "personality" }),
  ph("BANTER.a.2", "A", "banter", "Keep those results coming in, folks — this table never sits still for long.", "neutral", { tone: "personality" }),
  ph("BANTER.a.3", "A", "banter", "Ton, I don't think either of us saw this season shaping up quite like this.", "neutral", { tone: "personality" }),
  ph("BANTER.a.4", "A", "banter", "Honestly, this is exactly why we love doing this show every week.", "positive", { tone: "personality" }),
  ph("BANTER.a.5", "A", "banter", "Plenty more where that came from tonight, Ton — stick with us.", "neutral", { tone: "personality" }),
  ph("BANTER.a.6", "A", "banter", "Say what you like about this league, it never gives you a dull night.", "positive", { tone: "humour" }),
  ph("BANTER.a.7", "A", "banter", "You can hear the oche buzzing already — back to that in a moment.", "neutral", { tone: "personality" }),
  ph("BANTER.a.8", "A", "banter", "That's one for the notebook at this rate, Ton.", "positive", { tone: "humour" }),
  ph("BANTER.a.9", "A", "banter", "We'll keep an eye on that one — this league loves a twist.", "neutral", { tone: "personality" }),
  ph("BANTER.a.10", "A", "banter", "Right, Ton, let's see what else tonight's got in store for us.", "neutral", { tone: "personality" }),
  ph("BANTER.a.11", "A", "banter", "Every single week this league finds a new way to surprise us, Ton.", "positive", { tone: "humour" }),
  ph("BANTER.a.12", "A", "banter", "Anyway — moving on, because there's no shortage of it tonight.", "neutral", { tone: "personality" }),
];

// ════════════════════════════════════════════════════════════════════════
// PUNDIT_LEADS reuse for DOUBLES.PAIR_UPSET's own observation/data_check/
// response turns — folded into PAIR_UPSET's own array above via
// DISAGREEMENT instead (this section intentionally left without a separate
// PUNDIT_LEADS set for Doubles, since PAIR_UPSET's DISAGREEMENT phrases
// already give it a full featured-length blueprint).
// ════════════════════════════════════════════════════════════════════════

// ── Assembly ───────────────────────────────────────────────────────────
export const COMMENTARY_LIBRARY: Partial<Record<StoryType, Phrase[]>> = {
  UPSET: UPSET_PHRASES,
  MAJOR_UPSET: MAJOR_UPSET_PHRASES,
  MODEL_SHOCK: MODEL_SHOCK_PHRASES,
  HIGH_STAKE_WIN: HIGH_STAKE_WIN_PHRASES,
  HIGH_STAKE_LOSS: HIGH_STAKE_LOSS_PHRASES,
  ELIMINATION: ELIMINATION_PHRASES,
  LEADER_BEATEN: LEADER_BEATEN_PHRASES,
  STREAK_BREAKER: STREAK_BREAKER_PHRASES,
  DROUGHT_ENDED: DROUGHT_ENDED_PHRASES,
  FIRST_H2H_WIN: FIRST_H2H_WIN_PHRASES,
  REVENGE: REVENGE_PHRASES,

  WIN_STREAK: WIN_STREAK_PHRASES,
  LOSS_STREAK: LOSS_STREAK_PHRASES,
  FORM_REVERSAL: FORM_REVERSAL_PHRASES,
  QUIET_CLIMBER: QUIET_CLIMBER_PHRASES,
  FREEFALL: FREEFALL_PHRASES,
  ABOVE_BASELINE: ABOVE_BASELINE_PHRASES,

  H2H_DOMINANCE: H2H_DOMINANCE_PHRASES,
  RIVALRY: RIVALRY_PHRASES,
  RIVALRY_SWING: RIVALRY_SWING_PHRASES,

  CLINICAL_FINISHING: CLINICAL_FINISHING_PHRASES,
  DOUBLE_TROUBLE: DOUBLE_TROUBLE_PHRASES,
  SCORING_POWER: SCORING_POWER_PHRASES,
  SCORING_WITHOUT_FINISHING: SCORING_WITHOUT_FINISHING_PHRASES,
  SEASON_BEST: SEASON_BEST_PHRASES,
  PERSONAL_BEST: PERSONAL_BEST_PHRASES,

  NEW_LEADER: NEW_LEADER_PHRASES,
  LEAD_TIGHTENS: LEAD_TIGHTENS_PHRASES,
  LEAD_WIDENS: LEAD_WIDENS_PHRASES,
  TITLE_SWING: TITLE_SWING_PHRASES,
  NEW_FAVOURITE: NEW_FAVOURITE_PHRASES,
  DEAD_HEAT: DEAD_HEAT_PHRASES,
  TITLE_RACE: TITLE_RACE_PHRASES,
  CHAMPION: CHAMPION_PHRASES,
  TIE_PENDING: TIE_PENDING_PHRASES,

  CAREER_MATCH_MILESTONE: CAREER_MATCH_MILESTONE_PHRASES,
  CAREER_WIN_MILESTONE: CAREER_WIN_MILESTONE_PHRASES,
  "180_MILESTONE": MILESTONE_180_PHRASES,
  ELIMINATION_MILESTONE: ELIMINATION_MILESTONE_PHRASES,

  UNBEATEN_PAIR: UNBEATEN_PAIR_PHRASES,
  PAIR_SURGE: PAIR_SURGE_PHRASES,
  PAIR_UPSET: PAIR_UPSET_PHRASES,
  PAIR_ELIMINATED: PAIR_ELIMINATED_PHRASES,

  SHIFT_LEAD_CHANGE: SHIFT_LEAD_CHANGE_PHRASES,
  SHIFT_MOMENTUM: SHIFT_MOMENTUM_PHRASES,
  SHIFT_COMEBACK: SHIFT_COMEBACK_PHRASES,
  SHIFT_DOMINANCE: SHIFT_DOMINANCE_PHRASES,

  LAST_MEETING: LAST_MEETING_PHRASES,
  SEASON_COMPARISON: SEASON_COMPARISON_PHRASES,
  HISTORICAL_H2H: HISTORICAL_H2H_PHRASES,
};

export { UNIVERSAL_CALLBACK_PHRASES, UNIVERSAL_BANTER_PHRASES };

/** The one intended lookup entry point — every story type in Appendix A's v1 catalogue has an entry (enforced by the library-validation test), so this only ever returns `[]` for a story type that's genuinely uncovered (which the test catches). */
export function phrasesForStoryType(storyType: StoryType): Phrase[] {
  return COMMENTARY_LIBRARY[storyType] ?? [];
}

/** Every phrase in the library, flattened — for library-wide validation scans (record-claim compliance, banned-topic language) that need to check every phrase regardless of which story type it belongs to. */
export function allLibraryPhrases(): Phrase[] {
  return [...Object.values(COMMENTARY_LIBRARY).flat(), ...UNIVERSAL_CALLBACK_PHRASES, ...UNIVERSAL_BANTER_PHRASES];
}
