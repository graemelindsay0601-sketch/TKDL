# A7.5 — Career Life, Stories & Public Profile

Starting main: `10030355b05531524b8f2d8e7741fbbe04c60ab0`.
Scope ends at A7.5. No A7.6, A8, A9 or general UI redesign.

## Architecture and authorities

`career/life/` is a bounded, deterministic narrative/commercial layer over existing
Career authorities. `types.ts` defines public DTOs; `content.ts` supplies versioned
content identity and copy families; `stories.ts`, `profile.ts` and
`opportunities.ts` are pure projections. `service.ts` reads owned authorities and
records actual choices. `commitments.ts` settles agreed payments through A4.
`router.ts` supplies authenticated, no-store, save-scoped HTTP routes.

- A1: identity, settings snapshot, ownership, active/retired status.
- A2: public NPC identity, age/status and retirement; unchanged simulation,
  ability, potential, form, development, cadence and RNG.
- A3: authored event/venue identity, actual draws, played matches/results,
  bookings, entitlements and the only progression clock.
- A4: contracts, append-only financial ledger, cached balance and four headlines.
- A5: published rankings, Tour Cards, Q-School results/completed allocations.
- A7.1/A7.2: factual Career history, played H2H and public world/cohort history.
- A7.4: contextual sporting recognition, never awarded for persona or dialogue.
  A7.3 focus/goals are not fame or persona inputs.

Root locking serializes choices, event entry and financial settlement. Reads do
not initialize a world, simulate matches or materialize weekly reputation.

## Story/content framework

Eighteen composable families: breakthrough, amateur, professional, major, Palace,
Card, Q-School, rivalry, adversity, ranking, return, generation, retirement,
world, commercial, draw, qualification and prospect. Each has multiple headline
and introductory variants plus a contextual question. Five presentation styles
have deterministic response variants. Names, events, published positions,
history and actual decisions provide factual context rather than fictional plots.

Stable SHA-256 content IDs include version, save ID, kind and source identity.
Copy selection and NPC presentation use an independent deterministic hash, not
the sporting RNG stream. Nothing calls runtime AI or attributes invented
statements/private feelings to NPCs.

Signals include first final/title, significant amateur/professional success,
played pro/major/Palace appearances and pro wins, actual pre-debut draws,
major/World runs, qualification, Card award/loss/regain, published ranking
thresholds and material movement, repeated final defeats, title defence and
defending-champion elimination. Champions also support factual first-final
evidence. Qualifiers are not promoted into played main-stage appearances.

Q-School has result chapters; explicit no-Card outcomes require a completed
final-stage allocation with actual human final-stage participation and no award
through that pathway. Absence of a Card alone does not establish failure.

NPC world stories include significant titles/finals, defending-champion
outcomes, young public-player results, ranking leaders, public major
qualification, non-initial Card awards, recorded Card losses and retirement.
Young-player news does not invent a shared human cohort or wonderkid potential.

Meaningful upsets require an actual completed main-event match AND a prior
published World snapshot containing both participants: a #32-or-lower-ranked
winner against a top-eight opponent. The snapshot must precede the match's week.
No current/future ranking hindsight, hidden ratings or guesses about unranked
players are used.

## Career Moments and remembered decisions

News, Career Moment and Major Career Scene are separate significance classes.
Only one recent actionable moment is returned. Ordinary interviews have a
two-week cooldown; source and recent same-event resolution suppress duplicates
(including equivalent major/World-title facts). Eligible facts are at most
three weeks old; season-only historical facts do not fabricate an interview.
First meaningful sporting arrivals can be compact acknowledgement scenes.
An actual first Palace draw supports a contextual four-answer dialogue before
the played-debut claim exists.

Dialogue presents four valid authored responses, including professional and
reserved options. Moment steps are bounded to three and use factual context,
public opponent presentation and callbacks. Major scenes require significant
sporting evidence, not weekly repetition. NPC presentation can break otherwise
equal-time/equal-significance scene ties; it never influences a sporting result.

The server stores kind, semantic choice, source IDs, thread, applicable event/
opponent, statement family and `contentVersion: 1`, not generated paragraph
snapshots. A later relevant thread can quote the actual chosen response.
Future copy changes must retain a version-one renderer for historical statements;
do not silently rewrite old choices. Same-choice retries replay; conflicting
retries are refused.

## Persona, public and commercial profiles

Persona is not selectable at creation. It emerges after genuine dialogue:
professional, confident, showman, fiery or reserved, with a possible secondary
style. Recent eight answers have greater influence; older behaviour retains
bounded influence so long histories do not permanently lock a presentation.
Internal aggregation is not returned as XP, levels or spendable points.

Sporting recognition, persona, awareness/interest, reception, crowd draw,
commercial demand and actual commercial activity remain distinct. Fiery public
presentation can be divisive while drawing substantial interest. A reserved
successful World player can remain a major darts figure. Quiet/media-selective
careers do not lose sporting recognition, ability or eligibility.

Sporting stature is the primary commercial eligibility/fee driver. Public draw,
presentation and completed work describe context, not an optimal persona build,
currency, mandatory media path or sponsor gate. A fresh unknown Career has no
established commercial demand.

## NPC identity and relationship tone

Public NPC identity is derived on demand from owned A2/A3/A5 evidence and A7.4
recognition. One or two stable presentation traits are derived from public NPC
ID: reserved, professional, confident, fiery, showman, humorous, intense,
ambitious or gracious. No new all-NPC weekly records are created.

Some initial public NPC IDs legitimately occur in multiple save universes.
Ownership is always `(career_save_id, npc_id)`, not presumed global ID
uniqueness. The endpoint returns this save's public evidence, never another
save's identity/history.

Tone is respectful, competitive or heated, derived from actual recent dialogue
about a relevant played opponent. A7.2 sporting labels remain untouched.
Respectful Career Rival combinations remain valid; repeated defeats do not
automatically invent hatred. Retired identities and meetings remain readable.
Traits supply presentation/scene flavour, not invented emotional responses.

## Optional commercial opportunities

Twelve families: local signing; sponsor signing/appearance; meet-and-greet;
exhibition; charity; product/equipment launch; podcast/show; interview;
television; awards/promotional evening; major darts launch; international
exhibition/appearance.

Up to four offers per four-week window follow actual sporting stature,
played-match history and active-save readiness. Sponsor-specific offers require
an owned active contract. International offers require strong international
recognition. Each offer has a stable save/window/family identity, authored fee,
season/day and compatibility description. Choices are accept or decline.

Acceptance creates a real full-day off-board reservation. Tournament bookings
and other commitments make the offer unacceptably conflicted. Conversely, A3's
existing human entry check returns `SCHEDULE_CONFLICT` for a reserved day in
the event/series span. Tournament dates are never moved or overwritten.
The event UI links commercial conflicts to Career Life rather than pretending
a commitment ID is a tournament ID. Declines are remembered; charity carries
neither a fee nor morality reward/penalty.

## Financial integration and merchandise

Accepting an appearance is not attendance or immediate payment. After A3
finishes the sporting week, the root-locked transaction completes due
commitments and calls A4 `post` with a stable idempotency operation.
Positive fees use `COMMERCIAL_APPEARANCE`; zero-fee work records completion
without creating a fake monetary entry.

Merchandise is an optional single lightweight agreement: replica shirt, signed
items or sponsor-linked merchandise (the latter requires an active contract).
Royalty terms are displayed before opt-in and fixed on agreement, not posted by
the browser. A4 posts `MERCHANDISE_ROYALTY` at completed four-week accounting
boundaries only after a minimum four-week agreement age. No backdated royalties
are created. Stop disables future royalties; it does not erase history.

Both categories use the existing `SPONSOR` headline (Sponsor/Commercial), never
prize `EARNINGS`, and update the normal A4 balance. There is no parallel wallet,
shop, inventory, pricing, bank simulation or equipment stat boost. Existing
sponsor terms, payments, obligations and status authority are unchanged.
Sponsor-linked work is a separately agreed commercial fee/royalty arrangement,
not automatic satisfaction or rewriting of sponsor obligations.

## News, threads and callbacks

News has a forty-story cap, twelve-world-story cap and two-per-event/player
bounds. A bounded recency boost prioritizes nearby human/meaningful rival news
without permanently pinning an old human headline above newer world events.
Unknown-week records remain season-scoped; no precise date is invented.
Trivial anonymous NPC grassroots results are excluded.

Threads derive from stable event lineage, Palace, Q-School, Card, ranking,
commercial history, public NPC Career and recurring rival IDs. They are
chronological factual chapters, not preassigned plots or win objectives.

Callbacks cite real previous played meetings/H2H, earlier shared finals,
confirmed cohorts, previous event results, exact owned venue identity, prior
title lineage and actual earlier semantic statements. At most two callbacks
are shown; a real prior statement takes priority. The thread can support the
earlier Palace confidence/later achievement example without scripting a title.

## Persistence and compatibility

Additive, idempotent tables, all cascading from `career_saves`:

- `career_life_decisions`: semantic decisions and bounded metadata; composite
  save/decision primary key.
- `career_life_commitments`: accepted/completed agreements and actual dated fee;
  unique save/season/day reservation.
- `career_life_merchandise`: one opt-in royalty agreement per save.

No copied weekly persona, awareness or NPC reputation counters. A3's calendar
migration creates the additive tables so standalone calendar harnesses can read
reservations. Application startup also registers the idempotent migration.
A4's category/headline guards are extended, not bypassed.

Existing saves derive stories/standing from existing public facts without
inventing earlier choices. Uninitialized/profile-incomplete saves remain
readable with no opportunities. Retired saves preserve factual stories,
choices, commitments and agreements without new moments, agreements, payments
or clock progression. Pending commitments are not falsely marked attended.
Save deletion/admin reset cascade all new tables.

## UI and security

Two navigation destinations within existing Career layers:
Career Life (Profile / Opportunities / History) and News & Stories (News /
Story Threads). The Hub gets a compact living-Career summary. Owned NPC
recognition links to separate public presentation. Existing visual language is
retained; the sidebar still has its three layers.

All routes require a trusted authenticated session, ownership, feature
availability/admin-test gating and `Cache-Control: no-store`. NPC reads check
actual membership. Strict choice-only request bodies reject arbitrary persona,
reputation, fees, royalty rates, dates, scores and extra fields. IDs are
validated, choices must be currently offered, expired/unavailable decisions
are refused, and root locks plus unique keys make replay/races safe.
An opportunity/merchandise decision cannot replay as a dialogue decision.
Unexpected failures return generic JSON, not query/stack details.
No DTO exposes hidden NPC ability, potential, form, development, seed or wallet.

## No-gameplay-effect boundary

No changes to throwing/scoring, player ability, bot personality/strength,
NPC ability/potential/form/development, sporting RNG, draws, ranking
contributions, Tour Cards, qualification, difficulty or human age decline.
No XP, morality, training, stamina, injuries, gambling or fictional lifestyle.

The intended exceptions are actual date reservations and A4 commercial money:
these can affect schedule choices/affordability, not a darts-performance
modifier or prize/ranking reward. Dialogue alone changes neither sporting
authorities nor money; persona cannot award A7.4 recognition.

## Verification

Built the API before checks, then rebuilt after implementation.

- Backend models: **73/73** — 24 A7.5 tests plus directly affected
  A7.1–A7.4/identity tests.
- Live HTTP/PGlite suite: **13/13** — existing human loops, legs/sets/double-in,
  concurrency, A7.1/A7.3/A7.4, A7.5 and admin reset.
- Frontend model/SSR suites: **79/79** — all five Career test files, including
  six added Life/UI tests.
- API bundle: pass.
- Scoped Career frontend TypeScript: pass; temporary config removed.
- Whole API TypeScript: the same **12 pre-existing broadcast diagnostics**;
  no new diagnostics in Life/calendar/migration code. Not a clean whole-API
  typecheck.
- `git diff --check`: pass.

Live tests use a test-only Express/session harness and embedded PostgreSQL.
The A7.5 case uses an explicitly labelled owned authored amateur result and
clock fixture for dialogue/merchandise eligibility, plus an accepted-date
fixture for the real A3 entry check. This is not a claimed multi-season title
run. HTTP accept/replay/decline and royalty mutations are real service calls;
fee/royalty verification invokes the same root-locked settlement used by A3.
It checks append-only ledger effects, unchanged prizes/sponsor terms, owned
public NPC reads, foreign-only NPC rejection, gates, retired/cold saves and
checksums of sporting authorities.

Heavy checks ran serially with memory limits. PGlite used heap 256 MB,
`--liftoff-only --wasm-num-compilation-tasks=1 --test-isolation=none`; SSR used
production mode/heap 400 MB; scoped frontend TypeScript used heap 640 MB.

## Known limitations

- Intentionally lightweight authored content, nine NPC traits and three tone
  classes; no NPC mental-state, celebrity or private-life simulation.
- Current world evidence is bounded: 1,200 significant result rows, 150 public
  Card rows, 150 significant qualifications and upsets from the latest 600
  completed matches (maximum forty). Older world narrative is not an exhaustive
  archive; human result/H2H authorities remain preserved.
- Venue memory needs an exact recorded venue key; season-only/provider records
  do not acquire invented precise dates.
- Content remains version one; future copy changes need a versioned historical
  renderer. No runtime text generation.
- Four offers in a window share one authored day. Fees and royalty thresholds
  are v1 values, not a certified long-career economy balance.
- Stopped merchandise cannot be repeatedly restarted/switched for extra income.
  A linked royalty agreement is separate from its originating sponsor terms.
- No deployed browser/production migration certification, full frontend
  production bundle or mandatory multi-season balance simulation was run.
  SSR verifies meaning, not pixels or touch/keyboard interaction.
- Previous unsupported sporting formats remain subject to the existing
  capability boundary; A7.5 does not unlock or fabricate them.

## Manual checklist — not executed

1. Open an existing active/legacy save: Hub summary, Profile and real history;
   no invented previous choices. Open a cold save and confirm no opportunities.
2. Reach a genuine significant moment: inspect context, select one of four
   responses, refresh/retry and confirm it is remembered only once.
3. Compare a reserved successful and fiery/divisive Career: awareness,
   reception, draw, persona and sporting recognition remain distinct.
4. Inspect a real rival/Palace return: verify prior match/final/event/venue or
   earlier-statement callback against its source.
5. Accept optional work: confirm the day/fee, try a colliding tournament,
   decline another offer and advance through completion. Check exactly one A4
   commercial entry and unchanged prize earnings.
6. Opt into eligible merchandise: inspect terms, advance at least four weeks
   to an accounting boundary, inspect normal ledger/balance, then stop.
7. Inspect significant NPC news and owned public presentation; verify no hidden
   attributes, invented quotes or all-NPC weekly counters.
8. Open a retired save and hidden/admin-test modes; check readability, no new
   progression/actions, tab navigation and narrow-screen presentation.

Publication is to main only after these proportionate checks. Stop at A7.5.
