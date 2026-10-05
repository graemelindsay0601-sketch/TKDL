# A7.4 Reputation & Recognition

Starting current main: `b3894549c621562efd464794f3ee2e59d6ae9622`.
The connected GitHub API confirmed this exact remote SHA; the clean local
checkout was fast-forward checked against it. A7.3 is present and complete.
Terminal Git authentication is unavailable; publication uses the connected
GitHub integration. This milestone implements A7.4 only, not A7.5.

## Purpose and boundaries

Recognition interprets public sporting achievements. It is neither ability nor
an XP system, currency, grind bar, popularity measure, progression requirement
or sponsor gate. The five contexts are independent: LOCAL, AMATEUR, PROFESSIONAL,
MAJOR_STAGE and INTERNATIONAL. Their ordered vocabulary is Unknown, Known,
Established, Highly regarded and Elite.

A long-term amateur Career can be elite without any professional recognition
or Tour Card. Turning professional remains optional. No age multiplier, decay,
current-form penalty or hidden NPC attribute enters the model. Earned titles,
ranking highs and Card awards retain historical meaning after poor results,
Card loss or retirement.

## Existing authorities

- **A3:** completed event results; actual played attendance; qualification entitlements;
  event-instance circuit/classification/tier and the save-version's authored catalogue.
- **A4:** unchanged. Recognition does not read finances as prestige, pay rewards,
  alter sponsor eligibility/offers/contracts or invent commercial attention.
- **A5:** published World Ranking snapshots and factual Tour Card awards.
  Ranking money, calculation, qualification and Q-School remain authoritative there.
- **A6.5:** untouched scoring/session/bot/RNG authorities. No recognition dependency.
- **A7.1:** human results, factual dates and public sporting history are reused;
  no copied title, finish, match or performance counters are persisted.
- **A7.2:** actual human played meetings establish attendance; existing Rival/Nemesis
  labels and meeting/event/season counts provide factual optional relationship copy.
  Recognition does not recalculate H2H or change relationship labels.
- **A7.3:** focus and goal state are not recognition inputs. Completing a goal
  contributes nothing beyond its independently authoritative sporting achievement.

## Deterministic interpretation

The following numbers are developer-facing interpretation constants only. They
are not returned in the public DTO or displayed as scores, targets or meters.
The five bands use internal thresholds 0 / 3 / 15 / 40 / 80.

| Context | Main public result sources | Title interpretation |
| --- | --- | --- |
| Local | Grassroots, county | Grassroots 8; county 12 |
| Amateur | County, regional, national amateur, Vault, Challenger | County 8; regional 12; others 20 |
| Professional | Pro Circuit, European Series, major, World Championship main events | 20; authored major 28; World 45 |
| Major / Stage | Authored TELEVISED, MAJOR or WORLD main events | Televised 12; major 28; World 45 |
| International | European Series, World Series, World Championship main events; authored international stage/major/World events | 18; major 28; World 45 |

Finals contribute 5, semi-finals 3, quarter-finals 1 in their applicable contexts.
Actual played appearances contribute 1 each, capped at 6 per context over the
entire Career. Repeated participation/first-round losses alone can become Known,
but cannot become Established.

Direct EVENT_ENTRY/STAGE_ENTRY qualification to a known authored target contributes
3 in that **target's** contexts, capped at 6. Unknown/family-only SERIES_ACCESS
targets are not inferred. A qualifier result is never presented as attendance
or victory at its target major/World event. Local/amateur qualifier titles have
limited weight (3); they do not generate professional/stage/international title
recognition from their source circuit or cosmetic tier.

Tour Card awards contribute at most 5 professional recognition in total.
Retentions/regains are factual supporting history, not repeatable point awards.
Published World rankings contribute the historical maximum interpretation:
top 128 = 3, top 64 = 8, top 32 = 15, top 8 = 24, number one = 35.
A later weaker ranking does not erase this earned recognition. Public ranking
snapshots are consumed, never recalculated.

Duplicate facts are deduplicated by source ID/category. Stable fact sorting and
context tie-breaking make outputs independent of input ordering and repeated reads.
The UI shows up to four representative, traceable supporting facts per context;
these are not a second lifetime statistics engine.

## Career standing

Standing is a contextual description, not another numeric score. Significant
major-stage plus international recognition yields an international stage
performer description. Otherwise the strongest contextual band supplies a
grounded domain description such as Elite amateur or Established professional.
Equal bands use the fixed Local / Amateur / Professional / Major-stage /
International context order, not professional status as a master dimension.
Unknown contexts yield “Building a sporting record”, never a failure label.
The Hub highlights at most the strongest two contexts.

## Historical milestones and persistence decision

**No schema changes, new migration, persistent reputation counters, or unrelated
database/content/scorer version bump.** Existing saves need no reset or backfill.
Recognition is a read-only interpretation of their existing full history.

Significant first band crossings are reconstructed from contributing public
facts, with stable IDs `recognition:<context>:<level>`. No wall-clock date or
random UUID is involved. Facts on the same sporting day are grouped; a jump to
a higher band produces only that attained band, not a burst of intermediate
notifications. If a context contains Card/ranking weekly evidence, all of that
context's crossings are grouped by Career week and have no invented day, date
or age. A wholly day-precise context retains its source date and completion age
derived through A6.5 `ageOn`, not an event's stored start-age.

Qualification awards do not always have an exact award week/day. If any relevant
contribution has only a season, that context still derives current standing but
does **not** claim first-crossing milestone dates. It does not assign such a
milestone the day on which this read happened. This conservative rule also
applies to future reads with incomplete chronology.

Milestones are exposed on Recognition and in a separate Recognition threshold
history panel within the existing My Career Timeline tab. A7.1's sporting timeline
DTO/authority is not rewritten. Repeated reads cannot insert or recreate records:
there is no milestone writer or notification generator.

Retired human and NPC records remain readable from their sporting history. Reads
create no active progression. Normal restart/delete/beta reset needs no new
cascade: the existing save-owned source data remains the only authority.

## NPC public recognition

`GET /api/career/saves/:id/recognition/npcs/:npcId` derives ONE owned NPC on demand.
It uses public A3 results and actually played attendance, A5 snapshots/Card
awards and A3/A5 entitlements. It is not restricted to human meetings or only
champion summaries. There is no weekly scan/persistence of all NPC reputations.
NPC identity comes from the explicit public A7.2 projection. No ability,
potential, development, form, RNG seed or hidden tier reaches the DTO. NPC
result/attendance facts do not incorrectly use the human DOB for NPC age.

## API, UI and security

- `GET /api/career/saves/:id/recognition`
- `GET /api/career/saves/:id/recognition/npcs/:npcId`

Both return `Cache-Control: no-store` and require authenticated users, the
existing feature/admin-test gate, validated IDs and save ownership. NPC membership
is resolved in the selected save, not globally: deterministic NPC IDs can recur
legitimately in distinct universes. Foreign-only identities cannot bind to it.
There is no POST/PUT/PATCH/DELETE recognition endpoint.

The existing root lock serializes the composed A7.1/A7.2 snapshot with sporting
writers. A transaction executor adapter keeps the composition in ONE outer
transaction rather than independent nested transactions. Additional selectors
read only public A3/A5 evidence with save and participant predicates.

My Career adds Recognition at `/career/:saveId/recognition`, with five contextual
badges, standing, source evidence/event links, recent milestones and optional
existing sporting rivals. Public NPC pages are reachable from opponent panels
and the world-player list. The dark Career shell is retained, with readable
empty/loading/error/retired states, wrapping grids and ordinary keyboard links.
No scores, points targets, progress meters, gameplay controls or visual overhaul.
Per-save React Query keys share the read model; existing mutations invalidate
the save family, keeping recognition current.

Sponsorship/invitations/exhibitions remain presentation consumers for future
deliberate work. This milestone issues no invitation, creates no event, bypasses
no qualification and changes no sponsor offer or economics.

## Verification

Final targeted verification:

- Backend recognition/facts/relationships/goals/identity models: **49 passed**,
  including 21 new recognition tests.
- Full A1–A6.5 migrations/live HTTP suite extended through A7.4: **12 passed**.
  The new API test compares every save-owned source table and the entire save
  before/after human and NPC recognition reads. It verifies actual existing and
  retired history, fresh/profile-incomplete reads without reset, factual owned
  evidence, deterministic output, rejected recognition writes, authentication,
  ownership, invalid/foreign-only NPC IDs, feature/admin-test gates and no-store.
  The existing A7.3 test now proves every focus and active/duplicate goals grant
  no recognition; actual played-match goal completion leaves recognition unchanged
  from the underlying sporting evidence. Existing session recovery, scoring,
  settlement, concurrency, finance, sponsor, ranking, lifecycle and reset checks pass.
- Frontend Career models, bot/recovery and actual Vite SSR UI: **73 passed**,
  including five new Recognition tests (27 UI rendering/API tests in total).
- Changed frontend entrypoints and their imported dependency graph: **TypeScript
  passed** with a temporary scoped config and a 640 MB heap; that config was removed.
  Badge colours use the existing typed Career palette.
- API TypeScript: **12 unchanged, pre-existing broadcast diagnostics**, none in
  changed Career code. This is not an entirely green repository-wide typecheck.
- API production bundle and DB/API libraries TypeScript build: **passed**.
- `git diff --check`: **passed**.

The integration fixture's polymorphic JSON UUID arguments were explicitly typed
after PostgreSQL caught an ambiguous test parameter; the full suite was rerun.
The full frontend application bundle and physical-browser/mobile-device testing
are not certified in this memory-constrained environment. No broad balance run,
exhaustive hardening or production certification was attempted.

```sh
node --max-old-space-size=256 --test --test-isolation=none \
  artifacts/api-server/src/lib/__tests__/career-recognition.test.ts \
  artifacts/api-server/src/lib/__tests__/career-goals.test.ts \
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

The temporary frontend config extended the normal frontend config, included the
changed Career api/index/model and recognition/home/history/relationships/facts-panels
entrypoints, and redirected incremental metadata to `/tmp/a74-frontend.tsbuildinfo`.
The imported graph was checked with `tsc --noEmit`, not merely transpiled by Vite.

## Known limitations and deferred work

This is an initial deterministic interpretation, not an exhaustively balanced
multi-season reputation simulation. Recognition evidence is representative
(four facts/context), not a complete results listing; existing History remains
available. It does not infer every transitive qualification route, unrecorded
past achievement, broad “overseas” prestige solely from host country, or generic
series-access target. Junior events retain their actual authored circuit rather
than an invented Junior recognition context.

Incomplete season-only chronology suppresses that context's crossing timeline,
not its current standing. There is no historical milestone persistence/future-only
tracker to fill that evidence gap, no reputation decay, no age/prospect multiplier,
no separate sponsor-sensitive eligibility or new invitation authority.

A7.5 news/stories, A7.6 legacy/season review, A8 content/presentation and A9
balancing remain out of scope. No scoring, ability, ranking, money, Card,
qualification, Q-School or Career-difficulty effect is added.

## Manual browser checklist

These are suggested checks, not claims of completed physical-browser interactions:

1. Open a fresh and an established existing Career; compare recognition evidence
   against History without restarting.
2. Open an amateur-only successful save; confirm meaningful recognition with no
   Tour Card requirement and no meters or numerical reputation.
3. Switch Focus/select/abandon a goal; confirm no recognition change without sport.
4. Play/settle a real event, then inspect recognition evidence and milestone date
   precision; refresh/reopen and compare stable output.
5. Open the Timeline tab and a public opponent page through Relationships.
6. Switch save slots; inspect a retired Career/opponent; check narrow layout,
   keyboard links, loading and an unavailable/error response.

## Changed-file manifest

```text
artifacts/api-server/src/career/recognition/model.ts
artifacts/api-server/src/career/recognition/router.ts
artifacts/api-server/src/career/recognition/service.ts
artifacts/api-server/src/career/recognition/types.ts
artifacts/api-server/src/lib/__tests__/career-a65-live.test.ts
artifacts/api-server/src/lib/__tests__/career-recognition.test.ts
artifacts/api-server/src/routes/career.ts
artifacts/tkdl/src/features/career/api.ts
artifacts/tkdl/src/features/career/index.tsx
artifacts/tkdl/src/features/career/model.ts
artifacts/tkdl/src/features/career/pages/facts-panels.tsx
artifacts/tkdl/src/features/career/pages/history.tsx
artifacts/tkdl/src/features/career/pages/home.tsx
artifacts/tkdl/src/features/career/pages/recognition.tsx
artifacts/tkdl/src/features/career/pages/relationships.tsx
artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-ui.test.ts
docs/tour-career-a7-4.md
```
