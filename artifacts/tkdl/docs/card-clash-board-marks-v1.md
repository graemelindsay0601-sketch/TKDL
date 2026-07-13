# Card Clash — Chaos Lab / Board Marks v1

Chaos Lab is a new, separate Card Clash mode (`chaos_lab`) sitting alongside
`standard` and `chaos`. It does not replace either. Its identity: **normal
darts scoring stays real — Card Clash makes the board tactically alive.**

Its first mechanic is **Board Marks**: cards that temporarily mark a
dartboard target (a number bed, a specific treble/double, or bull) as hot,
cold, trapped, or shielded. Marks change what happens in the Card Clash
effect layer when a dart lands there — they never change the dart's actual
score, bust rules, checkout rules, or Cricket mark/point logic.

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
  boardMarkPrototypeCards.ts  the 4 v1 cards + the factory that places them
  index.ts                    public exports — import from here
  __tests__/                  43 tests (node:test), run with:
                               npx tsx --test src/lib/card-clash/boardMarks/__tests__/*.test.ts
```

The module has **zero dependency on the scorer** — it only needs a plain
`{ segment, multiplier, throwingPlayerId }` shape (`toBoardMarkDartResult`
adapts TKDL's real `Dart` type into that). That's what keeps it isolated
and independently testable.

## Mark types

| Type | Effect | Removed |
|---|---|---|
| `hot` | Next eligible hit emits a trigger event. Score unaffected. | On trigger |
| `cold` | Blocks Card Clash triggers from that target for the affected player. Score unaffected. | When affected player's visit ends |
| `trap` | Cancels a Card Clash trigger from that target for the affected player. Score unaffected. | On trigger |
| `shield` | Blocks *enemy* Cold/Trap placement on that target. Never blocks Hot. Doesn't affect scoring. | When owner's next visit ends |

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

- **Draw pool**: `drawChaosLabOptions()` (in `cards-data.ts`) mixes the 4
  Board Mark cards into the normal chaos pool. `drawChaosOptions()` — what
  regular Chaos Mode uses — is completely untouched.
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

### Important limitation (intentional, for v1)

Chaos Lab's only "Card Clash trigger" right now is the automatic per-visit
mystery-card draw — there's no other per-dart-triggered effect system in
Card Clash today. So `resolveBoardMarksForDart`'s `blockCardClashTriggers`/
`cancelCardClashTriggers` flags are correctly computed and logged/toasted,
but nothing currently *consumes* them to suppress a future draw — there
isn't yet a clean, safe way to wire "this dart was Cold-blocked" into
"skip that player's next mystery-card draw" without touching the existing
chaos-draw logic in a riskier way than this v1 aims for. Future work that
wants Cold/Trap to have a harder effect on gameplay should explicitly check
the resolver's result before firing whatever it's gating — the module is
built so that's a small, additive change, not a rewrite.

## Prototype cards (v1 — proof of concept, not a balanced set)

| Card | Mark | Target | Applies to | Duration |
|---|---|---|---|---|
| Hot Bull | hot | Bull | neutral | until_hit |
| Cold 20s | cold | 20 bed | opponent | until_affected_player_visit_end |
| Trap T20 | trap | T20 | opponent | until_hit |
| Shield D16 | shield | D16 | self | until_owner_next_visit_end |

These live in `cards-data.ts` flagged `mode: "chaos_lab"` (ids 701-704).
That flag is what keeps them out of everywhere else — they're **never**
added to `card_definitions` in the backend, so they can't be purchased,
packed, or equipped. The only place they can ever appear is Chaos Lab's
mixed mystery-card pool.

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

## Manual test checklist

- Standard Card Clash and regular Chaos Mode: unaffected, no Board Marks state involved.
- Chaos Lab, Hot Bull: mark appears in the Board Marks HUD; hitting Bull fires the toast and removes the mark.
- Chaos Lab, Cold 20s: opponent's T20/D20/S20 still scores exactly as normal; a "Blocked by Cold" toast appears; mark persists until their visit ends.
- Chaos Lab, Trap T20: opponent's T20 still scores 60; a "Trap sprung!" toast appears; mark is removed.
- Chaos Lab, Shield D16: opponent's Cold/Trap D16 placement silently fails (mark never enters `activeBoardMarks`); a normal D16 checkout still works.
