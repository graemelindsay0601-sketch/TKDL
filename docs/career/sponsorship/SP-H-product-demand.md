# SP-H signature-product demand rules

This is the immutable `demandVersion: 2` rule for product sales generated after the SP-H migration. It applies only to future weekly sales rows. Existing SP-G sales remain version 1 and retain their recorded unit, gross and royalty amounts.

## Demand

For each launched product and Career week:

1. Compute the existing stable product/season/week hash demand, bounded at 8–34 units.
2. Add up to 12 units for current-season human tournament titles completed by the current week (3 per title).
3. Add 5 units for a last-published World ranking of 1–16, or 3 units for 17–32. No other rank bonus applies.
4. Add 6 units when at least one optional `PRODUCT_LAUNCH` opportunity for that product's manufacturer is recorded `COMPLETED` in the current season by that week, and no earlier than the product's recorded launch week. Only opportunities materialized from an explicit signed SP-D clause qualify.
5. Cap each week's product sales at 100 units, and additionally cap limited editions at their remaining edition inventory.

The sales row stores its demand version and the bounded, auditable evidence inputs. Demand affects only simulated product-market units. It never modifies darts ability, match outcomes, tournament entry or sponsor contract terms.

## Money and history

Retail prices remain £69.99 for signature darts and £24.99 for signature ranges. The player's royalty remains 8% of gross, floored to whole pence and posted once through A4 as `MERCHANDISE_ROYALTY`. Gross product turnover is not player income. Existing sales and A4 entries are append-only; the SP-H migration adds only nullable-in-practice historical metadata defaults (version 1, empty evidence) plus the read-state table for the commercial inbox.

Optional sponsor product-launch activities remain consequence-free when declined. This rule does not create a new activity, promote a product automatically, or add a mandatory clause to any existing contract.
