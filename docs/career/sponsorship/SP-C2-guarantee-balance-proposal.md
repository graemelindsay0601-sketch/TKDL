# SP-C2 — sponsor guarantee balance proposal

**Status: review proposal only. Not approved, not active, and not a new contract catalogue.**

## Decision

The current supported sponsor catalogue is v3. Its guarantee schedules are empty for every sponsor; no approved sponsor-guarantee budget or schedule was found in the source or existing sponsorship documentation. Keep v1–v3 snapshots unchanged and do not publish a v4 schedule until the amounts and contract-end policy are approved. Existing offer and contract snapshots, signing bonuses, event payments, earned bonuses, ledger entries and cost coverage remain authoritative.

The player-facing finance screen must describe new guarantees as **awaiting balance approval**. This does not alter or hold back any payment already promised in a signed snapshot. It means the current catalogue issues no new guarantee term.

## Candidate schedule matrix

Every row below is a design candidate, not a priced promise. `TBD — balance approval required` is deliberate: no unsupported amounts are introduced.

| Sponsor tier / relationship categories | Candidate guarantee treatment | Cadence / instalments | Term duration | Guaranteed amount and total value | Existing cash terms to include in balancing |
| --- | --- | --- | --- | --- | --- |
| Local — local/regional partners | No recurring guarantee in the first release; retain the existing small signing/event model. Revisit only if a local sponsor needs a specific one-off commitment. | None proposed. | Existing signed duration, commonly the remainder of the season. | N/A while no guarantee is proposed. | v3 local terms generally use £75–£100 signing cash and £7.50–£10 per eligible event; the actual brand snapshot controls. |
| Regional — equipment, apparel, travel and secondary commercial | Candidate for a modest season guarantee only after portfolio simulations; do not stack it automatically on top of signing cash and travel/entry coverage. | Four equal instalments per Career season (weeks 1, 14, 27, 40); no pre-signing instalment. | Use the duration recorded in the accepted offer; schedule only dates within the signed term. | Annual amount: TBD. Installment: annual amount ÷ 4, with remainder pennies assigned to the earliest instalments. Lifetime total: TBD from the exact signed start/end dates. | Existing v3 signing/event terms vary by sector: equipment about £350–£500 / £20–£25 per event; apparel about £250 / £15; travel/automotive about £200 / £10. These are separate cash terms; cost coverage is not cash. |
| Professional — equipment, apparel, primary/secondary commercial and travel | Candidate only after an aggregate portfolio ceiling and early-termination treatment are agreed. Prefer one guarantee schedule per contract rather than one per sponsor activity. | Four equal instalments per Career season (weeks 1, 14, 27, 40) as a first candidate; no ON_SIGNING guarantee in addition to the existing signing bonus. | Use the exact signed term; do not infer a new duration from the tier. | Annual amount and lifetime total: TBD — balance approval required. | Existing v3 signing cash ranges from £1,000–£2,000 for most professional categories; Northline is an exception. For most v3 professional sponsors, the former appearance payment is a conditional performance bonus, not an unconditional event payment. Northline retains its distinct direct event-payment terms. |
| Elite — equipment, apparel, travel and primary/secondary commercial | Candidate for a capped season guarantee only after combined multi-sponsor exposure is modelled; the current elite catalogue inherits substantial signing, appearance, performance and cost-cover terms. | Four equal instalments per Career season as a candidate; no separate signing guarantee until priced independently from signing cash. | Use the exact accepted contract snapshot (the current elite model is multi-season). | Annual amount and lifetime total: TBD — balance approval required. | The current elite template includes £50,000 signing cash, £1,000 per eligible event, performance bonuses and broad eligible cost coverage. These existing terms must be included in any guarantee cap model. |

### Schedule rules to preserve

- A recurring rule's amount is the total per Career season, split into integer-pence instalments. First eligible date is on or after the signed start date; no retrospective catch-up.
- A payment is cash only when posted to A4's immutable finance ledger. It must remain distinct from signing cash, event cash, earned conditional bonuses and non-cash cost coverage.
- Payment identity remains stable per contract, term, scheduled date and instalment. Retries must not duplicate ledger rows or sponsor timeline events.
- Only dates inside the accepted contract's signed start/end window are scheduled. The calendar pays the exact due week before running the lifecycle transition for the new week.
- Current system behavior stops future scheduled payments when a contract is explicitly replaced or otherwise ends. No termination buyout, acceleration, penalty or settlement is implemented. Because the contract terms do not yet define whether future guarantee instalments survive early termination, that policy must be approved before any guarantee schedule becomes live.
- Compatible sponsors can coexist. A v4 proposal therefore needs both a per-contract ceiling and an aggregate portfolio ceiling; neither is defined by the current approved catalogue.

## Balance approval inputs still required

1. Approve amounts per tier/category, instalment cadence/count and duration treatment.
2. Approve whether mid-season first-year guarantees are prorated or simply paid on remaining scheduled dates.
3. Approve what happens to future instalments after player replacement, sponsor termination or early expiry. No buyout or penalty should be inferred.
4. Set per-contract and combined portfolio ceilings, including existing signing/event cash, conditional bonuses, travel/entry coverage and overlapping agreements.
5. Re-run lifetime and season-level cash exposure across the actual eligible athlete progression, not just a single sponsor contract.

Until these inputs are approved, keep catalogue v3 as the current version and keep its guarantee arrays empty.
