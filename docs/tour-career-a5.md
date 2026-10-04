# Career 2.0 A5: Rankings, Tour Cards, Q-School and sporting status

A5 builds on the locked A4 checkpoint `5511c8f` on `feature/tour-career-2-foundation`. It makes one module, `artifacts/api-server/src/career/sporting/`, the single authority for Career rankings, Tour Cards, Q-School, qualification and seeding facts, and sporting milestones.

There is **no XP, no level, no tier-unlock score and no player-favouring logic**. Progression is sporting: results produce A4 prize facts, those produce ranking money, and ranking money, results and Q-School produce Tour Cards and qualification. The normal pathway (local → county → regional → national/Challenger/Vault → Q-School → Tour Card → Pro Circuit → majors → World Championship) is common, never mandatory.

## Authority boundaries

| Phase | Owns | A5 relationship |
| --- | --- | --- |
| A1 | Saves, lifecycle | `has_tour_card` and `professional_ranking_money_pence` become display caches A5 keeps in sync; restart/delete cascades every A5 row |
| A2 | NPC ability, form, development, aging, retirement | Untouched. A5 never reads ability or potential and never changes NPCs. Retirement is consumed (see below) |
| A3 | Events, entries, draws, matches, results, entitlements | A3 calls A5 through providers and hooks; A5 never invents or alters results. A3 still makes and locks every draw |
| A4 | Career money, prize cash, ranking-eligible amounts, sponsorship | A5 reads A4's immutable prize tables and the human's `ranking_eligible_pence`. A5 never moves money. A4 sponsorship reads A5 facts |
| **A5** | Rankings, contributions, snapshots, Tour Cards, Q-School standings and allocation, qualification/seeding facts, sporting milestones | |

### Narrow A3 integration changes

- `providers.ts`: `CalendarSportingHooks` (`bind`, `onEventCompleted`, `afterWeek`, `onCalendarMoved`), plus two optional `SportingStatusProvider` methods (`npcProfessionalStatus`, `selectionTier`).
- `engine.ts`:
  - NPC professional status comes from the provider;
  - field-selection tier weighting goes through `selectionTier`;
  - `completeEvent` calls the sporting hook after A4's prize processing.
- `selection.ts`: `tierWeight` accepts a tier function.
- `service.ts`:
  - each transaction binds A5 state after the root lock (`bind`);
  - `afterWeek` runs in the transaction that marks a week played;
  - `onCalendarMoved` runs when the clock moves.

**Why `selectionTier` exists.** A3's authored participation weights assume "professional tier = card holder". With real Tour Cards, a card-less professional would never be picked for Q-School, and a carded amateur-tier NPC never for the Pro Circuit. `selectionTier` affects only who is likely to *enter*; it never touches ability or results:

- card holders count as at least `PROFESSIONAL`;
- professional-ability players without a card count as `AMATEUR`.

Without A5 (the A3-only tests), A3 behaves exactly as locked.

## Composition

`createCareerSportingService(db)` builds the one Career composition that `routes/career.ts` serves:

- the A3 calendar, carrying the A4 finance hooks and the A5 status, seeding and sporting hooks;
- A4 finance, whose sponsorship facts come from `createSportingFactsProvider`.

`career.initialize` runs, in order: A1 save → A2 world → A3 calendar → A4 finance → A5 state and founding cards. Every step is idempotent.

## Ranking model

**Lists.** `RANKING_LISTS_V1`, under `RANKING_RULES_VERSION = 1`:

| List | Categories (A3 `ranking_category`) | Window | Cut lines reported |
| --- | --- | --- | --- |
| `pro-world`: World Ranking | PRO_CIRCUIT, EUROPEAN_SERIES, PRO_MAJOR, PRO_WORLD_CHAMPIONSHIP | Rolling 104 weeks (2 seasons) | 1, 8, 16, 24, 32, 64 |
| `pro-circuit`: Pro Circuit OoM | PRO_CIRCUIT | Rolling 52 weeks | 16, 32, 64 |
| `european-series` | EUROPEAN_SERIES | Rolling 52 weeks | 16, 32 |
| `challenger` | CHALLENGER | Season | 2, 10 |
| `vault` | VAULT | Season | 8 |
| `amateur` | AMATEUR_LOCAL, COUNTY, REGIONAL, NATIONAL | Rolling 52 weeks | 16, 32 |

New lists such as race lists are data rows, not a new engine.

**Contributions.** `career_ranking_contributions` holds one immutable row per (list, event, participant), with:

- `amount_pence`, `finishing_position`, `season`, `week`;
- `completion_index`, `expires_index`, `ranking_category`;
- `source`, `ranking_rules_version`.

Foreign keys tie each row to the A3 result and the A4 prize table, so every value is explainable (`GET …/rankings/:list/explain`).

The amount is always A4's:

- **Human:** `career_prize_awards.ranking_eligible_pence` (source `A4_PRIZE_AWARD`).
- **NPCs:** the immutable `career_event_prize_tables` band at the finishing position, only when that table is ranking-eligible (source `A4_PRIZE_TABLE`).
- **Cross-check:** the human figure is checked against the table and must match, so the two paths cannot diverge.
- **Non-ranking events:** Specials, exhibitions, invitationals and qualifiers (including all of Q-School) are never ranking-eligible and never contribute.
- **What is never ranking money:** sponsor income, bank balance, expenses and coverage. A5 has no access to the ledger or the balance.

**Clock.** The publication index is `(season − 1) × 52 + week`. A contribution completed at index `C` counts at publication `P` when `C ≤ P < expires_index`:

- **ROLLING:** `expires_index = C + weeks`, so the same week two seasons later drops it.
- **SEASON:** `expires_index` is the first publication of the next season.

**Ranking order and tie-breaks.** Ties are broken in this order, identically for everyone:

1. ranking value (descending)
2. largest single counting contribution (descending)
3. most recent counting contribution (descending)
4. fewer counting contributions (ascending)
5. neutral key `stableUuid(seed, rulesVersion, "ranking-tiebreak", list, participant)` (ascending)

There is no random draw, no ability input and no human preference.

**Active participants.** Only active participants are listed: retired NPCs are excluded from current tables, but their contributions and history remain.

## Publication and snapshots

`afterWeek` publishes each list once per played week, and only when something changed (new contributions or expiries) or a publication is forced at season start (retirements, season-list resets).

- **`career_ranking_snapshots`** (immutable, unique per list and publication index) record:
  - sequence, season and week;
  - participant count;
  - counted, new and expired contributions;
  - retirees removed;
  - values at each cut line;
  - the rules version.
- **`career_ranking_snapshot_rows`** (immutable, unique position per snapshot) record:
  - position and value;
  - previous position;
  - movement (`previous − current`, or `null` with `is_new` for a new entry);
  - gap to the player above and below;
  - career-high position;
  - number of counting contributions.

Movement always compares two authoritative snapshots.

**Current-state cache.** `career_ranking_participants` caches the current state per (list, participant): current, previous and career-high position, and the first ranked index. It is derivable from snapshots, and keeps career highs for players who drop out.

Season highs are queried from snapshot rows. Old snapshots are never rewritten (tested by hash).

## Tour Cards

`career_tour_cards` (`TOUR_CARD_RULES_VERSION = 1`) stores per card:

- participant, source and source detail (event, pathway, position);
- awarded season and week, start and end season, status;
- end reason and end season/week;
- previous card and rules version.

**Integrity guards:**

- a partial unique index makes two live cards per participant impossible;
- a trigger keeps the terms immutable;
- ended cards are history.

**Status.** Statuses are `ACTIVE`, `EXPIRED` (term completed and renewed), `LOST` (outside the retention cut) and `SURRENDERED` (retired). A card is valid in season *s* when it is `ACTIVE` and `start ≤ s ≤ end`.

| Source | Term |
| --- | --- |
| `FOUNDING`: every PROFESSIONAL/ELITE NPC existing when the world is generated (95 with the default seed) | Ends season 1 or 2 by neutral hash (they are mid-term) |
| `Q_SCHOOL_DIRECT` / `Q_SCHOOL_ORDER_OF_MERIT` | Award season + 1 (2 seasons) |
| `RANKING_RETENTION`: card ending this season while inside the World Ranking top 64 at the season-end publication | The next 2 seasons |
| `CHALLENGER_RANKING`: top 2 non-holders of the season-end Challenger ranking | The next 2 seasons |

The human never gets a founding card. The default term (2 seasons), retention cut and Challenger places are config.

**Season review** runs in the week-52 `afterWeek`, after that week's publication. It is idempotent via `reviewed_season` and per-card operation keys:

1. **Renewals and losses.** Cards ending this season are either renewed (retention) or lost.
2. **Challenger cards.** Challenger cards go to the next eligible non-holders.
3. **Q-School exemptions.** Final Stage exemptions for next season go to card losers and Challenger places 3–10. They are issued as **A3 provider entitlements** (`q-school-final:<pathway>`, `SEASON_PASS`): A5 uses A3's entitlement system rather than replacing it.

**Loss and return.** A player can win, keep, lose, return through Q-School or the Challenger ranking, and regain a card. Nothing is scripted.

## Q-School

A3 owns the structure:

- two separate pathways, `UK_IRELAND` and `EUROPE` (one per player per season via an exclusive group);
- a 3-day First Stage and a 4-day Final Stage;
- Final Stage entry by entitlement from First Stage top-16 finishes or A5 exemptions.

Pathway eligibility is by zone, not birthplace: rest-of-world players may use either pathway; exemptions default rest-of-world players to UK & Ireland.

`career_qschool_results` records every Q-School result, with Final Stage points (`Q_SCHOOL_RULES_VERSION = 1`): champion 6, runner-up 5, semi 4, quarter 3, last 16 2, last 32 1.

**Order of Merit.** Derived only from those rows. Ties are broken in this order:

1. points
2. best single-day finish
3. scoring days
4. points on the latest day
5. Final Stage leg difference
6. legs won
7. neutral key `stableUuid(seed, version, "q-school-tiebreak", season, pathway, participant)`

**Allocation.** Persisted once per (season, pathway) when every Final Stage day is finished:

1. Each day's winner earns a card directly, in day order. A repeat winner or a cancelled day leaves that direct card unused, and it **rolls into the Order of Merit**.
2. Order of Merit cards go to non-carded players with at least 1 point: UK & Ireland 10, Europe 6, plus any rolled-over cards.

Allocation is stored in `career_qschool_allocations` (standings snapshot, counts and version) and `career_qschool_card_awards` (route, day or OoM position, card). Retries return the stored allocation; database keys prevent duplicate cards.

## Qualification and seeding

**Bound providers.** `bind(tx, root)` loads, per transaction:

- the save's valid card holders;
- current ranking positions.

It returns:

- **`A5_SPORTING_STATUS`:**
  - `tourCard` and professional status for the human and every NPC;
  - `rankings` by list;
  - `selectionTier`.
- **`A5_RANKING_SEEDING`:** entrants with a position in the requested list, best first.

**What A3 does with them.** A3 evaluates `TOUR_CARD`, `NON_TOUR_CARD`, `PRO_STATUS` and `RANKING` rules with these facts, unchanged. It draws with the seeded order and persists the draw; later ranking movement never changes a locked draw (tested).

**Unbound access.** It sees only the A1 cache for the human and treats NPC facts as unknown (`null`).

**Qualification API.** `GET …/qualification` evaluates each upcoming event's rule tree for the human. For every route it returns structured facts (A6 decides the wording):

- **Ranking routes:** list, cut, position, places outside the cut, gap to the cut in pence.
- **Tour Card routes:** whether the human holds a card.
- **Entitlement routes:** whether the entitlement is held, and which qualifier events grant it.

## A4 integration

`createSportingFactsProvider` supplies A4's existing facts (titles, finishes, qualifications from A3) with A5's Tour Card, professional status and World Ranking. Unknown stays unknown:

- `worldRanking` is `null` only before any World Ranking is published;
- once one is published, an unranked player is reported as outside every position (a known non-qualifying fact).

Facts are never granted because they are missing.

## International behaviour

Nationality affects only geography, travel, participation weighting and pathway zone. It never affects ability or rules, and A5 code never reads ability.

The harness measures nationality and zone shares of ranked players, the top 32, the top 10 and card holders, and enforces no target. NPCs do not relocate in A5: home region is fixed by A2.

## Retirement and the human player

- **Retired NPCs:**
  - surrender any live card at the next season start (`SURRENDERED`/`RETIRED`);
  - a forced publication removes them from current tables;
  - contributions, snapshots and cards are preserved.
- **The human:** no aging decline, forced retirement or injuries. The Career continues until the player retires the save through A1. A retired save remains readable; mutations return 409.

## Milestones (facts, not prose)

`career_sporting_milestones` is immutable, unique per operation key, and records season, week, list and detail.

| Kind | Who |
| --- | --- |
| `FIRST_RANKING_ENTRY`, `ENTERED_TOP_100/64/32/16/8`, `WORLD_NUMBER_ONE` / `RANKING_NUMBER_ONE` | Everyone, first time only |
| `CAREER_HIGH_RANK` | Human |
| `Q_SCHOOL_FINAL_STAGE_REACHED` | Everyone |
| `TOUR_CARD_WON`, `TOUR_CARD_RETAINED`, `TOUR_CARD_LOST`, `TOUR_CARD_REGAINED`, `TOUR_CARD_SURRENDERED` | Everyone |
| `FIRST_PROFESSIONAL_EVENT`, `FIRST_MAJOR`, `FIRST_WORLD_CHAMPIONSHIP` | Everyone |

**How qualification milestones are recorded.**

- `FIRST_PROFESSIONAL_EVENT` comes from confirmed entries.
- `FIRST_MAJOR` and `FIRST_WORLD_CHAMPIONSHIP` are recorded from confirmed entries **or** from meeting the event's sporting rule (ranking cut, Tour Card or entitlement — never an invitation) at registration close.
- This matters because A3 cancels the sets-format World Championship as `UNSUPPORTED_FORMAT`; qualifying for it is still a real fact.

A7 turns these facts into narrative.

## Versioning, idempotency, concurrency

**Versioning.** `career_sporting_state` pins the ranking, Tour Card and Q-School rules versions per save. Every contribution, snapshot, card and allocation stores the version that produced it. An unsupported version returns 409.

**Idempotency.** Every write is keyed:

| Write | Key |
| --- | --- |
| Contribution | (list, event, participant) |
| Snapshot | (list, publication index) |
| Card | Operation key |
| Allocation | (season, pathway) |
| Card award | (season, participant) |
| Milestone | Operation key |
| Season review | `reviewed_season` |
| Exemption | A3 entitlement idempotency key |

**Concurrency.** All writes happen inside A3's root-locked (`FOR UPDATE`) transactions. Tests replay hooks and run concurrent advances, and nothing is duplicated.

## API (read-only; `Cache-Control: no-store`, same auth and feature gate)

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/career/saves/:id/sporting` | Career Home summary: status, card, World Ranking standing with cut gaps, all list positions, recent milestones |
| GET | `/saves/:id/rankings` | Lists, latest publication, human standing per list |
| GET | `/saves/:id/rankings/:list?view=TOP\|AROUND\|PAGE&limit&offset&participant&radius` | Table slice (never the whole history) |
| GET | `/saves/:id/rankings/:list/history?participant&limit` | Snapshots, season highs, career high |
| GET | `/saves/:id/rankings/:list/explain?participant` | Counting, expired and pending contributions; value = sum |
| GET | `/saves/:id/tour-card?participant` | Current card, term, review season, retention rule, history |
| GET | `/saves/:id/q-school?season&participant` | Per pathway: days and winners, the participant's stages, OoM position, card line, standings, allocation |
| GET | `/saves/:id/qualification?eventId \| fromWeek&weeks` | Structured qualification routes |
| GET | `/saves/:id/milestones?participant&limit&beforeSeason&beforeWeek` | Factual history |

Sporting state changes only through A3 play (`advance`, `recordHumanMatchResult`, `enter`/`withdraw`).

## Validation

- **Harness:** `pnpm --filter @workspace/api-server run career:sporting [seed] [--seasons=N]` (default 10). It plays a deterministic Career through the real A1–A5 services for N seasons, plus one week of the next. Fixtures are labelled:
  - the human's live match results (a fixed hash, about 50% wins);
  - one starting funding adjustment.

  It reports:
  - ranking integrity, #1 reigns, climbers and fallers;
  - card flows per season;
  - Q-School per pathway;
  - nationality shares;
  - milestones;
  - integrity checks.
- **Tests:** `src/lib/__tests__/career-sporting.test.ts` (28 tests covering the 33 required behaviours).

### Harness results (default seed, 10 seasons + 1 week)

| Area | Result |
| --- | --- |
| Runtime | 1,373 s (78 s season 1 → 181 s season 10) |
| World #1 | 21 changes, 7 different players (GBR, DEU, CAN, NLD, BEL); one long reign (Harlan Alderbrook, CAN) |
| Contributions | 71,255 (62,902 expired out of their windows) |
| Snapshot and total integrity | 0 integrity errors, 0 unexplained totals |
| Tour Card holders per season | 114–130 |
| Cards per season | 24 from Q-School (5–7 direct + 17–19 OoM incl. rolled-over), 2 Challenger, 29–36 retained, 15–39 lost |
| Comebacks and churn | 186 regains, 74 new professionals (25 generated after season 1), 11 retirement surrenders |
| Q-School per season | UK & Ireland 75–91 First Stage / 33–40 Final Stage; Europe 38–47 / 26–34; card line tie-broken deterministically 13 times |
| Integrity checks | 0 for every one: non-ranking money, retired active competitors, duplicate cards/contributions/milestones/allocations, overlapping terms, broken entitlements, Pro Circuit entrants without cards, pathway zone violations. Season-1 history unchanged after 10 seasons |
| Nationality (population → ranked → top 32 → top 10 → card holders), UK & Ireland / Europe / rest of world | 52/36/11 → 51/40/8 → 50/31/19 → 50/30/20 → 51/39/10. Emergent, nothing enforced |
| Not observed with this seed | No former top-16 player lost a card (the top-64 retention cut protects them). The fixture human (about 50% wins) reached one Final Stage (season 2) but won no card, and from season 5 could no longer afford Q-School (A4 funds). Both are reported, not forced |

## Known limitations

- **World Championship and some majors.** The World Championship (sets), Double Start Grand Prix (sets) and Grand Slam (groups) are A3 `UNSUPPORTED_FORMAT` events: they are cancelled, award no ranking money, and their qualification is recorded only as a fact. The World Ranking is therefore built from the Pro Circuit, the European Series and the executable majors.
- **No founding World Ranking.** Season 1 starts with an empty World Ranking; it emerges from results. Ranking-gated invitationals use their A3 invitation policies until rankings exist, and seeding is empty until the first publication.
- **Card supply is not capped.** Holders vary (about 105–131 in testing); balancing is for A9.
- **Unranked players and sponsorship.** Unranked-but-published is reported to A4 as `Number.MAX_SAFE_INTEGER`, which no sponsor requirement accepts.
- **Pathways are fixed.** NPCs do not relocate. Rest-of-world exemptions default to the UK & Ireland pathway.
- **Performance.** The PGlite harness takes 78 s for season 1, rising to 181 s by season 10 as Career history accumulates (A2 match JSON, A3 results, A5 snapshots). This has not been profiled per component; it is A10 work, along with snapshot retention.
- **The human's Q-School pathway.** The human is free to choose either pathway their zone allows; exemptions follow home country.

## Deferred

| Phase | Work |
| --- | --- |
| A6 | Career Home, Rankings, Q-School and Tour Card screens over the API above |
| A7 | Narrative, news and story over the milestone facts |
| A8 | Final ranking-list, content and race-list catalogue |
| A9 | Balancing: card supply, retention cut, Q-School card numbers, prize-driven ranking spread, nationality outcomes |
| A10 | Production performance: background advance, snapshot retention and compaction |
