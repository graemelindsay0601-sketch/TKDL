# Career 2.0 — visual completion programme

Branch flow: each verified batch goes `career-polish/visual-completion` → PR → `main`.

## Batch 1 — Shirt collection quality

### Audit

All 250 kits in `CAREER_KIT_DESIGNS` were audited in two ways:
- **Visual:** labelled contact sheets per asset group (`scripts/kit-audit/contact-sheets.mjs`).
- **Pixels:** alpha, border opacity, chroma-key residue and framing, measured on every raster.

| Group | Kits | Finding | Classification |
|---|---|---|---|
| Original 50 (`kit-50-*`, WebP) | 50 | Consistent photographic studio garments with real folds, seams and lighting. `kit-50-01` was cropped by the canvas edges (collar, sleeves and hem touched the frame). | 49 KEEP · 1 IMPROVE |
| Pro 10 (`kit-pro-*`, SVG) | 10 | Flat clip-art T-shapes (~1 KB each), clearly below the rest of the collection, and their art did not match the catalogue descriptions. | 10 REPLACE |
| Next 40 (`kit-100-*`, WebP) | 40 | Same photographic standard. A few plain club shirts are intentionally simple. | 40 KEEP |
| Expanded 150 (`kit-250-*`, WebP) | 150 | Strong overall. The five-cut theme sets vary cut and motif, not just palette. `kit-250-133` had a solid chroma-key green block beside the garment. `kit-250-104` is a narrower cut at the normal height, not a defect. | 149 KEEP · 1 IMPROVE |

**Result:** 238 KEEP, 2 IMPROVE, 10 REPLACE. 12 assets changed in total.

### Changes

- **Pro 10 rebuilt as photographic garments** (`scripts/kit-audit/rebuild-pro-kits.py`).
  - Each design follows its own catalogue description, for example "ink-knit body with a champagne crown and engineered shoulder seams".
  - The design is printed onto the real fabric shading, folds, seams, collar and alpha of a plain studio shirt from the collection: `kit-100-06` for the zip, stand and crew cuts, and `kit-100-29` for the polos.
  - Panels are separated by dye rather than by light, so the original seams stay sharp.
  - The kit IDs are unchanged. The image changed from `.svg` to `.webp`, and only the catalogue references the file.
- **`kit-50-01`:** reframed with the collection's margins.
- **`kit-250-133`:** chroma key removed and green spill cleaned (`scripts/kit-audit/fix-raster-defects.py`).
- **Renderer (`premium-shirt.tsx`, `kit-customizer.tsx`):** the colour wash used to apply whenever `primaryColour` existed.
  - Every save has one via the presentation defaults, and so does every NPC palette. Almost every shirt in the game was therefore drawn under a 34% colour-blend over its artwork.
  - Original artwork is now the default. The tint applies only when the player explicitly chose a colourway (`kitTintEnabled: true`, which the Kit Room already stores).
  - Saves where the player did choose a colour are unchanged.

Evidence: `docs/career/evidence/kit-contact-sheets/`, which contains the full updated sheets plus the before sheets for the Pro 10 and the raster fixes.
Tests: `career-kit-quality.test.ts` checks:
- all 250 IDs are stable;
- every kit is a raster garment of production size;
- tint applies only on an explicit choice.

## Batches 2–4 — Career screens

All screens use the shared `CareerPageHero`. It is built on the F1 venue plates, with the screen's accent, an outlined watermark, the player's premium shirt and a stat ribbon of real data. Long rules text moved into collapsible `career-note` callouts. Raw codes are shown in plain language (`denialLabel`, `titleCase`).

| Batch | Main | Screens |
|---|---|---|
| 2 | `d15e409` | Home, Rankings (podium chips, ~3.5 MB → ~106 KB images via 256px shirt thumbnails), Finances, Journey |
| 3 | `f8b7cd0` | Darts World front page and directory, Goals, Achievements (silverware vs. titles without silverware, from E2 `resolveAward`), Relationships |
| 4 | `f66f5f4` | Q-School hero and plain-language refusals. Calendar: venue plate on every agenda row (trophy badge for majors/World), dossier venue banner, staged header, readable entry status. Sponsor HQ: hero with ledger stats and the sponsored shirt, contract-term bars, brand names instead of internal keys. |
| 5 | `4a5e561` | Full sweep of 39 Career routes at 390/1440. Fixed defects: raw `{city}`/`{region}` template names on World → Events; illegible standalone news article; missing opponent heading on the rivalry route; raw sponsor key in the archive; profile shirt collapsing to 0px on My Career; honours shelf contradicting E2 awards. New treatment: premium Career navigation (accents, medallion icons, dartboard glyph, venue plate on the active tab, section-tab icons); Events & Circuits directory and championship detail; Career archive / World history; My Career Performance & Career Life; Career Life, Stories, Recognition; Guide; Finances body; shared stat tiles. |
| 6 | `c9eecce` | Cream "paper" styling replaced with dark premium panels (newsroom cards, articles, player profiles, rivalry record). Kit Room hero and single kit section; event pages with venue art behind the header; Palace backdrop; Career saves with a staged card per slot and the save's shirt; Trophy cabinet hero; fact lines as a timeline. |
| 7 | `e447ade` | Phone-width review: embedded kit designer, hero layout on phones, event/Palace backdrops, full qualifier names. |
| 8 | (this batch) | Release pass on a brand-new save plus every tab: internal authority labels (A3/A4/A5/A7.x), raw codes and pence removed from player-facing text (`publicText`); archive tabs, season-end transition and season review, new-career wizard and empty slot, other players' pages (shared NPC hero), head-to-head generations, story threads, event field shirts and Attention panel brought to the premium standard. |

Sweep result after batches 5 and 6 (39 save routes plus the saves list): no horizontal overflow, no page errors and no raw template tokens or internal codes in visible text on any of the 39 routes.

Unchanged: gameplay, settlement, rankings, eligibility, finance authorities, save identities and all 250 kit IDs. No schema changes.
