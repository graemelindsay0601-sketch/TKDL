# Tour Career 2.0 — A7.2 Relationships and generations

Starting SHA: `9aba08045f661e9ab1f7b1df16a3108cdb582cce` (A7.1).

## Authorities and audited foundations

ONE FACT, ONE AUTHORITY. This milestone is a read-only composition of:

- A1 save, ownership, feature gating and Career identity.
- A2 persistent `career_world_players`: fictional identity, starting/current age,
  created season, retirement status/season and the existing world lifecycle.
- A3 `career_tournament_matches` joined to save-scoped event instances.
- A5 latest published `pro-world` ranking snapshot and its NPC rows.
- A7.1 chronological ordering convention and snapshot/authorization convention.

A2 already has initial mixed-age populations, deterministic development,
plateaus, late breakthroughs, decline profiles, retirement and active-population
replenishment through `evolveOffSeason` / `generateProspects`. Retired rows are
retained, not deleted. New prospects enter as GRASSROOTS NPCs, not elite stars.
A6.5 adds a separate junior initial cohort (40) and annual intake (18), gated by
event database v2+. Existing fictional naming/nationality and scoped RNG streams
remain untouched. No lifecycle rewrite or new generation logic was necessary.
Potential does not guarantee development or success.

## H2H calculation

Only save-scoped A3 matches with `status=COMPLETED`, distinct non-null sides, a
winner on one of those sides, one human side, and no BYE/WALKOVER result source
are included. BYE, WALKOVER, PENDING, AWAITING_HUMAN and incomplete rows are not
meetings. Match IDs deduplicate the pure read model. Event-result rows, repeat
submissions and live-session records never add another meeting.

NPCs are identified by their save-scoped A2 identity. Every faced NPC remains
visible, even with only one meeting or after retirement. Results provide human
wins, NPC wins, win percentage, distinct events/seasons, first/latest meeting,
finals, major/world and qualification counts and complete played meeting history.
Rounds/stage keys are persisted facts, not invented round names. Finals are the
maximum bracket round for that event/stage. Major/world signals use the existing
presentation tiers or circuits; qualification uses QUALIFIER or Q_SCHOOL.
Persisted legs/sets are oriented to the human side. Missing scores stay null.

Dates use A6.5 Career calendar mapping, not wall-clock completion timestamps.
The A7.1 chronology helper orders season/day/ID; same-day ties are deterministic
display ordering, not proof of a relative sporting sequence. No win streak or
consecutive-meeting claim is manufactured from ambiguous chronology.

## Central rules

All thresholds are in `career/relationships/model.ts: RELATIONSHIP_RULES`.
There is no random assignment, gameplay modifier, or player-facing score.

| Label | Required evidence |
| --- | --- |
| Familiar Opponent | At least 3 played meetings across at least 2 events |
| Career Rival | At least 6 meetings, at least 3 events, human win fraction 25–75%, plus at least 2 seasons OR at least 2 final/major/world/qualification meetings |
| Nemesis | At least 5 meetings across at least 3 events; NPC won at least 80% |
| Favourite Opponent | At least 5 meetings across at least 3 events; human won at least 80% |
| Generation Rival | Career Rival plus a shared played sporting cohort, or age difference at a recorded meeting no greater than 3 years |
| Q-School Class | Actual played participation by both in the same season and pathway/stage series session |
| Junior Contemporary | Actual played participation by both in the same Junior Development event |

Familiar can coexist with a performance label. Nemesis/Favourite are mutually
exclusive and cannot coexist with Career Rival at the configured thresholds.
Historical cohort labels can coexist with any performance label. Cohort
membership alone does not make a rivalry or manufacture H2H meetings.
Evidence text explains each derived performance label without exposing points.

The cohort query considers completed played matches for **each** participant.
Registrations, reservations, drawn byes, walkovers and withdrawn entrants with
zero-match event results alone do not establish attendance. Q-School first and
final stages, pathways and seasons do not mix, but different days of the same
series session can establish a class. Juniors must overlap an actual event,
not just share an age or season. Cohort history remains derivable after ageing
out/retirement because the immutable sporting evidence is retained. Performance
labels recompute on each read and can evolve as wins/losses change.

For generation age comparison, NPC age is reconstructed at the recorded meeting
from A2 starting age + meeting season − created season, then compared with the
human's A6.5 DOB-derived age. This is approximate whole-season NPC age, not an
invented NPC date of birth. Retired NPC current age is frozen by A2; the UI labels
it as age at retirement. Missing human DOB produces no age-based classification;
actual sporting cohorts can still establish contemporary evidence.

## API and UI

`GET /api/career/saves/:id/relationships` is authenticated, ownership checked,
feature gated, `Cache-Control: no-store`, and reads active or retired Careers.
It acquires the same root snapshot lock as A7.1, then performs three set-based
source reads (identities/latest ranking, H2H, cohorts); no per-player query loop.
It returns explicit public DTOs from `relationships/types.ts`.

The existing My Career navigation now includes **Relationships**, at
`/career/:saveId/relationships`. Search and label filters include ordinary
opponents and cohort-only members. Accessible native expandable panels show
identity, status, ranking, H2H, evidence, cohorts, first/latest and played
meetings linked to existing event views. Loading, retry/error and empty states
reuse existing Career components. Existing save mutations invalidate the
save-scoped React Query cache, including the new read key.

Generation presentation shows active/retired totals, new entrants this season,
active young players (age ≤23, centrally configured), starting/entry seasons and
an active/young/retired/all identity browser with search and 30-row increments.
Youth is age context, not a claim of hidden potential or a scripted breakthrough.
Current ranking means the latest published A5 snapshot, not a recalculation.

## Persistence, safety and boundaries

No tables, migrations or schema/database/world-generation version changes.
No save regeneration, second history, second NPC/ranking/retirement authority or
relationship persistence. All joins/read filters are save-scoped, including
same-NPC IDs across different saves. Pre-initialization saves return empty data;
older saves use whatever real evidence they possess.

Hidden scoring, finishing, consistency, pressure, power scoring, clutch, form,
potential, development, internal tier/stage and tendencies are deliberately
not selected/returned. Public starting age is factual generation context.
The relationship model has no write, RNG or simulation dependency. Scoring,
draw, ranking, economy, sponsorship, eligibility, qualification and the human's
no-age-decline/no-age-injury rule are unchanged. Classic Tour is untouched.

## Focused verification and manual checks

New tests cover deterministic classification boundaries/evolution, ID dedup,
cohort persistence, retired identity, missing/ordinary evidence, played SQL
participation across days/pathways/stages/events, source orientation, latest
ranking, same-ID save isolation, hidden-field exclusion, no read mutation and
HTTP auth/ownership/feature gate/no-store. The existing full-migration A6.5 live
suite additionally checks A7.2 agreement with A3/A7.1 and retired/uninitialized
save behavior. Frontend static-render tests cover records, labels, history links,
retired status, empty state and generation context. Navigation tests include
the new route.

Verification in the temporary development workspace:

- Relationships model + A7.1 facts unit tests: 9 passed.
- Relationships SQL/HTTP fixture tests: 4 passed.
- Existing full-migration A6.5 live suite (with A7.2 assertions): 10 passed.
- Focused existing A2 generation/RNG/retirement checks: 3 passed (no long balance simulation).
- Affected frontend screen/API/navigation suites: 58 passed.
- Library declaration build/typecheck and API production bundle: passed.
- Focused frontend TypeScript check of the new screen, API hook, navigation
  model and their imports: passed.
- Focused API TypeScript check of the new read model, service, router and tests:
  passed. Focused browser bundle of the new UI: passed (framework imports
  externalized; not a substitute for a full application build).
- Full API typecheck reports 12 existing broadcast diagnostics: `WEEKLY_HIGHLIGHTS`
  type incompatibilities in `src/broadcast/edition-engine.ts`, plus two
  `fan-verdict-math.test.ts` fixtures missing `reactions`. Both files are
  unchanged from the starting SHA. These unrelated errors were not fixed in A7.2.
- Full frontend TypeScript attempt hit the workspace's memory limit. A bounded
  768 MB heap rerun did not complete within five minutes and was stopped.
  This is not a full-app typecheck pass.
- Full frontend production build transformed all 2,419 modules, but the OS
  killed it during chunk rendering (exit 137), even with a bounded 640 MB
  JavaScript heap. It is not reported as a successful full frontend build.

Environment notes: database suites passed with Node `--max-old-space-size=256
--liftoff-only --wasm-num-compilation-tasks=1 --test-isolation=none` to fit the
workspace's ~1.6 GB total memory limit. Frontend tests use `NODE_ENV=production`
to omit the development metadata plugin (which otherwise corrupts existing
generic JSX during SSR transformation). Restored only the relevant locked
workspace dependencies; no dependency/lockfile edits. Temporary focused-check
configurations are not part of the committed product.

Total: **84 focused tests passed**. Manual browser interaction and deployment
verification were not performed; the checklist above is for follow-up use.

## Files changed

```text
artifacts/api-server/src/career/relationships/model.ts
artifacts/api-server/src/career/relationships/router.ts
artifacts/api-server/src/career/relationships/service.ts
artifacts/api-server/src/career/relationships/types.ts
artifacts/api-server/src/lib/__tests__/career-a65-live.test.ts
artifacts/api-server/src/lib/__tests__/career-relationships-http.test.ts
artifacts/api-server/src/lib/__tests__/career-relationships.test.ts
artifacts/api-server/src/routes/career.ts
artifacts/tkdl/src/features/career/api.ts
artifacts/tkdl/src/features/career/index.tsx
artifacts/tkdl/src/features/career/model.ts
artifacts/tkdl/src/features/career/pages/relationships.tsx
artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-ui.test.ts
docs/tour-career-a7-2.md
```

Manual browser checklist (not a claim that these interactions were performed):
open Relationships in an existing Career; expand an opponent; follow the event
link; filter a cohort; play/resume a match and revisit H2H; inspect retired
identities and archived saves; switch saves and verify history independence;
try narrow/mobile layout and keyboard expansion/search.

Known limits: cohort evidence requires a played match, so attendance consisting
solely of byes/walkovers is deliberately not inferred. NPC ages are A2 whole-season
ages. No invented score, emotion, scouting potential, breakthrough announcement,
news, goals, reputation or legacy system. A full long-Career read still scales
with that save's actual match history; it avoids N+1 queries but is not A10
pagination/optimisation/certification. A7.3 and later milestones remain out of scope.
