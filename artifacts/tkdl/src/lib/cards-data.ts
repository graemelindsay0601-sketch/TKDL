export type Category =
  | "X01 GOOD"
  | "X01 BAD"
  | "CRICKET GOOD"
  | "CRICKET BAD"
  | "WILDCARD GOOD"
  | "WILDCARD BAD";

export type Rarity = "COMMON" | "RARE" | "LEGENDARY";

export interface CardData {
  id: number;
  name: string;
  category: Category;
  rarity: Rarity;
  effect: string;
  flavourText: string;
  energyCost?: number;
  artworkUrl?: string;
}

export const ALL_CARDS: CardData[] = [
  // ── X01 GOOD (20) ──────────────────────────────────────────────────────────
  { id: 101, name: "Big Game Player", category: "X01 GOOD", rarity: "RARE", effect: "If you score 80+ (not on double), gain +35 bonus next leg.", flavourText: "When the pressure is on, legends step up.", energyCost: 1 },
  { id: 102, name: "Power Surge +50", category: "X01 GOOD", rarity: "COMMON", effect: "Add +50 to your turn total.", flavourText: "Sometimes the board just opens up.", energyCost: 1 },
  { id: 103, name: "Treble Hunter", category: "X01 GOOD", rarity: "RARE", effect: "Next treble hit counts at 1.3x — T20 becomes 78 instead of 60.", flavourText: "Narrow the wire. Broaden the reward.", energyCost: 2 },
  { id: 104, name: "Unstoppable Checkout", category: "X01 GOOD", rarity: "RARE", effect: "While on double, opponent cannot play penalty cards this turn.", flavourText: "The finish line belongs to you alone.", energyCost: 2 },
  { id: 105, name: "Banking Strategy", category: "X01 GOOD", rarity: "COMMON", effect: "If you score 50+ (not on double), next turn gets +20 bonus.", flavourText: "Build momentum. Bank the points.", energyCost: 1 },
  { id: 106, name: "Checkout Confidence", category: "X01 GOOD", rarity: "RARE", effect: "If on double, gain 1 free re-throw if you miss the first attempt.", flavourText: "One chance wasn't enough — take another.", energyCost: 2 },
  { id: 107, name: "Exact Finish", category: "X01 GOOD", rarity: "RARE", effect: "In final 50 points, if you hit your double, opponent can't play penalty cards next turn.", flavourText: "Precision silences the opposition.", energyCost: 2 },
  { id: 108, name: "High Pressure", category: "X01 GOOD", rarity: "COMMON", effect: "If opponent is ahead in legs, gain +40 bonus this leg.", flavourText: "The underdog always has something to prove.", energyCost: 1 },
  { id: 109, name: "Perfect Rhythm", category: "X01 GOOD", rarity: "COMMON", effect: "All your darts this turn score +10 each.", flavourText: "Three darts. One heartbeat.", energyCost: 1 },
  { id: 110, name: "High Roller", category: "X01 GOOD", rarity: "RARE", effect: "If you score over 100 this turn, gain +25 bonus.", flavourText: "High stakes. Higher rewards.", energyCost: 2 },
  { id: 111, name: "Precision Strike", category: "X01 GOOD", rarity: "RARE", effect: "Your next three darts score minimum 6 — no 1–5 segments this turn.", flavourText: "Sloppy scores don't cut it here.", energyCost: 2 },
  { id: 112, name: "Safety Boost", category: "X01 GOOD", rarity: "COMMON", effect: "Your lowest-value dart this turn scores minimum +15.", flavourText: "Even your worst dart counts tonight.", energyCost: 1 },
  { id: 113, name: "Treble Boost", category: "X01 GOOD", rarity: "RARE", effect: "Your trebles count at 1.4x this turn — T20 becomes 84 instead of 60.", flavourText: "Push that wire just a fraction further.", energyCost: 2 },
  { id: 114, name: "Safety Net", category: "X01 GOOD", rarity: "LEGENDARY", effect: "If you would bust, score half your current visit total instead.", flavourText: "There's always a way back.", energyCost: 3 },
  { id: 115, name: "Close Control", category: "X01 GOOD", rarity: "RARE", effect: "In final 50 points, any dart that would bust is automatically reduced to 1 point.", flavourText: "Stay in the game. Always.", energyCost: 2 },
  { id: 116, name: "Steady Hand", category: "X01 GOOD", rarity: "LEGENDARY", effect: "Your darts can't miss the board — any complete miss is redirected to segment 5.", flavourText: "The hand that never falters.", energyCost: 3 },
  { id: 117, name: "Scoring Arsenal", category: "X01 GOOD", rarity: "COMMON", effect: "Your turn can't end until all 3 darts are thrown — forces a full visit.", flavourText: "Use every weapon at your disposal.", energyCost: 1 },
  { id: 118, name: "Finishing Bonus", category: "X01 GOOD", rarity: "RARE", effect: "If you finish this turn, gain +50 bonus points.", flavourText: "The sweetest points are the last ones.", energyCost: 2 },
  { id: 119, name: "Century Maker", category: "X01 GOOD", rarity: "COMMON", effect: "If you score exactly 100 this turn, gain +40 bonus.", flavourText: "Three figures — exactly.", energyCost: 1 },
  { id: 120, name: "Iron Will", category: "X01 GOOD", rarity: "RARE", effect: "All your darts score at 1.2x value this turn.", flavourText: "Bend the board to your will.", energyCost: 2 },

  // ── X01 BAD (20) ───────────────────────────────────────────────────────────
  { id: 201, name: "Rust Hands -40", category: "X01 BAD", rarity: "COMMON", effect: "Target's next turn score is reduced by 40 points.", flavourText: "Some nights the grip just isn't there.", energyCost: 1 },
  { id: 202, name: "Wild Throw", category: "X01 BAD", rarity: "COMMON", effect: "One random dart this turn becomes a complete miss — 0 points.", flavourText: "Nobody knows which one goes wild.", energyCost: 1 },
  { id: 203, name: "Brick Wall", category: "X01 BAD", rarity: "RARE", effect: "Target can't score on 20, 19, or 18 (any ring) this turn.", flavourText: "The top of the board is closed.", energyCost: 2 },
  { id: 204, name: "Low Blow", category: "X01 BAD", rarity: "COMMON", effect: "Single hits count as 0 — only doubles and trebles score.", flavourText: "Mediocrity is punished.", energyCost: 1 },
  { id: 205, name: "Doubles Don't Count", category: "X01 BAD", rarity: "RARE", effect: "Doubles count as singles this turn — D20 = 20, not 40.", flavourText: "Half the reward. All the effort.", energyCost: 2 },
  { id: 206, name: "Shackled", category: "X01 BAD", rarity: "COMMON", effect: "Target's highest possible dart this turn is capped at 50.", flavourText: "Chains on the wrist, chains on the score.", energyCost: 1 },
  { id: 207, name: "Turn Enforcer", category: "X01 BAD", rarity: "RARE", effect: "Target must complete all 3 darts before attempting to finish.", flavourText: "No shortcuts tonight.", energyCost: 2 },
  { id: 208, name: "Pressure Zone", category: "X01 BAD", rarity: "COMMON", effect: "Target can only score on 15, 20, or Bull — all other segments score 0.", flavourText: "Three numbers. Pick wisely.", energyCost: 1 },
  { id: 209, name: "Off Target", category: "X01 BAD", rarity: "RARE", effect: "Target's darts shift to the adjacent dartboard segment — 20 becomes 1 or 5.", flavourText: "Just a fraction off. Just enough.", energyCost: 2 },
  { id: 210, name: "Mercy Killer", category: "X01 BAD", rarity: "COMMON", effect: "Target's turn is capped at 60 total.", flavourText: "Sixty and done.", energyCost: 1 },
  { id: 211, name: "Jinx", category: "X01 BAD", rarity: "RARE", effect: "All target's darts score at 0.75x value this turn.", flavourText: "The curse lands before the dart.", energyCost: 2 },
  { id: 212, name: "Fatigue", category: "X01 BAD", rarity: "RARE", effect: "Target's darts get progressively worse — Dart 1 normal, Dart 2 ×0.9, Dart 3 ×0.8.", flavourText: "Three visits too many.", energyCost: 2 },
  { id: 213, name: "Leg Reset", category: "X01 BAD", rarity: "COMMON", effect: "If target won 2+ legs in a row, their streak is reset to zero.", flavourText: "Winning streaks end here.", energyCost: 1 },
  { id: 214, name: "Clutch Breaker", category: "X01 BAD", rarity: "RARE", effect: "In final 100 points, target's darts score -15 each.", flavourText: "The moment that matters — ruined.", energyCost: 2 },
  { id: 215, name: "Finish Delay", category: "X01 BAD", rarity: "RARE", effect: "Target's first 2 darts can't finish — doubles count as singles until dart 3.", flavourText: "So close. Not yet.", energyCost: 2 },
  { id: 216, name: "Treble Curse", category: "X01 BAD", rarity: "LEGENDARY", effect: "Trebles count as singles this turn — T20 = 20, not 60.", flavourText: "The wire bites back.", energyCost: 3 },
  { id: 217, name: "Dead Zone", category: "X01 BAD", rarity: "RARE", effect: "Target can't score on any segment 15–20 this turn — only 1–14 and Bull.", flavourText: "The high numbers are gone.", energyCost: 2 },
  { id: 218, name: "Mental Block", category: "X01 BAD", rarity: "COMMON", effect: "Each dart thrown costs 10 points — visit length × 10 is subtracted.", flavourText: "The mind is the first thing to go.", energyCost: 1 },
  { id: 219, name: "Trapped", category: "X01 BAD", rarity: "RARE", effect: "Target must finish on double or their turn ends immediately after 1 dart.", flavourText: "Hit it first time or not at all.", energyCost: 2 },
  { id: 220, name: "Lockdown", category: "X01 BAD", rarity: "LEGENDARY", effect: "Choose one segment — target can only score on that number all turn.", flavourText: "One number. One chance.", energyCost: 3 },

  // ── CRICKET GOOD (20) ──────────────────────────────────────────────────────
  { id: 301, name: "Instant Mark", category: "CRICKET GOOD", rarity: "COMMON", effect: "Automatically mark the called number without throwing — counts as 1 hit.", flavourText: "Sometimes the board does the work.", energyCost: 1 },
  { id: 302, name: "Double Strike", category: "CRICKET GOOD", rarity: "RARE", effect: "Your marks count as 2x toward opening or closing this turn.", flavourText: "One dart. Double the progress.", energyCost: 2 },
  { id: 303, name: "Sniper Lock", category: "CRICKET GOOD", rarity: "RARE", effect: "Next 3 darts must hit the called number — any miss scores 0.", flavourText: "Lock on. Don't deviate.", energyCost: 2 },
  { id: 304, name: "Number Resurrection", category: "CRICKET GOOD", rarity: "LEGENDARY", effect: "One closed number becomes fresh and reopenable again — opponent's marks reset.", flavourText: "What was closed can be reopened.", energyCost: 3 },
  { id: 305, name: "Scoring Surge", category: "CRICKET GOOD", rarity: "LEGENDARY", effect: "All your open numbers score at 1.5x value this leg — T20 = 90 instead of 60.", flavourText: "The board bends to the will of the dominant.", energyCost: 3 },
  { id: 306, name: "Closing Protection", category: "CRICKET GOOD", rarity: "RARE", effect: "Once you open a number, opponent can't close it this leg.", flavourText: "Open territory stays open.", energyCost: 2 },
  { id: 307, name: "Mark Flood", category: "CRICKET GOOD", rarity: "RARE", effect: "All your darts this turn automatically mark — even if you miss the number.", flavourText: "Every throw counts tonight.", energyCost: 2 },
  { id: 308, name: "Scoring Momentum", category: "CRICKET GOOD", rarity: "COMMON", effect: "Each mark this turn is worth +5 more points than the last.", flavourText: "Build on every hit.", energyCost: 1 },
  { id: 309, name: "Early Closer", category: "CRICKET GOOD", rarity: "RARE", effect: "If you close a number before turn 5, get +30 bonus points.", flavourText: "First to close wins the initiative.", energyCost: 2 },
  { id: 310, name: "Perfect Round", category: "CRICKET GOOD", rarity: "RARE", effect: "If all 3 darts mark this turn, gain +25 bonus.", flavourText: "A clean sweep of three.", energyCost: 2 },
  { id: 311, name: "Bull Multiplier", category: "CRICKET GOOD", rarity: "RARE", effect: "When you hit Bull, it counts as marking any 3 numbers you choose.", flavourText: "One bull. Three gains.", energyCost: 2 },
  { id: 312, name: "Bullseye Rush", category: "CRICKET GOOD", rarity: "COMMON", effect: "Bull = auto-marks 2 numbers of your choice.", flavourText: "Centre board, double reward.", energyCost: 1 },
  { id: 313, name: "Comeback Marks", category: "CRICKET GOOD", rarity: "COMMON", effect: "If you're behind in points, all your marks count at 1.5x toward opening.", flavourText: "The deficit breeds the hunger.", energyCost: 1 },
  { id: 314, name: "Mark Accelerator", category: "CRICKET GOOD", rarity: "RARE", effect: "When you hit the called number, marks count as 2 — closing twice as fast.", flavourText: "Double speed. Same dart.", energyCost: 2 },
  { id: 315, name: "Mark Multiplier", category: "CRICKET GOOD", rarity: "RARE", effect: "If you mark the called number 3+ times this turn, score +50 bonus points.", flavourText: "Hat-trick on one number. Bonus earned.", energyCost: 2 },
  { id: 316, name: "Quick Close", category: "CRICKET GOOD", rarity: "COMMON", effect: "If you close your number by dart 2, get a free mark on the next number.", flavourText: "Speed is its own reward.", energyCost: 1 },
  { id: 317, name: "Momentum Arsenal", category: "CRICKET GOOD", rarity: "COMMON", effect: "Each successful mark builds +10 point bonus — stacks through the turn.", flavourText: "Stack the marks. Stack the points.", energyCost: 1 },
  { id: 318, name: "High Scorer", category: "CRICKET GOOD", rarity: "RARE", effect: "If you score 100+ points this turn, gain +20 bonus.", flavourText: "Three figures on the board.", energyCost: 2 },
  { id: 319, name: "Perfect Form", category: "CRICKET GOOD", rarity: "RARE", effect: "All your marks count this turn AND you score at 1.5x.", flavourText: "Total control. Maximum return.", energyCost: 2 },
  { id: 320, name: "Dominance", category: "CRICKET GOOD", rarity: "COMMON", effect: "If you lead in closed numbers, all your marks are worth 1.3x.", flavourText: "Control the board. Control the game.", energyCost: 1 },

  // ── CRICKET BAD (20) ───────────────────────────────────────────────────────
  { id: 401, name: "Bad Aim", category: "CRICKET BAD", rarity: "COMMON", effect: "Target's marks count at 50% value toward opening or closing.", flavourText: "Half the marks for double the throws.", energyCost: 1 },
  { id: 402, name: "Distraction", category: "CRICKET BAD", rarity: "RARE", effect: "Target loses their next number mark completely — hit doesn't count.", flavourText: "Just enough to break the rhythm.", energyCost: 2 },
  { id: 403, name: "Out of Position", category: "CRICKET BAD", rarity: "COMMON", effect: "Target can't hit high-value numbers — 20, 19, 18 all score 0 this turn.", flavourText: "Wrong side of the board.", energyCost: 1 },
  { id: 404, name: "Penalty Zone", category: "CRICKET BAD", rarity: "RARE", effect: "Target's next marks must be on 6–15 only — high numbers and Bull don't mark.", flavourText: "Forced into the low end.", energyCost: 2 },
  { id: 405, name: "Re-Opening Block", category: "CRICKET BAD", rarity: "RARE", effect: "When you close one of target's numbers, that number is permanently locked.", flavourText: "Closed for good.", energyCost: 2 },
  { id: 406, name: "Aim Shift", category: "CRICKET BAD", rarity: "RARE", effect: "Target's shots hit adjacent segments — 20→1/5, 19→3/7.", flavourText: "The board shifted when they weren't looking.", energyCost: 2 },
  { id: 407, name: "Hesitation", category: "CRICKET BAD", rarity: "COMMON", effect: "Target's first dart this turn doesn't mark — only darts 2 and 3 count.", flavourText: "A moment's doubt costs a dart.", energyCost: 1 },
  { id: 408, name: "Pressure", category: "CRICKET BAD", rarity: "RARE", effect: "Target must close their current number or lose 30 points at turn end.", flavourText: "Close it — or pay.", energyCost: 2 },
  { id: 409, name: "Momentum Killer", category: "CRICKET BAD", rarity: "RARE", effect: "If target had 2+ marks last turn, they lose those marks this turn.", flavourText: "Yesterday's momentum means nothing.", energyCost: 2 },
  { id: 410, name: "Sluggish Marks", category: "CRICKET BAD", rarity: "COMMON", effect: "All target's marks count as 1 this turn — regardless of single, double, or treble.", flavourText: "Everything slows to a crawl.", energyCost: 1 },
  { id: 411, name: "Number Hex", category: "CRICKET BAD", rarity: "RARE", effect: "Target is locked to one number all turn — any other segment scores 0.", flavourText: "Cursed to chase just one.", energyCost: 2 },
  { id: 412, name: "Closing Blocker", category: "CRICKET BAD", rarity: "RARE", effect: "Target cannot close any numbers this turn — marks cap at 2.", flavourText: "Close enough. Not close enough.", energyCost: 2 },
  { id: 413, name: "Mark Erasure", category: "CRICKET BAD", rarity: "COMMON", effect: "Each mark costs target 10 points — marks still count, but -10 each.", flavourText: "Progress has a price tonight.", energyCost: 1 },
  { id: 414, name: "Cricket Prison", category: "CRICKET BAD", rarity: "COMMON", effect: "Target can only hit 15, 19, 20 — only 3 of the 7 cricket numbers mark.", flavourText: "Three numbers. Four locked away.", energyCost: 1 },
  { id: 415, name: "Bull Void", category: "CRICKET BAD", rarity: "RARE", effect: "Bull doesn't count as marking anything this turn.", flavourText: "Dead centre. Dead points.", energyCost: 2 },
  { id: 416, name: "Mark Killer", category: "CRICKET BAD", rarity: "COMMON", effect: "Target's final dart this turn doesn't count as a mark.", flavourText: "The last dart lands for nothing.", energyCost: 1 },
  { id: 417, name: "Mark Drain", category: "CRICKET BAD", rarity: "RARE", effect: "If target leads in points, they lose 1 mark from a random opened number each turn.", flavourText: "The lead drains slowly away.", energyCost: 2 },
  { id: 418, name: "Streak Breaker", category: "CRICKET BAD", rarity: "RARE", effect: "If target had 3+ marks last turn, lose half those marks this turn.", flavourText: "Good form never lasts.", energyCost: 2 },
  { id: 419, name: "Number Prison", category: "CRICKET BAD", rarity: "LEGENDARY", effect: "One random closed number is locked forever — target can never reopen it.", flavourText: "Some numbers stay closed.", energyCost: 3 },
  { id: 420, name: "Score Halve", category: "CRICKET BAD", rarity: "LEGENDARY", effect: "Target's open numbers score at 0.5x value this leg — T20 = 30 instead of 60.", flavourText: "Half the points. Same effort.", energyCost: 3 },

  // ── WILDCARD GOOD (10) ─────────────────────────────────────────────────────
  { id: 501, name: "Coin Flip", category: "WILDCARD GOOD", rarity: "RARE", effect: "50/50 chance — either gain +40 bonus OR opponent loses 30 points.", flavourText: "Fortune favours the brave.", energyCost: 2 },
  { id: 502, name: "Lucky Streak", category: "WILDCARD GOOD", rarity: "COMMON", effect: "If you won the previous leg, gain +50 bonus this leg.", flavourText: "Winners keep winning.", energyCost: 1 },
  { id: 503, name: "Momentum Surge", category: "WILDCARD GOOD", rarity: "COMMON", effect: "If you're ahead in the match, gain +25 bonus this leg.", flavourText: "Lead from the front. Keep leading.", energyCost: 1 },
  { id: 504, name: "Finishing Edge", category: "WILDCARD GOOD", rarity: "RARE", effect: "In the final deciding leg, if you miss a finish or close attempt, you get 1 free retry.", flavourText: "One more chance at glory.", energyCost: 2 },
  { id: 505, name: "Comeback Leg", category: "WILDCARD GOOD", rarity: "RARE", effect: "If you lost the previous leg, gain +60 bonus this leg.", flavourText: "Down but never out.", energyCost: 2 },
  { id: 506, name: "Hot Hand", category: "WILDCARD GOOD", rarity: "RARE", effect: "If you've won 2+ legs in a row, gain +45 bonus.", flavourText: "The streak is real.", energyCost: 2 },
  { id: 507, name: "Underdog", category: "WILDCARD GOOD", rarity: "COMMON", effect: "If you're behind overall, gain +50 bonus this leg.", flavourText: "Nobody's backing you. Do it anyway.", energyCost: 1 },
  { id: 508, name: "Perfect Game", category: "WILDCARD GOOD", rarity: "COMMON", effect: "If this is a shutout leg (opponent scored 0), gain +30 bonus.", flavourText: "Perfection deserves recognition.", energyCost: 1 },
  { id: 509, name: "Match Point", category: "WILDCARD GOOD", rarity: "LEGENDARY", effect: "If you're 1 leg away from winning the match, gain +70 bonus.", flavourText: "One leg from glory — take it.", energyCost: 3 },
  { id: 510, name: "Invincible", category: "WILDCARD GOOD", rarity: "LEGENDARY", effect: "Your next turn is completely unaffected by any opponent penalty cards.", flavourText: "Not tonight.", energyCost: 3 },

  // ── WILDCARD BAD (10) ──────────────────────────────────────────────────────
  { id: 601, name: "Dark Cloud", category: "WILDCARD BAD", rarity: "COMMON", effect: "Target's next leg score reduced by 35 points (X01) or 1 number locked (Cricket).", flavourText: "The storm follows the leader.", energyCost: 1 },
  { id: 602, name: "Streak Crusher", category: "WILDCARD BAD", rarity: "RARE", effect: "Target's current winning streak is reset to zero — any streak bonus they held is gone.", flavourText: "Streaks are just waiting to be ended.", energyCost: 2 },
  { id: 603, name: "Unlucky Night", category: "WILDCARD BAD", rarity: "COMMON", effect: "All target's darts count at 75% value this leg.", flavourText: "Not every night goes your way.", energyCost: 1 },
  { id: 604, name: "Hex", category: "WILDCARD BAD", rarity: "RARE", effect: "All target's darts count at 50% value (X01) or marks at 50% (Cricket) this leg.", flavourText: "Cursed from the first dart.", energyCost: 2 },
  { id: 605, name: "Wipeout", category: "WILDCARD BAD", rarity: "RARE", effect: "Target's last 2 darts this leg score 0.", flavourText: "The finish disappears before your eyes.", energyCost: 2 },
  { id: 606, name: "Total Annihilation", category: "WILDCARD BAD", rarity: "LEGENDARY", effect: "Target's next leg score reduced by 100 OR loses 1 opened number — whichever game mode.", flavourText: "No mercy. No survivors.", energyCost: 3 },
  { id: 607, name: "Match Pressure", category: "WILDCARD BAD", rarity: "RARE", effect: "In the final leg of the match, target's darts score -20 each (X01) or marks halved (Cricket).", flavourText: "The big moment becomes the worst moment.", energyCost: 2 },
  { id: 608, name: "Underdog Curse", category: "WILDCARD BAD", rarity: "COMMON", effect: "If target is ahead, all their darts score at 0.8x value.", flavourText: "The lead is a burden.", energyCost: 1 },
  { id: 609, name: "Win Bonus Removed", category: "WILDCARD BAD", rarity: "COMMON", effect: "If target won last leg, they lose that momentum bonus.", flavourText: "What you earned doesn't last.", energyCost: 1 },
  { id: 610, name: "Shutdown", category: "WILDCARD BAD", rarity: "RARE", effect: "Target's leg capped at 50 points (X01) or 2 numbers max (Cricket).", flavourText: "Hard stop.", energyCost: 2 },
];
