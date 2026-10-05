# A7.6 — Season Review & Legacy

Scope: Season Review & Legacy only, built from A7.5.1 `076b4cd0c129a467b7b097f9e786488e1907df8c`.
This is not A8, A9, a sporting rebalance or multi-season balance certification.

## Implemented

- Permanent, version-1 completed-season reviews: results, main-event titles/finals,
  major/World outcomes, real A4 prize and sponsor/commercial income, prior/final
  published World positions, Cards, qualification changes, sponsors, actual most-met
  season opponent, public-profile context, remembered decisions and completed work.
- Deterministic season identities, factual paragraphs and contiguous achievement
  eras. A successful amateur Career is valid; professional status is not its goal.
- Five restrained award policies: Player, Breakthrough, Amateur Player, Young Player
  and Performance of the Season. Unsupported categories are omitted. Winners may be
  human or NPC; persona, sponsorship and hidden attributes cannot decide them.
- Lightweight world history: major/World champions, last published #1, amateur award
  leader where actually recorded, Card outcomes, actual retirements and next-season
  cohort entrants. Names/IDs and evidence are retained without copying match/world databases.
- Career record, championship history, exact-definition-key event/Palace lineage,
  defending champion only with an actual previous-season result, most titles/finals,
  human event results and retired/public NPC sporting histories with actual H2H links.
- Comparable universe records, strict record-crossing facts, factual joint-rank
  comparisons, meaningful descriptors and retired human/NPC Hall of Fame routes.
- Confirmed, retry-safe retirement with an immutable final summary and readable
  archive. Includes actual A7.1 played-match totals, most-met opponent and first/final
  meetings, sporting/amateur achievements, Cards, honours/eras, championship history,
  commercial income/activity, longest signed sponsor term and established story links.
- Grouped History/Legacy tabs inside the existing navigation structure. Existing
  A7.1 trophy, performance, firsts and match facts remain available beneath Career
  Record and at `/history/facts`; existing Relationships and Life/Stories are linked.

## Authorities and persistence

`career/legacy/model.ts` contains pure policies/projections; `persistence.ts` reads
public authoritative evidence with SQL aggregates and stores bounded snapshots.
There are three additive, save-root-cascading tables:

1. `career_legacy_reviews`: save/season key, version, immutable review JSON and a
   monotonic acknowledgement bit.
2. `career_legacy_inductions`: save/participant key, immutable explained policy-v1
   induction evidence and actual in-world induction season.
3. `career_legacy_retirements`: one immutable final archive per save.

Database triggers reject snapshot/evidence updates and reversal of acknowledgement.
Inserts use `ON CONFLICT DO NOTHING`; the root lock serializes captures and writes.
Root deletion, restart and admin reset cascade normally. No child history deletion
or snapshot-edit API is exposed. Reads do not backfill tables.

Calendar schema installation adds the tables; application startup also installs
them idempotently. Standalone A3 providers do not require A4/A5 history evidence.
The actual composed A5 -> A4 -> A3 service receives optional history hooks.
No legacy computation writes A2 players, A3 sporting results, A4 money, A5 rankings,
Tour Cards or qualifications. A7.1 remains the scoring/statistical authority and
A7.5 remains the public-persona, commercial-life and story authority.

## Season transition and recovery

The existing authorities first play/settle week 52, develop the final A2 period,
perform A2 off-season aging/retirement/replacement, finalize the previous season and
prepare the next one through existing A4/A5 hooks. The immutable review is captured
under the existing root lock. Even a multi-week advance stops at `SEASON_REVIEW`.

The presentation is deliberate: Review -> Awards & Champions -> Career Changes ->
New Season. `BEGIN SEASON` acknowledges the preserved review and unlocks progression;
it does not rerun development, rankings, finance or sporting allocation. The backend
blocks advancement while a captured review is pending, including direct API calls.
Acknowledgement replay cannot reverse history; retired saves cannot acknowledge or advance.

A2 commits its off-season in a separate existing transaction. If the subsequent
finalization/capture fails, the next advance can recover the unfinished previous
season, requiring its played/developed week-52 state and existing A2 off-season proof.
This never backfills awards for already completed old seasons. The original incomplete
operation is completed with `recovered: true`, an empty reconstructed steps list and
`weeksPlayed: 0`; it does not claim to have re-played missing step summaries.

## Policies (v1)

Player: recorded World titles, major/World titles, national/open-amateur titles,
pro titles, total titles, finals, then wins. Stable public ID is the final tie-break.
This is an explained award ordering, not a universal Legacy Score or gameplay value.

Amateur: national/open-amateur titles, amateur titles, finals, then public ID.
Junior, County, Regional, National Amateur, Vault and Challenger main-event titles
are separate from professional titles; qualifiers never count as titles here.

Young: public age 23 or below at season start and actual sporting participation.
Human ages use A6.5 DOB and the 364-day Career calendar, not an assumed birthday each
season. NPC ages use the public A2 starting-age/cohort cadence.

Breakthrough: first recorded Q-School Card without an earlier Card; otherwise an
evidenced >=32-place improvement from outside the upper World positions into the
top 32; otherwise a first major/World title after an earlier participating season.
No young/player label is invented when none of those facts exists.

Performance: an actual non-qualifier champion result, ordered by World/major/
televised/other recorded tier, finishing position, event date and source ID. It
never compares simulated NPC dart scoring against human GameScorer performance.

Hall of Fame requires retirement and at least one route:

- Professional Great: >=2 Worlds, or >=4 major/World titles plus >=8 pro titles.
- Amateur Great: >=20 amateur titles, >=5 national/open-amateur titles and >=5
  seasons with recorded completed sporting results. No Tour Card is required.
- Longevity + Achievement: >=12 participating seasons, >=12 titles and >=5
  national/open-amateur/pro/major title achievements. Longevity alone is insufficient.

Routes are explicit evidence thresholds, not XP, a currency, a buff or a numeric
rank of all Careers. Inductions survive later policy changes.

## Compatibility, security and limitations

- Old completed seasons are read-derived and visibly `RECONSTRUCTED`; absent public
  context is not invented. They receive no retrospective awards or announcements.
  Derived eligibility on an old retired Career explicitly says there was no
  recorded induction. Future real boundaries capture permanent reviews.
- No invented pre-save champions/biographies, quotes, missing seasons, start/end
  ranks or reign lengths. Ranking comparisons use the prior season's last and the
  reviewed season's last actual published snapshot; week labels are retained.
- NPC ranking histories are season endpoints and #1 observations, not every weekly
  position. No World #1 duration is inferred through snapshot gaps.
- Record scope is retained, completed A3 tournament results. Finals include champions;
  qualifier titles/finals are excluded. Aggregate result wins are explicitly distinct
  from the actual-match A7.1 authority, which remains visible and is used at retirement.
- Prize records are **human A4 ledger only**. NPC A5 ranking money is not presented as
  comparable cash. Human 180s, checkouts and averages remain A7.1 facts, not NPC records.
- No separate trophy cabinet, full world/match duplication or permanent copies of
  all existing life/relationship facts. Their authorities remain readable under the save.
- A partial retirement season remains partial and never receives season awards.
  Longest sponsor history describes the longest signed term, not guessed actual duration.
- Session, exact owner and existing feature/admin-test gates apply; an admin does not
  bypass ownership. All responses are `Cache-Control: no-store`. Writes are rate-limited.
- New writes accept only the exact strict confirmation payloads below; no client
  award winners, ranks, finances, Hall criteria or snapshot fields are accepted.

## API

All routes are under `/api/career/saves/:id`:

- `GET /legacy` — grouped overview, review index, world/records/eras/honours/Hall,
  pending review and final summary (frozen retirement archive when available).
- `GET /legacy/seasons/:season` — a completed-season review; unfinished/missing = 404.
- `GET /legacy/events/:key` — recorded exact-key event lineage.
- `GET /legacy/npcs/:npcId` — owned public NPC history, including retired players.
- `POST /legacy/seasons/:season/begin` — `{"confirmation":"BEGIN SEASON"}`.
- Existing `POST /retire` now requires `{"confirmation":"RETIRE CAREER"}` and replays
  the original retired save without changing timestamps, archives or inductions.

## Verification

Proportionate checks, not certification:

- Legacy model/source tests: 18/18.
- Actual PGlite/HTTP Career integration: 14/14, including an explicitly labelled
  shortened week-52 fixture with one authored A3 amateur title, cancelled remaining
  events and a week-51 clock/development cursor. Actual week 52, A2 off-season, A5
  Card review, snapshot, acknowledgement and retirement then use real services.
- That fixture injects failure after A2 commits, proves capture rollback, recovers the
  same operation, checks unchanged authority digests on read/begin/replay, database
  snapshot immutability, old/fresh ownership/gates, public event/NPC reads, no hidden
  data, strict bodies, retirement replay and save-root admin cascades.
- A1 lifecycle: 18/18. Composed sporting/ranking/Card/Q-School/seeding suite: 28/28.
- Focused A4 finance regression: 4/4 (start/restart ledger, immutable/idempotent ledger,
  cash-vs-ranking prize bands, isolation/retirement/restart).
- Career frontend model + production-mode Vite SSR screens: 55/55, including five
  A7.6 screens/policy-preservation checks and exact retirement request confirmation.
- Whole API TypeScript: zero diagnostics. Career-scoped frontend TypeScript: zero
  diagnostics. API production build and `git diff --check` pass.

The full finance suite was attempted but was killed by the container (exit 137);
the bounded four-case finance run succeeded. This is not a claim of full-suite
certification. Larger test-process attempts also hit resource limits; successful
PGlite checks were serialized with small heaps, single WASM compilation tasks and
`--test-isolation=none`. No multi-season balance simulation was required/run here.
The known pre-existing broadcast season-review order assertion is outside A7.6.

Suggested manual product checks: at a genuine season end, reload on each transition
section, open an older review, view an event's defending champion, search a retired
NPC, verify a mobile grouped tab layout and retire through the explicit confirmation.
These interactive/manual checks are not claimed as executed.

Stop after A7.6 publication/verification. Do not begin A8/A9 or balance certification.
