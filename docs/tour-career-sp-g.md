# SP-G — Equipment & Signature Products

Equipment loadouts are cosmetic only. They never change player stats, scoring, match physics, rankings, XP or RNG.

## Signed rights and product lifecycle

Only an active equipment agreement whose signed, immutable `contractFoundation.productRights.productTypes` lists a product type can authorize drafts. The lifecycle is server-controlled: draft → player approval → launch → retirement. Existing v1–v4 contracts and product history are not backfilled or rewritten.

Launched products remain in history. Sales continue only while an active contract with the same sponsor carries the corresponding signed right; renewal requires that right in its new terms. Expiry, release or replacement without that right stops future sales and leaves posted history intact.

## Balance and settlement

- Signature darts: £69.99. Signature ranges / personalized-flight collections: £24.99.
- Deterministic weekly demand: 8–34 units, capped at 100 per product/week.
- Limited editions: 25–500 total pieces, stopping at declared inventory.
- Royalty: 8% of persisted gross sales, integer pence, floor rounding.
- Idempotency: one sales row and one A4 `MERCHANDISE_ROYALTY` posting per product/Career season/week.

Demand does not depend on player ability or match results. New activity/contract duties are not implied by product rights.
