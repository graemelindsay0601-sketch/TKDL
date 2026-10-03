// TKDL LIVE — presenter running jokes: a small, recurring set of bits
// between Chalky and Ton that belong to the SHOW itself, not to any one
// story or player — continuity for its own sake. broadcast.ts's own schema
// (13.4, MEMORY_TYPES) already reserved a "RUNNING_JOKE" row shape for
// exactly this a full phase before anything actually read or wrote one;
// this is that feature. Exactly mirrors closing-tease-math.ts's and
// cold-open-math.ts's own split: pure template data + one pure selection
// function here, zero @workspace/db imports, directly unit-testable via
// `node --test`; the DB-facing cooldown lookup (and the actual pickFrom
// variant/dialogue-building calls) stay in edition-engine.ts, which is this
// file's only real caller.
//
// ── Why these are flat lines, never templates ───────────────────────────
// A running joke is about the HOSTS' OWN relationship/rapport — never about
// any story's specific facts, same reasoning UNIVERSAL_BANTER_PHRASES
// (commentary-library.ts) already documents for QUICK_HIT's own required
// third turn. No `{{placeholder}}` ever appears below, so there is nothing
// here for the fact firewall (17.1) to even check, and these can never fail
// to interpolate.
//
// ── Why several variants per joke ────────────────────────────────────────
// A running joke firing with the exact same two lines every time it
// recurs (editions apart) would read as a glitch, not a callback. Each
// joke keeps 2-3 interchangeable variants so a later firing of the same
// joke still feels alive rather than literally repeating itself.
//
// ── Why a cooldown AND a fire-probability roll, not just "if eligible,
// always fire" ────────────────────────────────────────────────────────────
// Firing deterministically the instant a joke clears
// MIN_EDITIONS_BETWEEN_RUNNING_JOKES would make the recurrence feel
// mechanical — clockwork every Nth edition — rather than organic.
// pickEligibleRunningJoke additionally rolls the show's own per-Edition
// seeded RNG against RUNNING_JOKE_FIRE_PROBABILITY, so clearing cooldown
// only means "eligible to fire this Edition," never "will." A quiet
// Edition can still go without one entirely — the same spirit as Show
// Bible v1's own "NO FAKE URGENCY" box, just applied to continuity instead
// of drama: a running joke on a fixed schedule stops being a joke and
// starts being a tic.
import { pickFrom } from "./seeded-rng.ts";

export type RunningJokeVariant = { a: string; b: string };
export type RunningJoke = { id: string; variants: readonly RunningJokeVariant[] };

export const RUNNING_JOKES: readonly RunningJoke[] = [
  {
    id: "the-model-vs-the-gut",
    variants: [
      { a: "Go on then, Ton — what does the model say you'd have called tonight?", b: "I don't need a model. I've got an eye for this, Chalky." },
      { a: "The model's been quiet tonight, Ton — any gut feelings to share instead?", b: "Always. The model can keep its percentages — I trust what I watch." },
      { a: "Careful, Ton — last time you ignored the model it didn't exactly go your way.", b: "Did it not? Funny, I don't remember that part." },
    ],
  },
  {
    id: "tons-tab",
    variants: [
      { a: "I believe you still owe me from the last time you were so sure about something, Ton.", b: "I'm choosing not to remember that one, if it's alright with you, Chalky." },
      { a: "Running tally's still very much in my favour, Ton, for the record.", b: "Nobody asked for a running tally, Chalky." },
      { a: "I keep the receipts, Ton. You know this about me by now.", b: "Unfortunately, I do." },
    ],
  },
  {
    id: "chalkys-notes",
    variants: [
      { a: "I've got the full notes ready for tonight, as always.", b: "Of course you have. I've got a hunch and a strong coffee, personally." },
      { a: "Some of us prepare properly for this show, Ton.", b: "Some of us don't need to, Chalky." },
      { a: "I did my homework again before tonight, for anyone keeping track.", b: "Nobody's keeping track except you." },
    ],
  },
  {
    id: "another-tuesday",
    variants: [
      { a: "Another night at Kilbirnie, Ton — never gets old, does it.", b: "Says the man who does the prep. I just turn up and talk." },
      { a: "Back at it again — this league really doesn't let you get bored, does it.", b: "It really doesn't. Keeps us both in a job, Chalky." },
      { a: "Here we go again, Ton. Same board, never quite the same story twice.", b: "That's the only reason I keep showing up, if I'm honest." },
    ],
  },
];

export const MIN_EDITIONS_BETWEEN_RUNNING_JOKES = 3;
export const RUNNING_JOKE_FIRE_PROBABILITY = 0.4;

/**
 * Picks ONE running joke to fire this Edition, or null for none. `cooldowns`
 * maps a joke's own id to editions-since-last-use (absent = never used
 * before, always eligible). Eligible jokes are every joke that's either
 * never been used or off cooldown (editions-since-last-use >=
 * MIN_EDITIONS_BETWEEN_RUNNING_JOKES); the fire-probability roll (see this
 * file's own header) is checked first, and only against that eligible set
 * being non-empty — a quiet show with every joke already on cooldown never
 * even reaches the roll. Among eligible jokes, the one(s) longest since
 * last used win a fair rotation (never-used jokes, sorting as Infinity,
 * always win outright) — the same "give every one a turn" reasoning
 * director.ts's own slot-8 FILLER staleness-priority rule already
 * documents — with ties broken by the same seeded RNG used for the fire
 * roll, so a rebuild of the exact same slot always reproduces the same
 * choice.
 */
export function pickEligibleRunningJoke(
  cooldowns: ReadonlyMap<string, number>,
  rng: () => number,
): RunningJoke | null {
  const eligible = RUNNING_JOKES.filter(joke => (cooldowns.get(joke.id) ?? Infinity) >= MIN_EDITIONS_BETWEEN_RUNNING_JOKES);
  if (eligible.length === 0) return null;
  if (rng() >= RUNNING_JOKE_FIRE_PROBABILITY) return null;
  const longestIdle = Math.max(...eligible.map(joke => cooldowns.get(joke.id) ?? Infinity));
  const stalest = eligible.filter(joke => (cooldowns.get(joke.id) ?? Infinity) === longestIdle);
  return pickFrom(stalest, rng);
}
