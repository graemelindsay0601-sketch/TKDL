# Card Clash — Chaos Lab / Board Marks

Chaos Lab is a new, separate Card Clash mode (`chaos_lab`) sitting alongside
`standard` and `chaos`. It does not replace either. Its identity: **normal
darts scoring stays real — Card Clash makes the board tactically alive.**

Chaos Lab draws exclusively from a 27-card Board Marks pool (never the
regular chaos pool) — cards that temporarily mark a dartboard target (a
number bed, a specific treble/double, or bull) as hot, cold, trapped, or
shielded. Marks change what happens in the Card Clash effect layer when a
dart lands there — they never change the dart's actual score, bust rules,
checkout rules, or Cricket mark/point logic.

Hot and Trap carry a real, rarity-scaled score effect (see "Reward
magnitudes" below) — this was a deliberate v2 change from the original
design (which kept them purely event/notification-based) to make the mode
feel like it actually swings a game, not just nudges the trigger layer.

## Where the code lives

```
artifacts/tkdl/src/lib/card-clash/boardMarks/
  boardMarkTypes.ts           core types (BoardMark, events, results)
  boardMarkTargets.ts         dart → BoardMarkDartResult adapter, target helpers
  boardMarkMatcher.ts         doesDartMatchBoardMarkTarget()
  boardMarkConflicts.ts       placeBoardMark() — all conflict rules, centralised
  boardMarkState.ts           small array helpers + id generation
  boardMarkResolver.ts        resolveBoardMarksForDart() — runs after scoring
  boardMarkLifecycle.ts       expireBoardMarksForVisitEnd/DartHit()
  boardMarkRewards.ts         getBoardMarkMagnitude() — rarity-scaled Hot/Trap magnitudes
  boardMarkPrototypeCards.ts  the 27-card roster + the factory that places them
  index.ts                    public exports — import from here
  __tests__/                  58 tests (node:test), run with:
                               npx tsx --test src/lib/card-clash/boardMarks/__tests__/*.test.ts
```

The module has **zero dependency on the scorer** — it only needs a plain
`{ segment, multiplier, throwingPlayerId }` shape (`toBoardMarkDartResult`
adapts TKDL's real `Dart` type into that). That's what keeps it isolated
and independently testable.

## Mark types

| Type | Effect | Removed |
|---|---|---|
| `hot` | Next eligible hit scores normally AND grants a real score bonus to whoever hits it. | On trigger |
| `cold` | Blocks Card Clash triggers from that target for the affected player. Pure denial — no score effect. | When affected player's visit ends |
| `trap` | Cancels a Card Clash trigger from that target AND applies a real score penalty to whoever springs it. | On trigger |
| `shield` | Blocks *enemy* Cold/Trap placement on that target. Never blocks Hot. Doesn't affect scoring. | When owner's next visit ends |

## Reward magnitudes

Hot and Trap's score effect is rarity-scaled by target difficulty —
`boardMarkRewards.ts`'s `getBoardMarkMagnitude(targetType, engine, kind)`:

| Target | X01 Hot | X01 Trap | Cricket Hot | Cricket Trap |
|---|---|---|---|---|
| number bed | 35 | 30 | 18 | 15 |
| treble / double | 55 | 45 | 28 | 22 |
| bull | 90 | 75 | 45 | 38 |

X01 values are applied to remaining score (Hot subtracts, Trap adds).
Cricket values are applied to points (Hot adds, Trap subtracts). Cold has
no entry here — it never gets a score effect, on purpose.

## Steal marks

Four cards (Point Thief, Robbery, Highway Robbery, Grand Larceny) flag
their mark with `steal: true` in `metadata`. When a steal Hot/Trap
triggers, it's not just a grant/penalty — it's a direct transfer:

- **Steal Hot**: the trigger reward is subtracted from the *other* player,
  not just added to the triggering one. Since Hot is neutral (either
  player can trigger it), this makes it a genuine race — winning it
  actively hurts your opponent, not just helps you.
- **Steal Trap**: the mark's *owner* (whoever placed it) receives the same
  amount the trapped player loses, rather than the penalty just
  disappearing.

## Risk/reward compound cards

Three cards (Wildfire, Double or Nothing, All In) place **two** marks at
once instead of one: a big, guaranteed-target Hot reward, plus a second,
self-targeted curse (Trap or Cold) on a random 1-20 number bed. Chasing
the big reward means playing the rest of that leg with a hidden landmine
of your own making — you don't know which number you've cursed yourself
on. `createBoardMarkFromPrototypeCard` returns `BoardMark[]` (1 or 2
elements) to support this; both scorers loop-place whatever comes back,
and each mark is placed independently (if one hits a conflict, the other
can still go through).

`shield` is placement-time-only protection — it's never "hit" or resolved
against a dart the way the other three are.

## Targets

- `{ type: "number", value: 20 }` — a bed, matches S20/D20/T20.
- `{ type: "treble", value: 20 }` — matches only T20.
- `{ type: "double", value: 16 }` — matches only D16.
- `{ type: "bull", value: "bull" }` — matches any bull hit (outer bull or bullseye — TKDL represents both as segment 25).

## Conflict rules (all centralised in `boardMarkConflicts.ts`)

1. An enemy Shield blocks Cold/Trap placement on the same target outright — this is never bypassable, even with `allowReplace: true`. That's the whole point of a defensive Shield.
2. Cold and Trap can't coexist on the same target (either order).
3. Marks don't stack — two of the same type can't share a target.
4. `allowReplace: true` on the new mark lets it replace a conflicting mark from rules 2/3 (not rule 1).
5. Different, non-conflicting types coexist fine (e.g. Hot + Shield on the same target).

## Duration / expiry approximation

This app doesn't have a first-class "visit id" threaded everywhere, so
"owner's next visit" and "affected player's visit end" are approximated
using each mark's own `createdAtVisitId` (stamped at placement time): a mark
never expires on the exact visit it was created during, only on a later one
belonging to the relevant player. This matches every example in the design
spec (e.g. a Shield placed mid-visit must survive past the owner's own
visit-end and expire on their *next* one).

## Integration into the scorer

Chaos Lab reuses Chaos Mode's existing "3 face-down mystery cards dealt at
the start of each visit" mechanic — it does **not** add a new UI flow. The
differences:

- **Draw pool**: `drawChaosLabOptions()` (in `cards-data.ts`) draws
  exclusively from the 27-card Board Mark pool — every draw is guaranteed
  to be a mark, not a normal score-boost card. This is intentional: Chaos
  Lab is meant to be a genuinely distinct tactical mode (per the design
  spec), not regular Chaos Mode with a few marks occasionally mixed in.
  `drawChaosOptions()` — what regular Chaos Mode uses — is completely
  untouched. With only 4 v1 prototype cards, a 3-card draw will show most
  of the pool most of the time — expected for a proof-of-concept; a future
  card expansion (see section 15 of the design spec) would make draws feel
  more varied.
- **Card activation**: in `handleChaosCardActivation` (both `X01Scorer` and
  `CricketScorer`), if the drawn card's id is in `BOARD_MARK_CARD_ID_MAP`,
  it's routed to `createBoardMarkFromPrototypeCard` + `placeBoardMark`
  instead of the normal `ccActivateCard` effect engine.
- **Per-dart resolution**: in `handleDart`, right after Card Clash's
  existing dart preprocessing step (and before any scoring math happens),
  `resolveBoardMarksForDart` runs against `activeBoardMarks`. It only ever
  updates `activeBoardMarks` state and surfaces a toast — it has no way to
  touch `nv`/`cum`/`rem` or any other scoring variable.
- **Visit-end expiry**: piggybacks on the same effect that triggers each
  fresh visit's card draw, since "a new visit is starting" and "the previous
  visit just ended" are the same event.

Both scorers gate all of this behind `isChaosLabMode` (read from the
`card_clash_chaos_lab_mode` sessionStorage flag, set by
`CardClashMatchScorer`'s `chaosLabMode` prop) — Standard Card Clash and
regular Chaos Mode never touch `activeBoardMarks` or the resolver at all.

### Remaining limitation (unchanged from v1)

Hot and Trap now have real score effects (see "Reward magnitudes" above) —
that was the v1 limitation this note used to describe, and it's fixed.
What's still true: `resolveBoardMarksForDart`'s `blockCardClashTriggers`/
`cancelCardClashTriggers` flags (from Cold/Trap) are correctly computed
and logged/toasted, but nothing currently *consumes* them to suppress a
*future mystery-card draw* — Chaos Lab's only "Card Clash trigger" is the
automatic per-visit draw, and there isn't yet a clean, safe way to wire
"this dart was Cold-blocked" into "skip that player's next draw" without
touching the existing chaos-draw logic in a riskier way than felt
warranted so far. Future work that wants Cold/Trap to suppress an actual
future draw (on top of their current score/denial effects) should
explicitly check the resolver's result before firing whatever it's
gating — the module is built so that's a small, additive change, not a
rewrite.

## Card roster (27 cards)

| Family | Count | Ids | Behaviour |
|---|---|---|---|
| Simple Hot | 5 | 701, 705-708 | Bull, 20, T20, D16, 19 — neutral, rewards whoever hits it |
| Simple Cold | 5 | 702, 709-712 | 20, Bull, T19, D20, 15 — opponent only, pure denial |
| Simple Trap | 5 | 703, 713-716 | T20, Bull, D16, 19, D20 — opponent only, cancels + penalizes |
| Simple Shield | 5 | 704, 717-720 | D16, Bull, T20, 20, D8 — self only, blocks enemy Cold/Trap |
| Steal | 4 | 721-724 | Point Thief, Robbery (Hot steal); Highway Robbery, Grand Larceny (Trap steal) |
| Risk/reward | 3 | 725-727 | Wildfire, Double or Nothing, All In — big reward + self-curse on a random spot |

These live in `cards-data.ts` flagged `mode: "chaos_lab"` (ids 701-727).
That flag is what keeps them out of everywhere else — they're **never**
added to `card_definitions` in the backend, so they can't be purchased,
packed, or equipped. The only place they can ever appear is Chaos Lab's
own mystery-card pool (`getChaosLabCardPool` in `cards-data.ts`), which
draws exclusively from this set — never mixed with the regular chaos pool.

## What not to do (carried over from the design spec — still true)

- Don't remove or rename Standard Card Clash or regular Chaos Mode.
- Don't add card energy, mana, cooldowns, or random-chance mechanics.
- Don't let Board Marks change actual scoring, bust rules, checkout rules,
  or Cricket mark/point logic — ever.
- Don't scatter `if (mode === 'chaos_lab')` checks through the scoring
  math itself — everything Chaos-Lab-specific should stay reachable through
  the Board Marks module's own functions.
- Don't add new mark types (`claim`, `contested`, etc.) without updating
  this doc and the conflict rules in `boardMarkConflicts.ts` first.

## Visibility (fixed — was a real gap)

Board Marks used to only surface as tiny hover-tooltip pills — useless on
a mobile-first, touch-only scoring app where hover doesn't exist. Fixed
two ways:

- **The dart input board itself highlights marked buttons.** `DartInputBoard`
  (`dartboard.tsx`) got a new, purely additive `markedSegments` prop —
  `{ segment, color }[]` — layered on top of the existing `highlightSegments`
  prop used by every other game mode in the app (untouched, zero risk to
  them). Both scorers pass `boardMarksToSegments(activeBoardMarks)` only
  when `isChaosLabMode` is true. The number button, and both Bull buttons,
  get a colored glow matching the mark's type (orange=hot, blue=cold,
  yellow=trap, green=shield) — so you see it right where you're about to
  aim, not in a side panel you might not be looking at.
- **`BoardMarksHUD` is a real panel now, not a tooltip.** Every active mark
  shows its type spelled out, the exact target (T20 vs D20 vs "20 bed" —
  the button highlight alone can't distinguish the multiplier), a
  plain-language "who this affects" line from the *current viewer's*
  perspective ("Blocks YOUR trigger there" vs "Blocks Sam's trigger
  there"), a STEAL badge where relevant, and the live reward/penalty
  number for Hot/Trap. No hover required anywhere.

## Manual test checklist

- Standard Card Clash and regular Chaos Mode: unaffected, no Board Marks state involved.
- Chaos Lab, Hot Bull: mark appears in the Board Marks HUD; hitting Bull fires the toast, scores normally, AND applies the Bull-tier bonus; mark is removed.
- Chaos Lab, Cold 20s: opponent's T20/D20/S20 still scores exactly as normal; a "Blocked by Cold" toast appears with no score effect; mark persists until their visit ends.
- Chaos Lab, Trap T20: opponent's T20 still scores 60; a "Trap!" toast appears with the treble-tier penalty applied; mark is removed.
- Chaos Lab, Shield D16: opponent's Cold/Trap D16 placement silently fails (mark never enters `activeBoardMarks`); a normal D16 checkout still works.
- Chaos Lab, Point Thief (steal Hot): whoever hits the 8 bed first gets the bonus AND the other player's score visibly moves the other way by the same amount.
- Chaos Lab, Highway Robbery (steal Trap): opponent hits Bull, takes the penalty, and the mark's owner gets an equal bonus.
- Chaos Lab, Wildfire (risk/reward): drawing it places Hot on Bull AND Trap on a random number against the drawer — confirm both appear in the Board Marks HUD, and that hitting your own cursed number actually penalizes you.
