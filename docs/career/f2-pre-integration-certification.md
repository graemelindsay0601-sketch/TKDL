# Career 2.0 — F2 pre-integration certification

Branch `career-polish/f2-pre-integration-certification`, from `main` `7aaf493`. E1 (apparel), E2 (trophies) and F1 (atmosphere) remain separate, unmerged branches; F2 did not modify them.

**Headline:** two P0 startup-schema defects on `main` block release (a fresh install cannot create a Career; guaranteed sponsor payments crash the weekly advance). Both have exact one-file fixes below for the integration owner. Everything else found is P1/P2 or a bounded integration change.

## 1. How this was verified

| Tool (dev-only, not shipped) | What it does |
|---|---|
| `artifacts/api-server/scripts/career-certification-server.ts` | Serves the built TKDL UI with the **production Career route composition** (mirrors `routes/career.ts`) over PGlite, signed-in fixture player. Applies the **exact `app.ts` Career migration order**. Seeds: new save, season save (Q-School, local wins, pro losses, a sponsor), legacy save pinned to event database **v2 before the A9 upgrade**, retired save. `--repair-missing` applies the proposed P0-1/P0-2 fixes. `--quick` stops the season save at week 20. |
| `artifacts/api-server/scripts/career-certification-journeys.mjs` | The 13 release journeys over HTTP (same routes as the UI). Reports PASS/FAIL/PARTIAL; never counts a skipped step as passed. |
| `artifacts/tkdl/scripts/career-screen-audit.mjs` | Opens every Career route by direct URL (deep link) at 390 and 1440 px; records console/page errors, failed API calls, broken images, overflow and offenders, CLS, image bytes, unlabelled controls; screenshots. |
| `artifacts/tkdl/scripts/f2/run-combined-certification.sh` | Builds a throwaway worktree of `main + E2 + F1` (never pushed) and runs E2, F1 and the F2 contract test together. |

Reproduce locally (no Docker needed):
```sh
cd artifacts/tkdl && pnpm run build
cd ../api-server && node scripts/career-certification-server.ts --repair-missing --quick --data=/tmp/cert-db   # http://localhost:8790/career
node scripts/career-certification-journeys.mjs --out=/tmp/journeys.json
cd ../tkdl && node scripts/career-screen-audit.mjs --out=/tmp/audit
```
Without `--repair-missing` the harness reproduces P0-1 (it stops while creating the first Career).

**Why the documented local preview was blocked:** `DEVELOPMENT-PREVIEW.md` starts a fresh Docker PostgreSQL and runs the `app.ts` startup migrations. On a fresh database P0-1 makes every Career creation fail with `relation "career_npc_sponsor_market_events" does not exist`, so authenticated Career testing in the local preview cannot get past save creation. No process was terminated; the harness uses its own port (8790) and refuses nothing else.

<!-- SECTIONS:AUDIT -->

## 6. Integration contract (matrix)

Shared files named here are **not** edited by F2; each row is a bounded change for the integration owner.

| System → consumer | Current source component | Replacement / adapter | Required props & IDs | Source of truth | Historical compatibility | Shared-file edit | Regression test | Visual acceptance |
|---|---|---|---|---|---|---|---|---|
| **E1 shirt renderer** → player cards, profile, tournament | `CareerShirt` (`identity.tsx`) used by `kit-customizer.tsx`, `tournament/components.tsx` (Tale of the Tape, Walk-on), `pages/saves.tsx`, `pages/tournament.tsx`, `pages/rankings.tsx`; `CareerPlayerCard` in `home.tsx`, `world-hub.tsx`, `legacy/components.tsx` | `PremiumCareerShirt` (E1 `apparel/premium-shirt.tsx`) behind the existing `CareerShirt` signature | `identity: ShirtIdentity` (`kitDesignId`, colours, `kitTintEnabled`), `sponsors: {brandName, slot, brandId?}[]`, `name`, `scale` | `/profile` presentation + contract slots | **Gap E1-1:** `PremiumCareerShirt` falls back to `kit-50-01` when `kitDesignId` is absent; saves that only stored `shirtTemplate`+colours change appearance. Keep the template SVG for saves without `kitDesignId`, or migrate explicitly. | `identity.tsx` `CareerShirt` delegates to E1 | E1 `career-apparel.test.ts` + a legacy-save snapshot (no `kitDesignId` → template shirt) | 390/1440: shirt never clipped in cards; sponsor marks inside print zones |
| **E1 NPC wardrobe** → NPC cards, directory, profiles, rivalries | Server `npcShirt()` (`content/visual.ts`) → `{shirtTemplate, colours}`; NPC profile/rivalry pages (`pages/player-profile.tsx`) render **no shirt** | `stableNpcKitDesignId(npcId, saved)` (E1 `apparel/npc-wardrobe.ts`) | `npcId` (A2 world id), optional saved `kitDesignId` | **Gap E1-2:** two sources (server palette vs client kit hash). Choose one: server returns `kitDesignId` from the same FNV hash, or every client consumer calls `stableNpcKitDesignId` | Hash over `npcId` is stable; pool frozen to first 50 kits | `identity.tsx` + `player-profile.tsx` + `world-hub.tsx` | Same id → same kit across directory, profile, rivalry, tournament | NPC profile and rivalry show the NPC's shirt (P1-5 today) |
| **E1 branding** → Sponsor HQ, offers, kit printing | Text brand names (`sponsor-offer-card.tsx`, `world.tsx`, `kit-customizer.tsx`) | `CareerSponsorMark({brandId, brandName, slot, theme})` | **Gap E1-3:** payloads carry `brandName` + `slot` only; `brandId` absent from tournament `field[].sponsors`, profile and contract reads → marks fall back to name matching | Sponsor catalogue key (`sponsor_key`) | Name fallback must never invent a mark for an unknown brand | Server reads add `brandId: sponsor_key`; E1 already edits `content/service.ts` (kit id validator) — coordinate | Mark resolves for every catalogue sponsor; unknown brand → text | Marks legible at 390; no placeholder logos |
| **E2 premium trophies** → arrival, victory, cabinet, honours | `CareerTrophy` (basic SVG, `identity.tsx`) at: `tournament/components.tsx` (`TournamentHero`, `CompletionSummary`), `legacy/components.tsx` (two shelves), `pages/world-hub.tsx` (event detail), `pages/world.tsx` (`TrophyPage`) | `AwardPresentation` (E2) | `event: {definitionKey, circuit, classification}`, `persistedTrophyId = content.trophyId` | `career_event_results.is_champion` (cabinet), tournament read | Persisted family ids shown as recorded; v1 pinnable | `identity.tsx` `CareerTrophy` → `PremiumTrophy`; six call sites → `AwardPresentation` | `scripts/f2/e2-f1-contract.test.ts` (cabinet rows by actual key) | Weekly/qualifier wins show **no** trophy (today they do: P1-1) |
| **E2 award policy** → results & historical achievements | `legacy/player.ts` `Moment` = `{kind,label,detail,season,eventId,tier}` | `resolveAward({definitionKey,circuit,classification})` | **Gap E2-1:** `Moment` drops `key`/`circuit`/`classification` though `Result` has them | `career_event_results` via legacy evidence | n/a (read model) | Server: add `definitionKey`, `circuit`, `classification` to `moment()` in `legacy/player.ts` | Documentary/honours rows resolve the event's own award | Honours never show a design from another event |
| **E2 cabinet data** → `TrophyPage`, shelves | `/trophy-cabinet` rows `{canonicalEventId, circuit, classification, trophy}` | as above | **Gap F1-2:** rows lack `eventClass`/presentation tier, so F1 can only use circuit (televised opens would read National, not Stage) | instance snapshot content | — | Server `content/service.ts trophies()` add `eventClass`, `presentationTier` (E1 also edits this file — coordinate) | — | — |
| **F1 atmosphere** → arrival, walk-on, champion reveal, documentary | `TournamentHero` uses `CareerVenueArtwork` at 32% opacity; `ArrivalCeremony`, `WalkOn`, `CompletionSummary`; `Documentary` | `CareerEventAtmosphere`, `CareerMomentScene` | `atmosphereFromTournament(v.event)`; `animate = v.depth.animate`; gate arrival on `v.depth.arrival`, walk-on on `v.depth.walkOn`; victory only when `v.phase === "CHAMPION"` / `achievements.tournamentChampion` | tournament read (`level`, `content.eventClass`, `venue`) | Missing metadata → neutral plate, no venue name | `tournament/components.tsx`, `legacy/components.tsx` | `scripts/f2/e2-f1-contract.test.ts` | WC → Palace plate; loss → no confetti; QUICK/reduced motion → static |
| **F1 ceremony depth** | — | — | **Gap F1-1:** no prop maps `depth.fullCeremony`; a STANDARD-mode Major win would still get full pyro | — | — | F1: add `ceremony="full"|"reduced"` | contract test `todo` | — |
| **Existing systems** → navigation, season review, retired saves | `model.ts CAREER_NAV` (14 items incl. Sponsor HQ), `pages/legacy.tsx` season reviews, retired gating in each page | unchanged | — | — | Retired saves read-only (journey J13) | none | nav tests restored (14 items) | — |

### E1 integration acceptance checks (do not duplicate E1's own tests)
1. Every `kitDesignId` the server accepts (`kit-50-01…50`, `kit-pro-01…10` after E1's validator change) resolves to an existing file under `public/assets/career-kit-library/` with exact casing; no 404 in the screen audit.
2. A save without `kitDesignId` renders the same shirt before and after E1 (Gap E1-1 decision recorded).
3. The same NPC id renders the same kit in directory, profile, rivalry and tournament (Gap E1-2 resolved to one source).
4. Sponsor marks: every catalogue `sponsor_key` resolves a mark; unknown brands render text only; no mark outside its print zone (`printZonesAreSafe`).
5. Screen audit at 390 px: no new horizontal overflow on Home, Kit Room, Sponsor HQ, tournament hub, rankings.
6. Image bytes per screen do not regress more than the new kit art adds (kit library is ~70 KB/design).

## 7. Release blocker register

| ID | Pri | Issue | Evidence | Owner | Exact fix / verification |
|---|---|---|---|---|---|
| **P0-1** | P0 | Startup no longer runs `createCareerSPHCommercial` / `createCareerNpcSponsorMarketSPF` (dropped in `5c51822`, a local-preview hardening commit). Fresh installs lack 4 tables; **creating a Career fails** (`world/service.ts:122 → persistInitialNpcSponsorRelationships`); NPC sponsor market and commercial inbox reads fail. Existing databases created before `5c51822` still have the tables. | Harness without repair stops at the first save; `career-startup-schema-f2.test.ts` (`todo`) lists the 4 tables. | Integration owner (`app.ts`) | Restore in `initSchemaAndData()`: `runMigrationStep("createCareerSPHCommercial", …)` after `createCareerFinanceA4`, and `runMigrationStep("createCareerNpcSponsorMarketSPF", …)` after `createCareerSponsorHQSPD` (both `IF NOT EXISTS`, safe on existing DBs). Then remove `todo` from the test. |
| **P0-2** | P0 | `upgradeCareerContentA9V1` re-runs the A4 `createCareerFinance`, which drops/re-adds `career_finance_entries_category_check` **without** `SPONSOR_GUARANTEED_PAYMENT` / `SPONSOR_RELEASE_SETTLEMENT`, after SP-C/SP-E2 widened it. Run-once steps keep it narrowed. Weekly advance then throws (`finance/engine.ts postDueGuaranteedPayments`) for any save with a guaranteed retainer: the Career cannot advance. | Harness crash at week 10 (`violates check constraint`); real-schema replay `career-startup-ledger-f2.test.ts` (`todo`). | Integration owner (migrations) | Either make the A4 migration's constraint list the full SP-E2 set, or add a new keyed step after A9 that re-applies the SP-E2 constraint (`createCareerSponsorContractActionsSPE2` is idempotent). Verify on a DB where A9 already ran: production databases whose A9 ran after SP-C are currently broken for retainers. |
| P0-3 | P0 → **resolved in F2** | ~80 core Career API tests (A2 world, A3 calendar, A5 sporting, A6 HTTP, A9 upgrade) failed on `main` because their setups went stale (SP-F tables; A5 ranking tables now read by A3 settlement; pre-SP-G install simulation; sponsor catalogue v5). Sporting/calendar regressions were undetectable. | API suite on `main`: 79 failures. | F2 (tests only) | Fixed: setups updated. API suite now: see §8. |
| P1-1 | P1 | Weekly club and qualifier wins display a championship trophy (`CareerTrophy` for every title) in the cabinet, `CompletionSummary`, honours shelves. E2 policy says result-only. | Code: `world.tsx TrophyPage`, `tournament/components.tsx CompletionSummary`. | Integration (E2) | Replace with `AwardPresentation`; contract test cabinet case. |
| P1-2 | P1 | Sponsor offers can be shown that cannot be accepted (required activities have no non-overlapping schedule). At week 9, across two seeded runs, 3 of 4 and then 5 of 6 offers were refused with a technical 409 message surfaced verbatim in Sponsor HQ. | Harness seed log; `finance/engine.ts acceptOffer`. | Sponsorship (finance) owner | Pre-check schedulability when generating/reading offers and mark or hide unacceptable offers; plain-language reason. |
| P1-3 | P1 | Documentary/honours `Moment` lacks `definitionKey/circuit/classification` (Gap E2-1) → E2 cannot resolve awards there. | `legacy/player.ts moment()` | Legacy (D) owner | Add the three fields from `Result`. |
| P1-4 | P1 | F1 cannot honour `depth.fullCeremony` (Gap F1-1). | contract test `todo` | F1 owner | Add a ceremony cap prop. |
| P1-5 | P1 | NPC profile and rivalry pages show no NPC artwork (no shirt/card). | `pages/player-profile.tsx` | Integration (E1 wardrobe) | Render the E1 NPC shirt in the profile header. |
| P1-6 | P1 | Brand identity data gap (Gap E1-3): no `brandId` in player/contract payloads. | Read shapes | Integration (E1) + server | Add `brandId` (= `sponsor_key`). |
| P1-7 | P1 | Legacy shirt appearance changes under E1 (Gap E1-1). | E1 `premium-shirt.tsx` fallback | E1 owner | Decide and test legacy behaviour. |
| P2-1 | P2 → **resolved in F2** | Palace venue plate shipped as a 1.2 MB PNG (5.7× any other plate) on the venue atlas and WC tournament hero. | `public/images/career-venues/` | F2 | Now a 71 KB WebP (same 1024² image); size guard in `career-venue-atlas.test.ts`. |
| P2-2 | P2 | Broadcast `StudioSet` hard-codes `/broadcast/studio/*.webp` (ignores Vite `BASE_PATH`). Career assets are base-path safe (verified with a `/tkdl-sub/` build). | `features/broadcast/presenters/StudioSet.tsx:63` | Broadcast owner | Prefix with `import.meta.env.BASE_URL`. |
| P2-3 | P2 | Two broadcast unit tests fail on `main` (`serializeSegment`, `selectSeasonReviewRunningOrder`) — outside Career. | API suite | Broadcast owner | Investigate separately. |

<!-- SECTIONS:REGISTER-AUDIT -->

