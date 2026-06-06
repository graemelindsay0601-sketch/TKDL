import { X, BookOpen } from "lucide-react";
import type { GameTypeOption } from "./game-scorer";

// ── Static fallback rules for games without DB rules_text ─────────────────────
const RULES: Record<string, string> = {
  "501_double_out": "Both players start at 501 and take turns throwing 3 darts per visit. Subtract each visit's score from your total. You must finish on exactly 0, with your final dart being a double (or the bull's-eye, which counts as a double). Going below 0 or hitting exactly 0 with a non-double is a BUST — your score reverts to before that visit.",
  "501_straight_out": "Both players start at 501. Subtract scores each visit. First player to reach exactly 0 wins — any dart can be the winning dart, no double required. Still bust if you go below 0.",
  "501_double_in": "You must hit a double before your score starts counting. Any darts before your first double are wasted. Once in, play as standard 501 and finish on a double.",
  "501_treble_out": "Start at 501. Play standard X01 but you MUST finish on a treble (not a double, not bull). The last dart must land in the thin treble ring.",
  "501_master_out": "Start at 501. You must finish on either a double OR a treble. Bull's-eye (50) also counts as a valid finishing dart.",
  "301_double_out": "Shorter format — start at 301. Same rules as 501 Double Out. First to exactly 0 on a double wins. Quick game, great for deciding wagers.",
  "301_double_in": "Start at 301. Must hit a double to open your scoring, then finish on a double. The most restricted format — skill test.",
  "1001_double_out": "Endurance format — start at 1001 points. Double out required. Long game that tests consistency and composure under pressure.",
  "501_bo3": "Best of 3 legs of 501 Double Out. First to win 2 legs wins the match. The player who did NOT throw first in the previous leg throws first in the next. PDC World Championship format.",
  "501_bo5": "Best of 5 legs of 501 Double Out. First to win 3 legs wins. Players alternate who throws first each leg. Grand Prix / Matchplay format.",
  "501_bo7": "Best of 7 legs of 501 Double Out. First to win 4 legs wins. Players Championship format — the full pro experience.",
  "301_bo3": "Best of 3 legs of 301 Double Out. First to 2 legs wins. Shorter, faster format great for tournaments.",
  "701_double_out": "Marathon format — start at 701. Double out. Tests consistency over a longer game. Used in some major European tournaments.",
  "cricket": "Cricket is played on the numbers 15, 16, 17, 18, 19, 20, and Bull.\n\nTo CLOSE a number: hit it 3 times total (singles=1 mark, doubles=2 marks, trebles=3 marks).\n\nTo SCORE: once you close a number, any further hits on that number score you points (face value), BUT only while your opponent hasn't closed it.\n\nTo WIN: close all 7 numbers AND have a score equal to or greater than your opponent.\n\nStrategy: Close your opponent's open numbers (where they're scoring) while also closing numbers where you're ahead.",
  "cutthroat_cricket": "Same marking system as Cricket (15-20 + Bull), but scoring HURTS opponents.\n\nWhen you close a number (3 marks) and hit it again: those points go to any OPPONENT who hasn't closed that number yet.\n\nTo WIN: close all 7 numbers with the LOWEST score (since receiving points is bad).\n\nStrategy: Close numbers where your opponent is weak. Hitting closed numbers when opponent is open dumps points on them.",
  "around_the_world": "Race from 1 to 20, then hit the Bull to win.\n\nOn your turn: throw 3 darts. Any dart hitting your current target advances you to the next number. You can advance multiple numbers in one visit if you hit consecutive targets.\n\nFirst player to hit Bull (after completing 1–20) wins.\n\nNo specific multiplier needed — single, double, or treble of the target all count.",
  "around_world_trebles": "Same race as Around the World (1-20, then Bull) but you MUST hit the TREBLE ring of each number. A single or double does NOT count — only the thin inner treble ring advances you. Serious skill challenge.",
  "round_the_clock": "Race to hit 1 through 20 in order. First to hit 20 wins — no Bull required.\n\nSingle, double, or treble all count for advancing. You can skip numbers if you hit a dart further ahead, but only your current target or beyond advances you.",
  "shanghai": "7 rounds, targeting numbers 1 through 7 (one per round).\n\nIn each round both players throw 3 darts at the round's number:\n• Single = 1 × number value\n• Double = 2 × number value\n• Treble = 3 × number value\n\nSHANGHAI: if you hit a single, double AND treble of the round number in ONE visit — you win instantly, regardless of score!\n\nAfter 7 rounds, highest score wins.",
  "halve_it": "Targets in order: 20, 16, Any Double, 17, Bull, 18, 19, Any Treble.\n\nEach round: throw all 3 darts at the current target.\n• Hit the target at least once: add all hits on that target to your score.\n• Hit the target ZERO times: your total score is HALVED (rounded down).\n\nStart: 0 points. After all 8 rounds, highest score wins.\n\nTip: Even a single dart on the target saves your score. Don't panic — strategic misses are better than careless ones.",
  "count_up": "Simple accumulator — score as many points as possible.\n\nEach visit: throw 3 darts, add total to your score. First player to reach 501 (or more) wins.\n\nNo restrictions — any dart, any number counts. Great for warming up and tracking your average.",
  "high_score": "Each player throws 3 rounds of 3 darts (9 darts total). Score as many points as possible in those 9 darts. Highest total wins.\n\nUse this to track your 9-dart average — a quick, clean format for personal records.",
  "killer": "PHASE 1 — Number Assignment: Each player secretly picks a number (1–20) by hitting it on the board, or in this app by tapping it. Numbers must be unique.\n\nPHASE 2 — The Game:\n• You are NOT a Killer yet. Hit YOUR OWN double to become a Killer.\n• Once you're a Killer: hit your OPPONENT'S double to take one of their lives (they start with 3).\n• Lose all 3 lives → eliminated. Last player standing wins.\n\nWarning: If a Killer hits their own double again, nothing happens. Focus on opponent!",
  "gotcha": "Race to exactly 301 points, starting from 0.\n\nEach visit: throw 3 darts and add the total to your score. No bust from going over on individual darts within a visit — only the visit total matters.\n\nGOTCHA! If after your 3 darts your score EXACTLY matches your opponent's score, they reset to ZERO.\n\nBUST: If your total would exceed 301, your visit score is discarded.\n\nFirst to land on EXACTLY 301 wins.",
  "nearest_bull": "Each player throws 3 darts at the bull. After both players have thrown, look at the board — whichever player has a dart PHYSICALLY CLOSEST to the centre of the bull wins the round.\n\nTie-breaker: throw again.\n\nThe app records the result after you visually inspect the board.",
  "bull_finish": "Standard 501 but you can ONLY finish on the Bull's-eye (the inner bull, worth 50). Regular doubles do NOT count as a valid finish — you must hit the small inner bull. Tests composure under pressure.",
  "double_or_nothing": "Play standard 301 Double Out. If you miss your finishing shot (and bust), the STAKE DOUBLES for that attempt. Best for when you want to raise the pressure on the out-shot.",
  "sudden_death": "Standard 501 but if you BUST, instead of reverting your score to before the visit, your score is reset to 50. No mercy — one bad visit and you're back near the start. No double out required.",
  "bobs_27": "Named after Bob Anderson. Start with exactly 27 points.\n\nRound 1: Throw 3 darts at Double 1 (value: 2).\n• Each dart that hits D1: +2 points.\n• ALL darts miss D1: -2 points.\nRound 2: Double 2 (value: 4). Hit = +4 each. Miss all = -4.\nContinue through D3...D20.\n\nYour score can go negative. Survive all 20 rounds and the highest score wins.\n\nKey danger: Missing D19 (-38) or D20 (-40) late-game can be devastating.",
  "bermuda_triangle": "Hit a specific sequence of targets: 12, 13, 14, Bull's-eye, 15, 16, 17, Bull, 18, 19, 20, Bull's-eye.\n\nEach player throws 3 darts at the current target. Score all hits on the target.\n\nMiss the target with ALL 3 darts: your score is HALVED — the Bermuda Triangle strikes!\n\nHighest score after all 12 targets wins.",
  "round_the_board": "Race to hit 1 through 20 in order, then 19 all the way BACK to 1. First to hit 1 at the end wins — 39 targets in total.\n\nAny hit on your current target (single, double, or treble) advances you. Trebles and doubles don't give you extra advances — just one step per hit.",
  "doubles_challenge": "Hit every double in order: D1, D2, D3... D20, then Double Bull.\n\nYou must hit the exact double (thin outer ring) of each number in sequence. Singles and trebles don't count.\n\nFirst player to hit Double Bull after completing D1-D20 wins.\n\nTimed format: the app tracks how many visits it takes you.",
  "baseball": "9 innings, each targeting the inning number (1-9).\n\nIn your at-bat (3 darts): only the inning number counts.\n• Single = 1 run\n• Double = 2 runs\n• Treble = 3 runs\n• Any other segment = 0 runs\n\nMost total runs after 9 innings wins. Ties go to extra innings (keep playing).",
  "scram": "Two phases, two roles — Stopper and Scorer.\n\nPHASE 1: Player 1 = Stopper, Player 2 = Scorer.\nNumbers in play: 20, 19, 18, 17, 16, 15, Bull — all start OPEN.\n• Stopper's darts: any segment that hits an open number CLOSES it.\n• Scorer's darts: any hit on an OPEN number scores those points.\nPhase ends when all numbers are closed.\n\nPHASE 2: Swap roles. Player 2 becomes Stopper, Player 1 scores.\n\nFinal: compare scoring totals from each phase. Higher scorer wins.",
  "football_darts": "Play like football, scored with darts!\n\nHit a DOUBLE (any number) = GOAL! Score one goal per double hit.\nHit anything else = no goal scored.\n\nBonus: if you score at least 1 goal in your visit, you KEEP POSSESSION — throw again!\nScore nothing = possession passes to your opponent.\n\nFirst to 5 goals wins. Game-changer: doubles scoring matters for possession too.",
  "golf_darts": "9 holes, each targeting a number (Hole 1 = aim at 1, Hole 2 = aim at 2, etc.).\n\nOn your 'hole': throw darts one at a time (up to 3).\n• Hit the target on dart 1: score 1 stroke (hole in one!)\n• Hit on dart 2: score 2 strokes.\n• Hit on dart 3: score 3 strokes.\n• Miss all 3: score 4 strokes (out of bounds).\n\nLOWEST total strokes after 9 holes wins — just like real golf!\n\nMultiplier bonus: double or treble of the target still counts as hitting it.",
  "legs": "Winner of each leg gets to name the starting score for the next leg (any value 101–501, no double in/out required).\n\nFirst to win 3 legs wins the match.\n\nThis game is about mind games — set a score that suits your strengths and challenges your opponent's weaknesses.",
  "no_black": "Standard 501 Double Out, but with a twist: any dart landing in the OUTER BULL (the green ring, worth 25) scores ZERO for that dart — the black is forbidden!\n\nStrategy changes significantly — players must avoid the outer bull when approaching finishes.",
  "pick_a_double": "Before each throw, you must call which double you intend to hit. If you hit any other number or the wrong double, your throw scores zero.\n\nReally hit your called double? Full score.\n\nHonour system — calls are made before each dart is thrown.",
  "pairs_501": "2-v-2 team format. Both teams start at 501. Teammates alternate throws within each visit. Double out to win. First team to reach 0 wins.\n\nIn this 2-player version, player 1 and player 2 represent their respective teams.",
};

interface Props {
  game: GameTypeOption;
  onClose: () => void;
}

export function RulesModal({ game, onClose }: Props) {
  const rules = (game as any).rulesText ?? RULES[game.key] ?? game.description;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: "rgba(8,8,18,0.99)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <BookOpen className="w-5 h-5 shrink-0" style={{ color: "#ffd24a" }} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", color: "#fff" }}>
              {game.name}
            </div>
            <div className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{game.category}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {rules ? (
            <div className="space-y-3">
              {rules.split("\n\n").map((block: string, i: number) => {
                const trimmed = block.trim();
                if (!trimmed) return null;
                // Detect header lines (no colon mid-sentence, short, possibly bold)
                const isHeader = trimmed.endsWith(":") || (trimmed.includes("PHASE") || trimmed.includes("ROUND") || trimmed.includes("PHASE") || /^[A-Z ]+$/.test(trimmed));
                return (
                  <div key={i}>
                    {isHeader ? (
                      <div className="font-bold text-sm uppercase tracking-wider mt-4 mb-1" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
                        {trimmed}
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {trimmed.split("\n").map((line: string, j: number) => (
                          <div key={j} className={line.startsWith("•") || line.startsWith("-") ? "ml-2 mt-1" : j > 0 ? "mt-1" : ""}>
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>No detailed rules available yet for this game.</p>
          )}
        </div>

        <div className="px-5 py-4 shrink-0 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <button onClick={onClose} className="w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm"
            style={{ background: "rgba(255,210,74,0.12)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
            Got It — Let's Play
          </button>
        </div>
      </div>
    </div>
  );
}
