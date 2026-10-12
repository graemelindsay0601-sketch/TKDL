# TKDL Career 2.0 — Progression & Season Pacing Audit

Branch `career-audit/progression-and-pacing`, cut from `main` @ `771861e`. Read-only product audit: **no gameplay,
finance, NPC, calendar or save authority was changed.** Everything added is a dev-only script under
`artifacts/api-server/scripts/career-audit/` plus one deliberately failing regression test.

## 0. Method and evidence

| Evidence | Script | What it is |
|---|---|---|
| Static calendar pacing, seasons 1/2/3/5/10/15/20 | `static-pacing.ts` | Real `generateSeason` (event DB v5) + real `evaluateRule`, fee, travel and prize tables, for **labelled** player states (ranks/entitlements assumed, not earned). Ayrshire home, travel v2. |
| Four simulated careers, 10 seasons each | `progression.ts --profile=A..D` | Real save → `initialize` → week-by-week `calendar()` / `enter()` / `advance()`; every human match played through the live dart loop (`live.open` / `bull` / `darts`). The human's throws come from the bot visit planner at a fixed skill average: **A 40, B 58, C 78, D 98**. That skill is the labelled fixture boundary; all titles, points, cards and money were earned through the real engine. |
| NPC world, 9 seasons | `world-run.ts` | NPC-only save (the human enters nothing); a snapshot each season of tiers, hidden ability (analysis only), ages, retirements and entrants, cards, champions and the world No.1. |
| Season-1 field check | `season1-check.ts` | Pro-world ranking depth by week; cancelled events by definition; major field sizes. |
| Integrity probes | `integrity.ts` | Advance retry / stale clock / reused operation key / entry retry. |
| Regression | `src/lib/__tests__/career-audit-unfillable-fields.test.ts` | **Fails on purpose** (PROG-01). |

All runs use an isolated in-memory PGlite database built with the production startup steps. No real save was opened.

**Harness limitations (read before the numbers).**

1. **Profile behaviour is a fixed policy.** The profile enters every playable event unless:
   - the event costs more than 20% of available money (50% with a card);
   - it is a non-local trip whose top prize is less than twice its cost (amateurs only);
   - entering would breach a reserve held back for Q-School.

   A real player chooses differently, so results are policy-sensitive.
2. **The harness signs one sponsor and never looks for another.** Missing sponsor income after season 1 in A–D is a harness artefact, not a game finding. Sponsor renewal is covered by `finance/harness.ts`.
3. **Run lengths.**
   - The 20-season world run was OOM-killed after season 9 (in-memory PGlite grew to about 4 GB). World results cover seasons 1–9. `AUDIT_PGDATA=<dir>` now allows an on-disk rerun.
   - Profile runs: see §3 for how many seasons each completed.
4. **A single world seed.** Conclusions about the shape of the world are hypotheses until repeated on other seeds.

---

## A. Progression map

Legend: **[S]** server-enforced rule (file) · **[UI]** guidance or recommendation only.

| Stage | Entry / eligibility | Ranking & qualification | Money | Progress ⇢ / regress ⇠ | Explained? | Key files |
|---|---|---|---|---|---|---|
| **Creation** | DOB, home locality, slot. Amateur, no card, £250. | — | £250 start [S] | — | Yes (creation flow) | `service.ts`, `finance/service.ts` |
| **Grassroots** | Locality catchment + AMATEUR_ONLY [S] (`R.all(R.country, AMATEUR_ONLY)`; county/club nights limited to `COUNTY_CATCHMENTS`) | `amateur` list (rolling 52 weeks) | Fee £5 (some free); prize £25 / £10 | ⇢ amateur ranking, county and regional entry. ⇠ none (no relegation) | Denial codes `OUTSIDE_REGION`, `INSUFFICIENT_FUNDS` | `calendar/catalogue.ts`, `content/events.ts` |
| **County / Regional** | Catchment or country + AMATEUR_ONLY [S] | `amateur` | £10 / £20; prize £75 / £150 | ⇢ national | Yes | same |
| **National / International amateur** | Open (`R.open()`) or country | `amateur` + `open-world` (v2 lists) | £35; prize £500 | ⇢ `open-world` top 32 → Open International Championship (**never runs, PROG-01**) | Partly | `content/events.ts:64-75` |
| **Vault (secondary)** | `nonTourCard` only [S] | `vault` (season) | Vault profile | ⇢ Vault Championship (top 16 or qualifier win), **never runs (PROG-01)**. The Vault Qualifier's `vault-tour` pass is redundant (PROG-06). | Partly | `content/events.ts:83-94,119-124` |
| **Major qualifiers (amateur)** | Open qualifier: `nonTourCard` + host country [S]. WC qualifier: UK zone and not pro-world top 64 [S]. Amateur World qualifier. | Prize counts toward `pro-world` | — | ⇢ amateur reaches the Open / World Championship. An amateur can top the world ranking (PROG-04). | Yes | `calendar/catalogue.ts:301-370` |
| **Q-School** (season 2 onward on v5) | First Stage: `nonTourCard` + zone [S], weeks 2 (UK days 2–4, EU days 5–7). Final Stage: needs `q-school-final:<pathway>` [S]. **No Q-School in season 1** [S] `generation.ts:86`. | First Stage top 9/day → Final Stage. Final Stage points 6/5/4/3/2/1. Day winners = direct card. Order of Merit UK 10 / EU 6. Any Q-School entry → `challenger-tour` pass. | £300 + £450 + travel. **UK First Stage all-in ≈ £570.** | ⇢ Tour Card (2 seasons). ⇠ none | Q-School screen | `sporting/qschool.ts`, `calendar/catalogue.ts:200-225` |
| **Challenger Tour** | `nonTourCard` + `challenger-tour` pass [S] | `challenger` (season). Top 2 → card. 3–10 → Final Stage exemption next season. | £50; prize £2,000 | ⇢ card or exemption | Yes | `sporting/cards.ts` `seasonReview` |
| **Tour Card / pro entry** | Card holders: Pro Circuit (`R.tourCard()`); European Series (card or qualifier) [S] | `pro-world` (rolling 104 weeks), `pro-circuit` (52), `european-series` (52) | £100 / £150; prize £15k / £25k | ⇢ majors by ranking | Yes | `sporting/config.ts` |
| **Majors** | Open (card or qualifier). Champions Masters (pro-world 24 or invitation). Matchplay (pro-world 16 or pro-circuit 16 or invitation). Double Crown (pro-world 32). European Championship (european-series 32). Grand Slam (top 2 at the Open or Amateur World Masters, same season, or invitation). Pro Circuit Finals (pro-circuit 64). World Championship (pro-world 32, pro-circuit 32, qualifier, invitation). [S] | `pro-world` | £0 fee; £100k (WC £500k) | — | Requirements visible | `calendar/catalogue.ts:301-370` |
| **Card retention / loss** | Season review at week 52 [S] | A card ending this season is renewed if `pro-world` ≤ 64; otherwise LOST → Final Stage exemption next season | — | ⇠ card lost → Q-School Final Stage (recovery path exists) | Tour Card screen shows retention cut | `sporting/cards.ts:101-170` |
| **Invitation-only events** | `INVITATION`: the human's `invited` fact is **always false** [S] `calendar/engine.ts:186-190` | — | — | World Series + World Series Finals unreachable for a non-host human (PROG-07). Champions Masters / Grand Slam / Matchplay are still reachable by ranking or result. | Denial `REQUIRES_INVITATION` | `calendar/eligibility.ts:106` |
| **Later career / retirement** | Human retirement is voluntary [S]; NPC retirement is probabilistic from age 45 [S] | — | — | Retired save is read-only; the legacy record is preserved | Legacy screens | `legacy/*`, `world/development.ts` |
| **Season boundary** | Advance is blocked until the Season Review is acknowledged (`BEGIN SEASON`) [S] `calendar/service.ts:298` | Week-52 review → off-season (A2) → new season | — | — | Yes (gate message) | `legacy/service.ts:50-58` |

---

## B. Calendar pacing report

### B1. Static pacing (labelled states, same calendar generator as live)

"Meaningful" means executable, enterable, RANKING or QUALIFIER, not SPECIAL, and not a club night outside the player's county.
"Worthwhile" means meaningful **and** either local or with a top prize at least twice the full trip cost.

| State | Weeks with 0 meaningful | Weeks with 0 worthwhile | Meaningful per week | Weeks with clashing meaningful options |
|---|---|---|---|---|
| A new amateur | 9–12 | 19–27 | ≈1.8 | **0** |
| B Q-School entrant (Challenger pass) | 5–9 | 15–23 | ≈2.2 | **0** |
| C new professional (card, unranked) | **18** | 25 | 1.21 | **0** |
| C2 professional ranked 50 | 19 | 24 | 1.21 | **0** |
| D world No.1 | 15 | 20 | 1.29 | **0** |

These figures cover seasons 1, 2, 3, 5, 10, 15 and 20. The professional rows are **identical in every season** checked.

Other per-season facts:

- About 630 instances per season, of which 53–66 are benched or unsupported: specials, pub doubles, Thursday Night Darts, regional champions league.
- No Q-School instances in season 1; 14 per season afterwards.

### B2. Findings from the live runs

- **Week 1 is empty for every profile in every season.** A–D played 0 events in week 1. The only denials were `OUTSIDE_REGION`.
- **The Pro Tour stops at week 31.**
  - The v3 catalogue cut it to 28 slots over 14 weeks.
  - From week 32 to 52 a professional has the majors and about seven amateur-grade opens or qualifiers.
  - A new pro has **18 zero weeks**, mostly 33–52.
- **Weeks 50–52 are empty for amateurs.** The World Championship period has nothing below it.
- **There are no genuine trade-offs.**
  - In no state and no season do two meaningful events overlap.
  - Choice is "enter or rest", never "which one". This is the core answer to *"meaningful choices or repetition?"*: **repetition**.
  - The pro season is the same fixed list every year, and the amateur calendar varies only by venue rotation.
- **Money limits amateurs more than the calendar does.**
  - Over its first three seasons, Profile A's policy skipped 938 non-local trips as not worth the travel and 98 events on budget.
  - Profile A played in only 23 of 52 weeks in season 1.

### B3. Season 1 on a new (v5) save (`season1-check.ts`)

| Fact | Value |
|---|---|
| Pro-world ranked participants, weeks 1–5 | **0** (first Pro Tour is week 6, then 92 → 141 by week 52) |
| Challenger events cancelled (`INSUFFICIENT_ENTRANTS`) | **20 / 20** (no Q-School, so no `challenger-tour` passes) |
| Vault Championship / Open International Championship | Cancelled (PROG-01) |
| Ranking majors | All completed with full fields (Open 128, Matchplay 32, Double Crown 32, European Championship 32, Grand Slam 32, Pro Circuit Finals 64, WC 123) |

Cards after season 1 fall from 120 to 94. In season 1 the only way a card can survive is ranking retention, and no new cards can enter: no Q-School, and no Challenger winners (§D).

---

## C. Financial viability report

Existing values (`finance/config.ts`): start £250. Fees and prizes are as listed in §A.

Travel bands:
- LOCAL £0
- DOMESTIC £60 + £70/night
- UK_IRELAND £90 + £80
- EUROPE £180 + £90 (+1 night)
- LONG_HAUL £900 + £120 (+2 nights)

Measured outcomes (balance at each season end):

| Profile | S1 | S2 | S3 | S4 | Notes |
|---|---|---|---|---|---|
| A (40) | £370 | £240 | £65 | £20 | Q-School First Stage denied `INSUFFICIENT_FUNDS` (cost ≈ £570) every year; drifting to zero; fell off every ranking by S4 |
| B (58) | £1,105 | £2,875 | £4,230 | £7,995 | Could not afford the Final Stage in S2 week 3 (£530 available); played it from S3; Challenger 15 → 7 → 12, so no card |
| C (78) | £27.8k | £382k | £753k | £1.11m | Card at the S2 Q-School (direct); retained by ranking |
| D (98) | £915k | £2.76m | £4.60m | £6.39m | Won the Open and the World Championship as an amateur in S1 |

Assessment:

1. **The entry barrier is real and unexplained.**
   - A new player cannot afford Q-School from the starting balance: £250 against about £570.
   - A weak amateur (A) never can. A modest one (B) reaches it a season late.
   - No income exists outside darts (finance categories are only fees, travel, accommodation, prizes, sponsor, refund and adjustment).
   - About seven free local events per season (Sunday League Sprint and Sudden Death nights; `scripts/career-audit/low-cost-events.ts`) mean £0 is **not a permanent stuck state**, but recovery is very slow. See PROG-05.
2. **Professional income dwarfs costs by about 10× to 70×.**
   - C: about £390k prize against about £28k costs per season. D: about £1.8m.
   - Once carded, money no longer constrains any decision and has nothing to be spent on. See PROG-08.
3. **There is a step from amateur to pro prize money.** National amateur pays £500 and the Pro Circuit pays £15,000. Challenger (£2,000) is the only bridge, and it does not exist in season 1.

Proposals follow the brief's format (existing value, outcome, adjustment, consequences, compatibility), but none were implemented:

- **Q-School travel or entry support.**
  - Existing: £300 entry plus travel; outcome A/B blocked.
  - Adjustment: for First Stage only, a one-off travel subsidy, or a bursary sponsor tier whose qualifying fact is "entered Q-School".
  - Compatibility: add it as a new finance or sponsor version only for new contracts. Historical ledger entries are untouched.
- **Pro-tier money sinks.**
  - Examples: coaching, equipment, management fees.
  - This is a design decision, not a defect, so it is out of scope for low-risk fixes.

---

## D. NPC world balance report (one seed, seasons 1–9)

| Season start | Population | Pros (mean hidden ability) | Live cards | Retired / new | World top-32 mean age | Top-32 players generated after S1 |
|---|---|---|---|---|---|---|
| 1 | 340 | 120 (63.8) | 120 | — | — | — |
| 2 | 369 | 112 (65.1) | 94 | 9 / 38 | 37.4 | 0 |
| 3 | 397 | 113 (65.0) | 90 | 10 / 38 | 38.6 | 0 |
| 4 | 422 | 110 (65.0) | 89 | 13 / 38 | 40.0 | 0 |
| 5 | 447 | 107 (65.2) | 88 | 13 / 38 | 41.3 | 0 |
| 6 | 460 | 105 (65.4) | 92 | 25 / 38 | 41.6 | 0 |
| 7 | 471 | 102 (65.7) | 92 | 27 / 38 | 42.8 | 0 |
| 8 | 485 | 102 (65.5) | 90 | 24 / 38 | 42.6 | 0 |
| 9 | 492 | 98 (65.8) | 92 | 31 / 38 | 43.3 | 0 |
| 10 | 511 | 96 (66.0) | 95 | 19 / 38 | 43.8 | 0 |

Tier counts at S1 → S10:
- Grassroots 125 → 293 (target 75)
- Amateur 95 → 122
- Professional 80 → 58
- Elite 40 → 38

Cards issued in season 2: Q-School 24 (7 direct + 17 Order of Merit), Challenger 2, retention 35.

The **same NPC was world No.1 at every season start from S3 to S10**, i.e. at the end of seasons 2–9 (8 seasons). That NPC also won 6 of the 8 World Championships of seasons 2–9.

Interpretation:
- **Card population is stable at about 90**, below the 120 founding cards. Fields are still filled.
- **No new generation reaches the top in 9 seasons, and the top 32 ages by about 0.7 years per season.**
  - The prospect config makes elite breakthroughs rare and slow: 82% of prospects have potential 40–65, only 3% have potential 78 or more, and pre-breakthrough growth is ×0.08.
  - The founding elite peak at 27–45 and then decline, so a generational cliff is plausible in seasons 12–20.
  - **This is a hypothesis** (one seed, 9 seasons). See PROG-09.
- **Population growth is unbounded below the target.**
  - Juniors (18 a season) and the women's intake arrive regardless of `targetPopulation()`.
  - Low retirement before 45 lets the grassroots pool grow to 4× its target.
  - Advance time per season rose from 154 s to 544 s in this harness. Part of that may be accumulated result tables rather than population; see PROG-10.
- Brief constraint respected: no RNG or generation version was touched. Any change needs a new generation version for new saves only.

---

## E. Player guidance findings ([UI] recommendations only; no screens were edited)

1. **Season-1 roadmap.** Say plainly on the Q-School and Calendar screens that Q-School first runs in season 2, weeks 2–3, and that the Challenger Tour opens only after a Q-School entry. Today a player can look for either all of season 1. The source is `generation.ts:86`.
2. **The Q-School cost should be visible early.** Show the all-in cost (about £570 from Scotland for the UK First Stage) and the player's progress toward it from mid-season 1.
3. **Explain "ranked but no card".** A player who reaches the world top 64 or wins a major as an amateur still needs Q-School. Say so on the Tour Card screen.
4. **Remove or explain unreachable targets.**
   - World Series and World Series Finals for non-host humans: the human is never invited.
   - The Vault Qualifier's "Vault Tour access" reward, which grants nothing (PROG-06).
5. **Off-weeks.** In the empty stretches (pro weeks 32–52, amateur weeks 50–52, and week 1) the hub could suggest rest, practice or sponsor activities so the player isn't simply clicking through.

---

## F. Defect register

Severity: P0 = data loss or blocked save; P1 = a core progression promise broken in every save; P2 = significant balance or pacing problem; P3 = polish.
Status: **Confirmed** = reproduced by code path and run/test. **Hypothesis** = supported but not proven.

### PROG-01 · P1 · Confirmed — Vault Championship and Open International Championship are cancelled every season
- **System:** A3 calendar field assembly.
- **Files:** `content/events.ts` (`open-finals` ~L72-75, `vault-championship` ~L91-94, qualifier outputs ~L119-123); `calendar/engine.ts` field assembly (~L263-300).
- **Reproduction:**
  - `node --test src/lib/__tests__/career-audit-unfillable-fields.test.ts` fails, listing both events.
  - `season1-check.ts` shows both cancelled with `INSUFFICIENT_ENTRANTS`.
- **Evidence:**
  - Both use `fieldPolicy: SELECTION`, `npcFill: [0,0]` and `invitationPolicy: null`.
  - With `fillTarget = 0` the only NPCs admitted are holders of an intake entitlement.
  - `open-finals` has no intake. `vault-championship` takes at most 3 (Vault Qualifier winners).
  - `minimumEntrants` is 8.
- **Expected:** the top-32 `open-world` and top-16 `vault` players contest a finale.
- **Actual:** it is cancelled even when the human qualified (C and D were No.1 on both lists in S1).
- **Impact:** every save, every season; the amateur tier's two capstone events never happen.
- **Fix:**
  - For these two definitions, select ranking-eligible NPCs up to field size, as the Palace World Championship already does for its qualifying places (`engine.ts` ~L283-291).
  - Or give them a non-zero `npcFill` restricted by their own eligibility rule.
- **Risks / compatibility:** changes event content. Ship it as a new event-database edition for new instances, leaving completed or cancelled history untouched.
- **Complexity:** S–M.

### PROG-02 · P2 · Confirmed — Season 1 has no route to a Tour Card and no Challenger Tour
- **Files:** `calendar/generation.ts:86`; `calendar/catalogue.ts:230` (Challenger needs `challenger-tour`).
- **Evidence:**
  - 20/20 season-1 Challenger events are cancelled.
  - No Q-School cards and no Challenger cards are issued at the end of S1, and cards fall from 120 to 94.
- **Impact:** the first in-game year cannot change professional status. For a new player that is a 52-week amateur phase with no professional ladder visible.
- **Fix (pick one, design call):**
  - (a) Guidance only (§E1). This is the lowest risk.
  - (b) Season-1-only Challenger access: grant `challenger-tour` from the S1 amateur ranking, or open S1 Challenger events to all non-card amateurs.
  - (c) A late-S1 Q-School.
- **Compatibility:** (b) and (c) need a v6 event database for new saves only.
- **Complexity:** (a) S, (b) M, (c) M.

### PROG-03 · P2 · Confirmed — Professional calendar is repetitive and empty after week 31
- **Files:** `calendar/catalogue.ts` (Pro Tour slots), v3 catalogue cut.
- **Evidence:**
  - §B1: identical pro schedule every season.
  - 18 zero weeks for a new pro.
  - 0 overlapping choices.
- **Impact:** no trade-offs, and a long dead stretch in the second half of every season.
- **Fix:**
  - Redistribute existing Pro Tour slots across weeks 32–48 (no new tournaments).
  - Add seeded week variance in placement for fixed-slot pro events.
- **Compatibility:** new event-database edition only.
- **Complexity:** M.

### PROG-04 · P2 · Confirmed — World ranking starts empty; one result can make a player world No.1
- **Files:** `sporting/rankings.ts` (no seeding); `sporting/service.ts` `initialize`.
- **Evidence:**
  - Pro-world depth is 0 in weeks 1–5.
  - Profile D became world No.1 in week 10 of season 1, as an amateur, on a single Open win.
  - Season 1 ranking-gated events then draw on S1-only form.
- **Impact:** the early-season ranking is meaningless, and a new save can show an amateur at the top of the world.
- **Fix:** seed founding pros with a synthetic prior-season contribution set at `initialize`, derived from the existing hidden ability order and recorded as a provider contribution.
- **Compatibility:** new saves only; a ranking-rules version note is required.
- **Complexity:** M.

### PROG-05 · P2 · Confirmed — Starting balance cannot reach Q-School; weak amateurs drift to zero
- **Files:** `finance/config.ts` (start £250; Q-School fees); `finance/travel.ts`.
- **Evidence:**
  - Profile A was denied the UK First Stage (`INSUFFICIENT_FUNDS`) in S2 and S3.
  - Profile A's balance went £370 → £240 → £65 → £20.
  - Profile B could not afford the Final Stage in S2 after earning it.
- **Impact:** the only professional entry route is gated by money that weaker players cannot accumulate, and the game does not explain this.
- **Not a stuck state:** about 7 free local events a season exist.
- **Fix:** guidance first (§E2). Optionally, a Q-School travel bursary as a new finance or sponsor version.
- **Complexity:** S (guidance) / M (bursary).

### PROG-06 · P3 · Confirmed — The Vault Qualifier's `vault-tour` pass is meaningless
- **Files:** `content/events.ts:85-87` (Vault Tour eligibility `R.nonTourCard()`), `:119-121` (qualifier output).
- **Fix:** drop the redundant output in the next edition, or relabel it in UI copy.
- **Complexity:** S.

### PROG-07 · P3 · Confirmed — Invitation-only events are unreachable for the human
- **Files:** `calendar/engine.ts:186-190` (human `invited=false`); `calendar/eligibility.ts:106`.
- **Evidence:** a static scan with the human given every ranking and result (`scripts/career-audit/invitation-scan.ts`) shows `world-dart-series` (needs host country USA or an invitation) and `world-dart-series-finals` are unreachable for a GBR human.
- **Impact:** low; these are non-ranking exhibitions.
- **Fix:** grant the human invitations using the same NPC `invitationPolicy` weighting by tier or ranking, or hide these events from non-host humans.
- **Complexity:** M (invitations) / S (hide).

### PROG-08 · P2 · Confirmed — Money is irrelevant once professional
- **Evidence:** C and D earn £390k to £1.9m a season against about £28k costs (§C).
- **Impact:** one of the four Career pillars (finance) stops mattering after Q-School.
- **Fix:** a design decision (money sinks or pro expenses). **Not** a low-risk fix.

### PROG-09 · P2 · Hypothesis — No generational turnover at the top
- **Evidence:**
  - 0 post-S1 players in the world top 32 after 9 seasons.
  - The top-32 mean age rose from 37.4 to 43.8.
  - The same world No.1 for 8 seasons.
  - Prospect config in `world/config.ts`: potential ≥ 78 for about 3% of prospects; pre-breakthrough growth ×0.08.
- **To confirm:** a 20-season on-disk world run on 3 seeds (`AUDIT_PGDATA=... node scripts/career-audit/world-run.ts --seasons=20`).
- **Fix (only if confirmed):** a new world generation version for new saves, raising the high-potential prospect weight or breakthrough growth.
- **Complexity:** M.

### PROG-10 · P2 · Hypothesis — Population growth slows week advance over a long career
- **Evidence:**
  - Population 340 → 511 in 9 seasons; grassroots 125 → 293 against a target of 75.
  - Harness season time 154 s → 544 s.
- **To confirm:** profile `advance` by table size against population on a real Postgres instance.
- **Fix:** have annual cohorts respect `targetPopulation()`, or raise amateur retirement for long-term low-ability players. This needs a new generation version.
- **Complexity:** M.

### Integrity checks — passed (no defect)

| Check | Result |
|---|---|
| Advance retry (same `operationKey`) | Returns the stored result; finance, results and ranking-contribution counts unchanged |
| Stale clock | 409 "Career calendar has moved" |
| Reused key with different input | 409 |
| Entry retry | `created:false`; fee charged once |
| Season Review gate | Advance is blocked until `BEGIN SEASON` |
| Card review | C/D Q-School cards (S2–S3) were renewed at the S3 review by ranking (`TERM_COMPLETED_RETAINED` → `RANKING_RETENTION` S4–S5); the world run issued retention, Q-School and Challenger cards every season |
| Off-season | Ran on every boundary (A2 snapshot changes each season); the profile runs crossed 4–8 boundaries without error |

---

## G. Top-5 backlog (value against risk)

| # | Item | Findings | Risk | Quick win? |
|---|---|---|---|---|
| 1 | Let the two amateur finales fill from their own ranking-eligible NPCs | PROG-01 | Low; two definitions, new edition | **Yes** |
| 2 | Player guidance: season-1 roadmap, Q-School cost and timing, "ranked but no card", unreachable invitations | PROG-02, 05, 07, E | Very low (copy and read-only facts) | **Yes** |
| 3 | Remove the redundant Vault Tour pass output | PROG-06 | Very low | **Yes** |
| 4 | Season-1 Challenger access or a late-S1 Q-School (new saves) | PROG-02 | Medium | No |
| 5 | Spread the Pro Tour across weeks 32–48 (existing slots) | PROG-03 | Medium | No |

Then: ranking seeding at creation (PROG-04); confirm or deny PROG-09 and PROG-10 with longer multi-seed runs; then the finance-sink design (PROG-08).

## H. Final recommendation

Career 2.0's systems are **sound**. Rules are enforced on the server, retries are idempotent, card review, the off-season and the ledger all held over the runs, and every stage from grassroots to world No.1 is reachable.

The weaknesses are **pacing and content shape**, not integrity:
- the amateur capstones never run;
- season 1 cannot change professional status;
- the pro calendar is fixed and empty after week 31;
- money stops mattering once carded.

Recommendation:
1. Ship items 1–3 (low risk) as the next change.
2. Treat items 4–5 as a v6 event-database edition for new saves.
3. Do not change world generation until PROG-09 and PROG-10 are confirmed on longer, multi-seed runs.

## Implementation handover (highest value, low risk)

1. **PROG-01 fix.**
   - In `content/events.ts`, give `open-finals` and `vault-championship` a selection path for NPCs that satisfy their own eligibility. Reuse the existing `npcFill [0,0]` + SELECTION branch in `engine.ts` by adding an `invitationPolicy` with `count: 0`, so the "qualifying pool first" block runs. Or set `npcFill: [1,1]`: eligibility already restricts the pool to `open-world` 32 / `vault` 16.
   - Ship it as a new event-database edition (v6) so v1–v5 snapshots are unchanged.
   - Acceptance: `career-audit-unfillable-fields.test.ts` passes; `season1-check.ts` shows both events COMPLETED with at least 8 entrants; existing calendar and season tests still pass.
2. **Guidance copy (PROG-02, 05, 07).** Hand to the Career UI owner; no shared components touched here. Data is already available: the Q-School instances and their finance preview in `calendar()`, and Tour Card `retention`.
3. **PROG-06.** In the v6 edition, drop the `vault-tour` SERIES_ACCESS output from `vault-qualifier`, or keep it and correct the label.
