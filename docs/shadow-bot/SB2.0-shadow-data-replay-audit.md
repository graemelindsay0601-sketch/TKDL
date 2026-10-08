# TKDL SB2.0 — Shadow, Player DNA and Match Replay audit

**Starting SHA:** `a736a085334d3b619e04700ef84934552a1e3d43` — verified remote `main`.
**Final SHA:** `a736a085334d3b619e04700ef84934552a1e3d43`.
**Files changed:** no repository files; this external report only.
**Commit/PR:** none; no source change requiring a commit.
**Tests/commands run:** remote HEAD inspection, clean clone, Git status/revision/history/diff, source searches and reads; `node --test artifacts/api-server/src/lib/__tests__/darts-rules.test.ts artifacts/tkdl/src/lib/__tests__/game-rules.test.ts` — **30 passed, 0 failed** (27 X01 rules tests; 3 game-instruction rendering tests).

Audit date: 8 October 2026. **Verified** below means established by source inspection, except the explicitly executed tests. **Proposal** means future design, not implemented behaviour. No production database, running application, deployment or historical records were inspected or changed. Links are pinned to the audited revision. Source code establishes possible historical record shapes, not live record counts or integrity.

**Concurrent remote update:** the final remote check found `main` at `b71dddaaadff3bbd01e85c7a5bc11f4a8854d8e5` (“Polish Career UI and shared app tabs”). Its changed-file list and TypeScript diff were inspected: presentation/attention-panel changes, with no Shadow, scorer capture, API or database changes. The clean audit checkout and test revision remain the Starting/Final SHA above; no claim is made to have runtime-tested the later UI commit.

## 1. Executive summary

Current Shadow is a small X01 probability profile, not yet a persistent, game-specific digital twin. Its eligibility surfaces disagree: displayed statistics count League plus P1 practice darts; the actual playing profile counts P1 practice only. Legitimate P2 data is omitted from most Shadow calculations.

Career live X01 has the strongest existing replay foundation: ordered, server-validated darts plus match format and starter. Practice X01, Tour and Master 501 have useful human hit arrays but incomplete replay context and capture caveats. Normal League discards the scorer's detailed arrays when submitting a result. Ordinary Cricket retains a result/mode marker rather than its evolving board or darts.

Establish trustworthy attribution, source identity, correction handling, game scoping and privacy before expanding models. Preserve existing Shadow until its replacement is proven. Hits are not intended targets; aggregates are not individual darts; generated opponents never train human DNA. **SB2.1 has not been implemented.**

## 2. Current Shadow architecture

### Verified calculation map

| Consumer | Inputs and behaviour | Limitation |
|---|---|---|
| `/players/:id/shadow-bot-stats` | P1 practice plus winner/loser `matches`; combined darts/checkout totals; 250-dart display unlock | Weighted average is practice-only, fallback 45; displayed 180s come from match rows |
| `/players/:id/shadow-profile` | P1 practice summaries and `session_data.dartLog`; separate 250 gate | No League, P2 or X01-only predicate; this is the actual challenge profile |
| `computedAvg` | All-time P1 score/darts × 3 | Different from recency-weighted UI/leaderboard average |
| `primarySeg` | Most frequent scoring-phase hit segment | Outcome, not intended target; zero/miss is not excluded as a candidate |
| `treblePct` / `singlePct` | Multipliers conditional on hitting primary segment | Not accuracy relative to an intended target; off-segment throws are absent from denominator |
| `checkoutSegs` | Most common checkout-phase double hits | Not attempted-double preference; actual bot does not consume it for route selection |
| `doubleHitPct` | P1 checkout hits/attempts, default .18, clamp .05–.95 | Summary attempts often mean visits beginning at ≤170; not double-dart attempts; cannot reproduce measured zero |
| `/players/:id/dart-profile` | Both slots' hit arrays; 100-dart gate | Separate descriptive endpoint, not actual Shadow profile |
| `/bots/leaderboard` | P1 practice, 250 darts, weighted average; excludes inactive players | No League or P2 |
| `/shadow-bot/league` | P1 practice ranking by weighted average, with checkout/180 summaries | Not a simulated round-robin; feature flag accompanies returned data |
| Shadow achievements | P1 practice counts, average, 180s, checkout and modes | No equivalent League/P2 contribution |
| Coach/routine | P1 aggregates; selected detailed X01 arrays | Aggregate and detail scopes differ; some synthetic visit/first-nine grouping loses session boundaries |
| Source summary/monthly chart | P1 practice only | Source summary conflates `session_data.mode` with provenance |
| Shadow matches/rivalry | `session_data.shadowPlayerId`, challenger P1 | Intentionally human-versus-selected-Shadow history, not general player rivalry |

Evidence: [statistics](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/routes/practice.ts#L762), [actual profile](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/routes/practice.ts#L910), [achievements](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/lib/shadow-bot-achievements.ts).

The list links to player detail; detail loads statistics, history, charts and rivalry. Practice Player Clone setup fetches the actual profile and attaches it to a generic club bot configuration. X01 uses that profile once opened; unopened double-in uses the generic planner. Cricket ignores `shadowProfile` and uses generic configuration. Selecting a clone therefore does not establish personalised Cricket tactics.

The Shadow dart helper samples primary-segment trebles/singles and generic neighbouring singles for misses. Doubles use a generic miss split; checkout routes are fixed rather than learned. Bust-producing selections are suppressed into misses. It does not learn target-relative misses, setup choices, pressure or contextual routes. There is no persistent model/version ID; Shadow helpers use `Math.random`, rather than the injected randomness supported by the generic planner.

Evidence: [bot engine](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/lib/bot-engine.ts#L503), [Practice setup](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/pages/practice.tsx#L259), [detail](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/pages/shadow-bot-detail.tsx#L107).

Shadow-vs-Shadow uses another calculation: P1 practice weighted average and checkout percentage, normally distributed visits with spread `average * .38`, simplified finishes and a 60-visit bound. It does not call the actual Shadow dart engine. Equal dart counts favour P1; repeated unresolved outcomes eventually use a coin flip. Its generated response is not saved as human evidence. It is not a validated legal, sequential personalised-darts simulation.

Relevant persistence is `practice_sessions`, `matches`, `players.shadow_bot_enabled`, `shadow_bot_achievements`, feature flags and self-play unlock records. There is no canonical observation/versioned DNA store. SQL migrations add practice idempotency and indexes; the typed practice schema does not declare the SQL-added idempotency key. `shadow_bot_enabled` is an admin capability setting, not a public/private model policy. Inspected paid personas/drills affect access/content, not actual Shadow probability or confidence.

Git history shows `f493f02` added League statistics to the display endpoint, not the playing profile. The “combined practice + league” profile comment therefore overstates the implementation; this is partial integration, not proof that a complete League dart model was subsequently removed. Comments describing Shadow League as simulated results, and stats-service comments that Tour never writes practice sessions, also disagree with current code.

## 3. Source coverage matrix

| Source | Scorer → backend/store | IDs, attribution and match structure | Detailed data and eligibility |
|---|---|---|---|
| Normal League | `pages/play.tsx` → `POST /matches` → `matches` | Match ID; winner/loser IDs correctly mapped from both seats; result/player summaries | Darts counts, bands and checkout summaries; no retained hit/visit stream, original starter or full leg/set boundaries. Aggregate only |
| Manual/ordinary matches | submit-match flow → matches | Match/participant IDs; older nullable stats | Result only. No separate rich friendly store found; ordinary two-human Practice follows its row below |
| Practice X01 | shared X01 scorer → `POST /practice/sessions` | Serial session ID, P1/P2 IDs, result index, duration/date/game key; P2 stats for human-v-human | Ordered per-human `{seg,mult,val,phase}` arrays, without interleaving/complete format. Conditional hit training |
| Master 501 | custom M501 scorer/page → practice POST and run PATCH | Run ID in run store; rich practice copy lacks run ID; human P1; tier/round/dart limit/legs totals | Human hits and summaries. Additional backend summary practice row. Partial historical context |
| Tour | GameScorer/tour-run → practice POST and Tour run PATCH | Run/bracket plus practice copy; tour ID/name/difficulty/opponent name, not unique run/round linkage; human P1 | X01 human hits; generated opponent not copied into human log. Other games depend on emitted payload |
| Career live X01 | live page → Career live router/service → `career_live_sessions` and linked results | Owner/save/match/session, revision, format, starter and bull; human normalized seat 0, bot seat 1 | Ordered validated darts; value/state derivable by existing replay. Human eligible; bot excluded |
| Simulated/non-live Career | Career results/events | Save/event/match and NPC IDs | Results/facts do not establish physical human throws; generated data excluded |
| Ordinary Cricket | CricketScorer → practice POST | Session/player IDs/result; normally `mode: cricket` only | In-play marks/points/darts not persisted. No historical per-dart training |
| Other Practice games | scorer branches → practice POST | Session/player IDs/result; selected mode/final-score fields | Usually result only; some branches emit no stats payload |
| Card Clash X01 | CardClashMatchScorer → card start/finish → card matches | Match ID/P1/P2/winner/cards/state/chaos/mock | No canonical dart stream. Temporary debug text is incompletely linked and includes generated darts |
| Card Clash Cricket | same wrapper/card routes | Same result identities | No canonical board/dart history; debug text not accepted evidence |
| Board Curse, Daily/Endless | `BoardCurseScorer` → `/board-curse/best`, `/record`, `/daily` → best/record tables and `arcade_runs` | Arcade row ID/date, selected P1 ID; opponent label rather than attributable P2 identity; game/format/result, visits count/streak | No individual hits, visit scores, exact rules/effect history or boundaries; result-only, level 1/D |
| Boss Battle/Rush | `BossBattleScorer` → `/boss-battles/attempt`, `/rush` → boss stats/progress and `arcade_runs` | Arcade ID/date, human player ID, boss ID/label, result/time/clean-sweep/ascension or rush wins | Human P1, generated boss P2; no dart stream or leg timeline; result-only, level 1/D |
| Doubles/team/shift-war/FFA | specialised scorer/results paths | Team/group participants and results | No persisted individual throw attribution established; cannot divide team totals between people |
| Broadcast/recovery | live-match route/local recovery | In-memory match or device-local snapshot | Ephemeral, not a historical data source |

Evidence: [League submission](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/pages/play.tsx#L1688), [matches API](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/routes/matches.ts#L21), [Practice writer](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/pages/practice.tsx#L990), [Tour writer](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/pages/tour-run.tsx#L390), [M501 writer](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/pages/master501.tsx#L151), [Career schema](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/db/migrations/create_career_live.ts#L51).

### Practice store inventory

Direct writers found: Practice, Tour and M501 pages via practice POST, plus M501's backend summary insert. No corresponding normal League, Career live or standalone Card Clash writer was found. The table is already a generic session store despite its name.

Code-emitted mode labels include `tour`, `master501`, `cricket`, `killer`, `sequence`, `high_low`, `halveit`, `countup`, `football`, `golf`, `pick_a_double`, `legs`, `checkout_challenge`, `fives`, `oche_roulette`, `one_eighty_challenge`, `hare_and_hounds`, `prisoner`, `knockout`, `tennis`, `follow_the_leader`, `battleship_darts`, `blind_killers`, `donkey_derby`, `limbo`, `snakes_ladders`, `quackshot`, `fight_game`, `snooker_darts`, `jdc41`, `exponential_bundle`, `shooting_gallery`, `dead_centre`, `99darts`. Missing modes also occur; the inspected Shanghai branch does not emit statistics. This is a code inventory, not a query of actual historical values.

`dartLog` and `p2DartLog` are seat-specific outcomes, without intended targets or a payload-version contract. Original activity linkage is generally absent. Readers include raw/session history, ordinary statistics, Shadow, achievements, coach, charts and source summary, with inconsistent seat/source assumptions.

## 4. Data-quality matrix

| Source | Result / legs / sets | Visits; segment / multiplier / value | Phase / intended aim | State, time/order and rules | Level |
|---|---|---|---|---|---|
| League | Result and summaries, no timeline | No visits or hits | Neither | Match date/game type, no complete format/order | 1 |
| Practice X01 | Result; incomplete boundaries | No explicit visits; all three hit fields | Coarse phase; no aim | Per-seat order/session date; starter/interleaving/format incomplete | 3 qualified |
| M501 rich copy | Result/tier/round/legs totals | No explicit visits; all hit fields | Coarse phase; no aim | 501/dart-limit context; boundaries not explicit | 3 qualified |
| Tour X01 | Result/Tour metadata, bracket elsewhere | No explicit visits; all hit fields | Coarse phase; no aim | Human sequence, not complete opponent or match order | 3 qualified |
| Career live | Format and log reconstruct boundaries | Visits derived; seg/mult recorded, value derived | Situation derived; no aim | Starter/global order/rules; pre/post state reconstructable; no per-dart wall clock | 4 |
| Ordinary Cricket/other Practice | Result/mode, occasional scores | No saved hits/visits | Neither | Session date/game label; variants incomplete | 1 |
| Card official record | Result/cards/participants | No hits/visits | Neither | Match dates and some configuration | 1 |
| Card diagnostics | Fragmentary | Often actual hit fields | Some situation; no aim | Relative time/slots; X01 remaining-before; inadequate identity/corrections | Unsafe by default |

No inspected source has level-5 intended-target evidence. No generally usable durable visit-only stream was established. Darts counts/180 totals are not visits.

Board Curse and Boss Battle also persist level-1 aggregate outcomes, not level-2 visit-score sequences: a field named `visits` is a count of visits. Their live scorers reuse X01/Cricket and effect machinery, but their completion payloads do not retain the physical hit stream. Board Curse local opponent names do not establish P2 player identity. Its short-window repeat guard is not stable activity deduplication. Boss Rush/attempt/history representations similarly need source aliases if ever adapted. These modes do not currently contribute detailed human evidence to the inspected Shadow queries. [Board Curse routes](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/routes/board-curse.ts), [Boss routes](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/routes/boss-battles.ts).

Shared X01 canonical live capture and legacy per-player stats are separate. Undo truncates the canonical stream, but does not equivalently roll back legacy P1/P2 arrays/counters. Unsuccessful double-in opening darts return before legacy recording. Card transformations can also precede legacy recording. Thus a level-3 array is not automatically a complete physical-dart record. M501 has its own capture/undo logic; current-visit undo removes a logged hit but attempt counters remain separate.

Evidence: [hit shape](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/lib/stats-types.ts), [X01 recording](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/lib/scorers.tsx#L1152), [undo](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/lib/scorers.tsx#L1475), [M501](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/lib/scorers.tsx#L9290).

## 5. P1/P2 parity

**Both seats:** general practice aggregate/best-average/dart-profile/favourite-double queries union both fields; League maps summaries to winner/loser correctly. However P2 practice row counting requires non-null P2 darts, omitting some result-only games.

**Wrong for universal DNA:** actual profile, practice part of Shadow unlock/statistics, leaderboard, league, simulation inputs, achievements, coach, chart and source summary use P1 only.

**Intentional:** Shadow challenger history, solo M501 and Tour human P1. Career human seat 0 must map to the owner, not to an event bracket side. **Ambiguous:** shared-device claimed IDs are not authenticated throw attribution; team membership does not identify each dart. Never globally assume P2 is a bot.

## 6. Duplicate/double-count risks

Practice hashes the JSON submission to suppress exact retries. This is not a physical activity ID: changed duration/body serialization can bypass it; identical legitimate activities may collide. M501 has a run result, rich frontend practice copy and second backend summary practice row. The latter lacks P1 darts, so it does not currently double those darts, but affects history/session semantics. Tour has a run/bracket plus independent practice copy without reliable run/round linkage. Career has a live session plus linked results/facts; only the live human stream should yield observations.

Independent run and practice requests can leave incomplete pairs. M501's guarded run completion and following summary insert are not one transaction. Card diagnostics/result rows cannot be matched safely from names/times alone. Career revision/duplicate-final handling is a stronger existing pattern.

**Proposal:** allocate activity UUID at match start, preserve in recovery, and uniquely identify source/activity/human participant/canonical ordinal. Add source aliases for run/round/session. Corrections supersede or retract; never append an undone dart as a second performance. Hashes supplement identity. Generated Replay/Shadow/NPC data must be excluded regardless of destination table.

## 7. Historical backfill

| Class | Candidate records | Qualification |
|---|---|---|
| A — full darts/context | Valid Career live sessions | Train only human; NPC can reconstruct the original match but is not human DNA |
| B — hits/incomplete context | Valid Practice X01, rich Tour/M501 arrays | Retain actual hit evidence; qualify missing context and capture integrity; quarantine malformed rows |
| C — visit only | No general durable source proved | Do not manufacture visits from summaries |
| D — aggregate/result | League, run/bracket summaries, result-only games, Card matches | History/performance summaries only, not invented dart samples |
| E — unsafe/ambiguous | Unattributed debug text, malformed/uncertain duplicate/generated records | Exclude pending reliable resolution |

Meaningful legacy outcome history may survive migration; no need to wipe everyone's Shadow. But retained sample sizes, historical schema mix and duplicate rates require a separately authorised read-only database inventory. Classify actual payloads, not current writer assumptions. Missing undos/opening darts, League sequences and Cricket boards cannot be recovered by inference.

## 8. X01 readiness

| Signal | Classification and limit |
|---|---|
| Segment/multiplier outcomes | AVAILABLE NOW in qualifying arrays; not aim accuracy |
| Preferred opening target | Opening hit tendency RECONSTRUCTABLE in Career; intended preference REQUIRES NEW CAPTURE |
| T20/T19/T18 switching | Hit switching RECONSTRUCTABLE; intended switching REQUIRES NEW CAPTURE |
| Visits/first nine | RECONSTRUCTABLE in Career; arbitrary filtered triples are invalid legacy substitutes |
| Segment/treble accuracy, miss spread | REQUIRES NEW CAPTURE of aim; historically NOT RELIABLY KNOWABLE |
| Doubles/checkout by double | Hit counts AVAILABLE; attempted preference/accuracy REQUIRES NEW CAPTURE |
| Setup/checkout routes | Actual paths RECONSTRUCTABLE in Career; intended routes NOT RELIABLY KNOWABLE from hits alone |
| Bust behaviour | RECONSTRUCTABLE in Career; legacy missing context qualifies conclusions |
| After missed doubles | Subsequent state RECONSTRUCTABLE; whether preceding dart was intended as double needs capture |
| Opponent on finish/decider/match dart | RECONSTRUCTABLE with Career format and both streams; not general legacy copies |
| 301/501/701 differences | RECONSTRUCTABLE where format retained; explicit variant/in-out snapshot needed prospectively |

Current phase commonly means visit-start score ≤170, not dart-specific aim or a double attempt. Existing shared X01 replay remains the state authority.

## 9. Cricket readiness

Cricket has in-play marks, points, turns and variants, including cut-throat/bull settings. Ordinary completion persists only a mode marker. Historical own/opponent marks, differential, legal scoring targets, dart/round/visit number, previous dart and opening/closing/scoring effects therefore cannot be reconstructed from those rows.

| Cricket evidence | Historical ordinary records | Prospective classification |
|---|---|---|
| Result/player IDs/session date | AVAILABLE NOW | Retain source identities |
| Own/opponent marks, points, differential, legal targets | REQUIRES NEW CAPTURE of initial rules and ordered hits | RECONSTRUCTABLE through existing rules once captured |
| Dart/visit/round index and previous dart | REQUIRES NEW CAPTURE | RECONSTRUCTABLE from complete turn sequence |
| Actual hit, Bull inner/outer | REQUIRES NEW CAPTURE | Record segment/multiplier directly |
| Open/close/point/finish effects | REQUIRES NEW CAPTURE | RECONSTRUCTABLE as effects, not motives |
| Intended target | NOT RELIABLY KNOWABLE from existing history | REQUIRES explicit target capture |
| Defensive intent, aggression, marks-versus-points choice | NOT RELIABLY KNOWABLE from result or hit alone | Context/aim evidence plus comparable opportunities; qualify any inference |
| Ahead/behind switching, Bull timing, late-game habits | REQUIRES NEW CAPTURE | Learn only from repeated attributable complete games |

**Proposal:** capture ordered physical hits, participants/starter and immutable variant/rule version. Existing rules derive both boards, points, differential, legal choices and hit effects. Closing/scoring are observable effects; aggression, defensive intent and chosen targets require actual evidence, not labels. Bull inner/outer is available only if the hit multiplier is retained.

Future decision order: existing rules/legal choices → contextual personal preference → target → sampled hit → existing rules. Current bot receives its own marks and generic accuracy; it is not opponent-aware personal tactics. Capture must precede learning claims. [Cricket completion](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/tkdl/src/lib/scorers.tsx#L3544).

## 10. Replay capability

| Source | Supported conclusion |
|---|---|
| Career live | FULL DART REPLAY for valid recorded sessions: format, starter, order, boundaries, busts and checkouts reconstructable |
| Practice X01 | Per-player hit playback; not guaranteed exact interactive match replay |
| M501 | Partial solo playback; narrow format-specific reconstruction needs proof; no blanket full-replay claim |
| Tour X01 | Partial human playback; complete opponent/order/linkage missing |
| League/manual/team | RESULT ONLY |
| Ordinary Cricket/other Practice | RESULT ONLY |
| Card Clash | RESULT ONLY as supported history; diagnostics are not a replay catalogue |
| Board Curse/Boss Battle/Rush | RESULT ONLY; visit counts/time/streaks are not a replay sequence |
| Broadcast/recovery | Not durable historical replay |

No general VISIT REPLAY source was proved. Never invent segment triples for a visit total.

**Proposal:** a replay challenge links to an immutable original and recording version. Consume historical opponent darts while legally applicable, within original leg boundaries. An early human win discards unused darts for that leg, not transfers them to the next. Exhaustion or a required new decision triggers an explicit handoff to a pinned permitted Shadow, or labelled generic fallback. Record handoff position and generated provenance. A Cricket hit on a now-closed number may legally yield zero; do not silently replace history with a new tactical target.

Career can underpin proven best-leg/12-dart/170-checkout challenges where its log establishes the performance. League match aggregates cannot prove those sequences. Taking either historical seat requires two recorded attributable streams and permission; Career's second seat is an NPC. Original results remain immutable; challenge results are separate. Shadow plays the player; Replay plays the performance; Challenge sets a bounded objective.

## 11. Ranked weaknesses

- **BLOCKER for new product claims:** lost League/Cricket events; absent intended targets; missing universal physical-dart identity/provenance. These do not mean existing basic gameplay cannot run.
- **HIGH:** P2 exclusion and inconsistent unlock; cross-game pollution; legacy undo/double-in omissions; loose client IDs/JSON; raw detail without owner guard; unsafe diagnostic import; checkout-summary ratio used as double accuracy.
- **MEDIUM:** no model versions, incompatible averages/session-ordinal decay, synthetic visits/first-nine, generic routes/misses/Cricket, simulation legality/tie bias, duplicate M501 representations, absent learning/privacy controls.
- **LOW:** stale comments/source labels, strength-based “accuracy” tiers, SQL/type drift. Address within owning milestones, not audit cleanup.

## 12. Proposed canonical observations

One Shadow identity per player; shared core and separate game evidence. Source activity: namespace, authority ID/aliases, owner, participants/roles, game/variant, immutable rules/config, source revision, time/status and verification tier.

Observation: activity, participant/player, ordinal and known leg/set/visit/dart indexes; unit DART/VISIT/RESULT; actual seg/mult/value; nullable intended target plus explicit origin; physical hit distinct from rule-adjusted value; quality/eligibility reason. Preserve HUMAN/BOT/NPC/SIMULATION/REPLAY_GENERATED provenance; unknown is not automatically human. Missing stays null. Reconstruct state through existing rules, not guesses written into facts.

Unique source/activity/participant/ordinal identity plus revision-aware supersession prevents duplicate training. Keep aliases and incomplete-source reconciliation. Validate legal hits and replay supported states; quarantine malformed records without cheating accusations. Shared-device submissions need explicit lower-trust provenance until participant confirmation is decided. Never trust client player IDs as ownership. Card-adjusted scores must not masquerade as physical X01 accuracy.

Concrete proposed field contract (not a migration):

```text
observation_id, schema_version, activity_id, player_id, participant_id,
source_type, source_session_id?, source_match_id?, source_revision,
game_family, game_variant, rules_version, rules_config_ref,
unit: DART | VISIT | RESULT, player_slot, throw_order,
set_index?, leg_index?, round_index?, visit_number?, dart_number?,
actual_segment?, actual_multiplier?, actual_value?, effective_value?,
intended_target?: { segment, multiplier, origin: EXPLICIT_INPUT },
phase?: { value, origin: DERIVED_RULE_STATE | LEGACY_LABEL },
pre_state_ref?, post_state_ref?, occurred_at?, received_at,
data_quality, provenance, verification_tier, eligible, exclusion_reason?,
supersedes_observation_id?, source_payload_hash
```

Ordering is mandatory for a dart stream even when per-dart wall-clock time is unknown. State references identify replay checkpoints/deltas or derivable states under pinned rules, not fabricated historical snapshots. Separate recording access and source identity from learned model identity, so Replay can consume recordings without treating the model as historical truth.

## 13. Raw versus derived

Keep authoritative history unchanged. Canonical observations normalize attributable evidence; DNA, confidence, text descriptions and replay caches are rebuildable derivatives. Keep physical hit separate from score effects; never generate raw darts from aggregates.

Reset affects only that player's learning generation/projections/eligible evidence, never source matches or unrelated systems. Establish a reset cutoff so automatic backfill cannot undo a reset. Pause stops new model influence while source recording continues; resumption must explicitly define whether paused observations stay excluded or are deliberately imported.

## 14. Model/confidence/versioning

**Proposal:** immutable player/game model ID, component/schema/builder/rules versions, build time, source cutoff/revisions/hash, sample/exclusion counts and deterministic parameters. Pin model and seed for each challenge. Retain bounded historical versions required by saved challenges subject to privacy policy.

Confidence is distinct from ability: core/game/signal counts, independent sessions, time span, context coverage and provenance. Initial calibration candidates—not validated thresholds—are Emerging below 300 eligible darts/5 sessions, Developing thereafter, and Established around 1,500 darts/20 sessions/four weeks, capped by missing context/low provenance. A per-double signal might require 50 explicitly aimed attempts across 10 sessions; Cricket needs repeated comparable opportunities across games. Without aim, no count establishes target-choice confidence.

Prefer elapsed-time decay with shrinkage to long-term personal evidence over `0.92 ^ session row number`. A 90-day half-life is a calibration starting point, not a measured optimum. Keep sparse recent sessions from dominating. Distinguish physical evolution from game tactics; Career fictional dates are not recording chronology.

Dashboard/evolution should show accepted/excluded new darts, comparable opportunities, uncertainty and measured changes. “D16 hits increased” does not prove “prefers D16”. Explanations must trace actual model components/evidence or state generic strategy was used. Purchases cannot affect eligibility, weights, ability or confidence.

Validate performance distributions/busts/finishing separately from context-conditioned target prediction and calibration against a generic legal baseline. Hold out later complete sessions; group aliases to prevent leakage. Without aim labels evaluate hit/effect prediction only. No external LLM is justified.

## 15. Privacy/security

Verified: practice submission deliberately permits shared-device unauthenticated input with claimed player IDs and loose JSON; raw session detail lacks a route-level owner guard and practice router mounting supplies none. Current Shadow endpoints lack private-DNA controls. Career ownership/replay validation is a stronger reusable pattern.

**Proposal:** separate public model challenge permission from raw replay permission. Resolve authenticated user→player ownership and authorize each source/model/replay read. Public derived opponents need not expose raw logs. Both-seat historical replay needs a participant visibility policy. Reset/pause/visibility require owner authorization, with explicit existing admin policy and audit where applicable.

Validate size/shape/provenance, prevent repeated influence, and never auto-import debug text. Card diagnostics accept truncated text, routinely omit match/player IDs, include generated darts and are cleaned after 30 days. [Practice input/detail](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/routes/practice.ts#L15), [mount](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/routes/index.ts#L85), [Career validation](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/career/live/service.ts#L194), [Card diagnostics](https://github.com/graemelindsay0601-sketch/TKDL/blob/a736a085334d3b619e04700ef84934552a1e3d43/artifacts/api-server/src/routes/card-clash.ts#L1821).

## 16. Scale/performance

Repeated JSON expansion and per-player profile fetching will grow costly. Incremental observations plus cached model versions move rebuilding off challenge requests. Illustrative only: 100 players × 10,000 darts = one million rows; 200–600 bytes of compact payload each means hundreds of MB before row/index overhead. Full board snapshots per dart can dominate. This is not measured production volume.

Use PostgreSQL unique source identity, player/game/time/id and activity/ordinal indexes, source aliases and current-model lookup. Store rules once; derive/cache state; page replay; bound rebuilds; track dirty players. A simple retryable database job/outbox is sufficient, not distributed infrastructure.

## 17. Tests and gaps

Executed **30/30 passing** existing X01 rules and instruction-rendering tests. No build, database/API/UI runtime test, migration, load test or behavioural simulation. These passing tests do not validate Shadow SQL or source ingestion.

No direct focused suite was found proving profile generation, consistent 250 unlock, P1/P2, League inclusion, Practice/M501/Tour inclusion, Career/Card handling, personalised Cricket, practice duplicate submission, Shadow League, Shadow-vs-Shadow or historical payload parsing. Career adapter tests rejecting a Shadow profile and incidental broadcast references are not substitutes.

SB2.1 needs both-seat fixtures, legal/illegal hits, generated exclusion, old/missing fields, aliases, retries/revisions/undo, distinct identical activities, ownership and reset/pause cutoff tests. Test transactions/uniqueness against the persistence boundary. Later models require temporal holdouts and seeded replay divergence/exhaustion tests. No Career multi-season simulations are needed.

## 18. Migration strategy

1. Keep existing Shadow functioning; add observation pipeline using established feature-flag pattern.
2. Ship identity, attribution, corrections and access foundations; dual-record accepted new evidence without changing competitive results.
3. Perform separately authorised, resumable quality-classified backfill with dry-run counts/exclusions. Never synthesize discarded events or import diagnostics.
4. Build versioned core/X01 projections and compare held-out performance/decisions; be honest about legacy confidence and fallbacks.
5. Opt into new engine only when proven; retire old calculations deliberately, preserving authoritative history and needed challenge versions.

Capture Cricket early so SB2.4 has evidence. This proposal is not permission to mutate production during SB2.0.

## 19. Exact SB2.1 implementation plan — not implemented

| Step | Files/boundaries | Deliverable |
|---|---|---|
| Contract/persistence | New `artifacts/api-server/src/shadow/observation-types.ts`, `observation-validation.ts`, `ingestion-service.ts`; new `lib/db/src/schema/shadow-observations.ts` and registered migration | Source aliases/revisions, nullable fields, roles/quality, unique identity and scoped access |
| Career adapter | Existing `career/live/service.ts`, `career/live/router.ts`; new `shadow/source-adapters.ts` | Ingest committed canonical human stream once; link result aliases, preserve revisions |
| Shared scorer capture | `artifacts/tkdl/src/lib/scorers.tsx`, `stats-types.ts`, `scorer-recovery.ts` | Activity ID, actual ordered hits, participants/rules, undo and failed double-in capture; no rule change |
| Durable source linkage | Frontend `pages/practice.tsx`, `play.tsx`, `tour-run.tsx`, `master501.tsx`; API `routes/practice.ts`, `matches.ts`, `tour.ts`, `master501.ts` | Preserve currently discarded details, stable run/round aliases and retry-safe source commit integration |
| Cricket capture | Cricket branches in `scorers.tsx` and observation contract | Starter/variant/participants/ordered hits, existing rules for context; no new tactical bot |
| Modified/unsupported modes | Review `components/CardClashMatchScorer.tsx`, `lib/card-clash/matchLogger.ts`, API `routes/card-clash.ts` | Explicit unsupported/modified/generated classifications; no diagnostic backfill; adapter only once identity/effects are proven |
| Arcade boundaries | Review `components/BoardCurseScorer.tsx`, `BossBattleScorer.tsx`, pages and API `routes/board-curse.ts`, `boss-battles.ts` | Explicit result-only classification initially; no invention of hit observations from visit counts or rush results |
| Backfill | New bounded `shadow/backfill.ts` | Dry-run, payload classification, resume cursor, aliases and exclusions; application separately authorised |
| Tests | New `artifacts/api-server/src/lib/__tests__/shadow-observations.test.ts` plus affected route/scorer tests | Both seats, retry/revision/undo, bot exclusion, uniqueness, ownership, source preservation; build/typecheck affected workspaces |

New paths are proposals, not existing files. Confirm then-current migration registration and participant policy before implementation. Do not silently upgrade all shared-device data to trusted identity. If too large for one checkpoint, first deliver contract+Career+canonical X01 capture with unsupported sources explicit, then linked adapters before claiming universal coverage.

Acceptance: one physical human dart → one observation; seat parity; no generated training; corrections remove undone influence; source results/rules unchanged; quality/provenance explain every accepted row; dry-run reports exclusions without fabrication. No new model, Replay UI, replacement rules or unrelated navigation work in SB2.1.

## 20. Roadmap adjustments

Retain SB2.1–SB2.7. Move minimal ownership/visibility/reset/pause foundations to SB2.1/2.2 before detailed-data exposure; leave polished UI for SB2.7. Capture Cricket in SB2.1 rather than waiting for its model. Validate an internal Career replay proof before advertising general Replay; League replay starts with future complete captures.

After X01/Cricket, Count Up is the simplest outcome-distribution extension; sequence/Around-the-Clock supplies rule-required target context, distinct from stated aim. Shanghai/Halve-It have tactical value but need capture and demonstrated usage. Actual live volumes are unknown, so final priority requires usage evidence, not assumptions.

Later Shadow League/simulation should use pinned models and existing legal authority, fair starters and seeded tests; generated results remain excluded. Do this after X01 model validation, not SB2.1.

## 21. Limitations / questions

- Static inspection plus stated tests only; no live data, accounts, deployment, endpoint/UI runtime validation.
- Historical counts/schema mix, duplicate frequency and retained player evidence remain unknown.
- Decide intended-target UX, shared-device participant confirmation, public/private defaults and historical-seat consent.
- Define reset cutoff, pause resumption, source deletion/retention and private historical model handling.
- Legacy omissions/discarded League/Cricket data cannot be recovered by guessing.
- Original Desktop checkout has unresolved A7.2 conflicts and was left untouched. Audit used a clean separate clone of current remote main; conflict recovery is a separate task.
- No source commit/push, production change, SB2.1 or unrelated corrections. **Stop after SB2.0.**

Preservation note: this document is the SB2.0 baseline audited on 8 October 2026, not certification of current runtime behaviour. Its original audit metadata and findings are retained.
