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
  ph("UPSET.qf.1", "A", "quick_fact", "{{winnerName}} beats {{loserName}} for {{stake}} points — the model had {{winnerName}} at just {{winnerProbabilityPct}}% coming in.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("UPSET.qr.1", "B", "quick_reaction", "Didn't see that coming — {{loserName}} will want to forget that one.", "neutral", { requires: UPSET_REQUIRES, tone: "humour" }),
  ph("UPSET.model.1", "A", "model_context", "Going in, our model gave {{winnerName}} a {{winnerProbabilityPct}}% chance against {{loserName}}.", "neutral", { requires: UPSET_REQUIRES }),
  ph("UPSET.contrary.1", "B", "contrary_opinion", "Numbers or no numbers, {{winnerName}} always fancied this one — I said as much last time out.", "positive", { requires: UPSET_REQUIRES }),
  ph("UPSET.evidence.1", "A", "evidence", "Fair, but a {{winnerProbabilityPct}}% shot landing is exactly why we call it an upset, {{stake}} points on the line as well.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("UPSET.close.1", "B", "disagree_close", "Model can recalculate — {{winnerName}} just made it look easy.", "positive", { requires: UPSET_REQUIRES }),

ph("UPSET.qf.2", "A", "quick_fact", "Not many saw that — {{winnerName}} gets past {{loserName}} for {{stake}} points despite going in at only {{winnerProbabilityPct}}%.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("UPSET.qf.3", "A", "quick_fact", "{{winnerName}} over {{loserName}} for {{stake}} points — the pre-match number on {{winnerName}} was just {{winnerProbabilityPct}}%.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("UPSET.qr.2", "B", "quick_reaction", "Well, that's turned the evening upside down.", "neutral", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("UPSET.qr.3", "B", "quick_reaction", "{{loserName}} walked in as the fancied one — walks off with a different story altogether.", "neutral", { requires: UPSET_REQUIRES }),
ph("UPSET.model.2", "A", "model_context", "Pre-match, {{winnerName}} was rated at just {{winnerProbabilityPct}}% to get past {{loserName}}.", "neutral", { requires: UPSET_REQUIRES }),
ph("UPSET.model.3", "A", "model_context", "The number on {{winnerName}} coming in was {{winnerProbabilityPct}}% — {{loserName}} was the clear favourite on paper.", "neutral", { requires: UPSET_REQUIRES }),
ph("UPSET.contrary.2", "B", "contrary_opinion", "I'll take the eye test over a percentage every time — {{winnerName}} looked sharp warming up.", "positive", { requires: UPSET_REQUIRES }),
ph("UPSET.contrary.3", "B", "contrary_opinion", "{{winnerProbabilityPct}}% doesn't account for how {{winnerName}} handles the big stage.", "positive", { requires: UPSET_REQUIRES }),
ph("UPSET.contrary.4", "B", "contrary_opinion", "Models don't throw the darts, do they — {{winnerName}} does, and did it well enough tonight.", "positive", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("UPSET.evidence.2", "A", "evidence", "A {{winnerProbabilityPct}}% chance is still a real chance — it just doesn't land this often, and tonight it did, for {{stake}} points.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("UPSET.evidence.3", "A", "evidence", "Eye test aside, {{winnerProbabilityPct}}% shots come off rarely enough that we still call this one an upset — {{stake}} points too.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("UPSET.evidence.4", "A", "evidence", "You can like {{winnerName}}'s chances all you want — the model still only gave that {{winnerProbabilityPct}}%, with {{stake}} points changing hands to show for it.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("UPSET.close.2", "B", "disagree_close", "Call it what you like — I'm just glad I backed {{winnerName}} in my head.", "positive", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("UPSET.close.3", "B", "disagree_close", "{{loserName}} will get another crack at it — tonight belonged to {{winnerName}}.", "positive", { requires: UPSET_REQUIRES }),
];

const MAJOR_UPSET_PHRASES: Phrase[] = [
  ph("MAJOR_UPSET.qf.1", "A", "quick_fact", "A major upset — {{winnerName}} was rated only {{winnerProbabilityPct}}% to beat {{loserName}}, and did it anyway for {{stake}} points.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("MAJOR_UPSET.qr.1", "B", "quick_reaction", "That's a proper shock, that. {{loserName}} won't enjoy watching that back.", "neutral", { requires: UPSET_REQUIRES, tone: "humour" }),
  ph("MAJOR_UPSET.model.1", "A", "model_context", "The model had {{loserName}} winning this comfortably — {{winnerName}} at just {{winnerProbabilityPct}}%.", "neutral", { requires: UPSET_REQUIRES }),
  ph("MAJOR_UPSET.contrary.1", "B", "contrary_opinion", "The model doesn't watch {{winnerName}} throw under pressure — I do, and I'm not remotely stunned.", "positive", { requires: UPSET_REQUIRES }),
  ph("MAJOR_UPSET.evidence.1", "A", "evidence", "Under 25% and it landed regardless — with {{stake}} points at stake too, that's a genuinely big result.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("MAJOR_UPSET.close.1", "B", "disagree_close", "Stick that one on the highlights reel.", "positive", { requires: UPSET_REQUIRES, tone: "personality" }),

ph("MAJOR_UPSET.qf.2", "A", "quick_fact", "A major upset on our hands — {{loserName}} was the strong favourite, but {{winnerName}} got the job done for {{stake}} points at just {{winnerProbabilityPct}}%.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MAJOR_UPSET.qf.3", "A", "quick_fact", "{{winnerName}} produces a big result worth {{stake}} points — only {{winnerProbabilityPct}}% to win this one, according to the model.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MAJOR_UPSET.qr.2", "B", "quick_reaction", "That is a proper turn-up — {{winnerName}} deserves every bit of that.", "positive", { requires: UPSET_REQUIRES, tone: "personality" }),
ph("MAJOR_UPSET.qr.3", "B", "quick_reaction", "{{loserName}} will be replaying that match in their head for a while.", "negative", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("MAJOR_UPSET.model.2", "A", "model_context", "{{winnerName}} came in at just {{winnerProbabilityPct}}% — one of the more lopsided numbers we've flagged tonight.", "neutral", { requires: UPSET_REQUIRES }),
ph("MAJOR_UPSET.model.3", "A", "model_context", "That's a heavy underdog tag — {{winnerProbabilityPct}}% for {{winnerName}} against {{loserName}}.", "neutral", { requires: UPSET_REQUIRES }),
ph("MAJOR_UPSET.contrary.2", "B", "contrary_opinion", "Big occasions bring out a different side of {{winnerName}} — the model can't measure nerve.", "positive", { requires: UPSET_REQUIRES }),
ph("MAJOR_UPSET.contrary.3", "B", "contrary_opinion", "I had a feeling about this one — {{winnerName}}'s been building to a night like this.", "positive", { requires: UPSET_REQUIRES }),
ph("MAJOR_UPSET.contrary.4", "B", "contrary_opinion", "{{loserName}} had the number on paper, not on the board — that's the only number that counts.", "positive", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("MAJOR_UPSET.evidence.2", "A", "evidence", "Feelings aside, {{winnerProbabilityPct}}% shots landing with {{stake}} points on the table is precisely why this counts as a major upset.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MAJOR_UPSET.evidence.3", "A", "evidence", "Building to it or not, the model still only gave {{winnerName}} {{winnerProbabilityPct}}% — and {{stake}} points just moved because of it.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MAJOR_UPSET.evidence.4", "A", "evidence", "Nerve is real, but so is a {{winnerProbabilityPct}}% numbers gap — this is a genuinely big result, {{stake}} points and all.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MAJOR_UPSET.close.2", "B", "disagree_close", "Somebody get {{winnerName}} a replay button, because that deserves one.", "positive", { requires: UPSET_REQUIRES, tone: "personality" }),
ph("MAJOR_UPSET.close.3", "B", "disagree_close", "{{loserName}} won't want to watch that back tonight.", "negative", { requires: UPSET_REQUIRES }),
];

const MODEL_SHOCK_PHRASES: Phrase[] = [
  ph("MODEL_SHOCK.qf.1", "A", "quick_fact", "That is a genuine model shock — {{winnerName}} was given only {{winnerProbabilityPct}}% against {{loserName}}, and takes {{stake}} points for it.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("MODEL_SHOCK.qr.1", "B", "quick_reaction", "Even I didn't have {{winnerName}} winning that one, and I back the underdog most weeks.", "neutral", { requires: UPSET_REQUIRES, tone: "humour" }),
  ph("MODEL_SHOCK.model.1", "A", "model_context", "Sub-15% for {{winnerName}} pre-match — about as heavy an underdog tag as the model hands out.", "neutral", { requires: UPSET_REQUIRES }),
  ph("MODEL_SHOCK.contrary.1", "B", "contrary_opinion", "This is exactly why you don't play the percentages against a player who fancies the big occasion.", "positive", { requires: UPSET_REQUIRES }),
  ph("MODEL_SHOCK.evidence.1", "A", "evidence", "Fifteen percent, beaten — with {{stake}} points changing hands, the model will be recalculating tonight.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
  ph("MODEL_SHOCK.close.1", "B", "disagree_close", "Sometimes the board doesn't care what the model says.", "positive", { requires: UPSET_REQUIRES, tone: "personality", distinctive: true }),

ph("MODEL_SHOCK.qf.2", "A", "quick_fact", "About as extreme a result as the model produces — {{winnerName}} at just {{winnerProbabilityPct}}%, and {{loserName}} beaten anyway for {{stake}} points.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MODEL_SHOCK.qf.3", "A", "quick_fact", "{{winnerName}} defies the model completely tonight, rated at only {{winnerProbabilityPct}}% against {{loserName}}, banking {{stake}} points regardless.", "positive", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MODEL_SHOCK.qr.2", "B", "quick_reaction", "That's about as shocked as I've been all season.", "neutral", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("MODEL_SHOCK.qr.3", "B", "quick_reaction", "{{loserName}} will be picking through that one for weeks.", "negative", { requires: UPSET_REQUIRES }),
ph("MODEL_SHOCK.model.2", "A", "model_context", "{{winnerProbabilityPct}}% for {{winnerName}} — right down among the biggest gaps the model has flagged this season.", "neutral", { requires: UPSET_REQUIRES }),
ph("MODEL_SHOCK.model.3", "A", "model_context", "The model rated {{loserName}} the overwhelming favourite here — {{winnerName}} at just {{winnerProbabilityPct}}%.", "neutral", { requires: UPSET_REQUIRES }),
ph("MODEL_SHOCK.contrary.2", "B", "contrary_opinion", "The board doesn't read percentages, and neither does {{winnerName}} apparently.", "positive", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("MODEL_SHOCK.contrary.3", "B", "contrary_opinion", "Give me a player who fancies himself over a model every single time.", "positive", { requires: UPSET_REQUIRES }),
ph("MODEL_SHOCK.contrary.4", "B", "contrary_opinion", "{{winnerName}} clearly didn't get the memo about being a {{winnerProbabilityPct}}% shot.", "positive", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("MODEL_SHOCK.evidence.2", "A", "evidence", "Funny or not, {{winnerProbabilityPct}}% landing with {{stake}} points on the line is exactly what makes this a genuine model shock.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MODEL_SHOCK.evidence.3", "A", "evidence", "Memo or no memo, that gap was real — {{stake}} points just moved on the back of a {{winnerProbabilityPct}}% shot.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MODEL_SHOCK.evidence.4", "A", "evidence", "Fancying yourself is one thing — beating {{winnerProbabilityPct}}% odds with {{stake}} points at stake is another entirely.", "neutral", { requires: [...UPSET_REQUIRES, "stake"] }),
ph("MODEL_SHOCK.close.2", "B", "disagree_close", "Send the model our love — it's going to need a quiet word with itself.", "positive", { requires: UPSET_REQUIRES, tone: "humour" }),
ph("MODEL_SHOCK.close.3", "B", "disagree_close", "Nights like that are exactly why we watch.", "positive", { requires: UPSET_REQUIRES, tone: "personality" }),
];

const HIGH_STAKE_WIN_REQUIRES = ["winnerId", "loserId", "stake"];
const HIGH_STAKE_WIN_PHRASES: Phrase[] = [
  ph("HIGH_STAKE_WIN.qf.1", "A", "quick_fact", "{{winnerName}} takes {{stake}} points off {{loserName}} — one of the bigger hauls of the night.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
  ph("HIGH_STAKE_WIN.qr.1", "B", "quick_reaction", "That's a proper points swing for {{winnerName}}.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
  ph("HIGH_STAKE_WIN.fact.1", "A", "fact", "{{winnerName}} beats {{loserName}} for {{stake}} points, comfortably above the usual stake on a night like this.", "positive", { requires: [...HIGH_STAKE_WIN_REQUIRES, "highStakeThreshold"] }),
  ph("HIGH_STAKE_WIN.reaction.1", "B", "reaction", "You take those points whenever they're on the table.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
  ph("HIGH_STAKE_WIN.context.1", "A", "context", "That result alone could shift things further up the table.", "neutral", { requires: HIGH_STAKE_WIN_REQUIRES }),
  ph("HIGH_STAKE_WIN.closer.1", "B", "closer", "{{loserName}} will feel that one for a while.", "neutral", { requires: HIGH_STAKE_WIN_REQUIRES }),

ph("HIGH_STAKE_WIN.qf.2", "A", "quick_fact", "{{winnerName}} banks {{stake}} points against {{loserName}} — a big one to bank at this stage of the season.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.qf.3", "A", "quick_fact", "{{stake}} points to {{winnerName}} tonight, at {{loserName}}'s expense — that's a serious swing.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.qr.2", "B", "quick_reaction", "{{winnerName}} picked the right night to play well.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.qr.3", "B", "quick_reaction", "You don't turn down {{stake}} points, do you.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES, tone: "humour" }),
ph("HIGH_STAKE_WIN.fact.2", "A", "fact", "{{stake}} points changes hands here — well above the average stake for a match like this one.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.fact.3", "A", "fact", "{{winnerName}} leaves with {{stake}} points, comfortably the biggest haul on tonight's card so far.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.reaction.2", "B", "reaction", "That's the sort of result that changes a whole conversation about {{winnerName}}.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.reaction.3", "B", "reaction", "Credit to {{winnerName}} for delivering when the points actually mattered.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.context.2", "A", "context", "A haul like {{stake}} points has real weight further up the table too.", "neutral", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.context.3", "A", "context", "Results with this much on the line tend to be remembered later in the season.", "neutral", { requires: HIGH_STAKE_WIN_REQUIRES }),
ph("HIGH_STAKE_WIN.closer.2", "B", "closer", "Take that and move on quickly, {{winnerName}}.", "positive", { requires: HIGH_STAKE_WIN_REQUIRES, tone: "humour" }),
ph("HIGH_STAKE_WIN.closer.3", "B", "closer", "{{loserName}} will need to shake that one off fast.", "neutral", { requires: HIGH_STAKE_WIN_REQUIRES }),
];

const HIGH_STAKE_LOSS_REQUIRES = ["winnerId", "loserId", "stake"];
const HIGH_STAKE_LOSS_PHRASES: Phrase[] = [
  ph("HIGH_STAKE_LOSS.qf.1", "A", "quick_fact", "{{loserName}} drops {{stake}} points to {{winnerName}} — a costly night for a contender.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
  ph("HIGH_STAKE_LOSS.qr.1", "B", "quick_reaction", "That's the kind of loss that lingers in a title race.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
  ph("HIGH_STAKE_LOSS.fact.1", "A", "fact", "{{stake}} points is well above the usual stake — {{loserName}} will feel that loss in the table.", "negative", { requires: [...HIGH_STAKE_LOSS_REQUIRES, "highStakeThreshold"] }),
  ph("HIGH_STAKE_LOSS.reaction.1", "B", "reaction", "Credit to {{winnerName}} for taking full advantage of the occasion.", "positive", { requires: HIGH_STAKE_LOSS_REQUIRES }),
  ph("HIGH_STAKE_LOSS.context.1", "A", "context", "That's the sort of result that can reshape a run-in.", "neutral", { requires: HIGH_STAKE_LOSS_REQUIRES }),
  ph("HIGH_STAKE_LOSS.closer.1", "B", "closer", "Onwards for {{loserName}} — plenty of season left.", "neutral", { requires: HIGH_STAKE_LOSS_REQUIRES }),

ph("HIGH_STAKE_LOSS.qf.2", "A", "quick_fact", "{{loserName}} on the wrong end of a {{stake}}-point result tonight, beaten by {{winnerName}}.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.qf.3", "A", "quick_fact", "A big one to lose — {{stake}} points go to {{winnerName}} at {{loserName}}'s expense.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.qr.2", "B", "quick_reaction", "That's a painful one for {{loserName}} to take.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.qr.3", "B", "quick_reaction", "Losses don't come much heavier than that one at this stage.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.fact.2", "A", "fact", "{{stake}} points is a significant haul to give up — {{loserName}} will feel that in the table.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.fact.3", "A", "fact", "That's {{loserName}} handing over {{stake}} points on a night they needed the opposite.", "negative", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.reaction.2", "B", "reaction", "{{winnerName}} took that chance with both hands.", "positive", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.reaction.3", "B", "reaction", "Full marks to {{winnerName}} for making the most of it.", "positive", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.context.2", "A", "context", "A result like that can ripple through the whole run-in.", "neutral", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.context.3", "A", "context", "That's the kind of stake swing that tends to matter later in the season.", "neutral", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.closer.2", "B", "closer", "Plenty of season left for {{loserName}} to put that right.", "neutral", { requires: HIGH_STAKE_LOSS_REQUIRES }),
ph("HIGH_STAKE_LOSS.closer.3", "B", "closer", "Move on quickly is the only way after one like that.", "neutral", { requires: HIGH_STAKE_LOSS_REQUIRES }),
];

const ELIMINATION_REQUIRES = ["winnerId", "loserId"];
const ELIMINATION_PHRASES: Phrase[] = [
  ph("ELIMINATION.qf.1", "A", "quick_fact", "That's it for {{loserName}} — eliminated after this {{stake}}-point loss to {{winnerName}}.", "negative", { requires: [...ELIMINATION_REQUIRES, "stake"] }),
  ph("ELIMINATION.qr.1", "B", "quick_reaction", "Tough way to go out, that.", "negative", { requires: ELIMINATION_REQUIRES }),
  ph("ELIMINATION.fact.1", "A", "fact", "{{loserName}}'s run comes to an end, beaten by {{winnerName}} for {{stake}} points.", "negative", { requires: [...ELIMINATION_REQUIRES, "stake"] }),
  ph("ELIMINATION.reaction.1", "B", "reaction", "Every campaign ends somewhere — at least {{loserName}} goes down fighting.", "neutral", { requires: ELIMINATION_REQUIRES }),
  ph("ELIMINATION.context.1", "A", "context", "That result also has knock-on effects further up the standings.", "neutral", { requires: ELIMINATION_REQUIRES }),
  ph("ELIMINATION.closer.1", "B", "closer", "Chin up, {{loserName}} — there's always next season.", "neutral", { requires: ELIMINATION_REQUIRES }),

ph("ELIMINATION.qf.2", "A", "quick_fact", "{{loserName}}'s campaign is over — {{winnerName}} the one to close it out, taking {{stake}} points in the process.", "negative", { requires: [...ELIMINATION_REQUIRES, "stake"] }),
ph("ELIMINATION.qf.3", "A", "quick_fact", "That's the end of the road for {{loserName}}, beaten by {{winnerName}} for {{stake}} points.", "negative", { requires: [...ELIMINATION_REQUIRES, "stake"] }),
ph("ELIMINATION.qr.2", "B", "quick_reaction", "Hard way to see a season come to a close.", "negative", { requires: ELIMINATION_REQUIRES }),
ph("ELIMINATION.qr.3", "B", "quick_reaction", "{{loserName}} gave it a real go, credit to them.", "neutral", { requires: ELIMINATION_REQUIRES }),
ph("ELIMINATION.fact.2", "A", "fact", "{{loserName}}'s involvement ends here, beaten by {{winnerName}} on the night.", "negative", { requires: ELIMINATION_REQUIRES }),
ph("ELIMINATION.fact.3", "A", "fact", "That result confirms {{loserName}} is done for this run, {{winnerName}} the one who ended it.", "negative", { requires: ELIMINATION_REQUIRES }),
ph("ELIMINATION.reaction.2", "B", "reaction", "Not every campaign gets a happy ending — {{loserName}}'s stops here.", "neutral", { requires: ELIMINATION_REQUIRES }),
ph("ELIMINATION.reaction.3", "B", "reaction", "{{winnerName}} didn't do {{loserName}} any favours there.", "neutral", { requires: ELIMINATION_REQUIRES, tone: "humour" }),
ph("ELIMINATION.context.2", "A", "context", "That result reshapes what's left further up the bracket too.", "neutral", { requires: ELIMINATION_REQUIRES }),
ph("ELIMINATION.context.3", "A", "context", "Eliminations like that tend to open the door for somebody else.", "neutral", { requires: ELIMINATION_REQUIRES }),
ph("ELIMINATION.closer.2", "B", "closer", "Head up, {{loserName}} — plenty to build on from this one.", "neutral", { requires: ELIMINATION_REQUIRES }),
ph("ELIMINATION.closer.3", "B", "closer", "That's a wrap on {{loserName}}'s night, and their run.", "neutral", { requires: ELIMINATION_REQUIRES }),
];

const LEADER_BEATEN_REQUIRES = ["winnerId", "loserId", "leaderPointsBefore"];
const LEADER_BEATEN_PHRASES: Phrase[] = [
  ph("LEADER_BEATEN.qf.1", "A", "quick_fact", "The points leader falls — {{winnerName}} takes {{stake}} points off {{loserName}}, who came in leading on {{leaderPointsBefore}}.", "positive", { requires: [...LEADER_BEATEN_REQUIRES, "stake"] }),
  ph("LEADER_BEATEN.qr.1", "B", "quick_reaction", "Nobody's untouchable at the top, are they.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
  ph("LEADER_BEATEN.fact.1", "A", "fact", "{{loserName}} led the way on {{leaderPointsBefore}} points coming in, but {{winnerName}} has beaten them for {{stake}} points regardless.", "positive", { requires: [...LEADER_BEATEN_REQUIRES, "stake"] }),
  ph("LEADER_BEATEN.reaction.1", "B", "reaction", "Every leader gets tested eventually — that's the one for {{loserName}}.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
  ph("LEADER_BEATEN.context.1", "A", "context", "That result puts the whole top of the table back in play.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
  ph("LEADER_BEATEN.closer.1", "B", "closer", "Suddenly it's a race again.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),

ph("LEADER_BEATEN.qf.2", "A", "quick_fact", "{{winnerName}} gets the better of {{loserName}} for {{stake}} points, who arrived at the top on {{leaderPointsBefore}} points.", "positive", { requires: [...LEADER_BEATEN_REQUIRES, "stake"] }),
ph("LEADER_BEATEN.qf.3", "A", "quick_fact", "The table topper falls tonight — {{loserName}} beaten by {{winnerName}} for {{stake}} points despite {{leaderPointsBefore}} points to their name.", "positive", { requires: [...LEADER_BEATEN_REQUIRES, "stake"] }),
ph("LEADER_BEATEN.qr.2", "B", "quick_reaction", "That's a real statement from {{winnerName}}.", "positive", { requires: LEADER_BEATEN_REQUIRES }),
ph("LEADER_BEATEN.qr.3", "B", "quick_reaction", "Even the top of the table isn't safe tonight.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
ph("LEADER_BEATEN.fact.2", "A", "fact", "{{leaderPointsBefore}} points and top of the pile — none of it mattered against {{winnerName}} tonight, who leaves with {{stake}} points more.", "positive", { requires: [...LEADER_BEATEN_REQUIRES, "stake"] }),
ph("LEADER_BEATEN.fact.3", "A", "fact", "That's the league leader beaten, {{loserName}}'s {{leaderPointsBefore}} points doing nothing to stop {{winnerName}} taking {{stake}} points.", "positive", { requires: [...LEADER_BEATEN_REQUIRES, "stake"] }),
ph("LEADER_BEATEN.reaction.2", "B", "reaction", "Good to be reminded nobody's just cruising to the title.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
ph("LEADER_BEATEN.reaction.3", "B", "reaction", "{{winnerName}} will remember that result for a while.", "positive", { requires: LEADER_BEATEN_REQUIRES }),
ph("LEADER_BEATEN.context.2", "A", "context", "Results like that keep the whole league honest.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
ph("LEADER_BEATEN.context.3", "A", "context", "That's exactly the sort of upset that reshapes the run-in at the top.", "neutral", { requires: LEADER_BEATEN_REQUIRES }),
ph("LEADER_BEATEN.closer.2", "B", "closer", "Bet {{loserName}} wasn't expecting that one.", "neutral", { requires: LEADER_BEATEN_REQUIRES, tone: "humour" }),
ph("LEADER_BEATEN.closer.3", "B", "closer", "Table's wide open again, isn't it.", "positive", { requires: LEADER_BEATEN_REQUIRES }),
];

const STREAK_BREAKER_REQUIRES = ["winnerId", "loserId", "brokenWinStreak"];
const STREAK_BREAKER_PHRASES: Phrase[] = [
  ph("STREAK_BREAKER.qf.1", "A", "quick_fact", "{{winnerName}} ends {{loserName}}'s run of {{brokenWinStreak}} straight wins, taking {{stake}} points in the process.", "positive", { requires: [...STREAK_BREAKER_REQUIRES, "stake"] }),
  ph("STREAK_BREAKER.qr.1", "B", "quick_reaction", "Every streak ends somewhere — credit to {{winnerName}} for being the one to do it.", "positive", { requires: STREAK_BREAKER_REQUIRES }),
  ph("STREAK_BREAKER.fact.1", "A", "fact", "That's {{brokenWinStreak}} consecutive wins for {{loserName}} brought to a close by {{winnerName}}, {{stake}} points changing hands with it.", "positive", { requires: [...STREAK_BREAKER_REQUIRES, "stake"] }),
  ph("STREAK_BREAKER.reaction.1", "B", "reaction", "Takes some nerve to be the one who steps in and stops that.", "positive", { requires: STREAK_BREAKER_REQUIRES }),
  ph("STREAK_BREAKER.context.1", "A", "context", "A run like that was always going to end eventually — question now is how {{loserName}} responds.", "neutral", { requires: STREAK_BREAKER_REQUIRES }),
  ph("STREAK_BREAKER.closer.1", "B", "closer", "Good while it lasted, {{loserName}}.", "neutral", { requires: STREAK_BREAKER_REQUIRES }),

ph("STREAK_BREAKER.qf.2", "A", "quick_fact", "{{loserName}}'s run of {{brokenWinStreak}} straight wins is over, {{winnerName}} the one to end it and pocket {{stake}} points.", "positive", { requires: [...STREAK_BREAKER_REQUIRES, "stake"] }),
ph("STREAK_BREAKER.qf.3", "A", "quick_fact", "{{winnerName}} stops {{loserName}} right on {{brokenWinStreak}} consecutive wins, for {{stake}} points.", "positive", { requires: [...STREAK_BREAKER_REQUIRES, "stake"] }),
ph("STREAK_BREAKER.qr.2", "B", "quick_reaction", "Somebody had to do it eventually.", "neutral", { requires: STREAK_BREAKER_REQUIRES, tone: "humour" }),
ph("STREAK_BREAKER.qr.3", "B", "quick_reaction", "That run had to end sometime — still, well played {{winnerName}}.", "positive", { requires: STREAK_BREAKER_REQUIRES }),
ph("STREAK_BREAKER.fact.2", "A", "fact", "{{brokenWinStreak}} in a row for {{loserName}}, snapped by {{winnerName}} tonight for {{stake}} points.", "positive", { requires: [...STREAK_BREAKER_REQUIRES, "stake"] }),
ph("STREAK_BREAKER.fact.3", "A", "fact", "That's {{winnerName}} bringing {{loserName}}'s {{brokenWinStreak}}-match run to a close, {{stake}} points the reward.", "positive", { requires: [...STREAK_BREAKER_REQUIRES, "stake"] }),
ph("STREAK_BREAKER.reaction.2", "B", "reaction", "Not an easy thing, walking in and being the one who stops that.", "positive", { requires: STREAK_BREAKER_REQUIRES }),
ph("STREAK_BREAKER.reaction.3", "B", "reaction", "{{winnerName}} will fancy that as a big one to have on the resume.", "positive", { requires: STREAK_BREAKER_REQUIRES, tone: "personality" }),
ph("STREAK_BREAKER.context.2", "A", "context", "How {{loserName}} responds from here says a lot about the rest of their season.", "neutral", { requires: STREAK_BREAKER_REQUIRES }),
ph("STREAK_BREAKER.context.3", "A", "context", "Streaks like that always draw extra attention once they're gone.", "neutral", { requires: STREAK_BREAKER_REQUIRES }),
ph("STREAK_BREAKER.closer.2", "B", "closer", "All good runs end somewhere, {{loserName}}.", "neutral", { requires: STREAK_BREAKER_REQUIRES }),
ph("STREAK_BREAKER.closer.3", "B", "closer", "Back to zero, but no shame in a run like that.", "neutral", { requires: STREAK_BREAKER_REQUIRES }),
];

const DROUGHT_ENDED_REQUIRES = ["winnerId", "loserId", "endedLossStreak"];
const DROUGHT_ENDED_PHRASES: Phrase[] = [
  ph("DROUGHT_ENDED.qf.1", "A", "quick_fact", "{{winnerName}} finally back in the win column, ending a run of {{endedLossStreak}} straight losses with a {{stake}}-point win.", "positive", { requires: [...DROUGHT_ENDED_REQUIRES, "stake"] }),
  ph("DROUGHT_ENDED.qr.1", "B", "quick_reaction", "About time — you could see that one coming for a couple of weeks.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
  ph("DROUGHT_ENDED.perf.1", "A", "performance_fact", "{{endedLossStreak}} losses on the spin, snapped tonight against {{loserName}} for {{stake}} points.", "positive", { requires: [...DROUGHT_ENDED_REQUIRES, "stake"] }),
  ph("DROUGHT_ENDED.credit.1", "B", "credit", "Credit where it's due — that's not an easy run to break out of.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
  ph("DROUGHT_ENDED.consequence.1", "A", "consequence", "A result like that can turn a season back around.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),

ph("DROUGHT_ENDED.qf.2", "A", "quick_fact", "{{winnerName}} snaps a run of {{endedLossStreak}} straight losses with a {{stake}}-point win over {{loserName}}.", "positive", { requires: [...DROUGHT_ENDED_REQUIRES, "stake"] }),
ph("DROUGHT_ENDED.qf.3", "A", "quick_fact", "That's {{winnerName}} back in the winner's circle after {{endedLossStreak}} defeats on the spin, {{stake}} points to show for it.", "positive", { requires: [...DROUGHT_ENDED_REQUIRES, "stake"] }),
ph("DROUGHT_ENDED.qr.2", "B", "quick_reaction", "You could see the relief from here.", "positive", { requires: DROUGHT_ENDED_REQUIRES, tone: "humour" }),
ph("DROUGHT_ENDED.qr.3", "B", "quick_reaction", "Good to see {{winnerName}} get that one over the line.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
ph("DROUGHT_ENDED.perf.2", "A", "performance_fact", "{{endedLossStreak}} straight losses, ended tonight against {{loserName}} with {{stake}} points banked.", "positive", { requires: [...DROUGHT_ENDED_REQUIRES, "stake"] }),
ph("DROUGHT_ENDED.perf.3", "A", "performance_fact", "A run of {{endedLossStreak}} without a win for {{winnerName}}, now firmly behind them after a {{stake}}-point win.", "positive", { requires: [...DROUGHT_ENDED_REQUIRES, "stake"] }),
ph("DROUGHT_ENDED.credit.2", "B", "credit", "Takes character to keep turning up through a run like that.", "positive", { requires: DROUGHT_ENDED_REQUIRES, tone: "personality" }),
ph("DROUGHT_ENDED.credit.3", "B", "credit", "{{winnerName}} deserves that one after the run they've had.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
ph("DROUGHT_ENDED.consequence.2", "A", "consequence", "Breaking a run like that can lift a whole season.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
ph("DROUGHT_ENDED.consequence.3", "A", "consequence", "That's the sort of win {{winnerName}} can build some momentum from.", "positive", { requires: DROUGHT_ENDED_REQUIRES }),
];

const FIRST_H2H_WIN_REQUIRES = ["winnerId", "loserId", "priorLossesToThisOpponent"];
const FIRST_H2H_WIN_PHRASES: Phrase[] = [
  ph("FIRST_H2H_WIN.qf.1", "A", "quick_fact", "{{winnerName}} finally gets past {{loserName}} for {{stake}} points, ending a run of {{priorLossesToThisOpponent}} straight losses in this head-to-head.", "positive", { requires: [...FIRST_H2H_WIN_REQUIRES, "stake"] }),
  ph("FIRST_H2H_WIN.qr.1", "B", "quick_reaction", "That head-to-head has been one-way traffic — good to see {{winnerName}} finally get over the line.", "positive", { requires: FIRST_H2H_WIN_REQUIRES }),
  ph("FIRST_H2H_WIN.fact.1", "A", "fact", "{{winnerName}} had lost {{priorLossesToThisOpponent}} in a row to {{loserName}} before tonight's {{stake}}-point win.", "positive", { requires: [...FIRST_H2H_WIN_REQUIRES, "stake"] }),
  ph("FIRST_H2H_WIN.reaction.1", "B", "reaction", "That's a real monkey off the back for {{winnerName}}.", "positive", { requires: FIRST_H2H_WIN_REQUIRES, tone: "humour" }),
  ph("FIRST_H2H_WIN.context.1", "A", "context", "Whether that changes the pattern of this rivalry is one to watch.", "neutral", { requires: FIRST_H2H_WIN_REQUIRES }),
  ph("FIRST_H2H_WIN.closer.1", "B", "closer", "{{loserName}} won't want a rematch any time soon.", "neutral", { requires: FIRST_H2H_WIN_REQUIRES }),

ph("FIRST_H2H_WIN.qf.2", "A", "quick_fact", "{{winnerName}} gets past {{loserName}} at last for {{stake}} points, after {{priorLossesToThisOpponent}} straight losses in this matchup.", "positive", { requires: [...FIRST_H2H_WIN_REQUIRES, "stake"] }),
ph("FIRST_H2H_WIN.qf.3", "A", "quick_fact", "{{priorLossesToThisOpponent}} losses in a row to {{loserName}}, and {{winnerName}} finally turns it around for {{stake}} points.", "positive", { requires: [...FIRST_H2H_WIN_REQUIRES, "stake"] }),
ph("FIRST_H2H_WIN.qr.2", "B", "quick_reaction", "That's been a long time coming for {{winnerName}}.", "positive", { requires: FIRST_H2H_WIN_REQUIRES }),
ph("FIRST_H2H_WIN.qr.3", "B", "quick_reaction", "{{loserName}}'s hold on that matchup just ended.", "neutral", { requires: FIRST_H2H_WIN_REQUIRES }),
ph("FIRST_H2H_WIN.fact.2", "A", "fact", "{{priorLossesToThisOpponent}} consecutive losses to {{loserName}} before tonight's {{stake}}-point result.", "positive", { requires: [...FIRST_H2H_WIN_REQUIRES, "stake"] }),
ph("FIRST_H2H_WIN.fact.3", "A", "fact", "{{winnerName}} hadn't beaten {{loserName}} in {{priorLossesToThisOpponent}} attempts before tonight's {{stake}}-point win.", "positive", { requires: [...FIRST_H2H_WIN_REQUIRES, "stake"] }),
ph("FIRST_H2H_WIN.reaction.2", "B", "reaction", "Every one of those {{priorLossesToThisOpponent}} losses will have made that one taste sweeter.", "positive", { requires: FIRST_H2H_WIN_REQUIRES }),
ph("FIRST_H2H_WIN.reaction.3", "B", "reaction", "About time {{winnerName}} got one back in that matchup.", "positive", { requires: FIRST_H2H_WIN_REQUIRES, tone: "humour" }),
ph("FIRST_H2H_WIN.context.2", "A", "context", "Whether this becomes the new pattern between them is one for the next meeting.", "neutral", { requires: FIRST_H2H_WIN_REQUIRES }),
ph("FIRST_H2H_WIN.context.3", "A", "context", "A head-to-head that lopsided doesn't flip on paper — it took an actual result.", "neutral", { requires: FIRST_H2H_WIN_REQUIRES }),
ph("FIRST_H2H_WIN.closer.2", "B", "closer", "{{winnerName}} will want a rematch as soon as possible.", "positive", { requires: FIRST_H2H_WIN_REQUIRES }),
ph("FIRST_H2H_WIN.closer.3", "B", "closer", "That's one {{loserName}} will want to put right quickly.", "neutral", { requires: FIRST_H2H_WIN_REQUIRES }),
];

const REVENGE_REQUIRES = ["winnerId", "loserId", "consecutivePriorLosses"];
const REVENGE_PHRASES: Phrase[] = [
  ph("REVENGE.qf.1", "A", "quick_fact", "{{winnerName}} turns the tables on {{loserName}} for {{stake}} points, reversing their last meeting.", "positive", { requires: [...REVENGE_REQUIRES, "stake"] }),
  ph("REVENGE.qr.1", "B", "quick_reaction", "Sweet result for {{winnerName}}, that.", "positive", { requires: REVENGE_REQUIRES }),
  ph("REVENGE.fact.1", "A", "fact", "{{winnerName}} had lost {{consecutivePriorLosses}} straight to {{loserName}} before turning it around tonight for {{stake}} points.", "positive", { requires: [...REVENGE_REQUIRES, "stake"] }),
  ph("REVENGE.reaction.1", "B", "reaction", "You wait for that one, don't you.", "positive", { requires: REVENGE_REQUIRES }),
  ph("REVENGE.context.1", "A", "context", "A meaningful reversal given how one-sided this fixture has been.", "neutral", { requires: REVENGE_REQUIRES }),
  ph("REVENGE.closer.1", "B", "closer", "{{loserName}} will want that one back.", "neutral", { requires: REVENGE_REQUIRES }),

ph("REVENGE.qf.2", "A", "quick_fact", "{{winnerName}} gets one back on {{loserName}} for {{stake}} points after {{consecutivePriorLosses}} losses in a row to them.", "positive", { requires: [...REVENGE_REQUIRES, "stake"] }),
ph("REVENGE.qf.3", "A", "quick_fact", "Payback for {{winnerName}} tonight, worth {{stake}} points, reversing a run of {{consecutivePriorLosses}} straight losses to {{loserName}}.", "positive", { requires: [...REVENGE_REQUIRES, "stake"] }),
ph("REVENGE.qr.2", "B", "quick_reaction", "That one will have felt good.", "positive", { requires: REVENGE_REQUIRES }),
ph("REVENGE.qr.3", "B", "quick_reaction", "{{loserName}} won't have enjoyed watching that.", "neutral", { requires: REVENGE_REQUIRES, tone: "humour" }),
ph("REVENGE.fact.2", "A", "fact", "{{consecutivePriorLosses}} straight defeats to {{loserName}}, put right by {{winnerName}} tonight for {{stake}} points.", "positive", { requires: [...REVENGE_REQUIRES, "stake"] }),
ph("REVENGE.fact.3", "A", "fact", "{{winnerName}} hadn't beaten {{loserName}} across their last {{consecutivePriorLosses}} meetings — until now, and for {{stake}} points.", "positive", { requires: [...REVENGE_REQUIRES, "stake"] }),
ph("REVENGE.reaction.2", "B", "reaction", "That's the sort of result that changes how a rivalry feels.", "positive", { requires: REVENGE_REQUIRES }),
ph("REVENGE.reaction.3", "B", "reaction", "Every one of those losses makes tonight count for a bit more.", "positive", { requires: REVENGE_REQUIRES }),
ph("REVENGE.context.2", "A", "context", "One result doesn't erase {{consecutivePriorLosses}} losses, but it changes the conversation.", "neutral", { requires: REVENGE_REQUIRES }),
ph("REVENGE.context.3", "A", "context", "Worth watching whether {{winnerName}} can build on that the next time these two meet.", "neutral", { requires: REVENGE_REQUIRES }),
ph("REVENGE.closer.2", "B", "closer", "{{loserName}} will want that one back sharpish.", "neutral", { requires: REVENGE_REQUIRES }),
ph("REVENGE.closer.3", "B", "closer", "Turns out {{winnerName}} just needed the right night.", "positive", { requires: REVENGE_REQUIRES, tone: "personality" }),
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

ph("WIN_STREAK.qf.2", "A", "quick_fact", "{{playerName}} has won {{currentWinStreak}} in a row now — that run keeps building.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.qf.3", "A", "quick_fact", "{{currentWinStreak}} straight wins and counting for {{playerName}}.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.qr.2", "B", "quick_reaction", "{{playerName}}'s not just winning, they're strutting.", "positive", { requires: WIN_STREAK_REQUIRES, tone: "humour" }),
ph("WIN_STREAK.qr.3", "B", "quick_reaction", "Try finding a weakness in that at the minute.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.perf.2", "A", "performance_fact", "{{currentWinStreak}} wins on the bounce is a real number to put beside {{playerName}}'s name right now.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.perf.3", "A", "performance_fact", "A run of {{currentWinStreak}} says plenty about where {{playerName}}'s at currently.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.credit.2", "B", "credit", "Whatever {{playerName}}'s doing in practice, keep doing it.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.credit.3", "B", "credit", "That's a streak built on genuine substance, not fortunate bounces.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.consequence.2", "A", "consequence", "A run like that changes how every remaining opponent has to approach the game.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.consequence.3", "A", "consequence", "Momentum like this tends to carry a player a long way up the table.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.model.1", "A", "model_context", "{{currentWinStreak}} wins in a row is a small sample in the grand scheme — plenty of runs like that fade just as fast as they start.", "neutral", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.contrary.1", "B", "contrary_opinion", "Small sample or not, {{playerName}} looks like the real deal to me right now, not some flash in the pan.", "positive", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.evidence.1", "A", "evidence", "Fair — a run of {{currentWinStreak}} without one bad night in it is more than just puff, I'll grant that.", "neutral", { requires: WIN_STREAK_REQUIRES }),
ph("WIN_STREAK.close.1", "B", "disagree_close", "Backing {{playerName}} to keep that streak rolling for a good while yet.", "positive", { requires: WIN_STREAK_REQUIRES }),
];

const LOSS_STREAK_REQUIRES = ["playerId", "currentLossStreak"];
const LOSS_STREAK_PHRASES: Phrase[] = [
  ph("LOSS_STREAK.qf.1", "A", "quick_fact", "{{playerName}} has now lost {{currentLossStreak}} in a row.", "negative", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.qr.1", "B", "quick_reaction", "Rough spell for {{playerName}} at the minute.", "negative", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.fact.1", "A", "fact", "That's {{currentLossStreak}} straight defeats now for {{playerName}}.", "negative", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.reaction.1", "B", "reaction", "Everyone hits a wall like this at some point in a season.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.context.1", "A", "context", "The underlying numbers will tell us whether that's a blip or something more concerning.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
  ph("LOSS_STREAK.closer.1", "B", "closer", "One win turns that around completely.", "neutral", { requires: LOSS_STREAK_REQUIRES }),

ph("LOSS_STREAK.qf.2", "A", "quick_fact", "{{playerName}}'s losing run has stretched to {{currentLossStreak}} matches now.", "negative", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.qf.3", "A", "quick_fact", "Make it {{currentLossStreak}} defeats on the spin for {{playerName}}.", "negative", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.qr.2", "B", "quick_reaction", "Not the sort of run anyone wants to be on.", "negative", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.qr.3", "B", "quick_reaction", "You can see the frustration building with every one of those.", "negative", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.fact.2", "A", "fact", "{{currentLossStreak}} losses in a row now sits alongside {{playerName}}'s recent results.", "negative", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.fact.3", "A", "fact", "The results column makes for tough reading — {{currentLossStreak}} straight defeats.", "negative", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.reaction.2", "B", "reaction", "Confidence takes a hit in a run like that, however good the player.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.reaction.3", "B", "reaction", "It happens over a long enough season, however talented the player.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.context.2", "A", "context", "Whether that's a genuine dip or just a rough patch of fixtures is the real question.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.context.3", "A", "context", "A run like that doesn't erase what came before it, but it does need addressing soon.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.closer.2", "B", "closer", "Backing {{playerName}} to find a way out of it soon.", "positive", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.closer.3", "B", "closer", "Every run ends with a win somewhere — just a case of when.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.model.1", "A", "model_context", "{{currentLossStreak}} losses in a row looks bad on paper, but a short losing run doesn't always mean the underlying game has changed.", "neutral", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.contrary.1", "B", "contrary_opinion", "Paper or not, something's clearly gone missing from {{playerName}}'s game right now — that's not just bad luck.", "negative", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.evidence.1", "A", "evidence", "Fair point — {{currentLossStreak}} without a single win in between is more than a rough bounce or two.", "negative", { requires: LOSS_STREAK_REQUIRES }),
ph("LOSS_STREAK.close.1", "B", "disagree_close", "Hope {{playerName}} sorts it, because right now it's a real slump, not a blip.", "negative", { requires: LOSS_STREAK_REQUIRES }),
];

const FORM_REVERSAL_REQUIRES = ["playerId", "direction", "recentFiveWins", "priorFiveWins"];
const FORM_REVERSAL_PHRASES: Phrase[] = [
  ph("FORM_REVERSAL.qf.1", "A", "quick_fact", "{{playerName}}'s form has shifted — {{recentFiveWins}} wins from the last five, against {{priorFiveWins}} in the five before that.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.qr.1", "B", "quick_reaction", "That's a proper swing in form, that.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.fact.1", "A", "fact", "Five matches ago {{playerName}} had {{priorFiveWins}} wins in a five-match window — now it's {{recentFiveWins}}.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.reaction.1", "B", "reaction", "Form's a funny thing in this game — can flip in a fortnight.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.context.1", "A", "context", "Worth watching whether that trend holds over the next few matches.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
  ph("FORM_REVERSAL.closer.1", "B", "closer", "Either way, {{playerName}}'s worth keeping an eye on.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),

ph("FORM_REVERSAL.qf.2", "A", "quick_fact", "{{recentFiveWins}} wins from the last five tells a different story to the {{priorFiveWins}} {{playerName}} managed in the five before.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.qf.3", "A", "quick_fact", "Form's moved {{direction}} for {{playerName}} — {{priorFiveWins}} wins in the earlier five, {{recentFiveWins}} in the most recent.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.qr.2", "B", "quick_reaction", "That's a genuine change of gear, not just noise.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.qr.3", "B", "quick_reaction", "You don't see numbers move like that without something real going on.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.fact.2", "A", "fact", "The five-match window has gone from {{priorFiveWins}} wins to {{recentFiveWins}} — a clear directional shift.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.fact.3", "A", "fact", "Two five-match windows, two very different pictures: {{priorFiveWins}} then, {{recentFiveWins}} now.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.reaction.2", "B", "reaction", "Whatever's clicked — or stopped clicking — it's showing up in the results.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.reaction.3", "B", "reaction", "That kind of swing usually has a reason behind it, even if we can't see it from here.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.context.2", "A", "context", "A shift over one five-match window is a signal, not yet a certainty.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.context.3", "A", "context", "The next handful of matches will say whether this is the new normal for {{playerName}}.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.closer.2", "B", "closer", "Keep watching this one — could go either way from here.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.closer.3", "B", "closer", "Form like that doesn't stay quiet for long.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.model.1", "A", "model_context", "Two five-match windows is a fairly small lens — {{priorFiveWins}} to {{recentFiveWins}} could be signal, or it could just be the way the fixtures fell.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.contrary.1", "B", "contrary_opinion", "I don't buy the fixtures excuse — {{playerName}}'s actually playing differently right now, you can see it.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.evidence.1", "A", "evidence", "Going from {{priorFiveWins}} to {{recentFiveWins}} in back-to-back windows is a big enough jump that fixtures alone probably don't explain it.", "neutral", { requires: FORM_REVERSAL_REQUIRES }),
ph("FORM_REVERSAL.close.1", "B", "disagree_close", "Told you — this is {{playerName}} for real, not a run of kind draws.", "positive", { requires: FORM_REVERSAL_REQUIRES }),
];

const QUIET_CLIMBER_REQUIRES = ["playerId", "positionBefore", "currentPosition", "matches"];
const QUIET_CLIMBER_PHRASES: Phrase[] = [
  ph("QUIET_CLIMBER.qf.1", "A", "quick_fact", "{{playerName}} has quietly climbed from {{positionBefore}} to {{currentPosition}} over the last {{matches}} matches.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
  ph("QUIET_CLIMBER.qr.1", "B", "quick_reaction", "Nobody's really talking about {{playerName}}, but look at that table move.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
  ph("QUIET_CLIMBER.perf.1", "A", "performance_fact", "From {{positionBefore}} up to {{currentPosition}} without one single major shock along the way.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
  ph("QUIET_CLIMBER.credit.1", "B", "credit", "That's the sign of someone quietly putting a season together.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
  ph("QUIET_CLIMBER.consequence.1", "A", "consequence", "Keep that steady rise going and {{playerName}} becomes a real factor.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),

ph("QUIET_CLIMBER.qf.2", "A", "quick_fact", "{{matches}} matches, and {{playerName}}'s gone from {{positionBefore}} to {{currentPosition}} without much fuss at all.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.qf.3", "A", "quick_fact", "A move from {{positionBefore}} to {{currentPosition}} in {{matches}} matches — steady, not spectacular, but real.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.qr.2", "B", "quick_reaction", "This one's flying under the radar completely.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.qr.3", "B", "quick_reaction", "Sneaky good run from {{playerName}}, that.", "positive", { requires: QUIET_CLIMBER_REQUIRES, tone: "humour" }),
ph("QUIET_CLIMBER.perf.2", "A", "performance_fact", "{{matches}} matches to go from {{positionBefore}} to {{currentPosition}} — a genuinely consistent climb.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.perf.3", "A", "performance_fact", "No fireworks, just position {{positionBefore}} to {{currentPosition}} in {{matches}} matches.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.credit.2", "B", "credit", "Consistency like that is harder to find than one big result.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.credit.3", "B", "credit", "This is exactly the sort of run that gets overlooked until it's too late to catch.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.consequence.2", "A", "consequence", "A climb like that, sustained, changes how the rest of the table has to think about {{playerName}}.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.consequence.3", "A", "consequence", "Keep this up and {{playerName}} is in the conversation whether people noticed the climb or not.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.model.1", "A", "model_context", "{{playerName}}'s gone from {{positionBefore}} to {{currentPosition}} in {{matches}} matches, but a quiet climb like that rarely gets talked about for a reason — it hasn't come against anyone near the top.", "neutral", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.contrary.1", "B", "contrary_opinion", "I don't care who it's come against — that's exactly the kind of player worth watching for the run-in, quiet or not.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.evidence.1", "A", "evidence", "{{matches}} matches of steady improvement without a single setback along the way is at least real evidence of form, I'll give you that.", "neutral", { requires: QUIET_CLIMBER_REQUIRES }),
ph("QUIET_CLIMBER.close.1", "B", "disagree_close", "Mark it down — {{playerName}}'s the name nobody's talking about that they should be.", "positive", { requires: QUIET_CLIMBER_REQUIRES }),
];

const FREEFALL_REQUIRES = ["playerId", "positionBefore", "currentPosition", "matches", "currentLossStreak"];
const FREEFALL_PHRASES: Phrase[] = [
  ph("FREEFALL.qf.1", "A", "quick_fact", "{{playerName}} has slipped from {{positionBefore}} to {{currentPosition}} over the last {{matches}} matches.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.qr.1", "B", "quick_reaction", "That's a table position sliding the wrong way.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.fact.1", "A", "fact", "{{currentLossStreak}} losses in that spell have pulled {{playerName}} down to {{currentPosition}}.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.reaction.1", "B", "reaction", "Every player goes through a spell like this — it's what comes next that matters.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.context.1", "A", "context", "Plenty of matches left to arrest that slide.", "neutral", { requires: FREEFALL_REQUIRES }),
  ph("FREEFALL.closer.1", "B", "closer", "Backing {{playerName}} to steady the ship soon enough.", "neutral", { requires: FREEFALL_REQUIRES }),

ph("FREEFALL.qf.2", "A", "quick_fact", "From {{positionBefore}} down to {{currentPosition}} in {{matches}} matches — a heavy drop for {{playerName}}.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.qf.3", "A", "quick_fact", "{{playerName}}'s table position has gone from {{positionBefore}} to {{currentPosition}}, with {{currentLossStreak}} losses mixed in along the way.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.qr.2", "B", "quick_reaction", "That's a proper slide, that — no other word for it.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.qr.3", "B", "quick_reaction", "Hard watch, this one.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.fact.2", "A", "fact", "{{matches}} matches, {{currentLossStreak}} losses, and a fall from {{positionBefore}} to {{currentPosition}} to show for it.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.fact.3", "A", "fact", "The table doesn't lie — {{positionBefore}} to {{currentPosition}} in the space of {{matches}} matches.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.reaction.2", "B", "reaction", "You can see the confidence draining out of that with every result.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.reaction.3", "B", "reaction", "Nobody plans for a run like this, but it happens to everyone eventually.", "neutral", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.context.2", "A", "context", "The question now is whether {{currentLossStreak}} losses is the bottom of it or just the start.", "neutral", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.context.3", "A", "context", "A slide like that from {{positionBefore}} doesn't have to be permanent, but it needs addressing soon.", "neutral", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.closer.2", "B", "closer", "Give it a few matches — I reckon {{playerName}} turns this round.", "positive", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.closer.3", "B", "closer", "Rough patch, that's all it is for now.", "neutral", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.model.1", "A", "model_context", "{{currentLossStreak}} losses and a slide from {{positionBefore}} to {{currentPosition}} is a real number, but a run over {{matches}} matches is still a small enough sample that it could just be a rough patch of fixtures.", "neutral", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.contrary.1", "B", "contrary_opinion", "Rough patch nothing — this is a proper dip, and I don't think it turns round on its own.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.evidence.1", "A", "evidence", "{{currentLossStreak}} losses in a row is hard to wave away as just fixtures, fair enough.", "negative", { requires: FREEFALL_REQUIRES }),
ph("FREEFALL.close.1", "B", "disagree_close", "Still backing {{playerName}} to climb back out of {{currentPosition}} before the season's out.", "positive", { requires: FREEFALL_REQUIRES }),
];

const ABOVE_BASELINE_REQUIRES = ["playerId", "recentRate", "seasonRate"];
const ABOVE_BASELINE_PHRASES: Phrase[] = [
  ph("ABOVE_BASELINE.qf.1", "A", "quick_fact", "{{playerName}} is performing well above their own season average right now.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
  ph("ABOVE_BASELINE.qr.1", "B", "quick_reaction", "{{playerName}}'s a different player at the minute.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
  ph("ABOVE_BASELINE.perf.1", "A", "performance_fact", "Recent form is running well clear of {{playerName}}'s own season baseline.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
  ph("ABOVE_BASELINE.credit.1", "B", "credit", "Whatever's changed, it's clearly working.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
  ph("ABOVE_BASELINE.consequence.1", "A", "consequence", "Sustain that and {{playerName}}'s numbers for the season improve significantly.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),

ph("ABOVE_BASELINE.qf.2", "A", "quick_fact", "{{playerName}}'s recent numbers are running well ahead of the season rate they've shown all year.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.qf.3", "A", "quick_fact", "There's a clear gap right now between {{playerName}}'s recent output and their season-long average.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.qr.2", "B", "quick_reaction", "{{playerName}}'s found another level, and it's showing.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.qr.3", "B", "quick_reaction", "This is a different standard to what we've seen from {{playerName}} across the season.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.perf.2", "A", "performance_fact", "The recent rate is comfortably clear of the season baseline — no small gap, either.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.perf.3", "A", "performance_fact", "That's a meaningful jump above {{playerName}}'s own season number, not a marginal one.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.credit.2", "B", "credit", "Something's clicked, and it's showing up night after night.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.credit.3", "B", "credit", "That's the kind of jump you notice from the opening leg.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.consequence.2", "A", "consequence", "If that recent rate holds, the season average catches up to it eventually.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.consequence.3", "A", "consequence", "A gap like that, sustained, changes the whole shape of {{playerName}}'s season.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.model.1", "A", "model_context", "{{playerName}}'s recent rate is running above their season number, but a hot spell above your own baseline doesn't always hold — plenty regress back toward it.", "neutral", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.contrary.1", "B", "contrary_opinion", "Regress all you like on paper — right now {{playerName}}'s playing at a level the season average doesn't even come close to.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.evidence.1", "A", "evidence", "Fair, the gap between the recent rate and the season rate is wide enough that it's not just one good night skewing things.", "neutral", { requires: ABOVE_BASELINE_REQUIRES }),
ph("ABOVE_BASELINE.close.1", "B", "disagree_close", "This is {{playerName}}'s level now — the season average just needs to catch up.", "positive", { requires: ABOVE_BASELINE_REQUIRES }),
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

ph("H2H_DOMINANCE.qf.2", "A", "quick_fact", "It's {{wins}} from {{gamesPlayed}} in this head-to-head, and {{dominantPlayerName}} holds every bit of that edge.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.qf.3", "A", "quick_fact", "{{gamesPlayed}} meetings, {{wins}} wins for {{dominantPlayerName}} — a history {{dominatedPlayerName}} knows well.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.qr.2", "B", "quick_reaction", "{{dominatedPlayerName}} must dread seeing that name on the draw.", "neutral", { requires: H2H_DOMINANCE_REQUIRES, tone: "humour" }),
ph("H2H_DOMINANCE.qr.3", "B", "quick_reaction", "That's a proper mental hold one player's got over another.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.fact.2", "A", "fact", "{{wins}} of {{gamesPlayed}} is a lopsided head-to-head by any measure.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.fact.3", "A", "fact", "The numbers across {{gamesPlayed}} meetings favour {{dominantPlayerName}} heavily — {{wins}} wins to show for it.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.reaction.2", "B", "reaction", "Some match-ups just don't suit certain players, and this looks like one of them.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.reaction.3", "B", "reaction", "You'd forgive {{dominatedPlayerName}} for wanting a different draw.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.context.2", "A", "context", "History like that shapes expectations, even if it can't throw the darts for either player.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.context.3", "A", "context", "A gap that size over {{gamesPlayed}} meetings is too big to call pure coincidence.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.closer.2", "B", "closer", "Every hoodoo gets broken eventually — question's just when.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.closer.3", "B", "closer", "{{dominatedPlayerName}} just needs the one night to flip the script.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.model.1", "A", "model_context", "{{wins}} wins from {{gamesPlayed}} meetings is a real head-to-head gap, but past results between two players don't directly decide what happens on the next night.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.contrary.1", "B", "contrary_opinion", "Come on — a gap that one-sided over {{gamesPlayed}} meetings is not a coincidence, it's a genuine match-up problem for {{dominatedPlayerName}}.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.evidence.1", "A", "evidence", "{{wins}} from {{gamesPlayed}} is a big enough sample that it's more than random variation, I'll admit.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
ph("H2H_DOMINANCE.close.1", "B", "disagree_close", "Until {{dominatedPlayerName}} actually beats {{dominantPlayerName}}, I'm taking the head-to-head at face value.", "neutral", { requires: H2H_DOMINANCE_REQUIRES }),
];

const RIVALRY_REQUIRES = ["playerAId", "playerBId", "aWins", "bWins", "gamesPlayed"];
const RIVALRY_PHRASES: Phrase[] = [
  ph("RIVALRY.qf.1", "A", "quick_fact", "{{playerAName}} and {{playerBName}} are locked at {{aWins}}-{{bWins}} across {{gamesPlayed}} meetings.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.qr.1", "B", "quick_reaction", "That's about as even a rivalry as you'll find in this league.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.fact.1", "A", "fact", "Neither side has pulled clear across {{gamesPlayed}} matches between them.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.reaction.1", "B", "reaction", "Genuinely can't call this one — that's what makes it worth watching.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.context.1", "A", "context", "A rivalry this balanced tends to come down to whoever's sharper on the night.", "neutral", { requires: RIVALRY_REQUIRES }),
  ph("RIVALRY.closer.1", "B", "closer", "Never a dull one between these two.", "neutral", { requires: RIVALRY_REQUIRES }),

ph("RIVALRY.qf.2", "A", "quick_fact", "{{gamesPlayed}} meetings and barely a hair between them — {{aWins}}-{{bWins}} to {{playerAName}}.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.qf.3", "A", "quick_fact", "{{playerBName}} and {{playerAName}} split things almost evenly across {{gamesPlayed}} head-to-head meetings.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.qr.2", "B", "quick_reaction", "This is the fixture you circle on the calendar.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.qr.3", "B", "quick_reaction", "Neither of them's had a real edge here, have they.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.fact.2", "A", "fact", "{{aWins}} wins to {{bWins}} over {{gamesPlayed}} meetings — as tight as head-to-heads get.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.fact.3", "A", "fact", "Across {{gamesPlayed}} matches, the difference between {{playerAName}} and {{playerBName}} is about as small as it comes.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.reaction.2", "B", "reaction", "I wouldn't put money on it either way, and I mean that.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.reaction.3", "B", "reaction", "That's the kind of head-to-head that makes both players raise their game.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.context.2", "A", "context", "History offers no real steer here — it comes down to the night itself.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.context.3", "A", "context", "A history this close usually means a style match-up, not one player being simply better.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.closer.2", "B", "closer", "Set your alarm for the next one of these.", "neutral", { requires: RIVALRY_REQUIRES }),
ph("RIVALRY.closer.3", "B", "closer", "Toss a coin — genuinely, that's about as good a guide as any.", "neutral", { requires: RIVALRY_REQUIRES }),
];

const RIVALRY_SWING_REQUIRES = ["careerLeaderPlayerId", "recentLeaderPlayerId", "recentWindowSize", "aWins", "bWins"];
const RIVALRY_SWING_PHRASES: Phrase[] = [
  ph("RIVALRY_SWING.qf.1", "A", "quick_fact", "{{recentLeaderPlayerName}} has taken control of the recent meetings, even with {{careerLeaderPlayerName}} still ahead across the full history.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.qr.1", "B", "quick_reaction", "The tide's turning in that one, isn't it.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.fact.1", "A", "fact", "Over the last {{recentWindowSize}} meetings the pattern has flipped from the long-run head-to-head.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.reaction.1", "B", "reaction", "Long-term head-to-head is one thing — right now, {{recentLeaderPlayerName}}'s clearly got the edge.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.context.1", "A", "context", "Worth watching whether that recent trend becomes the new normal for this fixture.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
  ph("RIVALRY_SWING.closer.1", "B", "closer", "This rivalry's got a bit of a plot twist in it now.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),

ph("RIVALRY_SWING.qf.2", "A", "quick_fact", "{{careerLeaderPlayerName}} leads the overall history, but {{recentLeaderPlayerName}}'s won the last {{recentWindowSize}} meetings between them.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.qf.3", "A", "quick_fact", "The last {{recentWindowSize}} meetings tell a very different story to the full head-to-head history here.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.qr.2", "B", "quick_reaction", "Funny how these things flip, isn't it.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.qr.3", "B", "quick_reaction", "Recent form says one thing, the history books say another.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.fact.2", "A", "fact", "{{aWins}}-{{bWins}} overall, but {{recentLeaderPlayerName}} owns the last {{recentWindowSize}} between them.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.fact.3", "A", "fact", "The full history and the last {{recentWindowSize}} meetings are pointing in opposite directions right now.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.reaction.2", "B", "reaction", "You go with what's happening now over what happened a while back.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.reaction.3", "B", "reaction", "{{careerLeaderPlayerName}} can point to the overall history, but that's cold comfort lately.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.context.2", "A", "context", "A swing like this over {{recentWindowSize}} meetings is worth tracking against the full body of history.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.context.3", "A", "context", "Whether the long-run history or the recent trend wins out is exactly what makes the next meeting interesting.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.closer.2", "B", "closer", "Love a rivalry that keeps rewriting itself.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.closer.3", "B", "closer", "Ask me again after the next one — this could flip straight back.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.model.1", "A", "model_context", "{{recentLeaderPlayerName}}'s won the recent meetings, but {{careerLeaderPlayerName}} still leads the fuller career history — a short window can move around a lot before it settles into anything meaningful.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.contrary.1", "B", "contrary_opinion", "The full history's the past — {{recentLeaderPlayerName}}'s the one winning right now, and that's what I'd back going forward.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.evidence.1", "A", "evidence", "{{recentWindowSize}} meetings running the opposite way to the career history is a genuine pattern, not just one fluky result.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
ph("RIVALRY_SWING.close.1", "B", "disagree_close", "History can catch up when it wants — for now, {{recentLeaderPlayerName}}'s got this rivalry.", "neutral", { requires: RIVALRY_SWING_REQUIRES }),
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

ph("CLINICAL_FINISHING.qf.2", "A", "quick_fact", "{{playerName}} didn't miss a beat on the outside tonight — one of the more clinical checkout displays we've seen in a while.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.qf.3", "A", "quick_fact", "Every time {{playerName}} needed a double tonight, it seemed to land.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.qr.2", "B", "quick_reaction", "That's the kind of finishing that wins you matches you've got no business winning.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.qr.3", "B", "quick_reaction", "Ice in the veins from {{playerName}} on the doubles tonight.", "positive", { requires: CLINICAL_FINISHING_REQUIRES, tone: "personality" }),
ph("CLINICAL_FINISHING.perf.2", "A", "performance_fact", "That checkout rate puts {{playerName}} comfortably in the elite bracket for tonight's card.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.perf.3", "A", "performance_fact", "Statistically, that's about as sharp as finishing gets in this league.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.credit.2", "B", "credit", "You can have all the scoring in the world — nights like that are won on the outside, and {{playerName}} delivered.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.credit.3", "B", "credit", "That's not luck, that's repetition — {{playerName}}'s clearly been putting the hours in on the doubles board.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.consequence.2", "A", "consequence", "Finish like that consistently and {{playerName}} becomes very hard to beat over a season.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.consequence.3", "A", "consequence", "That's the sort of night that changes how opponents plan for {{playerName}} going forward.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.model.1", "A", "model_context", "One night of elite finishing is exactly the kind of thing that can flatter the percentile numbers — {{playerName}}'s checkout figures tonight are right up at the top of the pile.", "neutral", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.contrary.1", "B", "contrary_opinion", "Nah, I've watched {{playerName}} closely this season — this isn't a one-off, this is where they're at right now.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.evidence.1", "A", "evidence", "Fair point — the percentile reading isn't some freak outlier, it genuinely reflects a checkout rate this good tonight.", "neutral", { requires: CLINICAL_FINISHING_REQUIRES }),
ph("CLINICAL_FINISHING.close.1", "B", "disagree_close", "Exactly — write it down, {{playerName}}'s a different proposition on the doubles at the minute.", "positive", { requires: CLINICAL_FINISHING_REQUIRES }),
];

const DOUBLE_TROUBLE_REQUIRES = ["playerId", "checkoutRate", "checkoutAttempts", "ownBaselineCheckoutRate"];
const DOUBLE_TROUBLE_PHRASES: Phrase[] = [
  ph("DOUBLE_TROUBLE.qf.1", "A", "quick_fact", "{{playerName}} struggled on the doubles tonight — well down on their usual checkout rate across {{checkoutAttempts}} attempts.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
  ph("DOUBLE_TROUBLE.qr.1", "B", "quick_reaction", "Those missed doubles will sting more than the scoreline suggests.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES, tone: "humour" }),
  ph("DOUBLE_TROUBLE.fact.1", "A", "fact", "A checkout night well below {{playerName}}'s own baseline, from a reasonable {{checkoutAttempts}} attempts.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
  ph("DOUBLE_TROUBLE.reaction.1", "B", "reaction", "Everyone has a night where the doubles just won't fall.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
  ph("DOUBLE_TROUBLE.context.1", "A", "context", "Nothing in the scoring to suggest this becomes a pattern — one to watch next time out, though.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
  ph("DOUBLE_TROUBLE.closer.1", "B", "closer", "Backing {{playerName}} to sort that out sharpish.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),

ph("DOUBLE_TROUBLE.qf.2", "A", "quick_fact", "The doubles just wouldn't drop for {{playerName}} tonight, missing chance after chance across {{checkoutAttempts}} attempts.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.qf.3", "A", "quick_fact", "A tough night on the outside for {{playerName}} — the scoring was there, the finishing wasn't.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.qr.2", "B", "quick_reaction", "Painful to watch, that — you could see {{playerName}} getting more frustrated with every miss.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES, tone: "humour" }),
ph("DOUBLE_TROUBLE.qr.3", "B", "quick_reaction", "Those are the nights that keep a player up thinking about it.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.fact.2", "A", "fact", "{{checkoutAttempts}} attempts at the doubles tonight and nowhere near {{playerName}}'s usual conversion rate.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.fact.3", "A", "fact", "A checkout rate a long way off {{playerName}}'s established baseline tonight, and it cost them.", "negative", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.reaction.2", "B", "reaction", "Even in-form players have a night like that on the outside.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.reaction.3", "B", "reaction", "Darts is cruel sometimes — score like a dream and still walk away with nothing to show for it.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.context.2", "A", "context", "The scoring numbers don't point to anything wrong technically — this reads like a night the doubles simply didn't fall.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.context.3", "A", "context", "Worth watching the next couple of outings before reading too much into one off night on the doubles.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.closer.2", "B", "closer", "Bounce-back game for {{playerName}}, surely.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.closer.3", "B", "closer", "Chalk it up to one of those nights and move on.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.model.1", "A", "model_context", "The raw numbers say {{playerName}} should be walking away with more wins — a checkout rate this far below the baseline, across {{checkoutAttempts}} attempts, is the only thing holding them back.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.contrary.1", "B", "contrary_opinion", "I wonder if something clicks the wrong way for {{playerName}} once a leg comes down to the last dart — the scoring's clearly not the issue.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.evidence.1", "A", "evidence", "There's a real split there — the scoring backs that reading up, it's specifically the finishing percentage that's dragging the baseline down.", "neutral", { requires: DOUBLE_TROUBLE_REQUIRES }),
ph("DOUBLE_TROUBLE.close.1", "B", "disagree_close", "Give it one more match — {{playerName}} finds the outs again soon enough.", "positive", { requires: DOUBLE_TROUBLE_REQUIRES }),
];

const SCORING_POWER_REQUIRES = ["playerId", "scoringRate30", "scoringPercentile"];
const SCORING_POWER_PHRASES: Phrase[] = [
  ph("SCORING_POWER.qf.1", "A", "quick_fact", "{{playerName}}'s scoring power tonight sits well up in the league's percentile marks.", "positive", { requires: SCORING_POWER_REQUIRES }),
  ph("SCORING_POWER.qr.1", "B", "quick_reaction", "Big scoring from {{playerName}} — that puts real pressure on.", "positive", { requires: SCORING_POWER_REQUIRES }),
  ph("SCORING_POWER.perf.1", "A", "performance_fact", "A three-dart average that ranks near the top of the league tonight.", "positive", { requires: SCORING_POWER_REQUIRES }),
  ph("SCORING_POWER.credit.1", "B", "credit", "That's the sort of scoring that leaves an opponent chasing the game.", "positive", { requires: SCORING_POWER_REQUIRES }),
  ph("SCORING_POWER.consequence.1", "A", "consequence", "Sustain that scoring rate and the results tend to follow.", "positive", { requires: SCORING_POWER_REQUIRES }),

ph("SCORING_POWER.qf.2", "A", "quick_fact", "{{playerName}} was putting the scoreboard under real pressure tonight — heavy scoring right from the opening leg.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.qf.3", "A", "quick_fact", "That's relentless scoring from {{playerName}} — barely a visit that didn't look triple-heavy.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.qr.2", "B", "quick_reaction", "When {{playerName}}'s scoring like that, it doesn't matter much what's on the other oche.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.qr.3", "B", "quick_reaction", "That's the kind of scoring that ends legs in double-figure visits.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.perf.2", "A", "performance_fact", "That scoring output ranks right at the sharp end of tonight's whole card.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.perf.3", "A", "performance_fact", "A genuinely heavy scoring night, statistically speaking, from {{playerName}}.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.credit.2", "B", "credit", "Scoring like that takes the game away from an opponent before they've even settled.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.credit.3", "B", "credit", "You can't really defend against scoring that heavy — you just hope your own doubles keep pace.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.consequence.2", "A", "consequence", "Keep scoring at that level and the results start taking care of themselves for {{playerName}}.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.consequence.3", "A", "consequence", "That's the platform most big results in this league get built on.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.model.1", "A", "model_context", "A single big scoring night doesn't always mean a shift in level — but this scoring percentile for {{playerName}} tonight is about as high as this model typically shows.", "neutral", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.contrary.1", "B", "contrary_opinion", "This isn't a flash in the pan for me — {{playerName}}'s throwing a different way at the minute, full stop.", "positive", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.evidence.1", "A", "evidence", "The underlying numbers do back that up — this scoring percentile isn't a one-match blip, it's a genuinely elite reading.", "neutral", { requires: SCORING_POWER_REQUIRES }),
ph("SCORING_POWER.close.1", "B", "disagree_close", "Told you — {{playerName}}'s a real problem for anybody on current form.", "positive", { requires: SCORING_POWER_REQUIRES }),
];

const SCORING_WITHOUT_FINISHING_REQUIRES = ["playerId", "scoringPercentile", "checkoutPercentile"];
const SCORING_WITHOUT_FINISHING_PHRASES: Phrase[] = [
  ph("SCORING_WITHOUT_FINISHING.qf.1", "A", "quick_fact", "{{playerName}} scored well tonight but couldn't convert it on the doubles.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.qr.1", "B", "quick_reaction", "All that scoring, and the outs just wouldn't drop.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.fact.1", "A", "fact", "Strong scoring percentile, but a checkout percentile a long way behind it tonight.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.reaction.1", "B", "reaction", "That's the most frustrating way to lose a set, that.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.context.1", "A", "context", "The raw scoring suggests this result could easily have gone the other way.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
  ph("SCORING_WITHOUT_FINISHING.closer.1", "B", "closer", "Sort the finishing out and {{playerName}}'s a real problem for anyone.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),

ph("SCORING_WITHOUT_FINISHING.qf.2", "A", "quick_fact", "{{playerName}} did everything right with the scoring tonight — it's the finishing that let them down.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.qf.3", "A", "quick_fact", "Plenty of scoring power from {{playerName}}, but the doubles told a very different story.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.qr.2", "B", "quick_reaction", "That's got to be the most frustrating way to watch a game slip away.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.qr.3", "B", "quick_reaction", "All that hard work with the big scores, undone at the business end.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.fact.2", "A", "fact", "A scoring night well clear of the checkout side of {{playerName}}'s game tonight — a real gap between the two.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.fact.3", "A", "fact", "The scoring percentile and the checkout percentile are miles apart tonight for {{playerName}}.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.reaction.2", "B", "reaction", "Get the finishing anywhere near the scoring and that's a completely different result.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.reaction.3", "B", "reaction", "Darts in a nutshell — score for fun, lose the game at the doubles.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.context.2", "A", "context", "Nothing about the scoring suggests {{playerName}} is short of form — the gap is specifically at the finish.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.context.3", "A", "context", "That kind of split is usually the thing a player works on hardest in practice after a night like this.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.closer.2", "B", "closer", "Sort the doubles and {{playerName}} turns nights like this into wins.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.closer.3", "B", "closer", "Frustrating watch, but there's plenty to build on there.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.model.1", "A", "model_context", "Purely on the scoring numbers, {{playerName}} should be winning more matches than they are — that checkout percentile keeps undoing it.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.contrary.1", "B", "contrary_opinion", "I do wonder if there's a blockage between the ears once {{playerName}} gets to a double — the scoring clearly isn't the problem.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.evidence.1", "A", "evidence", "That's a fair read — the split between the scoring percentile and the checkout percentile is real, not just one bad night.", "neutral", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
ph("SCORING_WITHOUT_FINISHING.close.1", "B", "disagree_close", "Backing {{playerName}} to get the doubles sorted — the scoring alone makes them dangerous.", "positive", { requires: SCORING_WITHOUT_FINISHING_REQUIRES }),
];

const SEASON_BEST_REQUIRES = ["playerId", "metric", "value", "verifiedRecordClaim"];
const SEASON_BEST_PHRASES: Phrase[] = [
  ph("SEASON_BEST.qf.1", "A", "quick_fact", "That's a season-best {{metric}} for {{playerName}} — {{value}}.", "positive", { requires: SEASON_BEST_REQUIRES }),
  ph("SEASON_BEST.qr.1", "B", "quick_reaction", "New season high for {{playerName}} — take a bow.", "positive", { requires: SEASON_BEST_REQUIRES, tone: "personality" }),
  ph("SEASON_BEST.perf.1", "A", "performance_fact", "A season-best {{metric}} for {{playerName}} tonight — {{value}}, verified against their own season record.", "positive", { requires: SEASON_BEST_REQUIRES }),
  ph("SEASON_BEST.credit.1", "B", "credit", "That's the top {{metric}} {{playerName}}'s put up all season.", "positive", { requires: SEASON_BEST_REQUIRES }),
  ph("SEASON_BEST.consequence.1", "A", "consequence", "A season-best mark like that is a real confidence boost heading into the run-in.", "positive", { requires: SEASON_BEST_REQUIRES }),

ph("SEASON_BEST.qf.2", "A", "quick_fact", "Season-best numbers from {{playerName}} tonight — {{metric}} up to {{value}}, the highest they've hit all year.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.qf.3", "A", "quick_fact", "That's a new season high in {{metric}} for {{playerName}} — {{value}} on the board tonight.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.qr.2", "B", "quick_reaction", "Best {{metric}} of {{playerName}}'s season, and it's not particularly close either.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.qr.3", "B", "quick_reaction", "Season-best stuff — {{playerName}}'s timing that nicely.", "positive", { requires: SEASON_BEST_REQUIRES, tone: "personality" }),
ph("SEASON_BEST.perf.2", "A", "performance_fact", "Verified against the season record, {{value}} in {{metric}} is the strongest {{playerName}}'s produced all year.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.perf.3", "A", "performance_fact", "That's the best single-match {{metric}} reading {{playerName}}'s posted since the season began.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.credit.2", "B", "credit", "However you slice it, that's {{playerName}}'s standout night of the season so far.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.credit.3", "B", "credit", "Season-best on a night like this — that's exactly when you want to find your top form.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.consequence.2", "A", "consequence", "A mark like that tends to move the season averages meaningfully, not just the headline.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.consequence.3", "A", "consequence", "That's the sort of season-best that opponents will already have clocked.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.model.1", "A", "model_context", "A verified season-best {{metric}} of {{value}} for {{playerName}} tonight — the question now is whether that's the new level or a peak.", "neutral", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.contrary.1", "B", "contrary_opinion", "I think that's the level now — {{playerName}}'s been building to a night like this for weeks.", "positive", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.evidence.1", "A", "evidence", "Genuinely verified as a season high, so it's not a mislabelled fluke — but one night is still one night.", "neutral", { requires: SEASON_BEST_REQUIRES }),
ph("SEASON_BEST.close.1", "B", "disagree_close", "Give it a fortnight — I reckon we're back here saying the same thing about {{playerName}}.", "positive", { requires: SEASON_BEST_REQUIRES }),
];

const PERSONAL_BEST_REQUIRES = ["playerId", "metric", "value", "verifiedRecordClaim"];
const PERSONAL_BEST_PHRASES: Phrase[] = [
  ph("PERSONAL_BEST.qf.1", "A", "quick_fact", "A career-best {{metric}} for {{playerName}} tonight — {{value}}.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
  ph("PERSONAL_BEST.qr.1", "B", "quick_reaction", "Career highest for {{playerName}} — that's one to remember.", "positive", { requires: PERSONAL_BEST_REQUIRES, tone: "personality", distinctive: true }),
  ph("PERSONAL_BEST.perf.1", "A", "performance_fact", "A career-best {{metric}} for {{playerName}} tonight — {{value}}, verified against their full career record.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
  ph("PERSONAL_BEST.credit.1", "B", "credit", "That's the best {{metric}} {{playerName}}'s ever produced in this league.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
  ph("PERSONAL_BEST.consequence.1", "A", "consequence", "A genuine career mark like that will stand for a while.", "positive", { requires: PERSONAL_BEST_REQUIRES }),

ph("PERSONAL_BEST.qf.2", "A", "quick_fact", "A genuine career high from {{playerName}} tonight — {{metric}} all the way up to {{value}}.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.qf.3", "A", "quick_fact", "That's the best {{metric}} {{playerName}}'s ever recorded in this league — {{value}} on the night.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.qr.2", "B", "quick_reaction", "Career-best stuff — you don't see many nights like that in a whole career, let alone in one match.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.qr.3", "B", "quick_reaction", "Personal record for {{playerName}} — that's one for the scrapbook.", "positive", { requires: PERSONAL_BEST_REQUIRES, tone: "personality" }),
ph("PERSONAL_BEST.perf.2", "A", "performance_fact", "Verified against the full career record, {{value}} in {{metric}} is a genuine personal high for {{playerName}}.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.perf.3", "A", "performance_fact", "That's the highest {{metric}} reading {{playerName}}'s ever put up in this league, full stop.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.credit.2", "B", "credit", "A career-best like that doesn't happen by accident — that's years of work landing in one match.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.credit.3", "B", "credit", "Whatever {{playerName}}'s been doing in practice, that's the proof it's working.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.consequence.2", "A", "consequence", "A verified personal best like that will get talked about long after tonight.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.consequence.3", "A", "consequence", "That's a mark {{playerName}} will be chasing again for the rest of the career.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.model.1", "A", "model_context", "A verified career-best {{metric}} of {{value}} for {{playerName}} — the real question is whether that's repeatable or a one-off peak.", "neutral", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.contrary.1", "B", "contrary_opinion", "Doesn't matter to me if it's repeatable — you don't hit a career-best by accident, {{playerName}}'s trending in the right direction.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.evidence.1", "A", "evidence", "That's fair — it is a genuinely verified personal high, not some quirk of the numbers, so there's real substance behind it.", "neutral", { requires: PERSONAL_BEST_REQUIRES }),
ph("PERSONAL_BEST.close.1", "B", "disagree_close", "Either way, {{playerName}}'s just set the bar for themselves — let's see them clear it again.", "positive", { requires: PERSONAL_BEST_REQUIRES }),
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

ph("NEW_LEADER.qf.2", "A", "quick_fact", "The top of the table's changed hands — {{newLeaderEntityName}} goes above {{previousLeaderEntityName}} on {{points}} points.", "positive", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.qf.3", "A", "quick_fact", "{{previousLeaderEntityName}} loses top spot tonight, with {{newLeaderEntityName}} now on {{points}} points.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.qr.2", "B", "quick_reaction", "Love it when the top of the table actually moves.", "positive", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.qr.3", "B", "quick_reaction", "Somebody tell {{previousLeaderEntityName}} the seat's taken now.", "neutral", { requires: NEW_LEADER_REQUIRES, tone: "humour" }),
ph("NEW_LEADER.fact.2", "A", "fact", "{{points}} points now has {{newLeaderEntityName}} clear at the top, past {{previousLeaderEntityName}}.", "positive", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.fact.3", "A", "fact", "A change at the top — {{newLeaderEntityName}} in, {{previousLeaderEntityName}} out, at least for now.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.reaction.2", "B", "reaction", "Doesn't mean much long-term on its own, but it's a real shift in the mood at the top.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.reaction.3", "B", "reaction", "{{newLeaderEntityName}} deserves credit just for getting there.", "positive", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.context.2", "A", "context", "One change at the top rarely settles anything this early — it's what happens next that counts.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.context.3", "A", "context", "The table's now got a genuinely different look to it.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.closer.2", "B", "closer", "Let's see who's still there next time we look.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.closer.3", "B", "closer", "Enjoy it while it lasts, {{newLeaderEntityName}}.", "positive", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.model.1", "A", "model_context", "One result has put {{newLeaderEntityName}} above {{previousLeaderEntityName}} on {{points}} points — that's where the table stands right now.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.contrary.1", "B", "contrary_opinion", "One result, though — I wouldn't read too much into a single change at the top just yet.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.evidence.1", "A", "evidence", "Maybe, but the table only cares about points, and right now {{newLeaderEntityName}} has more of them.", "neutral", { requires: NEW_LEADER_REQUIRES }),
ph("NEW_LEADER.close.1", "B", "disagree_close", "Fine — ask me again in a few weeks.", "neutral", { requires: NEW_LEADER_REQUIRES }),
];

const LEAD_TIGHTENS_REQUIRES = ["leaderEntityId", "previousGap", "currentGap"];
const LEAD_TIGHTENS_PHRASES: Phrase[] = [
  ph("LEAD_TIGHTENS.qf.1", "A", "quick_fact", "{{leaderEntityName}}'s lead has shrunk from {{previousGap}} points down to {{currentGap}}.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.qr.1", "B", "quick_reaction", "That gap's closing fast now.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.fact.1", "A", "fact", "Down from {{previousGap}} to just {{currentGap}} at the top.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.reaction.1", "B", "reaction", "{{leaderEntityName}} can feel the breath on the back of the neck now.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.context.1", "A", "context", "A gap that size can disappear in a single weekend of results.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
  ph("LEAD_TIGHTENS.closer.1", "B", "closer", "This one's getting interesting.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),

ph("LEAD_TIGHTENS.qf.2", "A", "quick_fact", "That lead at the top is down to {{currentGap}} points now, in from {{previousGap}}.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.qf.3", "A", "quick_fact", "{{leaderEntityName}}'s cushion has been cut from {{previousGap}} to {{currentGap}}.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.qr.2", "B", "quick_reaction", "Suddenly that lead doesn't look so safe.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.qr.3", "B", "quick_reaction", "{{leaderEntityName}} might want to stop checking the table every five minutes.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES, tone: "humour" }),
ph("LEAD_TIGHTENS.fact.2", "A", "fact", "A gap of {{previousGap}} points is now just {{currentGap}}.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.fact.3", "A", "fact", "The margin at the top has narrowed to {{currentGap}}, from {{previousGap}} last time out.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.reaction.2", "B", "reaction", "That's the sort of gap that keeps a leader up at night.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.reaction.3", "B", "reaction", "Every point back matters more the smaller that gap gets.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.context.2", "A", "context", "Margins this tight put real weight on every fixture left to play.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.context.3", "A", "context", "It only takes a couple more results like that to change who's actually favourite.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.closer.2", "B", "closer", "Nobody's cruising to anything from here.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.closer.3", "B", "closer", "Keep an eye on that gap — it's not done moving.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.model.1", "A", "model_context", "The gap at the top is down to {{currentGap}} points, from {{previousGap}} before this round.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.contrary.1", "B", "contrary_opinion", "A few points either way happens most weeks — I'm not sure this is the shift people are making it out to be.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.evidence.1", "A", "evidence", "It's gone from {{previousGap}} to {{currentGap}} in one move, though — that's a real change in the table, not noise.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
ph("LEAD_TIGHTENS.close.1", "B", "disagree_close", "Alright, I'll grant you that one's worth watching.", "neutral", { requires: LEAD_TIGHTENS_REQUIRES }),
];

const LEAD_WIDENS_REQUIRES = ["leaderEntityId", "previousGap", "currentGap"];
const LEAD_WIDENS_PHRASES: Phrase[] = [
  ph("LEAD_WIDENS.qf.1", "A", "quick_fact", "{{leaderEntityName}} stretches the lead from {{previousGap}} points out to {{currentGap}}.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.qr.1", "B", "quick_reaction", "That's real breathing room at the top now.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.fact.1", "A", "fact", "Up from {{previousGap}} to {{currentGap}} clear at the summit.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.reaction.1", "B", "reaction", "The rest of the league needs to find an answer, and quickly.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.context.1", "A", "context", "A gap that size starts to change how the run-in gets played.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
  ph("LEAD_WIDENS.closer.1", "B", "closer", "{{leaderEntityName}} making this look comfortable.", "positive", { requires: LEAD_WIDENS_REQUIRES }),

ph("LEAD_WIDENS.qf.2", "A", "quick_fact", "{{leaderEntityName}}'s lead is out to {{currentGap}} points now, up from {{previousGap}}.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.qf.3", "A", "quick_fact", "The gap at the top has grown to {{currentGap}} points, with {{leaderEntityName}} pulling away.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.qr.2", "B", "quick_reaction", "That's daylight opening up at the top now.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.qr.3", "B", "quick_reaction", "Somebody's going to need a big run to catch that.", "positive", { requires: LEAD_WIDENS_REQUIRES, tone: "humour" }),
ph("LEAD_WIDENS.fact.2", "A", "fact", "{{previousGap}} points has become {{currentGap}} at the top of the table.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.fact.3", "A", "fact", "{{leaderEntityName}} has turned {{previousGap}} into {{currentGap}} clear of the field.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.reaction.2", "B", "reaction", "That's a lead built on the board, not on reputation.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.reaction.3", "B", "reaction", "Someone down the table needs to find an answer fast.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.context.2", "A", "context", "The bigger that gap gets, the fewer scenarios keep the rest of the field involved.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.context.3", "A", "context", "That's the kind of margin that starts to shape the whole run-in conversation.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.closer.2", "B", "closer", "Nice position to be defending from.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.closer.3", "B", "closer", "{{leaderEntityName}} in complete control of that one right now.", "positive", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.model.1", "A", "model_context", "The gap at the top has grown to {{currentGap}} points, up from {{previousGap}}.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.contrary.1", "B", "contrary_opinion", "Feels bigger than it is to me — plenty of season left for that to swing back.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.evidence.1", "A", "evidence", "Maybe, but it's widened, not narrowed — the table's actually moving in {{leaderEntityName}}'s favour, not away from it.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
ph("LEAD_WIDENS.close.1", "B", "disagree_close", "We'll see — I'm not writing anyone off from this far out.", "neutral", { requires: LEAD_WIDENS_REQUIRES }),
];

const TITLE_SWING_REQUIRES = ["entityId", "previousProbability", "currentProbability", "deltaPoints"];
const TITLE_SWING_PHRASES: Phrase[] = [
  ph("TITLE_SWING.qf.1", "A", "quick_fact", "{{entityName}}'s title chance has moved from {{previousProbabilityPct}}% to {{currentProbabilityPct}}%.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.qr.1", "B", "quick_reaction", "That's a serious jump in the title picture.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.model.1", "A", "model_context", "The title model now has {{entityName}} at {{currentProbabilityPct}}%, up from {{previousProbabilityPct}}% before this round of results.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.contrary.1", "B", "contrary_opinion", "Models move fast — I'd want to see that backed up on the board a few more weeks before I fully buy it.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.evidence.1", "A", "evidence", "A shift that size doesn't happen without real results behind it — this wasn't a rounding error.", "neutral", { requires: TITLE_SWING_REQUIRES }),
  ph("TITLE_SWING.close.1", "B", "disagree_close", "Fine — I'll believe it if it's still true next week.", "neutral", { requires: TITLE_SWING_REQUIRES }),

ph("TITLE_SWING.qf.2", "A", "quick_fact", "{{entityName}} picked up {{deltaPoints}} points this round, and the model's now got them at {{currentProbabilityPct}}%.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.qf.3", "A", "quick_fact", "That's {{entityName}}'s title probability up to {{currentProbabilityPct}}%, from {{previousProbabilityPct}}% before.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.qr.2", "B", "quick_reaction", "The title picture's genuinely shifted there.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.qr.3", "B", "quick_reaction", "The model's had a proper rethink on that one.", "neutral", { requires: TITLE_SWING_REQUIRES, tone: "humour" }),
ph("TITLE_SWING.model.2", "A", "model_context", "{{deltaPoints}} points swung the model that much — {{entityName}} now sits at {{currentProbabilityPct}}%.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.model.3", "A", "model_context", "Before this round the model had {{entityName}} at {{previousProbabilityPct}}% — it's {{currentProbabilityPct}}% now.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.contrary.2", "B", "contrary_opinion", "One good round and suddenly the model's rewriting the story — I'll wait and see.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.contrary.3", "B", "contrary_opinion", "Numbers catch up fast, but so do they fall back — I've seen this before.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.evidence.2", "A", "evidence", "{{deltaPoints}} points is a real swing, not a rounding error — the model's reacting to something genuine.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.evidence.3", "A", "evidence", "The probability only moves when the underlying results do — and they have, clearly.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.close.2", "B", "disagree_close", "Alright — noted, but I'm keeping half an eye on it.", "neutral", { requires: TITLE_SWING_REQUIRES }),
ph("TITLE_SWING.close.3", "B", "disagree_close", "Fair enough. Ask me again after a few more results.", "neutral", { requires: TITLE_SWING_REQUIRES }),
];

const NEW_FAVOURITE_REQUIRES = ["newFavouriteEntityId", "previousFavouriteEntityId", "probability"];
const NEW_FAVOURITE_PHRASES: Phrase[] = [
  ph("NEW_FAVOURITE.obs.1", "B", "observation", "{{newFavouriteEntityName}} feels like the team to beat for the title right now.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
  ph("NEW_FAVOURITE.check.1", "A", "data_check", "The title model agrees — {{newFavouriteEntityName}} is the new favourite at {{probabilityPct}}%, ahead of {{previousFavouriteEntityName}}.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
  ph("NEW_FAVOURITE.response.1", "B", "response", "Good to have the numbers on my side for once.", "neutral", { requires: NEW_FAVOURITE_REQUIRES, tone: "humour" }),
  ph("NEW_FAVOURITE.qf.1", "A", "quick_fact", "{{newFavouriteEntityName}} is the new favourite for the title, overtaking {{previousFavouriteEntityName}}.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
  ph("NEW_FAVOURITE.qr.1", "B", "quick_reaction", "About time someone else got a look-in at the top of that model.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),

ph("NEW_FAVOURITE.obs.2", "B", "observation", "Every time I watch {{newFavouriteEntityName}} lately, they look like the team nobody wants to play.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.obs.3", "B", "observation", "{{newFavouriteEntityName}}'s been building to this for weeks — anyone paying attention saw it coming.", "positive", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.check.2", "A", "data_check", "The numbers back it up — {{newFavouriteEntityName}} at {{probabilityPct}}% now leads the title model, past {{previousFavouriteEntityName}}.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.check.3", "A", "data_check", "That's {{newFavouriteEntityName}} into top spot in the model at {{probabilityPct}}%.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.response.2", "B", "response", "Feels right to me, that.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.response.3", "B", "response", "I'll take the model agreeing with me whenever it happens.", "positive", { requires: NEW_FAVOURITE_REQUIRES, tone: "humour" }),
ph("NEW_FAVOURITE.qf.2", "A", "quick_fact", "The title model has a new favourite — {{newFavouriteEntityName}}, at {{probabilityPct}}%.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.qf.3", "A", "quick_fact", "{{previousFavouriteEntityName}} has been overtaken — {{newFavouriteEntityName}} is the model's pick now.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.qr.2", "B", "quick_reaction", "Can't say I'm surprised to see {{newFavouriteEntityName}} up there.", "positive", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.qr.3", "B", "quick_reaction", "{{previousFavouriteEntityName}} demoted — the model shows no loyalty.", "neutral", { requires: NEW_FAVOURITE_REQUIRES, tone: "humour" }),
ph("NEW_FAVOURITE.model.1", "A", "model_context", "The title model's made {{newFavouriteEntityName}} the new favourite at {{probabilityPct}}%, ahead of {{previousFavouriteEntityName}}.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.contrary.1", "B", "contrary_opinion", "I'm not fully sold — {{previousFavouriteEntityName}}'s been the more convincing side all season, model or no model.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.evidence.1", "A", "evidence", "The model's not working off reputation, though — {{probabilityPct}}% reflects what's actually happened on the board recently.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.close.1", "B", "disagree_close", "We'll find out who's right soon enough.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.model.2", "A", "model_context", "{{newFavouriteEntityName}} has moved clear of {{previousFavouriteEntityName}} in the model, now at {{probabilityPct}}%.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.contrary.2", "B", "contrary_opinion", "Model likes them — I still think it's {{previousFavouriteEntityName}}'s to lose, personally.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.evidence.2", "A", "evidence", "That's your prerogative, but {{probabilityPct}}% didn't come from nowhere — the underlying numbers moved before the model did.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
ph("NEW_FAVOURITE.close.2", "B", "disagree_close", "Fine, fine — I hear the numbers. Doesn't mean I have to love it.", "neutral", { requires: NEW_FAVOURITE_REQUIRES }),
];

const DEAD_HEAT_REQUIRES = ["firstEntityId", "firstProbability", "secondEntityId", "secondProbability"];
const DEAD_HEAT_PHRASES: Phrase[] = [
  ph("DEAD_HEAT.qf.1", "A", "quick_fact", "{{firstEntityName}} and {{secondEntityName}} are separated by almost nothing at the top of the title model — {{firstProbabilityPct}}% to {{secondProbabilityPct}}%.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.qr.1", "B", "quick_reaction", "You could not call that title race with a coin right now.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.fact.1", "A", "fact", "Barely a percentage point in it between {{firstEntityName}} and {{secondEntityName}}.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.reaction.1", "B", "reaction", "This is exactly the kind of run-in that makes the whole season worth it.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.context.1", "A", "context", "Every remaining fixture for either side now carries real title weight.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
  ph("DEAD_HEAT.closer.1", "B", "closer", "Can't wait for the next round between these two.", "neutral", { requires: DEAD_HEAT_REQUIRES }),

ph("DEAD_HEAT.qf.2", "A", "quick_fact", "{{firstProbabilityPct}}% to {{secondProbabilityPct}}% — the model can't split {{firstEntityName}} and {{secondEntityName}} right now.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.qf.3", "A", "quick_fact", "It's a dead heat at the top between {{firstEntityName}} and {{secondEntityName}}.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.qr.2", "B", "quick_reaction", "Genuinely couldn't call that one either way.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.qr.3", "B", "quick_reaction", "Flip a coin — you'd have as much luck as the model right now.", "neutral", { requires: DEAD_HEAT_REQUIRES, tone: "humour" }),
ph("DEAD_HEAT.fact.2", "A", "fact", "{{firstEntityName}} and {{secondEntityName}} are effectively level in the title model.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.fact.3", "A", "fact", "Nothing meaningful separates {{firstEntityName}} from {{secondEntityName}} at the top right now.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.reaction.2", "B", "reaction", "Neither side's giving an inch, and I love that for the run-in.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.reaction.3", "B", "reaction", "This is what keeps you watching to the very last week.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.context.2", "A", "context", "With a gap that small, one result either way could settle the whole picture.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.context.3", "A", "context", "Neither {{firstEntityName}} nor {{secondEntityName}} can afford a slip from here.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.closer.2", "B", "closer", "Pull up a chair for this run-in.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.closer.3", "B", "closer", "However it goes, it's earned.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.model.1", "A", "model_context", "The model has {{firstEntityName}} and {{secondEntityName}} at {{firstProbabilityPct}}% and {{secondProbabilityPct}}% — as close as it gets.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.contrary.1", "B", "contrary_opinion", "Numbers say it's even, but if you made me pick, I'd still go with {{firstEntityName}}.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.evidence.1", "A", "evidence", "Fair enough, but the model's not finding a gap either — {{secondEntityName}}'s claim is just as strong right now.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.close.1", "B", "disagree_close", "Ask me again after the next round — I might change my mind.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.model.2", "A", "model_context", "There's next to nothing in it between {{firstEntityName}} and {{secondEntityName}} in the title model.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.contrary.2", "B", "contrary_opinion", "Then I'll happily be the one who says {{secondEntityName}} finishes on top of this.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.evidence.2", "A", "evidence", "Bold, but at {{firstProbabilityPct}}% to {{secondProbabilityPct}}% there's genuinely nothing in the numbers to back that over {{firstEntityName}}.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
ph("DEAD_HEAT.close.2", "B", "disagree_close", "Noted — you've heard my pick either way.", "neutral", { requires: DEAD_HEAT_REQUIRES }),
];

const TITLE_RACE_REQUIRES = ["viableEntityIds"];
const TITLE_RACE_PHRASES: Phrase[] = [
  ph("TITLE_RACE.obs.1", "B", "observation", "This title race has got real width to it — {{viableEntityNamesJoined}} all still have a genuine shout.", "neutral", { requires: TITLE_RACE_REQUIRES }),
  ph("TITLE_RACE.check.1", "A", "data_check", "The model agrees — {{viableEntityNamesJoined}} are all within a viable range of the title.", "neutral", { requires: TITLE_RACE_REQUIRES }),
  ph("TITLE_RACE.response.1", "B", "response", "Makes every remaining fixture must-watch.", "neutral", { requires: TITLE_RACE_REQUIRES }),
  ph("TITLE_RACE.qf.1", "A", "quick_fact", "Several sides are still viable for the title: {{viableEntityNamesJoined}}.", "neutral", { requires: TITLE_RACE_REQUIRES }),
  ph("TITLE_RACE.qr.1", "B", "quick_reaction", "Wide open — love a title race like this.", "neutral", { requires: TITLE_RACE_REQUIRES }),

ph("TITLE_RACE.obs.2", "B", "observation", "You've still got {{viableEntityNamesJoined}} all with something to play for.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.obs.3", "B", "observation", "Love a title race where you genuinely can't write anyone off yet — {{viableEntityNamesJoined}} the lot of them.", "positive", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.check.2", "A", "data_check", "Model's checked it — {{viableEntityNamesJoined}} all still sit inside a realistic title range.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.check.3", "A", "data_check", "Nothing's settled yet — {{viableEntityNamesJoined}} are all mathematically alive.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.response.2", "B", "response", "Every result from here changes the conversation.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.response.3", "B", "response", "Great for us, terrible for anyone trying to relax on the sofa.", "positive", { requires: TITLE_RACE_REQUIRES, tone: "humour" }),
ph("TITLE_RACE.qf.2", "A", "quick_fact", "The title's still up for grabs between {{viableEntityNamesJoined}}.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.qf.3", "A", "quick_fact", "That's {{viableEntityNamesJoined}} all still mathematically in the title picture.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.qr.2", "B", "quick_reaction", "This is the bit of the season you wait all year for.", "positive", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.qr.3", "B", "quick_reaction", "Nobody's allowed to relax with a list like that still live.", "neutral", { requires: TITLE_RACE_REQUIRES, tone: "humour" }),
ph("TITLE_RACE.model.1", "A", "model_context", "The model's got {{viableEntityNamesJoined}} all within touching distance of the title.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.contrary.1", "B", "contrary_opinion", "Model treats them as equal — I've already got my one out of that list, and I'm not changing it.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.evidence.1", "A", "evidence", "That's a hunch, though — nothing in the numbers actually separates {{viableEntityNamesJoined}} at this point.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.close.1", "B", "disagree_close", "Numbers can stay level. My mind's made up.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.model.2", "A", "model_context", "Every name in {{viableEntityNamesJoined}} still has a mathematically live route to the title.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.contrary.2", "B", "contrary_opinion", "Mathematically, sure — but watching them play, one of that group looks a clear step above the rest to me.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.evidence.2", "A", "evidence", "Maybe on the eye test, but the model's not seeing daylight between {{viableEntityNamesJoined}} yet.", "neutral", { requires: TITLE_RACE_REQUIRES }),
ph("TITLE_RACE.close.2", "B", "disagree_close", "Fine — the model can catch up whenever it's ready.", "neutral", { requires: TITLE_RACE_REQUIRES }),
];

const CHAMPION_REQUIRES = ["seasonId", "championEntityId"];
// qf.2's own requires, additionally needing seasonName — see
// story-detectors-league.ts's own comment on detectChampion for why
// seasonName is NOT added to the shared CHAMPION_REQUIRES above: stories
// already frozen in production before that change was made don't carry a
// seasonName in their stored facts and never will (CHAMPION is never
// re-upserted once written), so gating every CHAMPION phrase on it would
// silently drop their dialogue entirely. Keeping qf.1 (generic wording,
// old requires) AND adding qf.2 (season-specific wording, requires
// seasonName too) side by side means old stories still render exactly as
// before, while every NEW champion going forward becomes eligible for the
// clearer, season-naming wording — the fix that actually addresses a real
// user report ("last season's catch-up episode is just a clump of all
// seasons... can't tell which season is which").
const CHAMPION_REQUIRES_WITH_SEASON_NAME = [...CHAMPION_REQUIRES, "seasonName"];
const CHAMPION_PHRASES: Phrase[] = [
  // "{{championEntityName}} are/is this season's champion(s)" needs
  // singular agreement for a singles player's own name but plural for a
  // doubles/shift_wars team name ("Richard is..." vs "Team Fresh are...") —
  // rather than picking one and getting the other league type wrong, this
  // puts "is" on "champion" instead, which stays singular either way since
  // there's always exactly one, regardless of what kind of entity holds it.
  ph("CHAMPION.qf.1", "A", "quick_fact", "It's official — this season's champion is {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES }),
  ph("CHAMPION.qf.2", "A", "quick_fact", "It's official — {{seasonName}}'s champion is {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES_WITH_SEASON_NAME }),
  ph("CHAMPION.qr.1", "B", "quick_reaction", "Take a bow, {{championEntityName}} — fully deserved.", "positive", { requires: CHAMPION_REQUIRES, tone: "personality" }),
  ph("CHAMPION.perf.1", "A", "performance_fact", "A season-long effort confirmed with the title now mathematically settled.", "positive", { requires: CHAMPION_REQUIRES }),
  ph("CHAMPION.credit.1", "B", "credit", "That's a champion earned over the course of a whole season, not one lucky night.", "positive", { requires: CHAMPION_REQUIRES }),
  ph("CHAMPION.consequence.1", "A", "consequence", "The trophy's decided — attention turns to who challenges next season.", "positive", { requires: CHAMPION_REQUIRES }),

ph("CHAMPION.qf.3", "A", "quick_fact", "The title goes to {{championEntityName}} this season.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.qf.4", "A", "quick_fact", "Season over, and the champion's name is {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.qf.5", "A", "quick_fact", "The trophy has a new home — {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.qf.6", "A", "quick_fact", "Confirmed: the championship belongs to {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.qf.7", "A", "quick_fact", "That completes it — the title is {{championEntityName}}'s.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.qf.8", "A", "quick_fact", "The {{seasonName}} title goes to {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES_WITH_SEASON_NAME }),
ph("CHAMPION.qf.9", "A", "quick_fact", "That wraps up {{seasonName}} — the champion is {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES_WITH_SEASON_NAME }),
ph("CHAMPION.qr.2", "B", "quick_reaction", "Take a moment for that — a whole season's work, right there.", "positive", { requires: CHAMPION_REQUIRES, tone: "personality" }),
ph("CHAMPION.qr.3", "B", "quick_reaction", "Champion. Say it again — champion.", "positive", { requires: CHAMPION_REQUIRES, tone: "personality" }),
ph("CHAMPION.qr.4", "B", "quick_reaction", "Every result across the season added up to this moment.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.qr.5", "B", "quick_reaction", "What a journey it's been getting here.", "positive", { requires: CHAMPION_REQUIRES, tone: "personality" }),
ph("CHAMPION.qr.6", "B", "quick_reaction", "Somebody get the trophy polished for {{championEntityName}}.", "positive", { requires: CHAMPION_REQUIRES, tone: "humour" }),
ph("CHAMPION.qr.7", "B", "quick_reaction", "However this season twisted and turned, that's the finish {{championEntityName}} earned.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.perf.2", "A", "performance_fact", "Every phase of the season fed into this — the table settled it, not one big night.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.perf.3", "A", "performance_fact", "The title's been secured on cumulative points across the whole campaign.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.credit.2", "B", "credit", "Consistency did that — week in, week out, when it mattered.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.credit.3", "B", "credit", "Plenty of players have a great week. Not many turn it into a whole season.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.consequence.2", "A", "consequence", "The table's now settled at the very top — every other conversation this season builds toward this.", "positive", { requires: CHAMPION_REQUIRES }),
ph("CHAMPION.consequence.3", "A", "consequence", "That's the story of the season written — next up is who comes to challenge for it.", "positive", { requires: CHAMPION_REQUIRES }),
];

// SEASON_KICKOFF's own seasonName is a plain already-verified string fact
// (story-engine.ts pulls it straight off the seasons row), not an entity id
// needing resolution — so unlike CHAMPION's {{championEntityName}} it
// interpolates directly, the same way {{points}} does elsewhere in this file.
const SEASON_KICKOFF_REQUIRES = ["seasonId", "seasonName"];
const SEASON_KICKOFF_PHRASES: Phrase[] = [
  ph("SEASON_KICKOFF.qf.1", "A", "quick_fact", "The board resets — {{seasonName}} is officially under way.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
  ph("SEASON_KICKOFF.qr.1", "B", "quick_reaction", "Clean slate for everyone — love the start of a new season.", "neutral", { requires: SEASON_KICKOFF_REQUIRES, tone: "personality" }),
  ph("SEASON_KICKOFF.fact.1", "A", "fact", "{{entrantCount}} names go again for the {{seasonName}} title.", "neutral", { requires: [...SEASON_KICKOFF_REQUIRES, "entrantCount"] }),
  ph("SEASON_KICKOFF.context.1", "B", "context", "Whatever happened last time out, nobody's carrying a single point of it into this one.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
  ph("SEASON_KICKOFF.closer.1", "A", "closer", "Early days, but every table starts somewhere.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),

ph("SEASON_KICKOFF.qf.2", "A", "quick_fact", "{{seasonName}} gets under way — everyone back to zero on the table.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
ph("SEASON_KICKOFF.qf.3", "A", "quick_fact", "Opening night of {{seasonName}} is here.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
ph("SEASON_KICKOFF.qr.2", "B", "quick_reaction", "New season, new nerves for everybody involved.", "neutral", { requires: SEASON_KICKOFF_REQUIRES, tone: "personality" }),
ph("SEASON_KICKOFF.qr.3", "B", "quick_reaction", "Whatever went wrong last season, it's somebody else's problem to worry about now.", "neutral", { requires: SEASON_KICKOFF_REQUIRES, tone: "humour" }),
ph("SEASON_KICKOFF.fact.2", "A", "fact", "{{seasonName}} starts with every name in it back on level points.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
ph("SEASON_KICKOFF.fact.3", "A", "fact", "{{entrantCount}} entrants line up for {{seasonName}}.", "neutral", { requires: [...SEASON_KICKOFF_REQUIRES, "entrantCount"] }),
ph("SEASON_KICKOFF.context.2", "B", "context", "Reputations count for nothing until the table actually says otherwise.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
ph("SEASON_KICKOFF.context.3", "B", "context", "Plenty of time yet for a shape to this season to properly emerge.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
ph("SEASON_KICKOFF.closer.2", "A", "closer", "Let's see where {{seasonName}} takes us.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
ph("SEASON_KICKOFF.closer.3", "A", "closer", "Whoever wins it started today exactly like everyone else.", "neutral", { requires: SEASON_KICKOFF_REQUIRES }),
];

const TIE_PENDING_REQUIRES = ["seasonId", "tiedEntityIds", "points"];
const TIE_PENDING_PHRASES: Phrase[] = [
  ph("TIE_PENDING.qf.1", "A", "quick_fact", "We have a tie at the top on {{points}} points — {{tiedEntityNamesJoined}} — an official tiebreak will be needed.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.qr.1", "B", "quick_reaction", "Love a tiebreak, me — nothing else settles it fairly.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.fact.1", "A", "fact", "{{tiedEntityNamesJoined}} finish level on {{points}} points, so the rules go to a tiebreak.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.reaction.1", "B", "reaction", "However it's settled, nobody can say it wasn't earned.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.context.1", "A", "context", "We'll confirm the tiebreak format as soon as it's officially run.", "neutral", { requires: TIE_PENDING_REQUIRES }),
  ph("TIE_PENDING.closer.1", "B", "closer", "Can't ask for a tighter finish than that.", "neutral", { requires: TIE_PENDING_REQUIRES }),

ph("TIE_PENDING.qf.2", "A", "quick_fact", "{{tiedEntityNamesJoined}} are locked together on {{points}} points at the top.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.qf.3", "A", "quick_fact", "It's a genuine tie on {{points}} points between {{tiedEntityNamesJoined}} — the table alone can't split them.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.qr.2", "B", "quick_reaction", "Can't split them on paper, so let's split them on the board.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.qr.3", "B", "quick_reaction", "Whoever set the tiebreak rules, thank you — we need them tonight.", "neutral", { requires: TIE_PENDING_REQUIRES, tone: "humour" }),
ph("TIE_PENDING.fact.2", "A", "fact", "Nothing between {{tiedEntityNamesJoined}} — both level on {{points}} points.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.fact.3", "A", "fact", "The table alone can't separate {{tiedEntityNamesJoined}} on {{points}} points apiece.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.reaction.2", "B", "reaction", "That's a whole season boiled down to one more night.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.reaction.3", "B", "reaction", "Nerves for everybody involved in that one, I'd imagine.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.context.2", "A", "context", "The league's tiebreak procedure exists for exactly this scenario.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.context.3", "A", "context", "Both sides will want that resolved as quickly and fairly as possible.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.closer.2", "B", "closer", "Can't wait to see how that gets settled.", "neutral", { requires: TIE_PENDING_REQUIRES }),
ph("TIE_PENDING.closer.3", "B", "closer", "That's a finish worth sticking around for.", "neutral", { requires: TIE_PENDING_REQUIRES }),
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

ph("CAREER_MATCH_MILESTONE.qf.2", "A", "quick_fact", "{{playerName}} walks out for career match number {{careerGamesPlayed}} tonight.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
ph("CAREER_MATCH_MILESTONE.qf.3", "A", "quick_fact", "Match number {{careerGamesPlayed}} in the TKDL for {{playerName}} — still turning up.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
ph("CAREER_MATCH_MILESTONE.qr.2", "B", "quick_reaction", "You don't rack up {{careerGamesPlayed}} matches by accident.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
ph("CAREER_MATCH_MILESTONE.qr.3", "B", "quick_reaction", "{{careerGamesPlayed}} games in and {{playerName}}'s still enjoying it, by the look of things.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES, tone: "humour" }),
ph("CAREER_MATCH_MILESTONE.perf.2", "A", "performance_fact", "{{playerName}} adds another to a tally that now reads {{careerGamesPlayed}} TKDL matches.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
ph("CAREER_MATCH_MILESTONE.perf.3", "A", "performance_fact", "Match {{careerGamesPlayed}} of a genuinely long TKDL career for {{playerName}}.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
ph("CAREER_MATCH_MILESTONE.credit.2", "B", "credit", "That's a lot of Tuesday nights, that number.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES, tone: "humour" }),
ph("CAREER_MATCH_MILESTONE.credit.3", "B", "credit", "Availability like that is its own kind of consistency.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
ph("CAREER_MATCH_MILESTONE.consequence.2", "A", "consequence", "Numbers like {{careerGamesPlayed}} matches are what a proper TKDL career looks like.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
ph("CAREER_MATCH_MILESTONE.consequence.3", "A", "consequence", "Whatever else happens this season, {{careerGamesPlayed}} matches played is banked for good.", "positive", { requires: CAREER_MATCH_MILESTONE_REQUIRES }),
];

const CAREER_WIN_MILESTONE_REQUIRES = ["playerId", "careerWins"];
const CAREER_WIN_MILESTONE_PHRASES: Phrase[] = [
  ph("CAREER_WIN_MILESTONE.qf.1", "A", "quick_fact", "That's career win number {{careerWins}} for {{playerName}}.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
  ph("CAREER_WIN_MILESTONE.qr.1", "B", "quick_reaction", "Big number, that.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
  ph("CAREER_WIN_MILESTONE.perf.1", "A", "performance_fact", "{{careerWins}} career wins now on the board for {{playerName}}.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
  ph("CAREER_WIN_MILESTONE.credit.1", "B", "credit", "That tally doesn't build itself — years of work in that number.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
  ph("CAREER_WIN_MILESTONE.consequence.1", "A", "consequence", "A genuine landmark in {{playerName}}'s TKDL career.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),

ph("CAREER_WIN_MILESTONE.qf.2", "A", "quick_fact", "{{playerName}} picks up career win number {{careerWins}} tonight.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.qf.3", "A", "quick_fact", "That win takes {{playerName}}'s career total to {{careerWins}}.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.qr.2", "B", "quick_reaction", "{{careerWins}} wins is a serious number in this league.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.qr.3", "B", "quick_reaction", "Every one of those {{careerWins}} wins had to be earned.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.perf.2", "A", "performance_fact", "{{careerWins}} career wins now banked for {{playerName}}.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.perf.3", "A", "performance_fact", "The win column for {{playerName}} now reads {{careerWins}} for their TKDL career.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.credit.2", "B", "credit", "That's not a number you stumble into — plenty of hard nights behind it.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.credit.3", "B", "credit", "Win {{careerWins}} looks just like win one on the scoresheet, but it never feels that way.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.consequence.2", "A", "consequence", "{{careerWins}} wins deep, and {{playerName}} still looks hungry for more.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
ph("CAREER_WIN_MILESTONE.consequence.3", "A", "consequence", "A tally like that is a genuine marker of where {{playerName}}'s career stands right now.", "positive", { requires: CAREER_WIN_MILESTONE_REQUIRES }),
];

const MILESTONE_180_REQUIRES = ["playerId", "career180s", "matchThrown180s"];
const MILESTONE_180_PHRASES: Phrase[] = [
  ph("180_MILESTONE.qf.1", "A", "quick_fact", "{{playerName}} throws {{matchThrown180s}} maximums tonight, taking the career tally to {{career180s}}.", "positive", { requires: MILESTONE_180_REQUIRES }),
  ph("180_MILESTONE.qr.1", "B", "quick_reaction", "One-hundred-and-eighty! Love hearing that called out.", "positive", { requires: MILESTONE_180_REQUIRES, tone: "personality" }),
  ph("180_MILESTONE.perf.1", "A", "performance_fact", "{{career180s}} career maximums now for {{playerName}}.", "positive", { requires: MILESTONE_180_REQUIRES }),
  ph("180_MILESTONE.credit.1", "B", "credit", "Every one of those takes real composure to hit.", "positive", { requires: MILESTONE_180_REQUIRES }),
  ph("180_MILESTONE.consequence.1", "A", "consequence", "A tally like that puts {{playerName}} right up among the league's biggest scorers.", "positive", { requires: MILESTONE_180_REQUIRES }),

ph("180_MILESTONE.qf.2", "A", "quick_fact", "{{matchThrown180s}} maximums for {{playerName}} tonight — the career count moves to {{career180s}}.", "positive", { requires: MILESTONE_180_REQUIRES }),
ph("180_MILESTONE.qf.3", "A", "quick_fact", "{{playerName}} finds {{matchThrown180s}} tons-eighty this match, career tally now {{career180s}}.", "positive", { requires: MILESTONE_180_REQUIRES }),
ph("180_MILESTONE.qr.2", "B", "quick_reaction", "Love hearing that number tick over — {{career180s}} now.", "positive", { requires: MILESTONE_180_REQUIRES, tone: "personality" }),
ph("180_MILESTONE.qr.3", "B", "quick_reaction", "{{matchThrown180s}} big finishes tonight, and the crowd loved every one.", "positive", { requires: MILESTONE_180_REQUIRES }),
ph("180_MILESTONE.perf.2", "A", "performance_fact", "The career 180 count for {{playerName}} now stands at {{career180s}}.", "positive", { requires: MILESTONE_180_REQUIRES }),
ph("180_MILESTONE.perf.3", "A", "performance_fact", "{{matchThrown180s}} maximums tonight push {{playerName}}'s career tally to {{career180s}}.", "positive", { requires: MILESTONE_180_REQUIRES }),
ph("180_MILESTONE.credit.2", "B", "credit", "Hitting the same treble that many times under pressure is no fluke.", "positive", { requires: MILESTONE_180_REQUIRES }),
ph("180_MILESTONE.credit.3", "B", "credit", "{{career180s}} of those in a career — that's a lot of nerve on repeat.", "positive", { requires: MILESTONE_180_REQUIRES }),
ph("180_MILESTONE.consequence.2", "A", "consequence", "Scoring like that keeps {{playerName}} firmly in the conversation among the league's biggest hitters.", "positive", { requires: MILESTONE_180_REQUIRES }),
ph("180_MILESTONE.consequence.3", "A", "consequence", "A tally of {{career180s}} maximums is the kind of number that gets remembered around this league.", "positive", { requires: MILESTONE_180_REQUIRES }),
];

const ELIMINATION_MILESTONE_REQUIRES = ["playerId", "careerEliminations"];
const ELIMINATION_MILESTONE_PHRASES: Phrase[] = [
  ph("ELIMINATION_MILESTONE.qf.1", "A", "quick_fact", "That's career elimination number {{careerEliminations}} for {{playerName}}.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
  ph("ELIMINATION_MILESTONE.qr.1", "B", "quick_reaction", "Not the number anyone wants to see go up, that one.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES, tone: "humour" }),
  ph("ELIMINATION_MILESTONE.fact.1", "A", "fact", "{{careerEliminations}} career eliminations now on the books for {{playerName}}.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
  ph("ELIMINATION_MILESTONE.reaction.1", "B", "reaction", "Comes with the territory in a knockout format — happens to everyone eventually.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
  ph("ELIMINATION_MILESTONE.context.1", "A", "context", "Plenty of players on that same list who've bounced straight back the following season.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
  ph("ELIMINATION_MILESTONE.closer.1", "B", "closer", "Back stronger next time, no doubt.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),

ph("ELIMINATION_MILESTONE.qf.2", "A", "quick_fact", "{{playerName}} picks up career elimination number {{careerEliminations}} tonight.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.qf.3", "A", "quick_fact", "Elimination number {{careerEliminations}} for {{playerName}} in this one.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.qr.2", "B", "quick_reaction", "Nobody enjoys watching that number climb.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.qr.3", "B", "quick_reaction", "That's a rough way to head home, that.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES, tone: "humour" }),
ph("ELIMINATION_MILESTONE.fact.2", "A", "fact", "{{careerEliminations}} career eliminations is simply part of playing a knockout format long enough.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.fact.3", "A", "fact", "The elimination count for {{playerName}} moves to {{careerEliminations}} tonight.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.reaction.2", "B", "reaction", "Every player in this league carries a number like that somewhere.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.reaction.3", "B", "reaction", "Knockout darts doesn't care how well you've played all season — one bad night and that's it.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.context.2", "A", "context", "Nothing about tonight changes how {{playerName}} sits in the wider season picture.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.context.3", "A", "context", "That's the sharp edge of a knockout format — it catches everybody eventually.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.closer.2", "B", "closer", "Straight back to it next time out, that's the way.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.closer.3", "B", "closer", "Onwards for {{playerName}} — the board doesn't remember tonight for long.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.model.1", "A", "model_context", "{{careerEliminations}} career eliminations for {{playerName}} — on its own, that number reads worse than it should.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.contrary.1", "B", "contrary_opinion", "Come on, it's a knockout league — everybody who sticks around long enough collects a few of those.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.evidence.1", "A", "evidence", "Fair point — the format itself guarantees that count rises for anyone who keeps entering, win or lose.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
ph("ELIMINATION_MILESTONE.close.1", "B", "disagree_close", "Exactly — judge {{playerName}} on the darts, not on a number the format hands out to everyone.", "neutral", { requires: ELIMINATION_MILESTONE_REQUIRES }),
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

ph("PAIR_UPSET.qf.2", "A", "quick_fact", "{{winnerTeamName}} spring the surprise on {{loserTeamName}}, having gone in at just {{winnerProbabilityPct}}%.", "positive", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.qf.3", "A", "quick_fact", "Nobody had {{winnerTeamName}} winning this at {{winnerProbabilityPct}}%, but here we are.", "positive", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.qr.2", "B", "quick_reaction", "That's the kind of result that makes doubles night worth tuning in for.", "positive", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.qr.3", "B", "quick_reaction", "{{loserTeamName}} will be replaying that one in their heads all week.", "neutral", { requires: PAIR_UPSET_REQUIRES, tone: "humour" }),
ph("PAIR_UPSET.model.2", "A", "model_context", "Pre-match, the model had {{loserTeamName}} as clear favourites over {{winnerTeamName}}.", "neutral", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.model.3", "A", "model_context", "The number going in was just {{winnerProbabilityPct}}% for {{winnerTeamName}} — barely a look-in, on paper.", "neutral", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.contrary.2", "B", "contrary_opinion", "Doubles isn't just two singles players added together — the partnership on the night matters more than any percentage.", "positive", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.contrary.3", "B", "contrary_opinion", "You can't model nerve, and {{winnerTeamName}} had plenty of it tonight.", "positive", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.evidence.2", "A", "evidence", "Maybe so, but landing a shot that low still says something real about how they played tonight.", "neutral", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.evidence.3", "A", "evidence", "Whatever the reason behind it, {{winnerProbabilityPct}}% landing is still a genuinely rare result.", "neutral", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.close.2", "B", "disagree_close", "Call it chemistry, call it nerve — {{winnerTeamName}} got the job done.", "positive", { requires: PAIR_UPSET_REQUIRES }),
ph("PAIR_UPSET.close.3", "B", "disagree_close", "Numbers can argue all they like — the scoreboard's already settled it.", "positive", { requires: PAIR_UPSET_REQUIRES, tone: "personality" }),
];

const PAIR_ELIMINATED_REQUIRES = ["winnerTeamId", "loserTeamId"];
const PAIR_ELIMINATED_PHRASES: Phrase[] = [
  ph("PAIR_ELIMINATED.qf.1", "A", "quick_fact", "{{loserTeamName}} are out, beaten by {{winnerTeamName}}.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.qr.1", "B", "quick_reaction", "Tough end to the campaign for that pairing.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.fact.1", "A", "fact", "That result confirms {{loserTeamName}}'s elimination, with {{winnerTeamName}} through.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.reaction.1", "B", "reaction", "Doubles is a cruel format sometimes — one bad night and it's over.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.context.1", "A", "context", "That also reshapes who's still in the running elsewhere in the draw.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
  ph("PAIR_ELIMINATED.closer.1", "B", "closer", "Good run while it lasted for {{loserTeamName}}.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),

ph("PAIR_ELIMINATED.qf.2", "A", "quick_fact", "{{loserTeamName}}'s run in the doubles ends here, beaten by {{winnerTeamName}}.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.qf.3", "A", "quick_fact", "It's over for {{loserTeamName}} tonight — {{winnerTeamName}} get the win that ends it.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.qr.2", "B", "quick_reaction", "Doubles campaigns can end fast, and that's exactly what just happened.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.qr.3", "B", "quick_reaction", "Tough scenes for that pairing.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.fact.2", "A", "fact", "{{winnerTeamName}} move through, and {{loserTeamName}}'s campaign is done.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.fact.3", "A", "fact", "One result and {{loserTeamName}} are out, {{winnerTeamName}} through in their place.", "negative", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.reaction.2", "B", "reaction", "That's the format for you — win or go home, no room for a bad night.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.reaction.3", "B", "reaction", "At least {{loserTeamName}} can say they gave it everything.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.context.2", "A", "context", "The draw opens up a little further for whoever {{winnerTeamName}} meet next.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.context.3", "A", "context", "Results like that always ripple through the rest of the bracket.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.closer.2", "B", "closer", "See you next season, {{loserTeamName}}.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
ph("PAIR_ELIMINATED.closer.3", "B", "closer", "Plenty to build on for {{loserTeamName}} next time round.", "neutral", { requires: PAIR_ELIMINATED_REQUIRES }),
];

const UNBEATEN_PAIR_REQUIRES = ["teamId", "wins"];
const UNBEATEN_PAIR_PHRASES: Phrase[] = [
  ph("UNBEATEN_PAIR.qf.1", "A", "quick_fact", "{{teamName}} remain unbeaten after {{wins}} matches this season.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
  ph("UNBEATEN_PAIR.qr.1", "B", "quick_reaction", "Nobody's found an answer for {{teamName}} yet.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
  ph("UNBEATEN_PAIR.perf.1", "A", "performance_fact", "An unbeaten run still intact after {{wins}} matches for {{teamName}}.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
  ph("UNBEATEN_PAIR.credit.1", "B", "credit", "That kind of consistency as a pair is genuinely hard to build.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
  ph("UNBEATEN_PAIR.consequence.1", "A", "consequence", "Keep that run going and {{teamName}} are the team everyone else is chasing.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),

ph("UNBEATEN_PAIR.qf.2", "A", "quick_fact", "{{teamName}} are still unbeaten, {{wins}} matches into the season.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.qf.3", "A", "quick_fact", "Not a single loss yet for {{teamName}} across {{wins}} matches.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.qr.2", "B", "quick_reaction", "Every week I look for the result that ends it, and every week it doesn't come.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.qr.3", "B", "quick_reaction", "{{teamName}} just keep finding a way.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.perf.2", "A", "performance_fact", "{{wins}} matches played, {{wins}} matches won — the unbeaten mark stands for {{teamName}}.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.perf.3", "A", "performance_fact", "The unbeaten tag is still very much intact for {{teamName}} after {{wins}} matches.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.credit.2", "B", "credit", "Staying unbeaten this deep into a season takes more than just talent.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.credit.3", "B", "credit", "That's a partnership that hasn't put a foot wrong yet.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.consequence.2", "A", "consequence", "Every match {{teamName}} play now carries a little extra weight, given what's on the line.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.consequence.3", "A", "consequence", "Stretch that run further and {{teamName}} become the team everyone else is building their own season around beating.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.model.1", "A", "model_context", "{{wins}} matches unbeaten is the number, but it's worth asking how much longer a perfect run like that can realistically hold up.", "neutral", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.contrary.1", "B", "contrary_opinion", "Why not back them fully? {{teamName}} haven't lost once in {{wins}} matches — that's the actual result here.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.evidence.1", "A", "evidence", "Fair — until there's an actual defeat on the board, {{wins}} unbeaten is exactly what it says it is.", "neutral", { requires: UNBEATEN_PAIR_REQUIRES }),
ph("UNBEATEN_PAIR.close.1", "B", "disagree_close", "Exactly. Believe it until somebody actually beats them.", "positive", { requires: UNBEATEN_PAIR_REQUIRES }),
];

const PAIR_SURGE_REQUIRES = ["teamId", "currentWinStreak"];
const PAIR_SURGE_PHRASES: Phrase[] = [
  ph("PAIR_SURGE.qf.1", "A", "quick_fact", "{{teamName}} are picking up serious momentum, on a run of {{currentWinStreak}} wins.", "positive", { requires: PAIR_SURGE_REQUIRES }),
  ph("PAIR_SURGE.qr.1", "B", "quick_reaction", "{{teamName}} are the pairing nobody wants to draw right now.", "positive", { requires: PAIR_SURGE_REQUIRES }),
  ph("PAIR_SURGE.perf.1", "A", "performance_fact", "{{currentWinStreak}} wins on the spin has {{teamName}} moving fast up the table.", "positive", { requires: PAIR_SURGE_REQUIRES }),
  ph("PAIR_SURGE.credit.1", "B", "credit", "That's a partnership properly clicking at the right time.", "positive", { requires: PAIR_SURGE_REQUIRES }),
  ph("PAIR_SURGE.consequence.1", "A", "consequence", "Keep that surge going and {{teamName}} force their way into the title picture.", "positive", { requires: PAIR_SURGE_REQUIRES }),

ph("PAIR_SURGE.qf.2", "A", "quick_fact", "{{teamName}} have now won {{currentWinStreak}} in a row.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.qf.3", "A", "quick_fact", "That's {{currentWinStreak}} straight wins for {{teamName}} — momentum building fast.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.qr.2", "B", "quick_reaction", "{{teamName}} look like a completely different pairing right now.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.qr.3", "B", "quick_reaction", "You can feel that run building into something.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.perf.2", "A", "performance_fact", "{{currentWinStreak}} consecutive wins now on the board for {{teamName}}.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.perf.3", "A", "performance_fact", "The streak for {{teamName}} extends to {{currentWinStreak}} matches.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.credit.2", "B", "credit", "That's a pairing that's found their rhythm at exactly the right time.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.credit.3", "B", "credit", "Whatever they've changed, it's working match after match.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.consequence.2", "A", "consequence", "A run like {{currentWinStreak}} wins can turn a season around fast for {{teamName}}.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.consequence.3", "A", "consequence", "Keep the streak alive and {{teamName}} climb the table quicker than anyone expected.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.model.1", "A", "model_context", "{{currentWinStreak}} wins in a row for {{teamName}} — the question now is whether that run's built to last.", "neutral", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.contrary.1", "B", "contrary_opinion", "A win's a win, however it happens — {{currentWinStreak}} on the spin doesn't need an asterisk.", "positive", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.evidence.1", "A", "evidence", "Agreed on that much — the result stands regardless of how the schedule's fallen, so credit where it's due.", "neutral", { requires: PAIR_SURGE_REQUIRES }),
ph("PAIR_SURGE.close.1", "B", "disagree_close", "Glad we got there. {{teamName}} earned every one of those {{currentWinStreak}}.", "positive", { requires: PAIR_SURGE_REQUIRES }),
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

ph("SHIFT_LEAD_CHANGE.qf.2", "A", "quick_fact", "{{newLeaderTeamName}} move top of Shift Wars, edging past {{previousLeaderTeamName}} on {{points}} points.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.qf.3", "A", "quick_fact", "New name at the top of the department standings — {{newLeaderTeamName}}, on {{points}} points.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.qr.2", "B", "quick_reaction", "That'll be the talk of the shop floor tomorrow morning.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES, tone: "humour" }),
ph("SHIFT_LEAD_CHANGE.qr.3", "B", "quick_reaction", "{{previousLeaderTeamName}} won't be happy giving that one up.", "neutral", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.fact.2", "A", "fact", "{{points}} points is enough to send {{newLeaderTeamName}} past {{previousLeaderTeamName}} at the summit.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.fact.3", "A", "fact", "The department lead changes hands, {{newLeaderTeamName}} now out in front on {{points}}.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.reaction.2", "B", "reaction", "Every shift's got a stake in this now.", "neutral", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.reaction.3", "B", "reaction", "{{previousLeaderTeamName}} will want an answer, and quickly.", "neutral", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.context.2", "A", "context", "Shift Wars leads have a habit of not staying settled for long.", "neutral", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.context.3", "A", "context", "Whoever's on top in this competition rarely stays there uncontested.", "neutral", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.closer.2", "B", "closer", "New leaders on the board, at least for now.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES }),
ph("SHIFT_LEAD_CHANGE.closer.3", "B", "closer", "That's one for the noticeboard by the clocking-in machine.", "positive", { requires: SHIFT_LEAD_CHANGE_REQUIRES, tone: "humour" }),
];

const SHIFT_MOMENTUM_REQUIRES = ["leaderTeamId", "previousGap", "currentGap", "direction"];
const SHIFT_MOMENTUM_PHRASES: Phrase[] = [
  ph("SHIFT_MOMENTUM.qf.1", "A", "quick_fact", "The gap at the top of Shift Wars has moved from {{previousGap}} to {{currentGap}} points.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
  ph("SHIFT_MOMENTUM.qr.1", "B", "quick_reaction", "Real momentum shift building there.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
  ph("SHIFT_MOMENTUM.fact.1", "A", "fact", "That gap has gone from {{previousGap}} to {{currentGap}} in recent results.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
  ph("SHIFT_MOMENTUM.reaction.1", "B", "reaction", "The department chat will be buzzing about that one.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES, tone: "humour" }),
  ph("SHIFT_MOMENTUM.context.1", "A", "context", "Worth watching whether that momentum carries into next week's fixtures.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
  ph("SHIFT_MOMENTUM.closer.1", "B", "closer", "Shift Wars never sits still for long.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),

ph("SHIFT_MOMENTUM.qf.2", "A", "quick_fact", "The gap at the top of Shift Wars has shifted from {{previousGap}} to {{currentGap}}.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.qf.3", "A", "quick_fact", "{{leaderTeamName}}'s lead now reads {{currentGap}}, having stood at {{previousGap}} not long ago.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.qr.2", "B", "quick_reaction", "That number's been moving around a fair bit lately.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.qr.3", "B", "quick_reaction", "Everyone on that shift floor is watching that gap like a hawk.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES, tone: "humour" }),
ph("SHIFT_MOMENTUM.fact.2", "A", "fact", "From {{previousGap}} to {{currentGap}} — the standings at the top keep shifting.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.fact.3", "A", "fact", "The lead has moved from {{previousGap}} out to {{currentGap}} in recent results.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.reaction.2", "B", "reaction", "Numbers like that keep the whole department invested.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.reaction.3", "B", "reaction", "A gap moving that much always gets people talking.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.context.2", "A", "context", "How that gap moves from here says a lot about who's actually in form.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.context.3", "A", "context", "One good week can swing that number again just as easily.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.closer.2", "B", "closer", "Watch that space — it never stays still for long.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.closer.3", "B", "closer", "That gap's the story to follow for now.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.model.1", "A", "model_context", "The gap's moved from {{previousGap}} to {{currentGap}} — on paper, that reads like real movement at the top.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.contrary.1", "B", "contrary_opinion", "With matches still to play, I wouldn't read too much into one gap changing size — plenty of time for it to move straight back.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.evidence.1", "A", "evidence", "That's fair, but a shift from {{previousGap}} to {{currentGap}} still had to be earned on the board, whatever happens next.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
ph("SHIFT_MOMENTUM.close.1", "B", "disagree_close", "True enough — I'll just wait and see if it's still moving the same way next time out.", "neutral", { requires: SHIFT_MOMENTUM_REQUIRES }),
];

const SHIFT_COMEBACK_REQUIRES = ["teamId", "deficitBefore", "deficitNow", "matches"];
const SHIFT_COMEBACK_PHRASES: Phrase[] = [
  ph("SHIFT_COMEBACK.qf.1", "A", "quick_fact", "{{teamName}} have cut their deficit from {{deficitBefore}} to {{deficitNow}} points over the last {{matches}} matches.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
  ph("SHIFT_COMEBACK.qr.1", "B", "quick_reaction", "That's a proper fightback from {{teamName}}.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
  ph("SHIFT_COMEBACK.perf.1", "A", "performance_fact", "A deficit of {{deficitBefore}} is down to just {{deficitNow}} now.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
  ph("SHIFT_COMEBACK.credit.1", "B", "credit", "Clawing back a gap like that takes real consistency across the department.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
  ph("SHIFT_COMEBACK.consequence.1", "A", "consequence", "Keep that recovery going and {{teamName}} are right back in this.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),

ph("SHIFT_COMEBACK.qf.2", "A", "quick_fact", "{{teamName}} have pulled their deficit in from {{deficitBefore}} down to {{deficitNow}} in {{matches}} matches.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.qf.3", "A", "quick_fact", "That gap has closed from {{deficitBefore}} to just {{deficitNow}} for {{teamName}}.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.qr.2", "B", "quick_reaction", "That's a proper response from {{teamName}}.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.qr.3", "B", "quick_reaction", "Nobody saw that comeback coming a few weeks ago.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.perf.2", "A", "performance_fact", "{{matches}} matches, and the deficit's down from {{deficitBefore}} to {{deficitNow}}.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.perf.3", "A", "performance_fact", "A steady climb has {{teamName}}'s deficit shrinking from {{deficitBefore}} to {{deficitNow}}.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.credit.2", "B", "credit", "That kind of recovery doesn't happen without the whole department pulling together.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.credit.3", "B", "credit", "Cutting a gap like that down takes real consistency, match after match.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.consequence.2", "A", "consequence", "Keep trimming that deficit and {{teamName}} put real pressure on whoever's above them.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
ph("SHIFT_COMEBACK.consequence.3", "A", "consequence", "A run like that changes the whole complexion of the Shift Wars table.", "positive", { requires: SHIFT_COMEBACK_REQUIRES }),
];

const SHIFT_DOMINANCE_REQUIRES = ["teamId", "wins", "losses", "winShare"];
const SHIFT_DOMINANCE_PHRASES: Phrase[] = [
  ph("SHIFT_DOMINANCE.qf.1", "A", "quick_fact", "{{teamName}} have {{wins}} wins against just {{losses}} losses this season — a genuinely dominant win share.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
  ph("SHIFT_DOMINANCE.qr.1", "B", "quick_reaction", "Nobody else in the department is close to that.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
  ph("SHIFT_DOMINANCE.perf.1", "A", "performance_fact", "{{wins}} wins against just {{losses}} losses — a real gulf to the rest of Shift Wars.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
  ph("SHIFT_DOMINANCE.credit.1", "B", "credit", "That's a team playing at a different level to everyone else right now.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
  ph("SHIFT_DOMINANCE.consequence.1", "A", "consequence", "At that win rate, the title conversation in Shift Wars starts and ends with {{teamName}}.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),

ph("SHIFT_DOMINANCE.qf.2", "A", "quick_fact", "{{teamName}} sit on {{wins}} wins to {{losses}} losses — a serious win share this season.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.qf.3", "A", "quick_fact", "{{wins}} wins against {{losses}} losses tells you exactly where {{teamName}} stand in Shift Wars right now.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.qr.2", "B", "quick_reaction", "Nobody else in the department is putting up numbers like that.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.qr.3", "B", "quick_reaction", "That's a genuinely one-sided season so far for {{teamName}}.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.perf.2", "A", "performance_fact", "A win share that high, from {{wins}} wins against {{losses}} losses, sets {{teamName}} apart.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.perf.3", "A", "performance_fact", "{{wins}}-{{losses}} is about as clear a gap as you'll see in Shift Wars.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.credit.2", "B", "credit", "Every shift's been chasing shadows against {{teamName}} this season.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES, tone: "humour" }),
ph("SHIFT_DOMINANCE.credit.3", "B", "credit", "That's a team turning up and delivering, week in, week out.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.consequence.2", "A", "consequence", "Keep that win share up and the rest of the department is playing for second.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.consequence.3", "A", "consequence", "Numbers like {{wins}} and {{losses}} put {{teamName}} in a different bracket to everyone else right now.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.model.1", "A", "model_context", "{{wins}} wins to {{losses}} losses puts {{teamName}} well clear of the rest of the department on paper.", "neutral", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.contrary.1", "B", "contrary_opinion", "Well clear now, sure, but Shift Wars has a way of tightening up — I wouldn't call this one done yet.", "neutral", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.evidence.1", "A", "evidence", "Maybe, but a win share like that doesn't happen by accident — the rest of the department has to actually find an answer to it.", "neutral", { requires: SHIFT_DOMINANCE_REQUIRES }),
ph("SHIFT_DOMINANCE.close.1", "B", "disagree_close", "Fine, they've earned the tag for now — let's see if anyone actually closes the gap.", "positive", { requires: SHIFT_DOMINANCE_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// ARCHIVE family (3 types) — evergreen supporting context, cross-league.
// ════════════════════════════════════════════════════════════════════════

const LAST_MEETING_REQUIRES = ["entityAId", "entityBId", "lastMeetingWinnerId", "lastMeetingStake"];
// lastMeetingYear-aware variant of the quick_fact line — safe to require
// unconditionally (unlike CHAMPION/SEASON_COMPARISON's new season names,
// lastMeetingYear is derived from lastMeetingPlayedAt, a fact every
// LAST_MEETING story has always carried since this detector's first
// version — see story-detectors-archive.ts's own comment). Still kept as
// an ADDITIONAL phrase alongside qf.1 rather than a replacement: this
// story type is evergreen supporting context that can legitimately air
// beside a genuinely upcoming fixture (where "these two last met, X won"
// reads fine with no year needed) as well as standalone in a retrospective
// (where the year is exactly the missing context) — both phrasings are
// correct, just suited to different airings.
const LAST_MEETING_REQUIRES_WITH_YEAR = [...LAST_MEETING_REQUIRES, "lastMeetingYear"];
const LAST_MEETING_PHRASES: Phrase[] = [
  ph("LAST_MEETING.qf.1", "A", "quick_fact", "These two last met with {{lastMeetingWinnerName}} coming out on top, {{lastMeetingStake}} points on the line.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.qf.2", "A", "quick_fact", "These two last met back in {{lastMeetingYear}}, with {{lastMeetingWinnerName}} coming out on top.", "neutral", { requires: LAST_MEETING_REQUIRES_WITH_YEAR }),
  ph("LAST_MEETING.qr.1", "B", "quick_reaction", "Good bit of context, that.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.fact.1", "A", "fact", "{{lastMeetingWinnerName}} won the last meeting between {{entityAName}} and {{entityBName}}.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  // Was "Whether that means anything tonight is a different question
  // entirely." / "form on the night usually has the final say." — both
  // asserted a match was happening "tonight," which is only true when this
  // evergreen story happens to be airing right beside that actual fixture.
  // Slotted in on its own (e.g. as retrospective/archive filler, exactly
  // the scenario a real user report traced to this family), "tonight" is
  // simply false. Reworded to hold true either way.
  ph("LAST_MEETING.reaction.1", "B", "reaction", "Whether that carries any weight next time is a different question entirely.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.context.1", "A", "context", "History's one thing — current form usually has the final say.", "neutral", { requires: LAST_MEETING_REQUIRES }),
  ph("LAST_MEETING.closer.1", "B", "closer", "Let's see if that pattern holds.", "neutral", { requires: LAST_MEETING_REQUIRES }),

ph("LAST_MEETING.qf.3", "A", "quick_fact", "The head-to-head history here isn't blank — {{lastMeetingWinnerName}} won it last time out, with {{lastMeetingStake}} points at stake.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.qf.4", "A", "quick_fact", "Rewind to {{lastMeetingYear}} and it was {{lastMeetingWinnerName}} who came out on top in this exact meeting.", "neutral", { requires: LAST_MEETING_REQUIRES_WITH_YEAR }),
ph("LAST_MEETING.qr.2", "B", "quick_reaction", "Always worth knowing who won the last one before this gets going.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.qr.3", "B", "quick_reaction", "That's a nice bit of history to have in the back pocket.", "neutral", { requires: LAST_MEETING_REQUIRES, tone: "humour" }),
ph("LAST_MEETING.fact.2", "A", "fact", "{{lastMeetingStake}} points were on the line last time these two met, and {{lastMeetingWinnerName}} took them.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.fact.3", "A", "fact", "The last meeting between {{entityAName}} and {{entityBName}} went the way of {{lastMeetingWinnerName}}.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.reaction.2", "B", "reaction", "History like that sets a bit of a marker, even if it doesn't decide anything.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.reaction.3", "B", "reaction", "Doesn't guarantee a thing next time, but it's the kind of detail that sticks.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.context.2", "A", "context", "Past results are useful context — they're not a prediction on their own.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.context.3", "A", "context", "Worth filing that one away rather than reading too much into it.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.closer.2", "B", "closer", "History's noted — over to the current form now.", "neutral", { requires: LAST_MEETING_REQUIRES }),
ph("LAST_MEETING.closer.3", "B", "closer", "One for the archive either way.", "neutral", { requires: LAST_MEETING_REQUIRES }),
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
// Season-name-aware variants, same additive pattern as CHAMPION.qf.2 above
// (see story-detectors-archive.ts's own comment on why currentSeasonName/
// previousSeasonName aren't added to the plain REQUIRES constants instead)
// — old frozen rows keep using the generic "this season"/"last season"
// phrases below unchanged, new ones become eligible for these too once
// gatherSeasonComparisonFactsForPlayer starts supplying the names.
const SEASON_COMPARISON_IMPROVED_REQUIRES_WITH_NAMES = [...SEASON_COMPARISON_IMPROVED_REQUIRES, "currentSeasonName", "previousSeasonName"];
const SEASON_COMPARISON_DECLINED_REQUIRES_WITH_NAMES = [...SEASON_COMPARISON_DECLINED_REQUIRES, "currentSeasonName", "previousSeasonName"];
const SEASON_COMPARISON_PHRASES: Phrase[] = [
  ph("SEASON_COMPARISON.qf.improved.1", "A", "quick_fact", "{{entityName}}'s win rate this season is running well clear of last season's mark.", "neutral", { requires: SEASON_COMPARISON_IMPROVED_REQUIRES }),
  ph("SEASON_COMPARISON.qf.improved.2", "A", "quick_fact", "{{entityName}}'s win rate in {{currentSeasonName}} is running well clear of {{previousSeasonName}}'s mark.", "neutral", { requires: SEASON_COMPARISON_IMPROVED_REQUIRES_WITH_NAMES }),
  ph("SEASON_COMPARISON.qf.declined.1", "A", "quick_fact", "{{entityName}}'s win rate this season is well down on last season's mark.", "neutral", { requires: SEASON_COMPARISON_DECLINED_REQUIRES }),
  ph("SEASON_COMPARISON.qf.declined.2", "A", "quick_fact", "{{entityName}}'s win rate in {{currentSeasonName}} is well down on {{previousSeasonName}}'s mark.", "neutral", { requires: SEASON_COMPARISON_DECLINED_REQUIRES_WITH_NAMES }),
  ph("SEASON_COMPARISON.qr.improved.1", "B", "quick_reaction", "Proper step up from last season, that.", "neutral", { requires: SEASON_COMPARISON_IMPROVED_REQUIRES }),
  ph("SEASON_COMPARISON.qr.declined.1", "B", "quick_reaction", "That's a real step back from last season.", "neutral", { requires: SEASON_COMPARISON_DECLINED_REQUIRES }),
  ph("SEASON_COMPARISON.fact.1", "A", "fact", "A material change from last season's win rate to this one for {{entityName}}.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
  ph("SEASON_COMPARISON.reaction.1", "B", "reaction", "Season-on-season numbers like that don't happen by accident.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
  // Was "Worth remembering as the season goes on" — asserted a season was
  // CURRENTLY in progress, which is false whenever this fires as
  // retrospective/archive content well after that season closed (exactly
  // the "clump of all seasons" scenario a real user report traced here).
  ph("SEASON_COMPARISON.context.1", "A", "context", "Worth remembering when you look back on it — that trajectory tells its own story.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
  ph("SEASON_COMPARISON.closer.1", "B", "closer", "Different season, different {{entityName}}.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),

ph("SEASON_COMPARISON.qf.improved.3", "A", "quick_fact", "Set the two seasons side by side and {{entityName}}'s numbers have clearly climbed.", "neutral", { requires: SEASON_COMPARISON_IMPROVED_REQUIRES }),
ph("SEASON_COMPARISON.qf.declined.3", "A", "quick_fact", "Set the two seasons side by side and {{entityName}}'s numbers have clearly dipped.", "neutral", { requires: SEASON_COMPARISON_DECLINED_REQUIRES }),
ph("SEASON_COMPARISON.qr.improved.2", "B", "quick_reaction", "You don't get a swing like that by accident.", "neutral", { requires: SEASON_COMPARISON_IMPROVED_REQUIRES }),
ph("SEASON_COMPARISON.qr.declined.2", "B", "quick_reaction", "That's a swing in the wrong direction, no way around it.", "neutral", { requires: SEASON_COMPARISON_DECLINED_REQUIRES }),
ph("SEASON_COMPARISON.fact.2", "A", "fact", "Two different win rates, two different seasons — worth putting side by side for {{entityName}}.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
ph("SEASON_COMPARISON.fact.3", "A", "fact", "Season-on-season, the numbers for {{entityName}} simply don't match up.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
ph("SEASON_COMPARISON.reaction.2", "B", "reaction", "Numbers like that rarely happen by chance from one season to the next.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
ph("SEASON_COMPARISON.reaction.3", "B", "reaction", "That's the kind of shift you notice looking back rather than at the time.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
ph("SEASON_COMPARISON.context.2", "A", "context", "One season's numbers rarely tell the full story on their own — the comparison is what matters.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
ph("SEASON_COMPARISON.context.3", "A", "context", "Worth remembering that seasons don't always follow a straight line.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
ph("SEASON_COMPARISON.closer.2", "B", "closer", "Two seasons, two very different reads on {{entityName}}.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
ph("SEASON_COMPARISON.closer.3", "B", "closer", "That's the kind of detail that rewards paying attention over time.", "neutral", { requires: SEASON_COMPARISON_REQUIRES }),
];

const HISTORICAL_H2H_REQUIRES = ["entityAId", "entityBId", "aWins", "bWins", "gamesPlayed"];
const HISTORICAL_H2H_PHRASES: Phrase[] = [
  ph("HISTORICAL_H2H.qf.1", "A", "quick_fact", "{{entityAName}} and {{entityBName}} have met {{gamesPlayed}} times across their history — {{aWins}} wins to {{bWins}}.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.qr.1", "B", "quick_reaction", "Good bit of history between this pair.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.fact.1", "A", "fact", "A long-running head-to-head, {{gamesPlayed}} meetings deep now.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.reaction.1", "B", "reaction", "Always adds a bit of spice when there's history like that behind it.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  // Was "...as this fixture comes around again this season" / "...tonight"
  // — both claimed an imminent/current-season rematch, false whenever this
  // evergreen all-time record airs on its own rather than beside that
  // actual fixture (the retrospective/archive scenario a real user report
  // traced to this family). Reworded to hold true whenever it airs.
  ph("HISTORICAL_H2H.context.1", "A", "context", "Worth keeping in mind whenever this fixture comes around again.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
  ph("HISTORICAL_H2H.closer.1", "B", "closer", "Just another chapter in a long-running story.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),

ph("HISTORICAL_H2H.qf.2", "A", "quick_fact", "{{gamesPlayed}} matches deep, and the head-to-head between {{entityAName}} and {{entityBName}} still makes for good reading.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.qf.3", "A", "quick_fact", "{{aWins}} wins to {{bWins}} — that's the full history between {{entityAName}} and {{entityBName}}.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.qr.2", "B", "quick_reaction", "That's the sort of number you only get from years of these two meeting.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.qr.3", "B", "quick_reaction", "Somebody's clearly kept count over the years, and it shows.", "neutral", { requires: HISTORICAL_H2H_REQUIRES, tone: "humour" }),
ph("HISTORICAL_H2H.fact.2", "A", "fact", "A head-to-head this deep doesn't happen overnight — {{gamesPlayed}} meetings and counting.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.fact.3", "A", "fact", "{{entityAName}} and {{entityBName}} have built up quite a history across {{gamesPlayed}} matches.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.reaction.2", "B", "reaction", "History like that tends to add a bit of needle to the next one.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.reaction.3", "B", "reaction", "You can't manufacture a rivalry that deep — it just builds over time.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.context.2", "A", "context", "A long history like this is context, not a guarantee of what happens next.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.context.3", "A", "context", "Whatever the past says, both sides still have to turn up and play it.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.closer.2", "B", "closer", "However it reads, it's a proper long-running story between those two.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
ph("HISTORICAL_H2H.closer.3", "B", "closer", "Plenty more chapters left in that one yet.", "neutral", { requires: HISTORICAL_H2H_REQUIRES }),
];

// ════════════════════════════════════════════════════════════════════════
// FILLER family (3 types) — story-types.ts's own header: content this show
// can air when there isn't enough real news, plus a standing reminder slot
// for game modes players might not otherwise notice. director.ts confines
// this family (alongside ARCHIVE) to slot 8 — see its own isFlashbackFamily
// comment — so these never masquerade as today's actual headline.
//
// Every FILLER story caps out well under Supporting treatment's own score
// threshold (story-detectors-filler.ts's own components are deliberately
// small — competitiveImportance 1-3, everything else at or near zero), so
// in practice these only ever need the QUICK_HIT pair (quick_fact +
// quick_reaction) — the required 3rd "banter" turn is already covered by
// UNIVERSAL_BANTER_PHRASES below, same as every other story type. Adding
// only the pair here (rather than a fuller Featured-length blueprint that
// would never actually be reached) matches 12.5's own "a real, modest v1
// set, not hundreds of complete scripts."
//
// This library had NO entries at all for this family before now (confirmed
// by search) — a real gap on its own, independent of which detectors were
// wired into story-engine.ts: buildDialogueForStory (commentary-engine.ts)
// returns zero turns whenever phrasesForStoryType() comes back empty, and
// edition-engine.ts's buildSegmentForEntry drops any segment with zero
// dialogue outright (11.6's "drop rather than publish... empty content").
// SHADOW_BOT_PROMO had already been wired into story-engine.ts before this
// was written, so until now, whenever the Director picked it for a slot,
// that slot silently vanished instead of airing anything — wasting exactly
// the fallback content it was wired in to provide.
// ════════════════════════════════════════════════════════════════════════

// SHADOW_BOT_PROMO carries no facts at all (story-detectors-filler.ts's own
// header — "there is nothing to 'detect'"), so these phrases declare no
// `requires` and their templates contain no placeholders whatsoever, same
// convention as UNIVERSAL_BANTER_PHRASES below.
const SHADOW_BOT_PROMO_PHRASES: Phrase[] = [
  ph("SHADOW_BOT_PROMO.qf.1", "A", "quick_fact", "Quick reminder for anyone who hasn't tried it yet — Shadow Bot lets you take on an AI version of any player in the league.", "positive"),
  ph("SHADOW_BOT_PROMO.qr.1", "B", "quick_reaction", "Good way to see how you'd actually stack up without waiting on a real fixture.", "positive"),

ph("SHADOW_BOT_PROMO.qf.2", "A", "quick_fact", "If you fancy testing yourself against the league, Shadow Bot's sitting there ready to go.", "positive"),
ph("SHADOW_BOT_PROMO.qf.3", "A", "quick_fact", "Shadow Bot's worth a look if you've wondered how you'd fare against one of tonight's players.", "positive"),
ph("SHADOW_BOT_PROMO.qr.2", "B", "quick_reaction", "It's a good laugh too, not just useful practice.", "positive"),
ph("SHADOW_BOT_PROMO.qr.3", "B", "quick_reaction", "Fair warning — the bot doesn't take it easy on you.", "positive", { tone: "humour" }),
];

const PRACTICE_ACTIVITY_REQUIRES = ["windowDays", "sessionCount"];
// Additive variant, same pattern as CHAMPION.qf.2/LAST_MEETING.qf.2
// elsewhere in this file: topPlayerId is present on every real
// PRACTICE_ACTIVITY candidate today (detectPracticeActivity's own minimum-
// session gate can't pass with zero sessions), but story-detectors-
// filler.ts's own PracticeActivityFacts keeps it nullable/omittable on
// purpose — this phrase declares the extra requirement explicitly rather
// than assuming it, so the baseline pair above stays correct even if that
// ever changes.
const PRACTICE_ACTIVITY_REQUIRES_WITH_TOP_PLAYER = [...PRACTICE_ACTIVITY_REQUIRES, "topPlayerId"];

const PRACTICE_ACTIVITY_PHRASES: Phrase[] = [
  ph("PRACTICE_ACTIVITY.qf.1", "A", "quick_fact", "Plenty of practice going on behind the scenes — {{sessionCount}} sessions logged in the last {{windowDays}} days.", "positive", { requires: PRACTICE_ACTIVITY_REQUIRES }),
  ph("PRACTICE_ACTIVITY.qf.2", "A", "quick_fact", "{{topPlayerName}}'s been putting the work in — top of the practice charts over the last {{windowDays}} days.", "positive", { requires: PRACTICE_ACTIVITY_REQUIRES_WITH_TOP_PLAYER }),
  ph("PRACTICE_ACTIVITY.qr.1", "B", "quick_reaction", "Good sign — that usually shows up in the results before long.", "positive", { requires: PRACTICE_ACTIVITY_REQUIRES }),

ph("PRACTICE_ACTIVITY.qf.3", "A", "quick_fact", "{{sessionCount}} sessions logged in {{windowDays}} days — plenty of people putting the hours in.", "positive", { requires: PRACTICE_ACTIVITY_REQUIRES }),
ph("PRACTICE_ACTIVITY.qf.4", "A", "quick_fact", "{{topPlayerName}} has clocked more practice than anyone else over the last {{windowDays}} days.", "positive", { requires: PRACTICE_ACTIVITY_REQUIRES_WITH_TOP_PLAYER }),
ph("PRACTICE_ACTIVITY.qr.2", "B", "quick_reaction", "Practice like that doesn't always show up straight away, but it adds up.", "positive", { requires: PRACTICE_ACTIVITY_REQUIRES }),
ph("PRACTICE_ACTIVITY.qr.3", "B", "quick_reaction", "Nice to know someone's out there actually working on their doubles.", "positive", { requires: PRACTICE_ACTIVITY_REQUIRES, tone: "humour" }),
];

const FEATURE_SPOTLIGHT_REQUIRES = ["featureName", "featureBlurb"];

const FEATURE_SPOTLIGHT_PHRASES: Phrase[] = [
  ph("FEATURE_SPOTLIGHT.qf.1", "A", "quick_fact", "Worth a mention for anyone who hasn't seen it yet — {{featureName}} is live in the app now.", "positive", { requires: FEATURE_SPOTLIGHT_REQUIRES }),
  ph("FEATURE_SPOTLIGHT.qr.1", "B", "quick_reaction", "Yeah, {{featureBlurb}}", "positive", { requires: FEATURE_SPOTLIGHT_REQUIRES }),

ph("FEATURE_SPOTLIGHT.qf.2", "A", "quick_fact", "Quick mention for {{featureName}} if it's passed you by — it's live in the app right now.", "positive", { requires: FEATURE_SPOTLIGHT_REQUIRES }),
ph("FEATURE_SPOTLIGHT.qf.3", "A", "quick_fact", "{{featureName}}'s new in the app — worth a look next time you're in there.", "positive", { requires: FEATURE_SPOTLIGHT_REQUIRES }),
ph("FEATURE_SPOTLIGHT.qr.2", "B", "quick_reaction", "{{featureBlurb}} — that's a genuinely useful one.", "positive", { requires: FEATURE_SPOTLIGHT_REQUIRES }),
ph("FEATURE_SPOTLIGHT.qr.3", "B", "quick_reaction", "{{featureBlurb}} Go on, give it a go.", "positive", { requires: FEATURE_SPOTLIGHT_REQUIRES, tone: "humour" }),
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

ph("CALLBACK.ref.3", "A", "callback_reference", "Last time we flagged {{priorClaimTag}}, {{priorClaimEditionsAgo}} editions back now — worth revisiting.", "neutral", { requires: CALLBACK_REQUIRES }),
ph("CALLBACK.ref.4", "A", "callback_reference", "Ton, {{priorClaimEditionsAgo}} editions ago you were adamant about {{priorClaimTag}} — let's see how that's holding up.", "neutral", { requires: CALLBACK_REQUIRES, tone: "personality" }),
ph("CALLBACK.admit.3", "B", "admit_or_defend", "Look, {{priorClaimEditionsAgo}} editions is a while in this league — plenty can change.", "neutral", { requires: CALLBACK_REQUIRES }),
ph("CALLBACK.admit.4", "B", "admit_or_defend", "I'll happily revisit that one if tonight tells a different story.", "neutral", { requires: CALLBACK_REQUIRES, tone: "humour" }),
ph("CALLBACK.evidence.playerId.2", "A", "current_evidence", "Whatever the history, {{playerName}}'s form right now is what actually matters.", "neutral", { requires: ["playerId", ...CALLBACK_REQUIRES] }),
ph("CALLBACK.evidence.playerId.3", "A", "current_evidence", "Let's judge {{playerName}} on tonight's numbers rather than what either of us said before.", "neutral", { requires: ["playerId", ...CALLBACK_REQUIRES] }),
ph("CALLBACK.evidence.teamId.2", "A", "current_evidence", "Whatever the history, {{teamName}}'s current form is what actually matters tonight.", "neutral", { requires: ["teamId", ...CALLBACK_REQUIRES] }),
ph("CALLBACK.evidence.entityId.2", "A", "current_evidence", "Whatever the history, {{entityName}}'s current position tells its own story tonight.", "neutral", { requires: ["entityId", ...CALLBACK_REQUIRES] }),
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

ph("BANTER.a.13", "A", "banter", "Ton, keep that thought — we'll come right back to it after this.", "neutral", { tone: "personality" }),
ph("BANTER.a.14", "A", "banter", "Right, that's given us plenty to chew on already tonight.", "positive"),
ph("BANTER.a.15", "A", "banter", "I love a night where the table just won't settle down.", "positive", { tone: "humour" }),
ph("BANTER.a.16", "A", "banter", "You're grinning already, Ton — go on, what's caught your eye?", "neutral", { tone: "personality" }),
ph("BANTER.a.17", "A", "banter", "Fair warning, viewers — tonight's got more twists lined up yet.", "neutral"),
ph("BANTER.a.18", "A", "banter", "That's the thing about this league — someone always has a say in it.", "positive", { tone: "personality" }),
ph("BANTER.a.19", "A", "banter", "Let's not get ahead of ourselves — plenty of the night still to come.", "neutral"),
ph("BANTER.a.20", "A", "banter", "You can feel the mood in this league shifting week to week.", "neutral", { tone: "personality" }),
ph("BANTER.a.21", "A", "banter", "I'll be honest, Ton — I'm still not sure how tonight ends up.", "neutral", { tone: "personality" }),
ph("BANTER.a.22", "A", "banter", "Didn't you fancy a completely different name a few weeks back, Ton?", "neutral", { tone: "humour" }),
ph("BANTER.a.23", "A", "banter", "Our model's had a few humbling nights lately, and it's not shy about admitting it.", "neutral", { tone: "humour" }),
ph("BANTER.a.24", "A", "banter", "Keep watching, folks — there's someone out there about to have a night of it.", "positive", { tone: "personality" }),
ph("BANTER.a.25", "A", "banter", "This league has a real habit of making fools of anyone who tries to predict it.", "positive", { tone: "humour" }),
ph("BANTER.a.26", "A", "banter", "I still owe you a coffee for calling that one right, Ton — annoyingly.", "positive", { tone: "humour" }),
ph("BANTER.a.27", "A", "banter", "There's a reason neither of us bets against this league anymore.", "neutral", { tone: "personality" }),
ph("BANTER.a.28", "A", "banter", "Say what you like about the model — it's had its own wobbles this season too.", "neutral", { tone: "humour" }),
ph("BANTER.a.29", "A", "banter", "Somewhere out there tonight, someone's quietly building a story worth watching.", "positive", { tone: "personality" }),
ph("BANTER.a.30", "A", "banter", "Honestly, viewers — I didn't expect to be saying that either.", "neutral"),
ph("BANTER.a.31", "A", "banter", "Ton's confidence levels have been doing their own rollercoaster this season.", "neutral", { tone: "humour" }),
ph("BANTER.a.32", "A", "banter", "Whatever you think you know about this table, give it another fortnight.", "neutral", { tone: "personality" }),
ph("BANTER.a.33", "A", "banter", "Stick around — this league rarely lets a quiet patch last long.", "neutral"),
ph("BANTER.a.34", "A", "banter", "Credit where it's due, Ton — you called part of that one.", "positive"),
ph("BANTER.a.35", "A", "banter", "There's always one name climbing the table that nobody's talking about yet.", "positive", { tone: "personality" }),
ph("BANTER.a.36", "A", "banter", "That face tells me you've got an opinion brewing, Ton.", "neutral", { tone: "humour" }),
ph("BANTER.a.37", "A", "banter", "Every season this league finds a new way to make the model sweat a bit.", "positive", { tone: "humour" }),
ph("BANTER.a.38", "A", "banter", "We say this most weeks, but this table genuinely doesn't sit still.", "neutral"),
ph("BANTER.a.39", "A", "banter", "Keep half an eye on the bottom of the table too, viewers — plenty brewing down there.", "neutral", { tone: "personality" }),
ph("BANTER.a.40", "A", "banter", "I'll admit it — some weeks this league outsmarts the pair of us.", "neutral", { tone: "humour" }),
ph("BANTER.a.41", "A", "banter", "That's the fun of live sport, isn't it — nobody's got a crystal ball.", "positive"),
ph("BANTER.a.42", "A", "banter", "You've gone quiet, Ton — that usually means you're rethinking something.", "neutral", { tone: "humour" }),
ph("BANTER.a.43", "A", "banter", "Plenty of tonight left to prove either of us right.", "neutral", { tone: "personality" }),
ph("BANTER.a.44", "A", "banter", "This league's given us more U-turns this season than either of us bargained for.", "neutral", { tone: "humour" }),
ph("BANTER.a.45", "A", "banter", "Right, let's get back to it — there's more happening out there tonight.", "neutral", { tone: "personality" }),
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
  SEASON_KICKOFF: SEASON_KICKOFF_PHRASES,

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

  PRACTICE_ACTIVITY: PRACTICE_ACTIVITY_PHRASES,
  SHADOW_BOT_PROMO: SHADOW_BOT_PROMO_PHRASES,
  FEATURE_SPOTLIGHT: FEATURE_SPOTLIGHT_PHRASES,
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
