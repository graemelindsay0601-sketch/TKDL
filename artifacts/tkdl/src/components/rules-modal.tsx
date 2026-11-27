import { X, BookOpen } from "lucide-react";
import type { GameTypeOption } from "./game-scorer";
import { buildFallbackGameRules } from "@/lib/game-rules";

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
  "around_the_world": "Race round the board from 1 to 20, then the outer bull (25), then the bullseye to win.\n\nOn your turn: throw 3 darts. A single on your current number moves you on one. A double skips you ahead two numbers and a treble skips you three.\n\nYou can't skip the bulls: after 20 you must hit the 25, then the bullseye. A bullseye thrown when you need the 25 counts as the 25.\n\nFirst player to hit the bullseye wins.",
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
  "football_darts": "Football with darts. First to 5 goals wins.\n\nKICK-OFF: nobody has the ball. Hit the BULL (25 or 50) to win possession.\n\nIN POSSESSION: every DOUBLE you hit (D1–D20) is a goal. You keep the ball until your opponent steals it.\n\nNOT IN POSSESSION: hit the BULL to steal the ball back. Doubles don't score without the ball.\n\nEach dart counts the moment it lands, so you can win the ball and score in the same visit.",
  "golf_darts": "9 holes, each targeting a number (Hole 1 = aim at 1, Hole 2 = aim at 2, etc.).\n\nOn your 'hole': throw darts one at a time (up to 3).\n• Hit the target on dart 1: score 1 stroke (hole in one!)\n• Hit on dart 2: score 2 strokes.\n• Hit on dart 3: score 3 strokes.\n• Miss all 3: score 4 strokes (out of bounds).\n\nLOWEST total strokes after 9 holes wins — just like real golf!\n\nMultiplier bonus: double or treble of the target still counts as hitting it.",
  "legs": "Winner of each leg gets to name the starting score for the next leg (any value 101–501, no double in/out required).\n\nFirst to win 3 legs wins the match.\n\nThis game is about mind games — set a score that suits your strengths and challenges your opponent's weaknesses.",
  "no_black": "Standard 501 Double Out, but with a twist: any dart landing in the OUTER BULL (the green ring, worth 25) scores ZERO for that dart — the black is forbidden!\n\nStrategy changes significantly — players must avoid the outer bull when approaching finishes.",
  "pick_a_double": "301, but you choose your finish before you start.\n\nAt the start each player calls a double. That is the ONLY double you can finish on.\n\nScore down from 301 as normal. To win, your last dart must land in your called double and take you to exactly 0.\n\nA dart that would take you below 0, leave 1, or finish on any other double doesn't count. Just that dart is wasted, not the whole visit.",
  "pairs_501": "2-v-2 team format. Both teams start at 501. Teammates alternate throws within each visit. Double out to win. First team to reach 0 wins.\n\nIn this 2-player version, player 1 and player 2 represent their respective teams.",
  "shanghai_sudden_death": "7 rounds on the numbers 1 to 7, one number per round.\n\nEach round, both players throw 3 darts at that round's number. Single = the number, double = 2×, treble = 3×. Anything else scores nothing.\n\nSHANGHAI: hit the single, double AND treble of the number in one visit and you win on the spot.\n\nIf nobody hits a Shanghai, the highest score after round 7 wins.",
  "shanghai_20": "Shanghai over 20 rounds, numbers 1 to 20, one per round.\n\nEach round, throw 3 darts at that round's number. Single = the number, double = 2×, treble = 3×.\n\nSHANGHAI: single, double and treble of the number in one visit wins instantly.\n\nOtherwise the highest score after round 20 wins.",
  "golf_darts_18": "18 holes. Hole 1 is the 1, hole 2 is the 2, and so on up to 18.\n\nOn each hole, throw at the target one dart at a time:\n• Hit with dart 1 = 1 stroke\n• Hit with dart 2 = 2 strokes\n• Hit with dart 3 = 3 strokes\n• Miss all three = 4 strokes\n\nLike real golf, the LOWEST total after 18 holes wins.",
  "chase_the_dragon": "A set route round the board, one target at a time:\n\n1. Trebles up: T10, T11, T12 … T20\n2. Doubles down: D20, D19 … D10\n3. Finish on the double bull (50)\n\nHit your current target to move on to the next. First to hit the bull at the end wins.",
  "snooker_darts": "Snooker on a dartboard. Highest score after the last ball wins.\n\nREDS (15 of them): each red is potted by hitting any number from 1 to 15. 1 point each.\n\nCOLOURS, in order: Yellow = 2, Green = 3, Brown = 4, Blue = 5, Pink = 6, Black = 7. Pot each by hitting that number.\n\nBoth players get a 3-dart visit at each ball. Pot it to score its points; the first hit pots it and ends your visit. Then the game moves on to the next ball.",
  "noughts_crosses": "Noughts and crosses on the numbers 1 to 9, laid out as a grid:\n1 2 3\n4 5 6\n7 8 9\n\nHit a number to claim that square, as long as nobody has it yet. Any part of the number counts.\n\nThree in a row (across, down or diagonal) wins. If the grid fills up first, whoever owns more squares wins.",
  "three_in_a_bed": "Call it, then hit it three times.\n\nOn your turn, call any treble from 1 to 20. Then throw 3 darts. All three must land in THAT treble to win the round.\n\nTwo out of three doesn't count.\n\nFirst to win 5 rounds wins.",
  "bull_rush": "A race to the bull.\n\nOnly bulls count: the outer bull (25) and the bullseye (50) each count as one hit. Everything else scores nothing.\n\nFirst player to 5 bull hits wins.",
  "checkout_challenge": "Can you take out 170?\n\nEvery attempt starts at 170. Throw 3 darts and try to finish in that one visit. Your last dart must be a double (or the bullseye) and take you to exactly 0.\n\nIf you don't finish, your score resets to 170 for your next attempt.\n\nFirst player to check out wins.",
  "fives": "Only multiples of 5 count.\n\nAdd up each visit. If the total is a multiple of 5 (5, 10, 15 …), it's added to your score. If not, that visit scores nothing.\n\nFirst to 51 points wins.",
  "round_clock_doubles": "Round the Clock on the doubles.\n\nHit D1, then D2, then D3, all the way to D20. A single doesn't count; a double (or a treble) of your target does.\n\nFirst to get past D20 wins.",
  "around_clock_quick": "Around the World, no bull at the end.\n\nWork from 1 to 20 in order. A single on your target moves you on 1 number, a double moves you on 2, a treble 3.\n\nFirst past 20 wins.",
  "killer_1_life": "Killer, but everyone has just ONE life.\n\n1. Pick a number. Its double is your 'life'.\n2. Hit your own double to become a Killer.\n3. Once you're a Killer, hit your opponent's double and they're out.\n\nLast player standing wins.",
  "501_no_trebles": "501 Double Out, but the treble ring is switched off.\n\nAny dart in a treble scores as a single (T20 = 20). Doubles and bulls score as normal.\n\nFinish on exactly 0 with a double. Go below 0, or leave 1, and the visit is a bust.",
  "tactics": "Cricket with a bigger board: 20 down to 10, plus the bull.\n\nClose a number by hitting it 3 times (double = 2 marks, treble = 3). Once you've closed a number, more hits on it score points, as long as your opponent still has it open.\n\nClose all twelve with at least as many points as your opponent to win.",
  "cricket_no_bull": "Standard Cricket without the bull. Only 15 to 20 are in play.\n\nClose a number by hitting it 3 times (double = 2 marks, treble = 3).\n\nOnce closed, more hits score points while your opponent still has it open.\n\nClose all six numbers with a score at least equal to your opponent's to win.",
  "2001_double_out": "The long one. Start at 2001 and score down.\n\nFinish on exactly 0 with a double (or the bullseye). Go below 0, or leave 1, and the visit is a bust.",
  "701_bo3": "701 Double Out, best of 3 legs.\n\nEach leg: start at 701, score down, finish on exactly 0 with a double (or the bullseye). Going below 0 or leaving 1 is a bust.\n\nFirst to win 2 legs takes the match.",
  "accumulator": "Each visit has to beat your last one.\n\nThrow 3 darts and add them to your total. From your second visit on, if a visit scores LESS than (or the same as) your previous visit, your whole total is halved.\n\nFirst to 501 wins.",
  "high_score_9": "Nine darts each: three visits.\n\nEvery dart counts at face value.\n\nHighest total after 9 darts wins.",
  "oche_roulette": "9 rounds. Each round the app calls a random target (any number 1–20 or the bull).\n\nBoth players throw 3 darts at it. Only darts on that number score (single, double and treble count at face value). Everything else scores 0.\n\nHighest total after 9 rounds wins. If it's level, extra rounds are played until someone's ahead.",
  "one_eighty_challenge": "Chase the perfect visit.\n\nTake turns throwing 3 darts. Land T20, T20, T20 and you win on the spot.\n\nEach player gets 10 visits. If nobody hits a 180, the player with the best single visit wins.",
  "jdc_challenge_41": "Three phases; most points at the end wins.\n\n1. Shanghai 10–15: one visit per number. Score what you hit on that number. Single, double AND treble in one visit = a Shanghai, worth an extra 50.\n2. Doubles: D1 to D20, then the bullseye. You get up to 3 darts at each; hit it to score its value (D20 = 40, bullseye = 50) and move on.\n3. Shanghai 15–20: as phase 1, on 15 to 20.",
  "exponential_bundle": "Six rounds on the numbers 7 to 12. Big numbers, fast.\n\nEach dart on the round's number scores:\n• Single = the number (10)\n• Double = the number squared (10 × 10 = 100)\n• Treble = the number cubed (10 × 10 × 10 = 1,000)\n\nDarts anywhere else score nothing. Highest total after the six rounds wins.",
  "shooting_gallery": "5 rounds of checkouts, like golf: the LOWEST score wins.\n\nEach round the app gives you a checkout between 121 and 130. Finish it on a double in as few darts as you can.\n\nYour score for the round is the number of darts you needed. Bust, or not out within 9 darts, and you score 10.\n\nLowest total after 5 rounds wins.",
  "dead_centre": "Every dart has to hit the bull.\n\nOuter bull = 25, bullseye = 50. If any dart in your visit misses the bull, your WHOLE score goes back to 0.\n\nFirst to 300 wins.",
  "high_low_sudden": "The low starts at 21.\n\nYour first visit must score more than 21; that score becomes your high.\n\nAfter that, every visit must score either BELOW the low or ABOVE the high. Miss and you're out straight away.\n\nTreble 1 scores 0.",
  "high_low_lives": "High-Low with 3 lives.\n\nThe low starts at 21. Your first visit must beat 21 and sets your high. After that, every visit must score below the low or above the high.\n\nMiss and you lose a life. Lose all 3 and you're out.\n\nTreble 1 scores 0.",
  "straight_line": "Pick a starting number, then work across the board in a straight line to the number opposite, and back again.\n\nThe route is: Double → big single → Treble → small single → outer bull → bullseye → then out the other side to the opposite number, and back the same way.\n\nHit each target to move on. First to finish the line wins.",
  "team_501_doubles": "2 v 2. Each team shares one score, starting at 501.\n\nPlayers take turns: team A player 1, team B player 1, team A player 2, team B player 2, and so on.\n\nFinish on exactly 0 with a double (or the bullseye). Going below 0 or leaving 1 is a bust.",
  "team_301_doubles": "2 v 2 from 301. Each team shares one score.\n\nPlayers alternate between teams, and team-mates take turns.\n\nFinish on exactly 0 with a double (or the bullseye). Going below 0 or leaving 1 is a bust.",
  "team_501_triples": "3 v 3. Each team shares one score, starting at 501.\n\nPlayers alternate between teams, and the three team-mates take turns in order.\n\nFinish on exactly 0 with a double (or the bullseye). Going below 0 or leaving 1 is a bust.",
  "team_501_straight": "2 v 2 from 501, no double needed.\n\nEach team shares one score; players alternate between teams and take turns within them.\n\nFirst team to reach exactly 0 wins. Any dart can finish it. Going below 0 is a bust.",
  "team_cricket_doubles": "2 v 2 Cricket. Team-mates share their marks and score.\n\nClose 15 to 20 and the bull by hitting each 3 times (double = 2 marks, treble = 3).\n\nOnce your team closes a number, more hits score points while the other team still has it open.\n\nClose everything with at least as many points as the other team to win.",
  "team_cricket_triples": "3 v 3 Cricket. Team-mates share their marks and score.\n\nClose 15 to 20 and the bull by hitting each 3 times (double = 2 marks, treble = 3).\n\nOnce your team closes a number, more hits score points while the other team still has it open.\n\nClose everything with at least as many points as the other team to win.",
  "killer_3player": "Killer for 3 players, 3 lives each.\n\n1. Everyone picks a different number. Its double is your 'life'.\n2. Hit your own double to become a Killer.\n3. As a Killer, hit anyone else's double to take one of their lives.\n\nLose all your lives and you're out. Last player standing wins.",
  "killer_4player": "Killer for 4 players, 3 lives each.\n\n1. Everyone picks a different number. Its double is your 'life'.\n2. Hit your own double to become a Killer.\n3. As a Killer, hit anyone else's double to take one of their lives.\n\nLose all your lives and you're out. Last player standing wins.",
  "killer_5player": "Killer for 5 players, 3 lives each.\n\n1. Everyone picks a different number. Its double is your 'life'.\n2. Hit your own double to become a Killer.\n3. As a Killer, hit anyone else's double to take one of their lives.\n\nLose all your lives and you're out. Last player standing wins.",
  "killer_6player": "Killer for 6 players, 3 lives each.\n\n1. Everyone picks a different number. Its double is your 'life'.\n2. Hit your own double to become a Killer.\n3. As a Killer, hit anyone else's double to take one of their lives.\n\nLose all your lives and you're out. Last player standing wins.",
  "99_darts_standard": "A solo accuracy test.\n\nPick a target number (or the bull). Throw 99 darts at it.\n\nSingle = 1 point, double = 2, treble = 3. Darts anywhere else score nothing.\n\nTry to beat your best.",
  "99_darts_doubles": "A solo doubles test.\n\nPick a number. Throw 99 darts at its double. Each dart in the double = 1 point.\n\nTry to beat your best.",
  "99_darts_trebles": "A solo trebles test.\n\nPick a number. Throw 99 darts at its treble. Each dart in the treble = 1 point.\n\nTry to beat your best.",
  "grand_national": "A horse race round the board.\n\nGo round 1 to 20 TWICE (two laps), hitting each number in order. Then hit D20, the winning post.\n\nFirst past the post wins.",
  "hare_and_hounds": "One player is the Hare, the other the Hound. Both race round 1 to 20 in order.\n\nA single moves you on 1 number, a double 2, a treble 3.\n\nThe HARE wins by completing the lap. The HOUND wins by catching up to the Hare's position first.",
  "prisoner": "Round the Clock from 1 to 20, in order.\n\nHit your target to move on to the next number.\n\nBut watch the INNER single (the small section between the treble and the bull): hit that and you're jailed, and your next visit is skipped.\n\nFirst to get round wins.",
  "knockout": "Beat the last score or take a strike.\n\nThe first visit sets the score to beat. Every visit after that must score MORE than the visit just before it (whoever threw it).\n\nFail and you take a strike. Three strikes and you're out, and your opponent wins.",
  "tennis": "Darts tennis.\n\nThe server throws 3 darts at their half of the board, then the receiver throws 3 back. Highest visit wins the point.\n\nPoints go Love, 15, 30, 40, Game, like real tennis.\n\nFirst to 3 games wins the match.",
  "follow_the_leader": "One player leads, the other chases. 3 lives each.\n\nThe LEADER throws one dart. Wherever it lands (for example D16) is the target. A miss means call again.\n\nThe CHASER has 3 darts to hit exactly that: the same number AND the same ring.\n\nMatch it and you become the leader. Miss all three and you lose a life. Lose all 3 and you're out.",
  "battleship_darts": "Each player has a hidden fleet of 6 squares on the numbers 1 to 20.\n\nOn your turn, throw at your opponent's grid. Each number you hit is a shot at that square: hit or miss is revealed.\n\nSink every square in your opponent's fleet to win.",
  "blind_killers": "Killer where nobody knows their own number, not even you.\n\nEach player gets a secret double. Hit your own (by luck or by working it out) and you become a Killer, and it's revealed.\n\nAs a Killer, hit your opponent's double to take one of their lives. 3 lives each; last player standing wins.",
  "donkey_derby": "Each donkey gets a random racing number.\n\nHit your OWN number to move your donkey forward one length. Hit your RIVAL's number to knock them back one length.\n\nFirst donkey to 20 lengths wins.",
  "limbo": "How low can you go? 3 lives each.\n\nThe bar starts at 60. Your visit must score UNDER the bar to clear it. When you clear it, the bar drops to your score.\n\nFail to get under the bar and you lose a life. Lose all 3 and you're out.",
  "snakes_ladders": "Snakes and ladders on a 30-square board.\n\nEach dart is turned into a dice roll from 1 to 6 (bull = 6). Move that many squares.\n\nLand at the foot of a ladder and climb up; land on a snake's head and slide down.\n\nFirst to square 30 wins.",
  "quackshot": "8 rounds, highest score wins. Watch out for the trap.\n\n• Bullseye: +3\n• Outer bull: +2\n• Inner single: +1\n• Treble: −2\n• Outer single: −1\n• Double or a miss: 0\n\nThe treble is a trap: it's worth less than missing completely.",
  "fight_game": "Each fighter gets a random power number. 9 HP each.\n\nHit your RIVAL's number to damage them: single = 1, double = 2, treble = 3.\n\nHit your OWN number to heal by the same amount.\n\nKnock your rival down to 0 HP to win.",
};

interface Props {
  game: GameTypeOption;
  onClose: () => void;
}

export function RulesModal({ game, onClose }: Props) {
  const storedRules = typeof (game as any).rulesText === "string" ? (game as any).rulesText.trim() : "";
  const rules = storedRules || RULES[game.key] || buildFallbackGameRules(game);

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
                const lines = trimmed.split("\n");
                const firstLine = lines[0].trim();
                // A detailed block commonly starts with a heading followed
                // by its bullets. Treat that first line as the heading
                // without swallowing the instructions beneath it.
                const hasHeader = firstLine.endsWith(":") || /^(PHASE|ROUND)\b/.test(firstLine) || /^[A-Z &/-]+$/.test(firstLine);
                const bodyLines = hasHeader ? lines.slice(1) : lines;
                return (
                  <div key={i}>
                    {hasHeader && (
                      <div className="font-bold text-sm uppercase tracking-wider mt-4 mb-1" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
                        {firstLine}
                      </div>
                    )}
                    {bodyLines.length > 0 && (
                      <div className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {bodyLines.map((line: string, j: number) => (
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
          ) : null}
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
