# Career 2.0 A4: finance, Career economy and sponsorship

A4 builds on the locked A3 tree (`0d659ea`, identical to `dcc9c9a`) on `feature/tour-career-2-foundation`. Career money is integer pence (GBP). It is completely separate from TKDL coins, league points, M501, Classic Tour trophies and real money: there is no conversion in either direction and no purchase path.

## Ownership

| Phase | Owns | A4 relationship |
| --- | --- | --- |
| A1 | Saves, slots, lifecycle, `balance_pence`, the `CAREER_START` £250 row | A4 extends A1's `career_finance_entries` into the single immutable ledger; `balance_pence` becomes its cache |
| A2 | NPCs, simulation, development, off-season | Untouched. NPCs have no money |
| A3 | Calendar, entries, bookings, draws, matches, results, entitlements, lifecycle | A3 calls optional finance hooks inside its own transactions; it remains the sporting authority |
| **A4** | Ledger, the four headlines, event costs, trips, refunds, prizes, cash vs ranking-eligible amounts, sponsor offers/contracts | |
| A5 | Rankings, Tour Cards, Q-School Order of Merit, seeding | Consumes `career_prize_awards.ranking_eligible_pence` and `career_event_prize_tables`; provides real sporting facts via `SponsorFactsProvider` |

## Ledger model

`career_finance_entries` (A1's table, extended additively by `create_career_finance.ts`) is the only record of money.

- **Every movement is a row:** `category` and `headline`; `amount_pence` (signed); `operation_key`; season/week; event, trip, contract and reversed-entry references; gross amount and sponsor-covered amount; `finance_version`; reason; detail.
- **A1 unchanged:** A1's create and restart code still inserts only `(id, save, kind, amount)`. A `BEFORE INSERT` trigger completes those `CAREER_START` rows (`START` headline, key `career-start`). There is exactly one £250 credit per save universe.
- **Idempotency:** `UNIQUE (career_save_id, operation_key)`. Retrying a key returns the stored row; reusing a key with different inputs gives 409.
- **Immutable:** a `BEFORE UPDATE` trigger rejects every update. Corrections are reversal rows (`ADJUSTMENT` or `REFUND` with `reverses_entry_id`). Deletion happens only through A1's save cascade.
- **Category checks:** a check constraint enforces the sign and headline of each category.
- **IDs:** ledger IDs are scoped by save and seed, because A1's primary key is global.
- **The writer:** `post()` in `finance/ledger.ts` is the only writer. In the caller's transaction, with the save root already locked, it moves the balance cache with a guarded `UPDATE … WHERE balance_pence + amount >= 0`, then inserts the row. If the guard refuses, it throws `InsufficientFundsError` and writes nothing.
- **No debt:** `career_saves_balance_nonnegative CHECK (balance_pence >= 0)` backs this up at database level.
- **Repair:** `rebuildBalanceCache` rebuilds `balance_pence` from the ledger.

### Four headlines

Each row has exactly one headline, so the identity `start + earnings + sponsor − expenses = balance` holds by construction. `summary()` reports `reconciled` by checking both that identity and that the cache equals `SUM(ledger)`.

| Headline | Definition |
| --- | --- |
| Balance | `SUM(amount)` (cached in `career_saves.balance_pence`) |
| Career Earnings | `SUM(EARNINGS)`: prize money only |
| Sponsor Earnings | `SUM(SPONSOR)`: signing bonuses, event payments, performance bonuses |
| Career Expenses | `−SUM(EXPENSE)`: what the player actually paid (fees, travel, accommodation) net of refunds |

Sponsor coverage is never a fake cash flow. An expense row records `gross_amount_pence`, `sponsor_covered_pence` and `contract_id`, and its `amount` is only the player's share. Example: an entry fee of 4000 with 2000 covered posts −2000, gross 4000, covered 2000. `summary.sponsorCoveredExpensesPence` reports the covered total.

## Versions and content

- `FINANCE_VERSION = 1` covers fees, refund policies, travel bands and prizes (`finance/config.ts`).
- `SPONSOR_DATABASE_VERSION = 1` covers the fictional sponsor catalogue (`finance/sponsors.catalogue.ts`).
- `career_finance_state` pins both versions per save. Shipped versions are immutable.
- Event profiles resolve from the A3 snapshot references (`profiles.entryFee` and `profiles.prize`, e.g. `fee:pro_circuit`), with data-level per-definition overrides (e.g. Sunday League is free). There are no circuit branches in service code.
- `profileFor()` is the single resolver.

## Event cost lifecycle

| Cost | When it becomes authoritative |
| --- | --- |
| Entry fee | When the human's A3 entry is created (the same transaction as the sporting entry) |
| Travel and accommodation | At the start of the play-out of the week in which the trip's first event starts (`beforeWeek`, before any field locks) |
| Prize, sponsor event payment, performance bonus | Inside A3's event completion (the same transaction that writes the immutable results) |

**Preview.** Every calendar DTO and `GET /saves/:id/events/:eventId/finance` returns:

- fee and fee basis (`PER_EVENT` or `PER_SERIES`);
- travel band, nights, estimated travel and accommodation;
- sponsor coverage per cost type;
- estimated player cost;
- balance, `available` (balance minus travel reserved for entered events) and `affordable`;
- prize profile and top prize, plus whether the money is ranking-eligible;
- commitment status.

Previews are batched per calendar request: one contract, one coverage-usage, one balance and one commitment query, so there is no N+1.

**Affordability.** The entry fee plus the estimated trip cost (the player's share) must be within `available`. The trip estimate is stored on the entry and *reserved*, not charged, so later travel can never push the save into debt.

If coverage disappears before travel and the trip becomes unaffordable at commit time, the player is withdrawn from that trip's events before the field locks. There is no debit and no refund; the reason is recorded.

**Travel model.** This is a deterministic abstraction over A3 geography: the player's home comes from the A3 status provider; the event's locality, venue, country and zone come from A3. Nationality is never an input.

| Band | Rule | Round trip | Per night |
| --- | --- | --- | --- |
| LOCAL | Home county catchment or nearby venue | £0 | — |
| DOMESTIC | Same country | £60 | £70, multi-day only |
| UK_IRELAND | Same zone, other country | £90 | £80 |
| EUROPE | | £180 | £90 (+1 night) |
| LONG_HAUL | | £900 | £120 (+2 nights) |

**Trip grouping.** Entered events that start within one day of each other at the same destination chain into one trip: one round trip, with nights over the union span. Series days (Q-School) always chain. Local events never form trips.

Trips are persisted in `career_trips` (immutable). Each trip posts one `TRAVEL` and one `ACCOMMODATION` row, keyed `travel:s<season>:<firstEventId>`.

## Withdrawals, cancellations, refunds

Refunds are new `REFUND` rows referencing the charge they reverse (`reverses_entry_id`), keyed `refund:entry:<chargeId>`, so they are idempotent. Policies are data (`REFUND_POLICIES`, referenced by the fee profile):

| Policy | Withdraw before close | Late (post-lock) | Organiser cancellation |
| --- | --- | --- | --- |
| local | 100% | 0% | 100% entry |
| standard | 80% | 0% | 100% entry |
| q_school | 50% | 0% | 100% entry |

For all three policies, committed travel and accommodation refunds are 0%. That percentage is configurable, and the code applies it per trip share when it is set above zero.

Uncommitted travel was never charged, and withdrawing releases its reservation. Only the *current* entry attempt can be refunded; a withdraw-then-re-enter creates a new charge `entry:<event>:aN`.

**Cancellation.**
- An A3 `INSUFFICIENT_ENTRANTS` cancellation calls `onEventCancelled`, which refunds the entry once.
- Unsupported-format events can never be entered (A3 denial `UNSUPPORTED_FORMAT`), so they are never charged; the harness counts 0 such charges.

## Prize processing

- **Bands.** Prize profiles are bands keyed by finishing position: 1 = champion, 2 = runner-up, ≤4 = semi-final, ≤8 = quarter-final, ≤16 = last 16, … ≤128. Unpaid rounds pay 0.
- **On completion.** For every completed executable event, A4 snapshots the prize table in `career_event_prize_tables` (immutable). This is the A5 input for NPC ranking money; NPCs still have no money.
- **The human's award.** If the human has a result, A4 writes `career_prize_awards` (immutable, primary key per event) with:
  - `cash_award_pence` (the cash);
  - `ranking_eligible_pence` (= cash for `RANKING` events, 0 for SPECIAL, QUALIFIER and INVITATIONAL_EXHIBITION; a database check forbids a SPECIAL ranking amount).

  A `PRIZE` ledger credit (key `prize:<eventId>`) is posted only when the cash is above 0.
- **Exactly once.** This happens in A3's completion transaction, so a failure rolls back completion and the whole step retries. Results, simulations and prizes are all keyed or deterministic. Re-invoking the hook is a no-op (tested).
- **Ranking money.** A4 never calculates rankings. A5 reads `ranking_eligible_pence` and the prize tables.

## Sponsorship

- **Definitions** (`sponsors.catalogue.ts`, v1, all fictional, no gambling, no real manufacturers):

  | Sponsor | Tier |
  | --- | --- |
  | Forge Workwear | LOCAL |
  | Lochside Joinery | LOCAL |
  | Ochre Darts Co. | REGIONAL |
  | Redpoint Darts | REGIONAL |
  | Ironflight | PROFESSIONAL |
  | Northline Darts | PROFESSIONAL |
  | Vantage Darts | ELITE |

  Each defines:
  - an offer requirement;
  - duration (remainder of season or N seasons);
  - signing bonus;
  - event payment (amount, circuits, per-season cap);
  - coverage rules;
  - performance bonuses (by finishing position, circuits and classifications);
  - renewal and retention requirements;
  - presentation metadata.
- **Coverage** is one generic rule: cost types, percent, per-event cap, season cap and circuits. That expresses none, percentage, fixed, full and capped coverage. The first matching rule applies. Season usage is read from the ledger's `sponsor_covered_pence`.
- **Sporting facts** come through the `SponsorFactsProvider` boundary:
  - titles, best finish by circuit and qualifications come from A3 results and entitlements;
  - professional status and Tour Card come from the A3 status provider;
  - world ranking comes from the A3 ranking provider (empty until A5).

  `null` means unknown. Requirements evaluate to true, false or null, and **only true grants**; for retention, only a *known* failure terminates.
- **Offers** (`career_sponsor_offers`):
  - **Snapshot.** Each offer snapshots its terms.
  - **States.** AVAILABLE, ACCEPTED, DECLINED, EXPIRED or WITHDRAWN.
  - **Expiry.** Offers expire 4 weeks after being made.
  - **Generation.** Deterministic, with no RNG. Every sponsor whose requirement is known-true qualifies if it ranks above the current contract's tier, has no open offer and wasn't declined or expired this season. Ordering is tier then key, at most 2 per evaluation.
  - **Idempotency.** Each offer is keyed `offer:<trigger>:<sponsor>`.
  - **Triggers.** Career start, each human event result, season start, and the internal `evaluateOffers` milestone boundary.
- **Contracts** (`career_sponsor_contracts`):
  - **Lifecycle.** ACTIVE, COMPLETED, EXPIRED or TERMINATED.
  - **One active contract.** A partial unique index allows one ACTIVE contract per save.
  - **Accepting.** Accepting an offer terminates any active contract (reason `REPLACED`), snapshots the terms and pays the signing bonus once (`sponsor-signing:<contractId>`, Sponsor Earnings). A retried accept returns the existing contract.
  - **Terms are frozen.** Terms are immutable, and ended contracts are history (enforced by a trigger).
- **Contract end** happens when the calendar moves past the end week:
  - renewal requirement true → COMPLETED plus a RENEWAL offer;
  - false → EXPIRED (`RENEWAL_REQUIREMENT_NOT_MET`);
  - unknown → EXPIRED (`RENEWAL_AUTHORITY_UNKNOWN`).

  At season start, a retention requirement that is known-false → TERMINATED.
- **Event payment and performance bonuses** are paid on event completion when the human played (not withdrawn), keyed `sponsor-event:<contract>:<event>` and `sponsor-bonus:<contract>:<event>:<bonus>`.
- **Display cache.** `career_saves.sponsor` (A1's display field) mirrors the active sponsor's name.

## Atomicity, idempotency, concurrency

- **One locked transaction.** Every mutation runs in one transaction that locks the save root `FOR UPDATE` (A2 `lockRoot`). A3 entry calls `entryCheck` (affordability denial), inserts the A3 entry and bookings, then `onHumanEntry` charges the fee. Any failure rolls back both; this is tested with an injected fault.
- **Double-click.** Concurrent enters produce one entry and one charge; concurrent sponsor accepts produce one contract and one bonus. Both are tested.
- **Retries.**
  - Cancellation and completion retries are no-ops (tested).
  - Advance retries return the stored result.
  - A blocked (human-match) advance can resume only from the position it stopped at; retried later, it never moves time or money (tested). This last behaviour is a narrow A3 fix found by the A4 harness.
- **Database-enforced uniqueness:**
  - operation keys;
  - one open offer per sponsor;
  - offer → contract;
  - one active contract;
  - one award per event;
  - one prize table per event;
  - one trip per key;
  - plus no debt.

## Save lifecycle

- **Restart.** A1 deletes the root, which cascades every A4 row. A1 inserts the fresh save and its `CAREER_START` (£250); there is no old sponsor, offer or cost.
- **Retirement.** Summary, ledger, sponsors and event finance stay readable. Enter, accept, decline and milestones return 409 because the root is not ACTIVE.
- **Isolation.** Every table is save-scoped, with composite foreign keys and cascades. Other players get 404; three saves are tested independently.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/career/saves/:id/finance` | Four headlines, reconciliation, reserved/available, active sponsor, offer count |
| GET | `/api/career/saves/:id/finance/ledger?limit&beforeCreatedAt&beforeId` | Keyset-paginated ledger |
| GET | `/api/career/saves/:id/events/:eventId/finance` | Preview, plus actuals: charges, coverage, trip, refunds, prize award, sponsor payments |
| GET | `/api/career/saves/:id/sponsors` | Active contract, available offers, history (contracts and resolved offers) |
| POST | `/api/career/saves/:id/sponsors/offers/:offerId/accept` and `/decline` | Sponsor decisions |

- **Calendar routes are finance-aware.** The existing A3 routes now include `finance` on every event DTO and an `INSUFFICIENT_FUNDS` denial. Entry and withdrawal stay on A3's routes; there is no separate pay endpoint.
- **Service-only operations** (no HTTP): `evaluateOffers` (the milestone boundary), `reverseEntry` (corrections), `prizeFacts` (the A5 boundary) and `recordHumanMatchResult` (A3).

## Validation

- `pnpm --filter @workspace/api-server run career:finance [seed] [--weeks=N]` plays a deterministic human Career for a full season plus rollover. It uses a fixed entry policy and fixed match outcomes submitted through `recordHumanMatchResult`. It then runs labelled fixture scenarios (fixture sporting facts or funding are marked `HARNESS FIXTURE`).
- Tests are in `src/lib/__tests__/career-finance.test.ts` (18).

## Known limitations

- **Placeholder economy values.** Values are coherent references, not final balance (A9). The serious-amateur schedule is still large on paper. A4 costs shrink the *practical* schedule; nothing is capped.
- **The free route back from £0 is real but sparse.** A broke Ayrshire player has about 10 free, prize-paying local events per season, with gaps of up to about 11–14 weeks (events at £5 or less: about 30, gaps of 7 weeks or less). There are no bailouts.
- **Unknown sporting authority never grants.** Until A5 exists, professional and elite sponsor offers need fixture facts or real A5 facts. The default provider derives titles, finishes and qualifications from A3 results only.
- **Travel geography is coarse.** For example, Ayrshire to Inverness is LOCAL through the shared county catchment.
- **No live finance UI yet.** That is A6.
- **Season-boundary sponsor processing happens when the calendar moves.** A save left at week 52 doesn't expire contracts until it advances.
- **A3 performance carries over.** About 45 s per season in PGlite plus A4 work; the A4 full-season harness takes about 150 s, including about 120 human-match pauses.

## Deferred

| Phase | Work |
| --- | --- |
| A5 | Rankings from `ranking_eligible_pence` and prize tables; Tour Cards; Q-School Order of Merit; real `SportingStatusProvider` and `SponsorFactsProvider`; sponsor requirements on rankings |
| A6 | Finance, sponsor and calendar-cost UI using the DTOs above |
| A7 | Narrative over the factual ledger and sponsor events |
| A8 | Final sponsor and content library |
| A9 | Economy balancing (fees, purses, coverage, travel) |
| A10 | Performance and production tuning (advance as a background job, A2 match-history retention) |
