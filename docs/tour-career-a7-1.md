# A7.1 Career facts, statistics, records and history

## Authorities and API
`GET /api/career/saves/:id/facts` composes a read-only snapshot under the existing root lock, normal authentication, feature availability and save ownership. Retired saves remain readable. No persistence, migrations or version changes are introduced. Existing restart/delete/reset cascades remain authoritative.

A1 supplies lifecycle/season/immutable identity; A2 save-specific NPC names; A3 completed matches, event results and qualifications; A4 sponsor signing facts and existing finance presentation; A5 published ranking positions, milestones and Tour Cards; A6.5 completed live sessions and stored age facts. Money/rankings are not recalculated.

## Statistics and records
Completed matches are deduplicated by match ID; byes/walkovers do not count as played. Completed human event results are deduplicated by event ID. Events entered explicitly means completed events with a human result, not pending registrations. Titles, runners-up, semi/quarter-finals and best finish come from A3. A3 result losses may include walkovers and are not summed as played matches.

Win percentage uses completed matches. Streaks follow season/day/round/slot and become unavailable for ambiguous same-day events. Seasons played counts seasons with completed evidence. Records include first match/win/final/title, latest title, total titles, earliest best published World Ranking, longest streak, first Tour Card, evidenced regains and highest existing presentation-tier titles. Card regains require a dated gap after loss/expiry/surrender and exclude retention; no invented prestige score.

## Actual darts
Completed sessions replay the canonical X01 rules; human seat zero follows A6.5. Three-dart average is total net visit points * 3 / actual human darts, weighted across matches. Busts score zero. Other measured facts: completed checkouts, highest checkout, 180s, inclusive 140+/100+ counts, highest visit, best match average and most 180s in a match. Duplicate match evidence does not count twice.

Coverage distinguishes measured and unavailable matches. No evidence yields null/unavailable, not fake zeroes. Target intent is absent, so checkout attempts/percentage are unavailable. First-nine and per-event performance records are deferred. NPC statistics and missing historical darts are never fabricated.

## Timeline and UI
Existing History/Trophy Room retains trophies, seasons, finals, finance and sporting history. Added overview, Playing, Records and World panels; composed Timeline includes Career start, matches/results, milestones/cards, sponsor signings and qualifications. Journey links to History. Classic Tour is unchanged.

Facts carry source and Career season/week/date where supported. Event ages reuse age at event start; weekly facts use week-start dates. Unknown dates remain unavailable and season-only facts sort last within their season. Sponsor termination is omitted because wall-clock end time/planned duration do not establish actual Career termination time. First finals/titles require completed events.

World champions and published pro-world leaders are save-specific. NPC names reflect saved-world names. No news/rivalries/reputation/stories are generated. History is unpaginated; large-save pagination is deferred.

## Checks and manual notes
Focused tests cover deduplication, chronology/streaks, empty evidence, dart arithmetic, live record updates, duplicate submissions, ownership, stored ages, retirement, restart/delete and existing Career-only reset. Frontend typecheck passes. API typecheck has 12 pre-existing broadcast errors. Local frontend build/UI tests lack the optional Windows Rollup binary; API build hits esbuild filesystem access errors. No troubleshooting dependencies were added.

Manual check: open new/existing Careers, inspect History tabs and Journey link, complete a live match then revisit Playing/Records, and inspect retired-save history. No broad simulations or new fixture infrastructure.
