/**
 * Boss Battle: the bosses themselves (moves, lines, portraits, lore).
 *
 * 20 bosses across 4 worlds. The roster order, worlds and mastery times are shared
 * with the server (shared/darts-rules/boss-roster.ts); this file adds what only the
 * app needs.
 *
 * A fight is a health bar: your scoring knocks it down (see bossHealth), and the boss
 * changes move at ⅔ and ⅓ health (phase 1 → move 1, phase 2 → move 2, phase 3 →
 * its enraged move). In 501 and Cricket the moves are curses on your darts, built
 * from Card Clash's tested effects engine. In Around the World, Halve-It and Killer
 * there are no curses: the boss's moves make it throw better instead (botBoost).
 *
 * Wins and losses here never touch league Elo or stats.
 */

import type { CCEffect } from "./card-effect-engine";
import type { BotLevel } from "./bot-engine";
import { BOSS_ROSTER, WORLDS, PERKS, type BossMode, type WorldId, type PerkId } from "./darts-rules.ts";

export { WORLDS, PERKS };
export type { PerkId };
export type { BossMode, WorldId };

export interface BossMove {
  /** Short name shown in the "boss used X!" banner and the HUD. */
  name: string;
  /** One line explaining what this move actually does. */
  description: string;
  /** Curses on your darts (501 / Cricket). cardName/appliedBy/affectsPlayer/status are filled in at fight time. */
  effects: Omit<CCEffect, "cardName" | "appliedBy" | "affectsPlayer" | "status">[];
  /** Around the World / Halve-It / Killer: the boss throws this many levels better while the move is up. */
  botBoost?: number;
}

/** What the boss says. Each is a list; one is picked at random. */
export interface BossLines {
  entrance: string[];
  /** You scored nothing (or bust). */
  bust: string[];
  /** You hit it hard (100+ / a big Cricket visit / a life gone). */
  hurt: string[];
  /** It scored big. */
  big: string[];
  /** It won a leg. */
  legWon: string[];
  /** You won a leg. */
  legLost: string[];
  /** Entering phase 2, and phase 3 (enraged). */
  phase2: string;
  phase3: string;
  /** You beat it / it beat you. */
  defeated: string;
  victory: string;
}

/** Drawn by BossPortrait: a face shape and colours, all original artwork in SVG. */
export interface PortraitSpec {
  face: "brick" | "hood" | "skull" | "crown" | "visor" | "mask" | "horns" | "cyclops" | "screen" | "void";
  primary: string;
  secondary: string;
  eye: string;
}

export interface Boss {
  id: string;
  name: string;
  tagline: string;
  /** A few lines of story for the Bestiary. */
  lore: string;
  world: WorldId;
  gameMode: BossMode;
  /** For Around the World / Halve-It / Killer: which variant of the game. */
  gameKey?: string;
  /** CPU skill tier for the boss's own throws. */
  botLevel: BotLevel;
  order: number;
  masterySeconds: number;
  /** Phase 1 and phase 2. */
  moves: BossMove[];
  /** Phase 3 (below ⅓ health). */
  enrageMove?: BossMove;
  lines: BossLines;
  portrait: PortraitSpec;
}

type BossContent = Omit<Boss, "order" | "masterySeconds" | "world" | "gameMode" | "name">;

const L = (o: Partial<BossLines> & Pick<BossLines, "entrance" | "phase2" | "phase3" | "defeated" | "victory">): BossLines => ({
  bust: ["Is that it?", "Nothing. Lovely.", "Told you."],
  hurt: ["Lucky.", "Ow. Fine.", "Don't get used to that."],
  big: ["Watch and learn.", "That's how it's done."],
  legWon: ["One down.", "Keep up."],
  legLost: ["That one doesn't count.", "Enjoy it while it lasts."],
  ...o,
});

const CONTENT: Record<string, BossContent> = {
  // ── World 1: The Pub ───────────────────────────────────────────────────────
  "rookie-wall": {
    id: "rookie-wall", tagline: "Everyone's first loss.",
    lore: "Built from the bricks of every pub that ever said 'not tonight, mate'. It doesn't throw well. It doesn't have to. It just stands there, blocking the numbers you want.",
    botLevel: "amateur",
    moves: [
      { name: "Wall Block", description: "You can't score on 20, 19 or 18 — any hit on them scores 0.", effects: [{ segmentBlock: [20, 19, 18] }] },
      { name: "Wild Throw", description: "One random dart each visit goes completely wide and scores 0.", effects: [{ wildDartIndex: -1 }] },
    ],
    enrageMove: { name: "Panic Throw", description: "Down to the wire: two of your three darts each visit go wide and score 0.", effects: [{ wildDartIndices: [1, 2] }] },
    lines: L({ entrance: ["Not getting past me.", "Everyone hits the wall."], bust: ["Bounced off.", "Thud."], hurt: ["Cracked. Barely."],
      phase2: "Bricks are coming loose. So are your darts.", phase3: "Fine. Panic, then.", defeated: "...Mind the rubble.", victory: "Wall stands." }),
    portrait: { face: "brick", primary: "#b45309", secondary: "#78350f", eye: "#fde68a" },
  },
  "old-jinx": {
    id: "old-jinx", tagline: "Nothing you throw feels right.",
    lore: "Sits in the corner seat nobody else will take. Rumoured to have cursed a county final in 1987. Every dart you throw near him comes up a little short.",
    botLevel: "club",
    moves: [
      { name: "Jinxed", description: "Every dart is only worth 75% of its real value.", effects: [{ allDartsMultiplier: 0.75 }] },
      { name: "Shackled", description: "No single dart can score more than 50.", effects: [{ maxDartValue: 50 }] },
    ],
    enrageMove: { name: "Full Jinx", description: "Every dart is worth half its real value.", effects: [{ allDartsMultiplier: 0.5 }] },
    lines: L({ entrance: ["Ooh. Unlucky already.", "Sit down, this'll be quick."], bust: ["Jinxed.", "Feels wrong, doesn't it?"],
      phase2: "Let's shackle that arm.", phase3: "Half of nothing is still nothing.", defeated: "The curse... lifts. For now.", victory: "Never stood a chance, did you." }),
    portrait: { face: "hood", primary: "#4d7c0f", secondary: "#1a2e05", eye: "#bef264" },
  },
  quizmaster: {
    id: "quizmaster", tagline: "Fingers on buzzers. Darts in hand.",
    lore: "Runs the Tuesday quiz and has never once got a question wrong. Races you round the board, 1 to 20 and the bull, and reads out your mistakes into the microphone.",
    botLevel: "club", gameKey: "around_the_world",
    moves: [
      { name: "Starter for Ten", description: "Round the board, 1 to 20 then the bull. First to finish wins.", effects: [] },
      { name: "Quickfire Round", description: "The Quizmaster speeds up: throws a level better.", effects: [], botBoost: 1 },
    ],
    enrageMove: { name: "Sudden Death", description: "Final round nerves for you, none for it: throws two levels better.", effects: [], botBoost: 2 },
    lines: L({ entrance: ["Round one. Around the board. Begin.", "No conferring."], bust: ["Incorrect.", "I'll have to hurry you."], hurt: ["Correct. Annoyingly."],
      phase2: "Quickfire round!", phase3: "Sudden death. Fingers on buzzers.", defeated: "And the winner is... not me.", victory: "Better luck next week." }),
    portrait: { face: "visor", primary: "#7c3aed", secondary: "#2e1065", eye: "#facc15" },
  },
  "the-landlord": {
    id: "the-landlord", tagline: "House rules. My house.",
    lore: "Owns the oche, the board and the till. Plays Cricket the old way: slowly, and only on the numbers he says you're allowed.",
    botLevel: "club",
    moves: [
      { name: "House Rules", description: "Your bull doesn't count in here.", effects: [{ blockBullMarks: true }] },
      { name: "Last Orders", description: "Your first dart each visit marks nothing — you're still getting a drink.", effects: [{ hesitateFirstDart: true }] },
    ],
    enrageMove: { name: "Time, Gentlemen", description: "Every hit is only a single mark.", effects: [{ sluggishMarks: true }] },
    lines: L({ entrance: ["My pub. My board. My rules.", "Wipe your feet."], bust: ["Nothing? Out you go."], hurt: ["Steady on, that's my board."],
      phase2: "Last orders at the bar!", phase3: "Time, gentlemen, PLEASE.", defeated: "Fine. This one's on the house.", victory: "You're barred." }),
    portrait: { face: "crown", primary: "#92400e", secondary: "#451a03", eye: "#fcd34d" },
  },
  "big-barry": {
    id: "big-barry", tagline: "Not on my door, son.",
    lore: "Head of security at the end of the Pub world. Doesn't say much. Doesn't need to. You don't get through his door scoring big.",
    botLevel: "county",
    moves: [
      { name: "Not Tonight", description: "Your visit can't total more than 60.", effects: [{ maxVisitTotal: 60 }] },
      { name: "Pat Down", description: "20s and 1s are blocked and score 0.", effects: [{ segmentBlock: [20, 1] }] },
    ],
    enrageMove: { name: "Chucking Out Time", description: "Visit capped at 45 and every dart costs you 5.", effects: [{ maxVisitTotal: 45, penaltyPerDart: 5 }] },
    lines: L({ entrance: ["Name's not on the list.", "Not in them shoes."], bust: ["Back of the queue."], hurt: ["Ooh. Bold."],
      phase2: "Arms out. Pat down.", phase3: "Right. Out.", defeated: "...Go on then. In you go.", victory: "Not tonight." }),
    portrait: { face: "mask", primary: "#1f2937", secondary: "#030712", eye: "#ef4444" },
  },

  // ── World 2: The Shop Floor ────────────────────────────────────────────────
  "the-warden": {
    id: "the-warden", tagline: "You're not getting out of here.",
    lore: "Security on the shop floor, keys on a belt the size of a dartboard. In Cricket he locks numbers away and won't let you close a thing.",
    botLevel: "club",
    moves: [
      { name: "Cricket Prison", description: "You can only mark 15, 19 and 20 — every other number is dead to you.", effects: [{ allowedMarkSegments: [15, 19, 20] }] },
      { name: "Closing Blocker", description: "You can't close any number: your marks cap at 2.", effects: [{ blockClosing: true }] },
    ],
    enrageMove: { name: "Iron Cage", description: "Every hit only counts as a single mark.", effects: [{ sluggishMarks: true }] },
    lines: L({ entrance: ["Badge please.", "Nobody leaves till I say."], bust: ["Back in your cell."], hurt: ["Hey. HEY."],
      phase2: "Lock everything.", phase3: "Iron cage. Get comfy.", defeated: "...Keys are on the desk.", victory: "Lights out." }),
    portrait: { face: "visor", primary: "#0369a1", secondary: "#082f49", eye: "#7dd3fc" },
  },
  "night-manager": {
    id: "night-manager", tagline: "Targets are targets.",
    lore: "Runs the late shift on spreadsheets and coffee. Every dart you throw is a cost to the business, and he's billing you for it.",
    botLevel: "county",
    moves: [
      { name: "Overheads", description: "Every dart you throw costs you 5 points.", effects: [{ penaltyPerDart: 5 }] },
      { name: "Budget Cuts", description: "Trebles count as singles.", effects: [{ treblesAsSingles: true }] },
    ],
    enrageMove: { name: "Restructure", description: "Trebles are singles and every dart costs you 8.", effects: [{ treblesAsSingles: true, penaltyPerDart: 8 }] },
    lines: L({ entrance: ["You're late.", "Let's talk about your numbers."], bust: ["That's coming out of your wages."], hurt: ["I'll be noting that."],
      phase2: "We're cutting back. Starting with your trebles.", phase3: "There's going to be a restructure.", defeated: "...Take the rest of the shift off.", victory: "See me in my office." }),
    portrait: { face: "screen", primary: "#0ea5e9", secondary: "#0c4a6e", eye: "#f0f9ff" },
  },
  "stock-taker": {
    id: "stock-taker", tagline: "Everything gets counted. Then halved.",
    lore: "Counts every tin on every shelf. Plays Halve-It: miss the target and your score is cut in half, and the Stock Taker never miscounts.",
    botLevel: "county", gameKey: "halve_it",
    moves: [
      { name: "Stock Check", description: "Halve-It: hit the round's target or your score is halved. Highest score wins.", effects: [] },
      { name: "Recount", description: "The Stock Taker counts faster: throws a level better.", effects: [], botBoost: 1 },
    ],
    enrageMove: { name: "Write-Off", description: "Throws two levels better for the rest of the fight.", effects: [], botBoost: 2 },
    lines: L({ entrance: ["Clipboard ready.", "Let's see what you're worth."], bust: ["Halved. Noted."], hurt: ["That... adds up."],
      phase2: "Recount!", phase3: "Write it all off.", defeated: "Stock... balanced.", victory: "Discrepancy found: you." }),
    portrait: { face: "cyclops", primary: "#16a34a", secondary: "#052e16", eye: "#bbf7d0" },
  },
  "the-clipboard": {
    id: "the-clipboard", tagline: "Three strikes and you're out.",
    lore: "The shop floor's disciplinary officer. Plays Killer: get your number, become a killer, then take its three lives before it takes yours.",
    botLevel: "county", gameKey: "killer",
    moves: [
      { name: "Verbal Warning", description: "Killer: claim your number, then hit its number to take its lives. 3 lives each.", effects: [] },
      { name: "Written Warning", description: "The Clipboard means it now: throws a level better.", effects: [], botBoost: 1 },
    ],
    enrageMove: { name: "Gross Misconduct", description: "Throws two levels better.", effects: [], botBoost: 2 },
    lines: L({ entrance: ["This is a formal meeting.", "Sign here."], bust: ["Strike noted."], hurt: ["I'll be appealing that."],
      phase2: "Written warning.", phase3: "Gross misconduct. Final hearing.", defeated: "...You may return to work.", victory: "Clear your locker." }),
    portrait: { face: "screen", primary: "#e2e8f0", secondary: "#334155", eye: "#0f172a" },
  },
  lockdown: {
    id: "lockdown", tagline: "One number. That's all you get.",
    lore: "The shop's security system, gone rogue. It locks the whole board down to a single number and charges a toll on every dart.",
    botLevel: "county",
    moves: [
      { name: "Locked In", description: "Only one number scores anything — everything else is worth 0.", effects: [{ lockdownSegment: -1 }] },
      { name: "Toll Booth", description: "Every dart you throw costs you 10 points.", effects: [{ penaltyPerDart: 10 }] },
    ],
    enrageMove: { name: "Maximum Security", description: "Only one number scores, and every dart still costs you 15.", effects: [{ lockdownSegment: -1, penaltyPerDart: 15 }] },
    lines: L({ entrance: ["System armed.", "Access restricted."], bust: ["Access denied."], hurt: ["Breach detected."],
      phase2: "Toll applied.", phase3: "MAXIMUM SECURITY.", defeated: "System... disarmed.", victory: "Intruder contained." }),
    portrait: { face: "visor", primary: "#dc2626", secondary: "#450a0a", eye: "#fecaca" },
  },

  // ── World 3: The Arena ─────────────────────────────────────────────────────
  "the-annihilator": {
    id: "the-annihilator", tagline: "Everyone thinks this is the end.",
    lore: "First fight in the Arena, and most people's last. Turns your trebles into singles and caps what you can score in a visit.",
    botLevel: "pro",
    moves: [
      { name: "Trebles Curse", description: "Every treble counts as a single — T20 scores 20.", effects: [{ treblesAsSingles: true }] },
      { name: "Annihilation", description: "Your visit total is capped at 40.", effects: [{ maxVisitTotal: 40 }] },
    ],
    enrageMove: { name: "Total Annihilation", description: "Trebles are worthless AND your visit is capped at 30.", effects: [{ treblesAsSingles: true, maxVisitTotal: 30 }] },
    lines: L({ entrance: ["Welcome to the Arena.", "This is where it ends."], bust: ["Annihilated."], hurt: ["You'll pay for that."],
      phase2: "Annihilation.", phase3: "TOTAL ANNIHILATION.", defeated: "...Impossible.", victory: "As expected." }),
    portrait: { face: "skull", primary: "#ef4444", secondary: "#450a0a", eye: "#fde047" },
  },
  "the-showman": {
    id: "the-showman", tagline: "The crowd came to see me.",
    lore: "Walks on to his own music and plays to the cameras. The noise he whips up makes your darts drift.",
    botLevel: "pro",
    moves: [
      { name: "Walk-On", description: "The crowd's going wild: one random dart each visit goes wide.", effects: [{ wildDartIndex: -1 }] },
      { name: "Spotlight", description: "Your darts drift: every hit lands on the number next door.", effects: [{ segmentRedirect: true }] },
    ],
    enrageMove: { name: "Encore", description: "Darts drift next door and one each visit goes wide.", effects: [{ segmentRedirect: true, wildDartIndex: -1 }] },
    lines: L({ entrance: ["Can I get a cheer?!", "Lights. Camera. Me."], bust: ["The crowd boos!", "Ooh, awkward."], hurt: ["Even I clapped that."],
      phase2: "Spotlight on you. Feel the heat?", phase3: "ENCORE!", defeated: "...Take a bow. You've earned it.", victory: "Thank you, goodnight!" }),
    portrait: { face: "crown", primary: "#ec4899", secondary: "#500724", eye: "#fbcfe8" },
  },
  "double-trouble": {
    id: "double-trouble", tagline: "Two of us. Doubles only.",
    lore: "Twins who finish each other's sentences and every double on the board. Race them round the doubles, 1 to 20.",
    botLevel: "pro", gameKey: "round_clock_doubles",
    moves: [
      { name: "Seeing Double", description: "Round the board on doubles only, D1 to D20. First to finish wins.", effects: [] },
      { name: "Double Up", description: "The twins speed up: throw a level better.", effects: [], botBoost: 1 },
    ],
    enrageMove: { name: "Double Trouble", description: "Throw two levels better.", effects: [], botBoost: 2 },
    lines: L({ entrance: ["We've been expecting you.", "Two against one. Fair."], bust: ["Missed again! / Missed again!"], hurt: ["Hey! / Hey!"],
      phase2: "Double up!", phase3: "DOUBLE TROUBLE!", defeated: "We... lost? / We lost.", victory: "Double top. / Double top." }),
    portrait: { face: "mask", primary: "#22d3ee", secondary: "#164e63", eye: "#f0abfc" },
  },
  "the-gladiator": {
    id: "the-gladiator", tagline: "Are you not entertained?",
    lore: "Champion of the Arena's Cricket pit. Puts a shield over the big numbers and blunts every mark you land.",
    botLevel: "pro",
    moves: [
      { name: "Shield Wall", description: "20, 19 and 18 won't mark for you.", effects: [{ blockSegmentsForMarks: [20, 19, 18] }] },
      { name: "Blunted", description: "Your hits count for half the marks.", effects: [{ marksMultiplier: 0.5 }] },
    ],
    enrageMove: { name: "Thumbs Down", description: "Single marks only, and your last dart each visit marks nothing.", effects: [{ sluggishMarks: true, blockFinalDartMark: true }] },
    lines: L({ entrance: ["Fight!", "The crowd wants blood."], bust: ["Thumbs down."], hurt: ["A scratch!"],
      phase2: "Raise your shield. Oh wait.", phase3: "THUMBS DOWN.", defeated: "...The crowd chooses you.", victory: "Victory is mine!" }),
    portrait: { face: "horns", primary: "#b91c1c", secondary: "#1c0a0a", eye: "#fbbf24" },
  },
  "the-champion": {
    id: "the-champion", tagline: "Belt holder. Undefeated.",
    lore: "Holds the Arena belt and plays like it. Squeezes every dart you throw and doesn't let you finish easily.",
    botLevel: "pro",
    moves: [
      { name: "Title Defence", description: "Every dart is worth 85% of its real value.", effects: [{ allDartsMultiplier: 0.85 }] },
      { name: "Ring Rust", description: "Your doubles count as singles — finishing is harder.", effects: [{ doublesAsSingles: true }] },
    ],
    enrageMove: { name: "Belt on the Line", description: "Darts worth 80%, and the first two darts of each visit can't finish.", effects: [{ allDartsMultiplier: 0.8, noDoubleFinishFirstN: 2 }] },
    lines: L({ entrance: ["You want the belt? Take it.", "Undefeated. Unbothered."], bust: ["Champion's tip: score."], hurt: ["Not bad, challenger."],
      phase2: "Let's see you finish now.", phase3: "The belt's not going anywhere.", defeated: "...It's yours. Wear it well.", victory: "And STILL." }),
    portrait: { face: "crown", primary: "#eab308", secondary: "#422006", eye: "#fff7ed" },
  },

  // ── World 4: The Void ──────────────────────────────────────────────────────
  "the-hollow": {
    id: "the-hollow", tagline: "There's nothing inside.",
    lore: "A shape at the bottom of the board where the light doesn't reach. In Cricket it swallows your marks and gives nothing back.",
    botLevel: "elite",
    moves: [
      { name: "Empty", description: "Your hits count for half the marks.", effects: [{ marksMultiplier: 0.5 }] },
      { name: "Echo", description: "Your first dart each visit marks nothing, and no bull marks.", effects: [{ hesitateFirstDart: true, blockBullMarks: true }] },
    ],
    enrageMove: { name: "Hollowed Out", description: "Single marks only, and you can't close a number.", effects: [{ sluggishMarks: true, blockClosing: true }] },
    lines: L({ entrance: ["...", "You came down here?"], bust: ["...nothing..."], hurt: ["...it felt that."],
      phase2: "...echo...", phase3: "...hollow...", defeated: "...light...", victory: "...stay..." }),
    portrait: { face: "void", primary: "#6d28d9", secondary: "#0a0014", eye: "#e9d5ff" },
  },
  bermuda: {
    id: "bermuda", tagline: "Things go missing here.",
    lore: "The Bermuda Triangle game: 12, 13, 14, any double, 15, 16, 17, any treble, 18, 19, 20, 25, bull. Miss a round and half your score vanishes into it.",
    botLevel: "elite", gameKey: "bermuda_triangle",
    moves: [
      { name: "The Triangle", description: "Bermuda Triangle: hit the round's target or your score is halved. Highest score wins.", effects: [] },
      { name: "Pull of the Deep", description: "Bermuda throws a level better.", effects: [], botBoost: 1 },
    ],
    enrageMove: { name: "Vanishing Point", description: "Throws two levels better.", effects: [], botBoost: 2 },
    lines: L({ entrance: ["Lost? Everyone is.", "Mind the currents."], bust: ["Gone. Halved."], hurt: ["The tide turns."],
      phase2: "Feel the pull?", phase3: "The vanishing point.", defeated: "Found... your way out.", victory: "Lost at sea." }),
    portrait: { face: "cyclops", primary: "#0891b2", secondary: "#082f49", eye: "#a5f3fc" },
  },
  "the-executioner": {
    id: "the-executioner", tagline: "One life. One chance.",
    lore: "Killer with one life each. One mistake and it's over, in either direction.",
    botLevel: "elite", gameKey: "killer_1_life",
    moves: [
      { name: "The Block", description: "Killer, one life each: claim your number, then hit its number once.", effects: [] },
      { name: "The Axe", description: "Throws a level better.", effects: [], botBoost: 1 },
    ],
    enrageMove: { name: "Final Verdict", description: "Throws two levels better.", effects: [], botBoost: 2 },
    lines: L({ entrance: ["Kneel.", "One swing is all I need."], bust: ["Steady your hand."], hurt: ["...Clean."],
      phase2: "The axe rises.", phase3: "Final verdict.", defeated: "...Pardoned.", victory: "Next." }),
    portrait: { face: "hood", primary: "#111827", secondary: "#000000", eye: "#f87171" },
  },
  "the-mirror": {
    id: "the-mirror", tagline: "You've played this one before.",
    lore: "It throws your darts: your own shadow, if you've unlocked it, with every habit you have. If you haven't, it borrows an elite thrower's.",
    botLevel: "elite",
    moves: [
      { name: "Reflection", description: "It throws like you. Your trebles count as singles.", effects: [{ treblesAsSingles: true }] },
      { name: "Cracked Glass", description: "Your darts drift onto the number next door.", effects: [{ segmentRedirect: true }] },
    ],
    enrageMove: { name: "Shattered", description: "Darts drift, trebles are singles, and every dart costs you 5.", effects: [{ segmentRedirect: true, treblesAsSingles: true, penaltyPerDart: 5 }] },
    lines: L({ entrance: ["Hello, me.", "I know what you're going to throw."], bust: ["That's you, that is."], hurt: ["I didn't see that coming. You did."],
      phase2: "Cracks are showing.", phase3: "SHATTERED.", defeated: "You beat yourself. Finally.", victory: "Same as always." }),
    portrait: { face: "mask", primary: "#cbd5e1", secondary: "#1e293b", eye: "#38bdf8" },
  },
  "the-reckoning": {
    id: "the-reckoning", tagline: "Every trick they used, at the same time.",
    lore: "The last fight. Everything every boss on the way down did to you, all at once.",
    botLevel: "elite",
    moves: [
      { name: "Everything, All At Once", description: "Darts worth 80%, and 20 & 19 are blocked.", effects: [{ allDartsMultiplier: 0.8, segmentBlock: [20, 19] }] },
      { name: "Cold Comfort", description: "No dart can score more than 40, and every one costs you 5.", effects: [{ maxDartValue: 40, penaltyPerDart: 5 }] },
    ],
    enrageMove: { name: "The Reckoning", description: "Trebles are singles, your visit is capped at 30, and every dart costs you 10.", effects: [{ treblesAsSingles: true, maxVisitTotal: 30, penaltyPerDart: 10 }] },
    lines: L({ entrance: ["You made it. Pity.", "Everything you've faced. All of it. Now."], bust: ["Everything you feared."], hurt: ["...So you've learned."],
      phase2: "Cold comfort.", phase3: "THE RECKONING.", defeated: "It's over. You're the last one standing.", victory: "Back to the start with you." }),
    portrait: { face: "void", primary: "#f43f5e", secondary: "#0a0a0a", eye: "#fff1f2" },
  },
};

export const BOSSES: Boss[] = BOSS_ROSTER.map(r => ({
  ...CONTENT[r.id], name: r.name, order: r.order, masterySeconds: r.masterySeconds, world: r.world, gameMode: r.mode,
}));

const LOCKDOWN_SEGMENTS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];

/** The boss's move for a phase: 1 → moves[0], 2 → moves[1], 3 → its enraged move. */
export function moveForPhase(boss: Boss, phase: 1 | 2 | 3): BossMove {
  return phase === 3 && boss.enrageMove ? boss.enrageMove : boss.moves[Math.min(phase, boss.moves.length) - 1];
}

/** Turns a move into live curse effects on your darts (501 / Cricket). Random parts
 *  (Lockdown's number, which dart goes wide) are picked fresh each time. legDuration
 *  keeps them up across your visits: without it the engine drops a curse after your
 *  first visit (it was doing exactly that before). */
export function effectsForMove(move: BossMove, status: CCEffect["status"] = "active"): CCEffect[] {
  return move.effects.map(partial => {
    const filled = { ...partial } as Partial<CCEffect>;
    if (filled.lockdownSegment === -1) filled.lockdownSegment = LOCKDOWN_SEGMENTS[Math.floor(Math.random() * LOCKDOWN_SEGMENTS.length)];
    if (filled.wildDartIndex === -1) filled.wildDartIndex = Math.floor(Math.random() * 3);
    return { ...filled, cardName: move.name, appliedBy: 1, affectsPlayer: 0, status, legDuration: true } as CCEffect;
  });
}

export function getBossById(id: string): Boss | undefined {
  return BOSSES.find(b => b.id === id);
}

export const worldOf = (id: WorldId) => WORLDS.find(w => w.id === id)!;

export const pickLine = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

/** A perk's effect on your own darts (the ones the effects engine does; the rest are fight rules in BossBattleScorer). */
export function perkEffects(perk: PerkId | null | undefined): CCEffect[] {
  const e: Partial<CCEffect> | null = perk === "steady-hand" ? { missToMin: true }
    : perk === "second-wind" ? { preventBustInCheckout: true }
    : perk === "treble-hunter" ? { trebleMultiplier: 1.3, oneShotTrebleMultiplier: true }
    : null;
  const name = PERKS.find(p => p.id === perk)?.name ?? "";
  return e ? [{ ...e, cardName: name, appliedBy: 0, affectsPlayer: 0, status: "active", legDuration: true } as CCEffect] : [];
}

/** Be the Boss: a player turned into a 501 boss with three curses picked from bosses they've beaten. */
export function customBoss(c: { id: number; fromName: string; curses: string[]; message: string | null }): Boss {
  const move = (ref: string): BossMove => {
    const [bossId, ph] = ref.split(":");
    const b = getBossById(bossId);
    return b ? moveForPhase(b, Number(ph) as 1 | 2 | 3) : { name: "Nothing", description: "No curse.", effects: [] };
  };
  return {
    id: `custom-${c.id}`, name: `Boss ${c.fromName}`, tagline: c.message || "You asked for this.",
    lore: `${c.fromName} picked these curses themselves.`, world: "arena", gameMode: "X01", botLevel: "county", order: 0, masterySeconds: 0,
    moves: [move(c.curses[0]), move(c.curses[1])], enrageMove: move(c.curses[2]),
    lines: L({ entrance: [`It's me. Boss ${c.fromName}.`, "Let's see what you've got."], phase2: "Right, gloves off.", phase3: "Now I'm annoyed.",
      defeated: "...Fine. Rematch soon.", victory: "Told you I'd make a good boss." }),
    portrait: { face: "crown", primary: "#a78bfa", secondary: "#2e1065", eye: "#fde68a" },
  };
}
