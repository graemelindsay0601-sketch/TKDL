---
name: Career calendar scope
description: User's durable requirements for realistic professional, amateur, and grassroots darts progression.
---

Career should reflect a plausible real darts career: players may start through club, pub, local, county, and amateur competitions before progressing to regional, national, WDF, and PDC-level events. Keep those lower-level routes broad and viable. Career tournament fixtures should use real darts competition formats and represent actual PDC/WDF circuits; novelty games such as Cricket, Halve-It, or Golf are not tour events. Vault is an intentional optional in-game tour and must remain available, spaced around headline events.

**Why:** the user asked for a realistic career pathway without non-circuit events displacing real routes, and clarified that Vault is a desired optional game tour rather than unwanted calendar clutter.

**How to apply:** when changing Career calendar content, preserve the playable grassroots ladder, use distinct names inspired by real competitions where needed, keep Vault optional and well-spaced, and preserve history when replacing future unplayed fixtures.

Career tournaments should expose their real draw as a playable route: show round formats precisely and let the player launch an awaiting live match directly from the draw. Keep actual results server-authoritative and manually scored.

**Why:** the user approved expanding tournament draws and event-format fidelity, with actual playing progression as the focus.

**How to apply:** reuse the persisted draw and format definitions instead of generating client-side brackets or inventing results; display sets, legs-per-set, and each round's authored format clearly.

Players may book an event on each available day of a week; keep the one-event-per-day and overlap rules, but do not impose a weekly event-count cap. Continue Career must stop for a live money match or reserved/live DartCast stream so it cannot silently advance past a scheduled activity.

**Why:** the user explicitly asked to build a full seven-day schedule and reported Continue skipping booked activities while trying to arrange streams and money matches.

**How to apply:** preserve daily booking limits and budget checks, and add regression tests whenever the calendar's Continue behavior changes.

Local team leagues should be a viable Career path, not only background simulation: joining and taking part in a club season should build the player's local profile and improve access to opportunities or sponsors.

**Why:** the user said local league participation should be a real option that can make the player more popular and lead to more chances or better sponsors.

**How to apply:** preserve actual player participation in the league path, and connect team-season performance to meaningful local recognition and opportunity outcomes.

Local team membership is opt-in each season. A joined player who is free must play their own scheduled single in the live Career scorer; if booked elsewhere, a teammate stands in and the player's personal record and profile do not change. Team results must not become official tournament finishes or ranking money. Genuine appearances and wins can build local reputation and unlock local sponsor interest.

**Why:** the user clarified that a teammate should cover missed team nights without affecting the player's stats, and that the league should be a fully robust, meaningful Career option.

**How to apply:** keep team fixtures, substitutions, live personal rubbers, calendar blockers, and sponsor eligibility distinct and idempotent; preserve prior saves and historical sponsorship terms.

The week planner may offer a future activity only when its availability and booking paths support that exact week; never reuse current-week availability as a prediction.

**Why:** a future option must lead to a genuinely bookable slot rather than a link that fails or silently books a different week.

**How to apply:** pass the selected week through both the activity read and booking request, and omit activities whose services remain current-week-only.

After the weekly DartCast stream limit is reached, release any unused reserved stream nights so they cannot trap Continue in a redirect back to DartCast.

**Why:** the user reported that hitting the stream cap left no way to finish the day and move Career forward.

**How to apply:** when ending or advancing after the cap, clear remaining accepted DartCast reservations for that week; retain the blocker only while a stream is live or the cap has not been reached.

Series league points are standings inputs for that series only; do not add them to Career prize-money ranking contributions.

**Why:** competitions such as the ANZ Premier League award table points independently of the prize money used by the Career ranking lists.

**How to apply:** use series points only for that series' standings, seeding, and qualification; keep rankings tied to their authored ranking rules.

The World Cup of Darts is a recurring annual 40-nation pairs event, not a one-off. Preserve the current group-to-knockout structure and keep persistent national squads available for its full field.

**Why:** the user clarified that the event recurs and approved expanding the Career player world so every national pair can be drawn and played.

**How to apply:** preserve annual recurrence, the 40-team draw and live match progression, and migrate existing saves without rewriting completed event history.
