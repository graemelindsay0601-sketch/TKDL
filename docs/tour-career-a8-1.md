# A8.1 — Career World & Content

## Checkpoint and scope

- Starting SHA: `7f47f2ece04eea9a61513c6d85f0eec01ef0deb0`, on `main`.
- Final SHA: the commit containing this document. Its exact SHA is independently verified and supplied in the publication report; embedding this commit's own SHA here would be self-referential.
- Authority: the full A8.1 handover supplied with this task.
- A8.1 only. A8.2, A8.3, A9 and A10 are not started or certified.

## Architecture and authority boundaries

`career/content/world.ts`, `events.ts` and `brands.ts` hold authored, stable content IDs. Content is attached to new v3 event snapshots, rather than replacing the calendar or scoring engines. `content/service.ts` provides owned-save read models, presentation edits, signature launches and the factual trophy cabinet. Its router is mounted in the existing Career router and uses the existing authentication, feature-gate, root-lock, validation and write-rate-limit boundaries.

The content migration runs at the end of `createCareerFinance`, after the contract table exists. It is additive and idempotent, creates immutable signature-product records and removes the obsolete one-active-sponsor index. It does not rebuild saves or backfill fictional results or contracts.

- A1 owns saves, ownership and retirement.
- A2 owns NPC identity, ability, development and retirement.
- A3 owns calendar instances, eligibility, entries, fields, draws and immutable sporting results.
- The shared live/GameScorer boundary still owns playable scoring. No second scoring engine is introduced.
- A4 alone posts money and owns sponsor contracts and payment lifecycles.
- A5 owns rankings, qualification and Tour Cards. New lists use its existing ranking engine.
- A7.1/A7.2 own factual history and relationships; A7.5 owns merchandise/public-life authority; A7.6 owns Legacy and the deliberate season transition.
- A8.1 adds content, factual presentation and compatibility rules, not ability buffs, equipment effects, XP, debt, gambling, NPC wallets or invented history.

## World catalogue and counts

The checked v3 catalogue contains:

| Content | Count |
|---|---:|
| Organisations | 4 |
| Authored circuit descriptors | 22 |
| Countries | 22 |
| Regions | 59 |
| Cities | 64 |
| Authored venue records | 60 |
| Venue families | 15 |
| Trophy design archetypes | 18 |
| Core brands | 36 |
| Local/regional brands | 16 |
| Total brands | 52 |
| Guide entries | 19 |
| Event definitions / canonical IDs | 92 |
| Distinct calendar family strings | 55 |
| Executable definitions | 70 |
| Initial NPCs in a new world | 340 |

The 36 core brands include the 35 prescribed brands plus the retained legacy Vantage Darts identity. The 60 authored venues are distinct from city/locality-derived grassroots venues; generated club venues are not counted as extra authored records.

For seed `"a".repeat(64)`, season 1 contains **646 scheduled instances**, of which **570 are executable** by the existing A3 capability assessment. All 15 venue families appear in that season. Density-based grassroots placement can vary by seed, so 646 is a measured fixture count, not a promise for every season.

The four organisations are World Darts Union, International Open Darts Federation, Vault Darts and Youth Darts Association. Circuit descriptors distinguish grassroots, county/regional, open/international, Challenger, Q-School, professional floor, Continental stage, majors, Palace, Vault floor/stage, Foundation, Development, youth championships and women's pathways. Guide/almanac content explains access, season rhythm, money and optional progression without imposing a professional career.

## Geography and venues

Stable country, region, city and venue references include the Scottish local foundations and broader UK, Irish, European, Asian, North American and Australasian locations. Venues carry type/family, city anchor, atmosphere, capacity description, presentation tier and location relationships.

The Palace resolves to **Alexandra Grand Hall**, with the **Sovereign Trophy** and a distinct World Championship prestige class. The venue families include clubs, community halls, sports centres, professional-floor spaces, theatres, hotels/conference spaces, studios, exhibition halls, arenas and the Palace.

World/region/local map reads are backed by A3 calendar data. Region scope uses the home region; local scope uses its city and is deliberately narrower. Explicit country/region/city filters and week ranges are validated. City anchors are approximate, not surveyed venue coordinates.

The frontend exposes World, Guide, World Map, Players & Presentation and Trophy Cabinet views. The map offers world/home-region/home-locality filtering while retaining a separate world-level prestigious-event section. Inaccessible events remain visible with factual denial and qualification explanations. This is a functional content/map list foundation, not the final A8.3 visual map.

## Events, fields and trophies

Important v3 allocations include:

- Pro Tour: 28 floor events; Challenger: 20; Continental Series: 12; World Series: 6.
- Vault: 14 paired floor events, 5 stage nights and its championship. Legacy Vault Series Nights/Masters duplicates are removed only from v3.
- Women's Tour: 18 events plus Masters and World Championship.
- Development Tour: 12 events, alongside Foundation, Youth Masters and Youth World Championship.
- Local town opens, regional classics, national and international opens, Premier Open and Open International Championship provide amateur-valid alternatives.

Existing eligibility, invitation, qualification, field-strength, seeding and match-profile primitives remain authoritative. Added women's, youth and open ranking categories/lists use A5; old event versions keep the old rules. A new world exposes nine ranking lists; a v2 world retains six.

Women's-category declaration enables dedicated women's entry without excluding mixed/open competition. Women's NPCs are ordinary A2 participants, not a separate simulation: 80 founding participants and a 20-person annual intake in player database v2. Foundation remains under 18; Development/youth rules use the authored under-23 limits. Age does not erase earlier results.

Event metadata distinguishes permanent championships, recurring events, rotating venues, occasional specials and a retirable minor. Canonical event identity is independent of title-sponsor branding. Reusable trophy designs have separate canonical championship trophy IDs. The cabinet uses only actual A3 human champion results, preserves repeated wins, labels qualifier classifications and never invents historical champions.

The Grand Championship uses an explicitly supported knockout fallback because A3 does not support its desired group structure. Unsupported legacy specials remain visibly capability-limited; they are not represented as executable matches.

## NPC identity and public directory

Player database v2 applies country/region-aware fictional name pools only when generating new people. Existing NPC IDs, names, nicknames, ability, potential, development and stored histories are not rewritten. Authored templates keep their identity.

Names use deterministic identity-only RNG streams; crowded pools extend with compound surnames and then middle initials rather than numeric names. Nicknames are curated and sparse. A bounded 5,000-person synthetic name-pool test checks determinism and uniqueness; it is not a multi-decade simulation certification.

The paginated directory exposes public names, locations, status, history links and factual-stature commercial content. It does not expose hidden ability/potential/development. NPC brand allocations explicitly identify themselves as non-financial metadata, not fictional bank accounts or executed contracts. Actual NPC signature-product histories are not fabricated.

## Sponsor portfolios and A4

The portfolio supports equipment, apparel, primary commercial, secondary commercial and local/regional partnerships. A factual-stature cap varies from two to five contracts; slot and competitor/exclusivity rules still apply within that cap.

Acceptance requires current authoritative sporting facts. Compatible contracts coexist. Conflicting acceptance is rejected unless the request explicitly identifies owned active contracts to replace; only those named contracts end. Foreign or stale replacements fail atomically. Retries neither repay bonuses nor silently terminate other contracts.

Apparel/equipment competitors and brand exclusivity use stable groups. Existing single contracts receive an inferred valid relationship without changing stored terms. Accepted brands cannot be repeatedly reoffered for another signing bonus in the same season.

All active contracts participate in A4 payments, reviews, completion, retirement and renewal handling. Entry/travel/accommodation coverage takes the best applicable coverage rather than stacking percentages. Ledger attribution identifies the responsible contract. The representative cached sponsor remains compatible with older surfaces, but it is not the portfolio authority.

## Presentation and signature products

Presentation uses safe nickname, shirt template and palette inputs. Active saves can edit in the season-opening week; retired saves remain readable but immutable. Placement comes from actual contract categories. These changes do not touch age, ability, scorer, RNG, balance or calendar progression.

Human signature darts require a compatible active equipment contract, actual sporting achievement and an active A7.5 merchandise agreement. Signature ranges additionally require recorded A4 commercial income of at least £1,000 and stronger sporting demand.

Records store manufacturer, product identity, launch season, contract and eligibility evidence. Launch is retry-safe and immutable; product status is derived from the underlying contract and save. Products become legacy when the contract ends or the save retires. They do not post money, invent royalties or grant ability. A7.5 displays the same recorded products; existing merchandise payments remain A4-owned.

## Save/version compatibility

- New roots use event database v3 and player database v2.
- Existing root version pins are preserved; v1/v2 catalogues and established snapshots are not mutated.
- Compatibility hashes captured from the mandatory baseline cover old calendar and world generation.
- Read-only world content, map, presentation, directory and trophy reads leave an established v2 world unchanged, including its stored NPCs/events/root.
- Missing old cosmetic data gets safe display defaults. Old snapshots do not acquire invented title-sponsor history.
- Old one-contract terms and ledger records remain valid. Migration reruns do not reduce a valid new portfolio to one contract.
- The full A1–A7.6 live regression fixture is deliberately pinned to event v2/player v1, reproducing its published universe. New v3/v2 behavior has separate service and HTTP coverage.
- No Classic Tour implementation files are changed.

## Verification

**181 selected tests passed, zero failed**:

| Test scope | Passed |
|---|---:|
| Content, Legacy, life, world and identity pure-model files | 74 |
| A8.1 service/PGlite/HTTP integration | 11 |
| Career screen/model SSR tests | 60 |
| A1 save/session/restart tests | 18 |
| Focused A4 balance/ledger/entry/refund regressions | 4 |
| Complete A1–A7.6 live regression file | 14 |

Commands, run from the repository root:

```sh
node --max-old-space-size=256 --test --test-isolation=none \
  artifacts/api-server/src/lib/__tests__/career-content.test.ts \
  artifacts/api-server/src/lib/__tests__/career-legacy.test.ts \
  artifacts/api-server/src/lib/__tests__/career-life.test.ts \
  artifacts/api-server/src/lib/__tests__/career-world.test.ts \
  artifacts/api-server/src/lib/__tests__/career-a65-identity.test.ts

PG_NODE="node --max-old-space-size=256 --liftoff-only --wasm-num-compilation-tasks=1"
$PG_NODE --test --test-isolation=none artifacts/api-server/src/lib/__tests__/career-content-service.test.ts
$PG_NODE --test --test-isolation=none artifacts/api-server/src/lib/__tests__/career.test.ts
$PG_NODE --test --test-isolation=none \
  --test-name-pattern='A1 start balance|ledger is integer|entry charge and sporting entry|withdrawal refunds' \
  artifacts/api-server/src/lib/__tests__/career-finance.test.ts

node --max-old-space-size=320 --liftoff-only --wasm-num-compilation-tasks=1 \
  --test --test-isolation=none artifacts/api-server/src/lib/__tests__/career-a65-live.test.ts

NODE_ENV=production node --max-old-space-size=400 --test --test-isolation=none \
  artifacts/tkdl/src/lib/__tests__/career-ui.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts

node --max-old-space-size=512 node_modules/typescript/bin/tsc -p artifacts/api-server/tsconfig.json --noEmit
node --max-old-space-size=640 scripts/check-career-types.mjs
NODE_OPTIONS=--max-old-space-size=512 pnpm --filter @workspace/api-server build

NODE_ENV=production artifacts/api-server/node_modules/.bin/esbuild \
  artifacts/tkdl/src/features/career/index.tsx --bundle --platform=browser \
  --packages=external --format=esm --alias:@=./artifacts/tkdl/src \
  --outfile=/tmp/a81-career-ui.js
git diff --check
```

API type checking and scoped Career frontend type checking reported zero diagnostics. The API production build and scoped Career browser bundle succeeded. The scoped browser bundle externalizes packages and is not a substitute for a complete Vite build.

Two whole-app frontend Vite attempts did not complete: one exceeded its five-minute shell limit; the production-mode attempt remained in transformation and was stopped. No successful full-app frontend build is claimed. The complete repository test suite was not run.

## Manual checks and remaining limitations

Automated service/HTTP and SSR equivalents check local opportunities, inaccessible Palace visibility, qualification explanations, region/local separation, distinct Vault allocations, portfolio conflicts/coexistence, existing-world readability, A7.5 products and A7.6 history/season transition. The live suite exercises junior legs, set play, Double Crown double-in/double-out, shared scorer sessions, result acceptance, refunds/payment isolation, concurrency and retirement.

Interactive browser clicks and a Classic Tour playthrough were not performed. Classic compatibility is supported by unchanged implementation files and the retained shared-scoring boundary, not by a claimed manual playthrough.

Deferred work: A8.2 screen polish, A8.3 final geographic map/art/audio presentation, A9 balancing and A10 long-horizon certification. Audio/theme hooks are content metadata, not generated assets. The map uses city-level approximations. NPC commercial metadata is not a contract/payment simulation. Group-format support is not added. The incomplete full-app frontend build remains a verification limitation.

## Publication

The publication procedure compares the uploaded Git tree to the local committed tree, creates an exact matching commit, updates `main` without force and independently rereads the remote ref/commit/tree. Exact final SHA, clean-worktree and divergence results belong in the accompanying final publication report.

**STOP after A8.1.**
