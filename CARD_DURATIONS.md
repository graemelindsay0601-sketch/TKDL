# Card Clash: Card Duration & Persistence Analysis

## Critical Finding
**Different card types have different lifetimes. A single "cardsUsed" system won't work.**

---

## Category 1: THIS TURN ONLY (1 activation = 1 turn effect)
These cards modify the current turn's darts and expire immediately at turn end.

**X01 GOOD:**
- Power Surge +50
- Treble Hunter (1.3x trebles THIS TURN)
- Treble Boost (1.4x trebles THIS TURN)
- Iron Will (1.2x all darts THIS TURN)
- Perfect Rhythm (+10 per dart THIS TURN)
- Safety Boost (min +15 THIS TURN)
- Precision Strike (min segment 6 THIS TURN)
- High Roller (if 100+ THIS TURN, +25)
- Century Maker (if 100 exactly THIS TURN, +40)
- Scoring Arsenal (forces full visit THIS TURN)

**X01 BAD:**
- Rust Hands -40 (opponent's NEXT turn -40)
- Wild Throw (random miss THIS TURN)
- Brick Wall (20/19/18 = 0 THIS TURN)
- Low Blow (singles = 0 THIS TURN)
- Doubles Don't Count (D = S THIS TURN)
- Shackled (max 50 THIS TURN)
- Turn Enforcer (must complete 3 THIS TURN)
- Pressure Zone (only 15/20/Bull THIS TURN)
- Off Target (adjacent segments THIS TURN)
- Mercy Killer (cap 60 THIS TURN)
- Jinx (0.75x THIS TURN)
- Fatigue (dart multipliers THIS TURN)
- Treble Curse (T = S THIS TURN)
- Dead Zone (can't hit 15-20 THIS TURN)
- Mental Block (-10 per dart THIS TURN)
- Trapped (must finish on D or end THIS TURN)
- Lockdown (choose one segment THIS TURN)
- Clutch Breaker (final 100, -15 each THIS TURN)

**CRICKET BAD:**
- Bad Aim (0.5x marks THIS TURN)
- Out of Position (20/19/18 = 0 THIS TURN)
- Hesitation (dart 1 doesn't mark THIS TURN)
- Sluggish Marks (all marks = 1 THIS TURN)
- Number Hex (locked to one number THIS TURN)
- Closing Blocker (can't close THIS TURN)
- Mark Erasure (-10 per mark THIS TURN)
- Cricket Prison (only 15/19/20 THIS TURN)
- Bull Void (Bull = 0 THIS TURN)
- Mark Killer (dart 3 = 0 THIS TURN)

**WILDCARD BAD:**
- Unlucky Night (0.75x THIS LEG)
- Hex (0.5x THIS LEG)
- Wipeout (last 2 darts = 0 THIS LEG)

---

## Category 2: THIS LEG/MATCH PHASE (Lasts until specific condition met)

**X01:**
- Safety Net (prevent bust THIS VISIT ONLY) - expires after one visit attempt
- Close Control (final 50, prevent bust) - active for rest of LEG in checkout phase
- Steady Hand (misses redirect to 5) - active THIS TURN or ENTIRE LEG?
- Finish Delay (first 2 darts can't finish) - affects first 2 darts, then expires
- Finishing Bonus (if finish THIS TURN, +50) - bonus applied at turn end
- High Pressure (+40 if behind in legs) - lasts THIS LEG
- Banking Strategy (if 50+ this turn, NEXT turn +20) - bonus applied NEXT TURN
- Big Game Player (if 80+ not on D, NEXT leg +35) - bonus applied NEXT LEG

**CRICKET:**
- Closing Protection (opponent can't close MY number THIS LEG)
- Number Resurrection (one closed number THIS LEG/MATCH)
- Scoring Surge (1.5x MY open numbers THIS LEG)
- Mark Accelerator (marks = 2 when hitting number THIS TURN)
- Mark Multiplier (if 3+ marks THIS TURN, +50)
- Quick Close (if close by dart 2 THIS TURN, free mark)
- Momentum Arsenal (each mark +10 THIS TURN)
- Perfect Form (all marks count AND 1.5x THIS TURN)
- Double Strike (2x marks THIS TURN)
- Mark Flood (auto-marks THIS TURN)
- Sniper Lock (next 3 darts must hit number THIS TURN)
- Instant Mark (auto-mark WITHOUT throwing)

---

## Category 3: LEG-BASED (Affects entire LEG, expires at leg end)

**X01/CRICKET (Apply effects for whole leg):**
- Comeback Marks (if behind, 1.5x marks THIS LEG)
- Early Closer (if close before turn 5, +30)
- Perfect Round (if 3 marks THIS TURN, +25)
- Bull Multiplier (when Bull hit, choose 3 numbers)
- Bullseye Rush (Bull = 2 numbers)
- Scoring Momentum (each mark +5 more)
- High Scorer (if 100+ THIS LEG, +20)
- Dominance (if leading closed numbers, 1.3x)

---

## Category 4: MULTI-TURN PERSISTENT (Active multiple turns, then expire)

- Mark Drain (if ahead, lose 1 mark EVERY TURN - multi-turn penalty)
- Streak Breaker (if 3+ marks LAST TURN, lose half THIS TURN)
- Momentum Killer (if 2+ marks LAST TURN, lose them THIS TURN)
- Leg Reset (if won 2+ LEGS in a row, STREAK = 0)

---

## Category 5: PERMANENT/IRREVERSIBLE (Cannot be undone, affects entire match)

- Re-Opening Block (when I close YOUR number, it's locked FOREVER)
- Number Prison (one random closed number LOCKED FOREVER)
- Streak Crusher (if opp 2+ ahead, REMOVE their 2 LEGS - irreversible match state change)

---

## Category 6: CONDITIONAL/TRIGGER-BASED (Only active when condition met)

- Unstoppable Checkout (while on double, opp can't play penalty cards)
- Exact Finish (in final 50 on double, opp can't play penalty next turn)
- Checkout Confidence (retry on double miss)
- Coin Flip (50/50 chance)
- Lucky Streak (if won prev leg, +50)
- Momentum Surge (if ahead in match, +25)
- Finishing Edge (in final deciding leg, retry on miss)
- Comeback Leg (if lost prev leg, +60)
- Hot Hand (if won 2+ legs in a row, +45)
- Underdog (if behind overall, +50)
- Perfect Game (if shutout leg, +30)
- Match Point (if 1 leg from win, +70)
- Invincible (next turn unaffected by opponent cards)
- Dark Cloud (next leg -35 or lock 1 number)
- Match Pressure (in final leg, penalties apply)
- Underdog Curse (if ahead, 0.8x)
- Pressure (must close number or -30)

---

## Design Requirements

### For UNDO to work correctly:
1. **Per-turn effects** must be stored in a turn-specific snapshot
2. **Multi-turn effects** must track which turn activated them
3. **Permanent effects** must be excluded from undo (they're match-state)
4. **Conditional effects** must re-evaluate their condition after undo

### For Card Re-use Prevention:
1. **One-time-use cards** (most X01/Cricket) - mark as used forever
2. **Renewable cards** (conditionals) - can use multiple times if condition resets
3. **Permanent cards** (Re-Opening Block, Number Prison) - cannot be re-used, have match-level state
4. **Leg-based cards** - can use once per leg

### The Fix Needed:
Instead of a simple `cardsUsed` array:

```typescript
interface CardUsageTracker {
  permanentlyUsed: Set<number>;      // Used forever
  usedThisTurn: Set<number>;         // Used this turn only (can reuse next turn)
  usedThisLeg: Set<number>;          // Used this leg (can reuse next leg)
  matchStateCards: {
    reOpeningBlocks: number[];       // Opponent number IDs that are locked
    numberPrisons: number[];         // Numbers locked forever
    legResets: boolean;              // Did this happen?
  };
}
```

---

## Next Steps
1. Audit card-effect-engine.ts to mark which cards are in each category
2. Update card activation logic to use correct persistence type
3. Update undo logic to restore snapshots correctly
4. Prevent re-use based on category, not blanket disable
