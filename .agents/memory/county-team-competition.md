---
name: County team competition
description: Product scope and selected format for county representative play in Career mode.
---

Career mode should include playable county representative fixtures, not only individual county events, squad-selection displays, and standings derived from individual results. The user chose a UKDA-style structure: men's and women's A and B teams.

The player's selected county single must be thrown manually in the existing live scorer, not simulated on their behalf. Persist the dart log, record its result once, and prevent Career time advancing past the pending single.

A club-team season can open a county trial: count only the player's manually played singles, not teammate cover or simulated fixtures. Five appearances and two wins qualify for one manually played best-of-five trial; winning grants a county B-squad place without county ranking points.

Movement from county B to A is determined by the player's individual county selection ranking, not a second appearance-and-wins trial. The next-season projection should use current-season local, county, and regional event results.

The national World Cup route must also connect ranking-based call-up to a country pair, the event draw, and an actual live-scored match; selection logic alone is not enough.

**Why:** The user explicitly said the county/national route should be playable, selected the UKDA-style men's and women's A/B squad format, clarified that auto-simulating their own rubber did not make it playable, and chose individual county ranking as the B-to-A route. The club-trial bridge rewards real local participation without turning trial results into individual ranking points.

**How to apply:** Treat actual county-v-county fixtures, live human participation, persisted scoring, and progression gating as required. Show current ranking progress toward A places and keep trial-earned B places separate from individual ranking points. For national route audits, verify call-up through a playable World Cup match. Keep the individual county circuit and national World Cup route distinct from the representative team competition.
