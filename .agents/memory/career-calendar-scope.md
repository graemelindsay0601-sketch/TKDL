---
name: Career calendar scope
description: User's durable requirements for realistic professional, amateur, and grassroots darts progression.
---

Career should reflect a plausible real darts career: players may start through club, pub, local, county, and amateur competitions before progressing to regional, national, WDF, and PDC-level events. Keep those lower-level routes broad and viable. Career tournament fixtures should use real darts competition formats and represent actual PDC/WDF circuits; novelty games such as Cricket, Halve-It, or Golf are not tour events. Vault is an intentional optional in-game tour and must remain available, spaced around headline events.

**Why:** the user asked for a realistic career pathway without non-circuit events displacing real routes, and clarified that Vault is a desired optional game tour rather than unwanted calendar clutter.

**How to apply:** when changing Career calendar content, preserve the playable grassroots ladder, use distinct names inspired by real competitions where needed, keep Vault optional and well-spaced, and preserve history when replacing future unplayed fixtures.

Players may book an event on each available day of a week; keep the one-event-per-day and overlap rules, but do not impose a weekly event-count cap. Continue Career must stop for a live money match or reserved/live DartCast stream so it cannot silently advance past a scheduled activity.

**Why:** the user explicitly asked to build a full seven-day schedule and reported Continue skipping booked activities while trying to arrange streams and money matches.

**How to apply:** preserve daily booking limits and budget checks, and add regression tests whenever the calendar's Continue behavior changes.

The week planner may offer a future activity only when its availability and booking paths support that exact week; never reuse current-week availability as a prediction.

**Why:** a future option must lead to a genuinely bookable slot rather than a link that fails or silently books a different week.

**How to apply:** pass the selected week through both the activity read and booking request, and omit activities whose services remain current-week-only.

After the weekly DartCast stream limit is reached, release any unused reserved stream nights so they cannot trap Continue in a redirect back to DartCast.

**Why:** the user reported that hitting the stream cap left no way to finish the day and move Career forward.

**How to apply:** when ending or advancing after the cap, clear remaining accepted DartCast reservations for that week; retain the blocker only while a stream is live or the cap has not been reached.

Series league points are standings inputs for that series only; do not add them to Career prize-money ranking contributions.

**Why:** competitions such as the ANZ Premier League award table points independently of the prize money used by the Career ranking lists.

**How to apply:** use series points only for that series' standings, seeding, and qualification; keep rankings tied to their authored ranking rules.
