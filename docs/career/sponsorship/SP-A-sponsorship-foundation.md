# Career sponsorship foundation — SP-A

## Scope and starting point

This is the data/content foundation only. It deliberately stops before an NPC
sponsorship market, negotiations, player-facing sponsor offers, new finance
rules, shirt artwork, or sponsor UI.

The existing A4 sponsor catalogue, offer/contract snapshots, exclusivity
checks, ledger payments and cost coverage remain the authority for the human
player. SP-A does not replace or reinterpret them. The current fictional brand
catalogue has 52 entries; this work validates that catalogue rather than
replacing it.

## Content model

Sponsor definitions now validate their stable key, category, tier, geographic
identity, presentation tokens, targeting/tendency content, roster strategy and
active state. The supported categories are main, equipment, travel, local,
apparel and secondary partners.

Sixteen fictional representatives have stable IDs and static role/name
content. They are not simulated people, do not negotiate, and have no
independent schedules or finances. Existing sponsor terms may optionally carry
validated category, representative and typed contract-foundation fields.
Older v1/v2 snapshots remain valid without those fields; catalogue validation
runs for every shipped sponsor catalogue version.

The contract-foundation shape is a schema only: it can describe payment
schedules, commitments, opportunities, exclusivity, sporting priority,
release/termination, renewal and product rights. New metadata defaults to
empty or unconfigured values. Existing A4 payment amounts, timing, coverage and
acceptance behavior are unchanged.

## Save-owned NPC relationships

The new additive `createCareerSponsorshipFoundationSPA1` migration creates:

- One per-save world marker, including content/generation versions and the
  initial population/relationship counts. The marker exists even when a
  deterministic world generates no relationships.
- Save-scoped NPC relationship history with sponsor key, category,
  representative ID, lifecycle period/status and an immutable sponsor content
  snapshot.

When a new Career world is first initialized, NPC relationships are selected
from the seed, world-generation version and stable NPC IDs. The same inputs
always produce the same records. Each NPC receives at most one initial
relationship; the initial content pass selects only active non-local brands
with a curated representative. No player character is assigned a sponsor.
Database uniqueness, composite save/NPC ownership and checks protect these
records; historical identity and snapshot fields cannot be edited in place.

The existing `commercial` NPC projection is intentionally unchanged. The
Career player-content response exposes persisted records separately as
`sponsorshipFoundation`. Saves with no marker are reported as
`LEGACY_CONTENT_ONLY`; they are not silently backfilled, rerolled or rewritten.
No public mutation route was added.

## Migration and compatibility

The new migration is additive and runs after the Career world tables exist.
Prior migrations are not edited. Existing worlds and saves are not rewritten
or assigned NPC sponsor records during deployment. New worlds get the marker
and their deterministic initial records in the same transaction as NPC
creation. Save deletion cascades only through that save's new records.

## Deliberately deferred

- NPC sponsor offers, negotiation, contract changes and financial simulation.
- New human sponsor gameplay or any change to A4 payment/coverage rules.
- Shirt designs, sponsor-logo placement and Career visual/UI changes.
- Sponsor-driven news/rivalry presentation.

Those features can build on the stable IDs, typed categories, contract
foundation schema and immutable save-scoped history without changing the A4
finance authority or rewriting prior snapshots.

The user supplied a visual reference set for the later player-facing contract
and sponsor work. It covers a commercial market and brand profiles, sponsor
offers and negotiations, signing and relationship progression, commitments
and optional opportunities, contract/history views, and a season commercial
review. Treat these images as the intended visual direction for that later UI
phase; they are guidance, not functionality delivered by SP-A.
