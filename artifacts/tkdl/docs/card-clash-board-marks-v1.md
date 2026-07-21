# Card Clash — Chaos Lab / Board Marks

Chaos Lab is a separate Card Clash mode (`chaos_lab`) sitting alongside
`standard` and `chaos`. It does not replace either. Its identity: **normal
darts scoring stays real — Card Clash makes the board tactically alive.**

Chaos Lab draws exclusively from a 30-card Board Marks pool (never the
regular chaos pool) across 13 mechanically distinct families — cards that
mark a dartboard target (a number bed, a specific treble/double, an entire
category like "every treble", or bull) and change what happens in the Card
Clash effect layer when a dart lands there. They never change the dart's
actual score, bust rules, checkout rules, or Cricket mark/point logic.

This is a v3 design, rebuilt after a full design pass following real
playtesting feedback. The original v1/v2 (4 cards, then 27 cards mostly
spread across fixed targets) undersold "chaos" — it was mechanically just
"gain or lose a number" repeated with different targets. v3 adds genuinely
distinct mechanics (score swaps, leg theft, hidden types, category-wide
effects) and leans on random targeting so the board looks different leg to
leg instead of the same five familiar spots every time.

## Where the code lives

```
artifacts/tkdl/src/lib/card-clash/boardMarks/
  boardMarkTypes.ts           core types (BoardMark, events, results, durations)
  boardMarkTargets.ts         dart -> BoardMarkDartResult adapter, target helpers
  boardMarkMatcher.ts         doesDartMatchBoardMarkTarget() -- includes "any" category matching
  boardMarkConflicts.ts       placeBoardMark() -- all conflict rules, centralised
  boardMarkState.ts           small array helpers + id generation
  boardMarkResolver.ts        resolveBoardMarksForDart() -- runs after scoring
  boardMarkLifecycle.ts       expireBoardMarksForVisitEnd/DartHit/LegEnd()
  boardMarkRewards.ts         getBoardMarkMagnitude() -- rarity-scaled Hot/Trap magnitudes
  boardMarkPrototypeCards.ts  the 30-card roster + the factory that places them
  index.ts                    public exports -- import from here
  __tests__/                  66 tests (node:test), run with:
                               npx tsx --test src/lib/card-clash/boardMarks/__tests__/*.test.ts
```

The module has **zero dependency on the scorer** -- it only needs a plain
`{ segment, multiplier, throwingPlayerId }` shape (`toBoardMarkDartResult`
adapts TKDL's real `Dart` type into that). That's what keeps it isolated
and independently testable. The scorer-level integration (in
`scorers.tsx`) -- payload switching, Sabotage/Match Swing/Escalation
handling, the Activity Log, Recent Visits annotations -- is NOT covered by
this module's tests, since it's tangled up with React state; it's only
verified by `tsc --noEmit` + a production build.

## Mark types

| Type | Effect | Removed |
|---|---|---|
| `hot` | Next eligible hit scores normally AND grants a real, rarity-scaled score bonus to whoever hits it. | On trigger (unless `until_leg_end`, see below) |
| `cold` | Blocks Card Clash triggers from that target for the affected player. Pure denial -- no score effect. | When affected player's visit ends, or leg end |
| `trap` | Cancels a Card Clash trigger AND applies a real, rarity-scaled score penalty to whoever springs it. | On trigger (unless `until_leg_end`) |
| `shield` | Blocks *enemy* Cold/Trap placement on that target. Never blocks Hot. Doesn't affect scoring. | When owner's next visit ends |

`"unstable"` is a pseudo-type only used in `BoardMarkSpec.type` -- it
resolves to a real `hot` or `trap` (50/50) the moment the mark is created,
with `metadata.isUnstable: true` set so the UI can hide which one it is
until it actually triggers. By the time the resolver/lifecycle/conflict
code ever sees the mark, it's already a perfectly normal hot or trap --
none of that code has any concept of "unstable".

## Durations

| Duration | Meaning |
|---|---|
| `until_hit` | Removed the moment it triggers (Hot/Trap default) |
| `until_affected_player_visit_end` | Removed when the affected player's current visit ends (Cold default) |
| `until_owner_next_visit_end` | Removed when the owner's next visit ends (Shield default) |
| `until_leg_end` | Persists for the rest of the CURRENT leg regardless of how many times it matches -- only cleared by `expireBoardMarksForLegEnd`, called from `resetForLeg` in scorers.tsx at an actual leg transition. Used by leg-wide rule-benders (Treble Curse, Double Trouble); the resolver does NOT auto-remove `hot`/`trap` marks with this duration on trigger, since they're meant to keep re-triggering all leg. |

## Reward magnitudes

Hot and Trap's score effect is rarity-scaled by target difficulty --
`boardMarkRewards.ts`'s `getBoardMarkMagnitude(targetType, engine, kind)`,
further scaled up by Escalation (see below):

| Target | X01 Hot | X01 Trap | Cricket Hot | Cricket Trap |
|---|---|---|---|---|
| number bed | 35 | 30 | 18 | 15 |
| treble / double | 55 | 45 | 28 | 22 |
| bull | 90 | 75 | 45 | 38 |

X01 values are applied to remaining score (Hot subtracts, Trap adds).
Cricket values are applied to points (Hot adds, Trap subtracts). Cold has
no entry here -- it never gets a score effect, on purpose.

## Payloads

Most cards use the default payload, `"score_shift"` (the table above).
Cards can instead specify a `payload` on their `BoardMarkSpec`, handled by
a switch in scorers.tsx's Hot/Trap resolution:

- `swap_scores` -- the trigger completely swaps both players' remaining
  scores. Used by exactly one card (Score Swap), kept Legendary-only and
  singular on purpose -- this is the most dramatic effect in the game and
  deliberately not diluted by having more cards do it.
- `double_next_visit` / `weaken_next_visit` -- pushes a `CCEffect` with
  `status: "pending"` and `allDartsMultiplier: 2` (X01) /
  `extraScoreMultiplier: 2` (Cricket) -- reuses the existing, already-tested
  Card Clash effect engine rather than inventing new scoring math.
  **Important:** uses `"pending"`, not `"active"` -- this ensures the
  multiplier reliably applies to the recipient's next FULL visit. Using
  `"active"` would apply it to "whatever's left of the current visit",
  which could be zero darts if triggered on the third dart.
- `leech_score` -- computed directly from the triggering dart's own
  `.value` (not the rarity-scaled magnitude table), split 50% (Siphon) or
  35% (Parasite) onto the opponent. The trigger player's own dart scoring
  is completely untouched.

## Steal

Four of the score_shift-payload cards additionally flag `steal: true` on
their `BoardMarkSpec`, stored in `metadata.steal`. A steal Hot subtracts
the reward from the *other* player too (zero-sum: winning it actively
hurts your opponent). A steal Trap gives the mark's *owner* what the
trapped player loses.

## The 30-card roster, 13 families

| Family | Count | Cards |
|---|---|---|
| Bounty | 4 | Hot Bull, Hot Treble 20, Flashpoint (random), Wildstrike (random treble) |
| Curse/Cold | 3 | Cold Bull, Blackout (random), Deep Freeze (random double) |
| Curse/Trap | 3 | Trap Double 16, Ambush (random), Snare (random treble) |
| Shield | 3 | Shield D16, Ward (random), Bunker (random double) |
| Reversal | 1 | Score Swap -- kept singular, Legendary only |
| Momentum | 2 | Surge, Weakened |
| Leech | 2 | Siphon (50%), Parasite (35%) |
| Sabotage | 2 | Erase (remove one enemy mark), Purge (remove all) |
| Escalation | 2 | Slow Burn, Simmering Trap |
| Multi-target | 2 | Wildfire Spread (3x Hot), Minefield (3x Trap) |
| Leg-wide | 2 | Treble Curse, Double Trouble |
| Wildcard | 1 | Unstable -- hidden Hot/Trap |
| Match Swing | 3 | Overtake, Underdog's Grace, Set Point (Sets format only) |

These live in `cards-data.ts` flagged `mode: "chaos_lab"` (ids 701-730).
That flag is what keeps them out of everywhere else -- they're **never**
added to `card_definitions` in the backend, so they can't be purchased,
packed, or equipped. The only place they can ever appear is Chaos Lab's
own mystery-card pool (`getChaosLabCardPool` in `cards-data.ts`), which
draws exclusively from this set -- never mixed with the regular chaos pool.

## Rarity-weighted drawing

Chaos Lab draws are rarity-weighted specifically (`cards-data.ts`'s
`drawChaosLabOptions`) -- regular Chaos Mode is untouched and stays uniform
random, as it always has been. Weights: Common 15, Rare 5, Legendary 1.
Match Swing cards (Overtake/Underdog's Grace/Set Point) get an additional
/3 on top of their Legendary weight, since granting or removing a whole
leg is a bigger swing than most other Legendary cards here.

## Target range: 15-20 and Bull only

Every Board Mark target — fixed or randomly generated — is restricted to
numbers 15-20 plus Bull. `BOARD_MARK_NUMBER_POOL` in
`boardMarkPrototypeCards.ts` is the single source of truth for the random
generators (`random`/`random_treble`/`random_double`/`random_any`), and
`BOARD_MARK_IN_RANGE` in `boardMarkMatcher.ts` is the equivalent for "any"
category matching. This was a deliberate design change: 15-20+Bull are
exactly the numbers Cricket scores, so every single Board Mark card is
relevant in a Cricket match too, rather than a "Hot 7" or similar being
dead weight nobody would ever deliberately throw at (Cricket doesn't
track anything outside 15-20+Bull, so hitting an out-of-range number is
a wasted dart with zero Cricket-scoring benefit even if the mark's reward
were enticing). Every fixed-target card already happened to live within
this range from the original v3 design, so this only changed the four
random-generation functions and the "any" category matcher.

## Multi-target and additional marks

`BoardMarkPrototypeCardConfig.additionalMarks?: BoardMarkSpec[]` lets one
card place any number of marks at once -- `createBoardMarkFromPrototypeCard`
returns `BoardMark[]`, always at least length 1. Wildfire Spread and
Minefield use this to place 3 marks. Both scorers loop-place whatever
comes back; each mark is placed independently, so a placement conflict on
one doesn't block the others.

## Category ("any") targets

`BoardMarkTarget.value` can be `"any"` in addition to a specific number or
`"bull"` -- `{ type: "treble", value: "any" }` matches every treble on the
board. Used by the leg-wide family. The dartboard highlighting
(`boardMarksToSegments` in scorers.tsx) handles this by highlighting all
20 number buttons, since there's no single button to point at for "every
treble".

## Escalation

Slow Burn and Simmering Trap grow stronger the longer they survive unhit.
Each engine's visit-end effect increments `metadata.escalationStage` by 1
(capped at 5) for any active mark whose `createdByCardId` matches
`"prototype_slow_burn"` or `"prototype_simmering_trap"`.
`computeBoardMarkTriggerMagnitude` (scorers.tsx) applies up to +150% at
stage 5. This check is by string prototype id rather than
`BOARD_MARK_ESCALATION_CARD_IDS` (a numeric-id Set, exported but only used
for card-membership checks elsewhere) -- simplest given there are only two
escalation cards.

## Sabotage

Erase/Purge are special-cased in `handleChaosCardActivation` (both
scorers) BEFORE the normal board-mark placement path -- checked via
`BOARD_MARK_SABOTAGE_CARD_IDS`. `applyBoardMarkSabotage` (a pure function
in scorers.tsx) removes one or all of the opponent's active marks. If they
have none, falls back to placing the card's own default mark (a small
Cold/Trap on a random target) so it's never a dead draw.

## Match Swing

Overtake/Underdog's Grace/Set Point are special-cased similarly, checked
via `BOARD_MARK_MATCH_SWING_CARD_IDS`, resolved immediately on draw -- they
never place a mark at all. `computeMatchSwingOutcome` (a pure function) is
given a `standing: [number, number]` array and decides whether the
condition is met:

- Overtake / Underdog's Grace use `legWins` in Legs format, or overall
  `setWins` in Sets format -- whichever represents "the whole match
  standing" for the current match structure.
- Set Point always uses `legWins` specifically (the CURRENT set's tally,
  not whole-match) -- it operates at set granularity. Only enters the pool
  when `setsToWin > 0` (`getChaosLabCardPool`'s `isSetsFormat` param,
  threaded from each scorer's own `setsToWin` prop).

If the condition isn't met, falls back to a solid Legendary-tier bonus
(same magnitude as a Hot Bull trigger) instead of doing nothing.

## Visibility

Board Marks used to only surface as tiny hover-tooltip pills -- useless on
a mobile-first, touch-only scoring app. Fixed several ways:

- **The dart input board itself shows exactly what happens, not just a
  color.** `DartInputBoard` (`dartboard.tsx`) has an additive
  `markedSegments` prop -- `{ segment, color, icon, requiredMult?,
  magnitudeLabel }[]` -- layered on top of the existing `highlightSegments`
  prop every other game mode uses (untouched, zero risk to them). A color
  glow alone wasn't enough: a player throwing several darts in quick
  succession is looking at the board, not a side panel, so anything not
  shown right on the button they're about to tap effectively doesn't
  exist to them at the moment it matters -- and could bust them on a
  score change they never saw coming. Every marked button now shows a
  small type icon in the corner and the real magnitude/effect directly on
  the button (e.g. "T −55", "D +45", "SWAP"), computed by the same shared
  `boardMarkShortLabel` function the HUD panel uses, so the two can never
  say different things about the same mark. `requiredMult` distinguishes
  a treble/double-only mark from a "any multiplier" number-bed mark, so
  hitting the bed at the wrong multiplier doesn't look like it should
  have worked. Category ("any") targets highlight all matching numbers
  15-20.
- **`BoardMarksHUD` is a real, tappable panel**, not a tooltip. Every
  active mark shows its type spelled out, the exact target, a
  plain-language "who this affects" line from the *current viewer's*
  perspective, a STEAL badge where relevant, and the live reward/penalty
  number -- including payload-aware labels (`SWAP`, `x2 next visit`, `35%
  to them`) instead of a generic number, and Unstable marks show `???`
  everywhere instead of their real type/color. Tapping any mark opens a
  popover with the full card art and exact effect text.
- **`ChaosLabActivityLog`** -- a persistent, match-wide, engine-agnostic
  list of the last 20 Chaos Lab events, shown on both X01 and Cricket
  regardless of whether the engine has a per-visit history panel (Cricket
  doesn't). This is the primary "what happened" surface for Cricket.
- **X01's Recent Visits** additionally labels bonuses/penalties directly
  under the relevant visit (`boardMarkVisitNotesRef`, cleared each fresh
  visit, attached to the `history` entry). Cricket has no equivalent
  per-visit history panel -- a deliberate scope decision, not an oversight;
  the Activity Log above is Cricket's transparency mechanism instead.

Both the HUD and the Activity Log draw from the same
`BOARD_MARK_COLOR`/`BOARD_MARK_ICON` constants (plus `UNSTABLE_COLOR`/
`UNSTABLE_ICON`) so they're always visually consistent with the dartboard
glow.

## Checkout safety (X01)

A Hot/Trap reward is applied via `setScores` immediately (not deferred),
but there's a real edge case: if the SAME dart that triggers a reward also
wins the leg, the immediate `setScores` call can get silently overwritten
by `resetForLeg`'s `setScores([startingScore, startingScore])` a moment
later, before the player ever sees it. Fixed with
`pendingBoardMarkAdjustmentRef`: every reward/penalty is *also* stashed
here; `resetForLeg` folds any still-pending value into the new leg's
starting scores before clearing it, so it survives even if triggered on a
leg-winning dart. The ref is cleared at the start of a fresh visit (proof
the earlier value already landed in the live score) so it can never be
double-applied to some much later leg transition.

## Manual test checklist

- Standard Card Clash and regular Chaos Mode: unaffected, no Board Marks state involved.
- Chaos Lab, Hot Bull: mark appears in the Board Marks HUD and glows on the dartboard; hitting Bull fires the toast, scores normally, applies the Bull-tier bonus, and appears in Recent Visits (X01) / Activity Log (both).
- Chaos Lab, Cold: opponent's dart still scores exactly as normal; a "Blocked by Cold" note appears with no score effect; mark persists until their visit ends.
- Chaos Lab, Trap: opponent's dart still scores normally; penalty applies; mark is removed.
- Chaos Lab, Shield: opponent's Cold/Trap placement on the shielded target silently fails; a normal checkout there still works.
- Score Swap: hitting it swaps both players' remaining scores exactly.
- Surge/Weakened: confirm the multiplier applies to the recipient's NEXT full visit, not the triggering dart or "the rest of this visit".
- Siphon/Parasite: confirm the triggering player's own dart scores normally, and the opponent's remaining moves by 50%/35% of that dart's value.
- Erase/Purge: with opponent marks active, confirm the right number get removed; with none active, confirm the fallback mark gets placed instead.
- Slow Burn/Simmering Trap: confirm the magnitude shown in the HUD grows visit over visit, up to stage 5.
- Wildfire Spread/Minefield: confirm 3 marks appear at once, on different random targets.
- Treble Curse/Double Trouble: confirm every treble/double triggers it repeatedly (not consumed on first hit), and it clears at the actual leg transition, not a normal visit change.
- Unstable: confirm the HUD/dartboard show "???" until it triggers, then the toast reveals Hot or Trap.
- Overtake/Underdog's Grace/Set Point: test both the condition-met and condition-not-met (fallback bonus) paths. Confirm Set Point never appears in Legs-format matches.
- Checkout safety: get a Hot/Trap mark active on a checkout double, finish the leg with it, confirm the reward/penalty shows up in the NEW leg's starting score rather than vanishing.
