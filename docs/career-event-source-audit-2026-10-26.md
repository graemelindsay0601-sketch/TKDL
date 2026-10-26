# Career event and ranking source audit

**Audit date:** 26 October 2026  
**Scope:** Current Career event catalogue (event database v34), ranking rules v5, and the official-source checks completed in this pass.

## Findings

### WDF senior rankings — substantially aligned

Career's senior WDF point model matches the published senior framework in the areas checked: 52-week rolling windows, best 10 main-table results, best 8 regional results, the published grade/finish points and minimum-entry thresholds, and reduced Silver-equivalent points for Platinum/Gold results on regional tables. The current regional list keys (Australia, Canada, New Zealand, Russia, USA) also match the senior criteria.

The rules' singles-only scope and exclusion of current PDC Tour Card holders are represented in the event/ranking pipeline. Team-cup events are not added to the WDF singles points tables.

**Status:** Aligned on the reviewed criteria; this is not a complete re-certification of every senior event's grade, eligibility, draw, or qualification rules.

### WDF Youth and Under-23 rankings — material coverage gap

WDF publishes separate Youth and Under-23 ranking criteria, in addition to Seniors. Both 2026 documents specify:

- Open and Girls divisions, with different age eligibility (under 18 and ages 18–22 respectively, measured on 31 December).
- Singles events only; current PDC Tour Card holders are ineligible.
- 501, straight-in, double-out; local tournament bodies approve the event format within WDF limits.
- The same grade points and minimum-entry thresholds as the senior tables.
- Rolling 52-week main tables counting each player's best 10 results and regional tables counting the best 8; majors do not count regionally.
- Regional tables for Australia, Canada, New Zealand, Russia and the USA.

Ranking rules v5 contains only senior WDF Open/Women's main and regional point lists. The WDF points pipeline also recognizes only senior ranking categories/grade keys. The existing Career Youth Order of Merit is a separate season-based Career list; it is not a substitute for WDF Youth or Under-23 tables. Accordingly, current Career WDF points do not cover the official Open/Girls U18 and U23 rankings or their regional tables. The event database also needs distinct ranking identities for those divisions rather than treating all girls' events as one undifferentiated `YOUTH` category.

**Status:** Not aligned. Adding these tables should use a new ranking-rules edition and preserve old save snapshots/results through a tested migration.

### WDF Cups and pairs — scope distinction required in presentation

The Youth criteria rank singles events only. Career correctly keeps team-cup competitions out of WDF singles points. The catalogue also has playable youth-pairs divisions; they may remain Career competitions, but must not be presented as WDF-ranked singles results. Career's own season-based youth merit is distinct from official WDF Youth standings.

**Status:** WDF points exclusion is aligned; ensure the UI labels do not imply official WDF ranking credit for pairs.

### PDC calendar, event formats, and ranking rules — not certified in this pass

The official PDC sitemap exposes the current rankings-rules and tournament pages. However, the PDC pages returned dynamically rendered shells in the available fetch path, and the search service was unavailable. I could not read authoritative text for the 2026 event formats, prize-money ranking eligibility, annual schedule, or qualification rules. Internal tests confirm expected Career counts for the Women's Series, Development Tour, and European Tour, but those tests are not independent evidence of PDC rules.

**Status:** Open; do not treat the PDC portion as source-verified yet.

## Official sources reviewed

- WDF Rules index (lists current Seniors rev 50, Youth rev 19, and Under-23 rev 5 ranking criteria): <https://dartswdf.com/rules>
- WDF Main Rankings and Regional Tables: <https://dartswdf.com/rankings>
- WDF ranking-table rules (rolling windows, best-result counts, and regional reductions): <https://dartswdf.com/ranking-table-rules>
- WDF Seniors World Ranking Systems Criteria, rev 50, 17 Aug 2026: <https://dartswdf.com/storage/uploads/923afcee-0f2c-45e1-aef0-5813d8fa5cbf/2026-08-17_World_Ranking_Systems_Criteria_Seniors_50.pdf>
- WDF Youth World Ranking Systems Criteria, rev 19, 17 Aug 2026: <https://dartswdf.com/storage/uploads/923afcee-0f2c-45e1-aef0-5813d8fa5cbf/2026-08-17_World_Ranking_Systems_Criteria_Youth_19.pdf>
- WDF Under-23 World Ranking Systems Criteria, rev 5, 17 Aug 2026: <https://dartswdf.com/storage/uploads/923afcee-0f2c-45e1-aef0-5813d8fa5cbf/2026-08-17_World_Ranking_Systems_Criteria_U23_5.pdf>
- PDC sitemap and rankings-rules page (page content not extractable in this pass): <https://www.pdc.tv/sitemap.xml> · <https://www.pdc.tv/rankings/pdc-rankings-rules>

## Recommendation

Treat WDF Youth/U23 ranking coverage as the confirmed implementation gap. Complete the PDC source review separately once readable official event/rules material is available; keep any unverified PDC formats marked as Career-authored rather than asserting exact official fidelity.
