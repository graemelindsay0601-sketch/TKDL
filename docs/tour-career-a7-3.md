# A7.3 Career Focus & Personal Goals

Starting main: `41698e360a53948e26afd1cbf1e91d0706220717`.
This milestone first fixes the live-session cursor regression, then adds
guidance and optional factual sporting ambitions. A7.4 is not implemented.

## Live-session regression

The literal reported “session lost” warning is not present in this checkout.
The reproducible lifecycle defect was a stale checkpoint revision after bull-up:
`LiveMatchPage` previously updated its transport revision/dart refs in an effect
depending only on `session.sessionId`. Opening and completing bull-up reuse the
same session ID but advance its server revision. The first visit could therefore
submit the pre-bull revision and receive 409 “Session changed; reload it”.
The scorer recovery memo also omitted the first-thrower/format transition.
This was not evidence that the server had actually lost the session.

`live-model.ts` now exposes `adoptLiveCursor`, and `pages/live-match.tsx` calls it
synchronously for every adopted server response. The refs are only the transport
cursor, not another persistent match or gameplay authority. Recovery is rebuilt
when the first thrower/format becomes available. A generation token discards
queued checkpoint work from a superseded/restored session; checkpoint requests
remain serialized. No scoring, RNG, match creation, settlement or bot policy changes.

Genuine recovery is retained: a conflict still fetches the authoritative session
and remounts the shared scorer on its server log. If that fetch fails, the UI says
it could not restore the match rather than claiming it reloaded successfully.
The frontend live-model test verifies same-ID cursor adoption and scorer recovery.
The full-migration live HTTP test opens an actual session, finishes bull-up under
the same ID, adopts the revised cursor and verifies the first checkpoint is 200.
The existing refresh/resume, stale-revision rejection, valid server settlement,
tamper rejection, race/idempotency and downstream continuation coverage is retained.
This is automated coverage, not a claim of a physical-browser reproduction.

## Focus: guidance only

Each save has one freely changeable focus:

- **Open Schedule** (the default): normal upcoming calendar order.
- **Professional Pathway**: Q-School, professional/secondary and published ranking opportunities.
- **Amateur Circuit**: grassroots, county, regional, national amateur, Vault and Challenger competition.
- **Prize-Money Focus**: published first prizes and estimated player costs, without a profit guarantee.
- **Major Qualification**: major/world events and authored direct qualification outputs to those events.

Focus changes no eligibility, age rules, entry windows, clashes, entry fees,
money, sponsor terms, ranking points, NPCs, ability, RNG, results or Tour Cards.
It does not impose a pathway or auto-enter an event. Choosing no personal goals
is valid; ordinary Career play and the full calendar remain available.

## Recommendation derivation

The read model consumes the existing composed A3 calendar with its A4 finance
previews and A5 qualification/eligibility providers in one root-locked snapshot.
It uses the current season/current week through the next eight weeks, bounded
by week 52, and excludes events whose end date is already past.
Only existing scheduled, registration, drawn or in-progress event states qualify.
Six recommendations are shown at most.

Open Schedule preserves the source calendar ordering. Other focuses prefer
currently enterable events and use deterministic date/ID ordering; Prize-Money
Focus orders by published first prize and estimated costs before its stable tie
break. “Major route” means a qualification output targeting an event explicitly
authored as MAJOR/WORLD in the save's catalogue version, not every qualifier.
Eligibility, can-enter, denial codes, registration windows and costs are preserved.
Relevant but blocked events are labelled as blocked and link to the ordinary
event screen for the existing detailed explanations.

Retired or profile-incomplete Careers do not generate recommendations. Their
focus and goals remain readable; the established DOB/progression gate is unchanged.
The normal calendar is neither filtered nor mutated by this feature.

## Supported goals and authorities

| Initial supported family | Progress/completion authority |
| --- | --- |
| Win a title; reach a final | A3 human event results through A7.1 |
| Win a selected eligible event | Same save's A3 event/result |
| Win a major; win the World Championship | Existing authored presentation tier/circuit and human champion result |
| Win an amateur/secondary title | Existing grassroots/county/regional/national amateur/Vault/Challenger results |
| Reach World top N | Current A5 root ranking cache and A7.1's evidenced best published World ranking |
| Earn a first Tour Card | Existing A5 award fact through A7.1; not offered after an existing first award |
| Reach Career prize earnings | A4 immutable EARNINGS ledger/summary, not balance, sponsors or expenses |
| Record N maximums (180) | A7.1's A6.5 verified human dart aggregate |
| Beat an active selected NPC | Played A3 matches through A7.2 H2H |
| Improve existing H2H by one net win | Played wins minus losses since selection, from the same H2H authority |
| Beat a selected Career Rival/Nemesis | Existing evidenced A7.2 label at selection; completion requires a later played win |

Event/opponent accomplishment goals exclude evidence IDs already present when
selected. Lifetime ranking/earnings/maximum milestones must be above the existing
achievement; old achievements are not retroactively fabricated as new goals.
H2H improvement records the first crossing of +1 net win even if a subsequent
loss occurs before the next read. Byes/walkovers are excluded by the existing
played-match authority. A later relationship reclassification does not erase
the meaning of the relationship the player selected.

Selected-event labels are resolved from the owned event authority, including
after it leaves the recommendation window. Losing the selected event does not
complete the goal; its result produces an explicit no-longer-achievable note.
Retired/unavailable opponents are explained rather than silently granting a win.
The selector offers sensible preset ranking, earnings and maximum milestones.
The API supports validated bounded numeric targets; no invented qualification
or Q-School-stage goal is offered in this initial set.

## Persistence, versions and lifecycle

The repeat-safe additive migration `create_career_goals.ts` runs after A5.
It adds checked `career_saves.career_focus`, default `OPEN_SCHEDULE`, and the
cascade-owned `career_personal_goals` table. Existing saves need no world,
calendar, finance or ranking rebuild. Drizzle schema declarations mirror it.
No unrelated Career/world/calendar/ranking/scorer version is bumped: the changes
are additive choices/lifecycle records and do not reinterpret existing facts.

Each goal stores its definition/target, request UUID, baseline evidence IDs,
selection season/week, lifecycle and (only when verified) supporting completion
Fact. It does not store mutable copied sporting counters. States are ACTIVE,
COMPLETED and ABANDONED. The UI uses a small limit of five active goals; this
only limits display/selection, never gameplay.

Read/create/abandon reconcile ACTIVE goals against a root-locked authoritative
snapshot. The existing services share that outer transaction executor rather
than opening independent nested transactions. Completion is a conditional
ACTIVE-to-COMPLETED update; its supporting reference/season/date/age are retained.
Completed records are not rewritten by later reads. Request-key and active-target
uniqueness, plus the root lock, make selection/retries duplicate-safe.
Reusing a request key for another target is rejected.

Abandon is idempotent and has no penalty. If an already-played accomplishment is
verified during abandon, it remains COMPLETED rather than erasing the fact.
Retired Careers retain readable history but cannot change focus/create/abandon.
Restart creates a new save with default focus/no goals; the existing
restart/delete/beta-reset save cascade owns goal cleanup. There is no separate
global/player-owned goal store or change to Classic Tour data.

Maximum milestones have reliable aggregate totals but A7.1 does not expose the
exact threshold-crossing match. Their completion evidence explicitly records
the **confirmation season**, leaves sporting day/date/age unavailable, and the
UI says **Confirmed** rather than inventing a sporting crossing date.
Other goal evidence retains its source's sporting date precision. Where a date
and immutable DOB are available, completion age is derived by the existing A6.5
`ageOn` authority for that date, rather than copying an event's start-age field
and presenting it as completion age. Where either is unavailable, only existing
source age evidence is retained; no sporting date is invented.

There are no rewards: no XP, ability/skill/reputation/ranking points, financial
entries, coins, sponsor bonuses, loot, tokens or unlocks are generated.
Ordinary A3/A4/A5 effects continue independently of whether any goal exists.

## API, ownership and UI

- `GET /api/career/saves/:id/goals`: focus/options/context/recommendations and reconciled goal read model.
- `POST /api/career/saves/:id/focus`: strict focus mutation.
- `POST /api/career/saves/:id/goals`: strict definition/target and request UUID.
- `POST /api/career/saves/:id/goals/:goalId/abandon`: owned lifecycle transition.

All responses are no-store. Writes use the existing authenticated write limiter.
All paths use the established `lockRoot` authentication/feature-flag/ownership/
ACTIVE checks. Save, goal, selected-event and selected-NPC keys are validated.
NPC and event membership is checked inside the selected save, not globally:
deterministic IDs may legitimately repeat between two separately owned universes.
Cross-save-only targets cannot bind to the selected save.
H2H requires a played opponent; Rival/Nemesis requires the present evidenced
label; selected events must be eligible upcoming/entered opportunities.
The client cannot submit completion, progress, reward or hidden ability fields.
No scouting/hidden NPC ability is added to this DTO.

My Career now includes **Focus & Goals** at `/career/:saveId/goals`.
It shows a changeable focus, factual explanations, ordinary event/calendar links,
goal selection, active progress, completed evidence and abandoned history.
Career Home has a compact focus/active-goals/recommended-event summary.
Mutations invalidate the existing per-save query family.
Empty/loading/error/retired states use the established Career components.
Goals do not block creation, advancement, entry or live matches.

## Verification and limits

Verification at this revision:

- Backend goal/facts/relationships/identity model tests: **28 passed**.
- Full A1–A6.5 migration/live HTTP suite, extended for A7.3: **11 passed**.
  Includes legacy defaults/profile gate, all focuses, deterministic reads,
  additive migration of a pre-existing save, invalid/cross-save-only targets, strict client payload rejection, duplicate
  safety, active limit, hidden-feature gating, retired reads, deletion/reset
  cascades, actual played-match goal completion, age/date evidence, idempotency
  ledger-earnings and selected-event/final goals, birthday-sensitive completion
  age, thin supporting records without copied counters, and unchanged
  NPC/event/ledger/ranking/seed state during choices.
- Frontend live recovery, Career models/bot adapter and real Vite SSR UI suite:
  **68 passed**, including 22 screen/API rendering tests and the existing
  no-RPG/no-Classic-Tour/no-invented-client-data guard.
- Changed frontend Career entrypoints and their complete imported dependency
  graph: focused TypeScript check passed (temporary scoped config removed).
- API TypeScript check: **12 existing broadcast diagnostics**, none in the
  changed Career code. This is not an entirely green repository typecheck.
- API production bundle and DB/API libraries TypeScript build: **passed**.

The full frontend application bundle is not certified in this memory-constrained
environment. Focused typechecking and the real Vite SSR screens provide targeted
verification; they are not a physical-browser/mobile-device test.
No mandatory multi-season balance runs, broad optimisation, exhaustive hardening
or production certification were performed.

Other deliberate limits: next-eight-week/current-season recommendation horizon;
direct authored major qualification outputs, not transitive route inference;
numeric target presets in the UI; no separate A7.1 timeline insertion for goals
(completed achievements are retained in Focus & Goals); no exact maximums crossing
date without finer authoritative evidence. No human ageing decline/injury,
reputation, story/legacy system or A7.4 work.

Manual browser checklist (not claims of performed interactions):
open an existing Career and confirm Open Schedule/no required goals; switch each
focus and compare event links/entry denials with the full calendar; select and
abandon a goal; retry selection after a failed connection; play a real opponent
from bull-up through first visit, refresh/leave/resume, settle and inspect the
goal's date/age/reference; switch save slots; inspect a retired save; check narrow
layout and keyboard form use; exercise the existing confirmed admin beta reset.

## Verification commands

```sh
node --test artifacts/api-server/src/lib/__tests__/career-goals.test.ts \
  artifacts/api-server/src/lib/__tests__/career-facts.test.ts \
  artifacts/api-server/src/lib/__tests__/career-relationships.test.ts \
  artifacts/api-server/src/lib/__tests__/career-a65-identity.test.ts

node --max-old-space-size=256 --liftoff-only --wasm-num-compilation-tasks=1 \
  --test --test-isolation=none \
  artifacts/api-server/src/lib/__tests__/career-a65-live.test.ts

NODE_ENV=production node --max-old-space-size=400 --test --test-isolation=none \
  artifacts/tkdl/src/lib/__tests__/career-a65-live-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-bot-adapter.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-ui.test.ts

node --max-old-space-size=512 node_modules/typescript/bin/tsc \
  -p artifacts/api-server/tsconfig.json --noEmit
pnpm --filter @workspace/api-server build
node --max-old-space-size=512 node_modules/typescript/bin/tsc \
  --build lib/db lib/api-zod lib/api-client-react
git diff --check
```

The focused frontend typecheck used a temporary config extending the normal
TKDL frontend config, with the changed Career api/index/model/live-model and
home/goals/live-match entrypoints included. All their imports were checked,
not just transpiled. It ran with a 640 MB Node heap and exited 0. The temporary
config was removed and is not a project configuration change.

## Changed-file manifest

```text
artifacts/api-server/src/app.ts
artifacts/api-server/src/career/goals/model.ts
artifacts/api-server/src/career/goals/router.ts
artifacts/api-server/src/career/goals/service.ts
artifacts/api-server/src/career/goals/types.ts
artifacts/api-server/src/db/migrations/create_career_goals.ts
artifacts/api-server/src/lib/__tests__/career-a65-live.test.ts
artifacts/api-server/src/lib/__tests__/career-goals.test.ts
artifacts/api-server/src/routes/career.ts
artifacts/tkdl/src/features/career/api.ts
artifacts/tkdl/src/features/career/index.tsx
artifacts/tkdl/src/features/career/live-model.ts
artifacts/tkdl/src/features/career/model.ts
artifacts/tkdl/src/features/career/pages/goals.tsx
artifacts/tkdl/src/features/career/pages/home.tsx
artifacts/tkdl/src/features/career/pages/live-match.tsx
artifacts/tkdl/src/lib/__tests__/career-a65-live-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-ui.test.ts
docs/tour-career-a7-3.md
lib/db/src/schema/career-goals.ts
lib/db/src/schema/career-saves.ts
lib/db/src/schema/index.ts
```
