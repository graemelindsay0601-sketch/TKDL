# Workstream F1 — broadcast atmosphere & Career moments

Presentation only. F1 adds an isolated module and assets. **No existing Career screen is connected yet**: the integration owner wires the components in. F1 did not edit `identity.tsx`, the shell/router, shared Career CSS, tournament/newsroom/Home/legacy screens, trophies, apparel, sponsors or any server module.

## What F1 provides

`artifacts/tkdl/src/features/career/atmosphere/` (import from `@/features/career/atmosphere`):

| Export | Purpose |
|---|---|
| `CareerEventAtmosphere({ event, children?, animate?, headingLevel? })` | Event identity on its venue backdrop (the *arrival* treatment). Children are the screen's own facts. |
| `CareerMomentScene({ moment, event?, headline?, facts?, matchStage?, participants?, animate?, headingLevel?, children? })` | A Career moment: `ARRIVAL · MATCH_INTRO · QUALIFICATION · VICTORY · MILESTONE · DOCUMENTARY_CHAPTER`. Children (e.g. a Continue button) render above the art. |
| `CareerStageBackdrop({ atmosphere, spectacle, documentary?, animate?, eager? })` | The art layers alone, for any positioned container. |
| `resolveAtmosphere(input)`, `spectacleFor(moment, level, { matchStage })`, `victoryVariant(a)` | Pure model (no React). |
| `atmosphereFromTournament(view.event)`, `atmosphereFromCalendarEvent(e)`, `atmosphereFromLegacyMoment(m)` | Adapters from existing reads; they copy fields, never infer. |
| `AtmosphereGallery({ events })` | Review gallery (not routed). |

Assets: `public/assets/career-atmosphere/*.webp` (14 renders, ≈1.09 MB total; the two heaviest, gold confetti and ticker tape, load only for Major and World victories) and `atmosphere-renders.json`. The 14 venue photographs in `public/images/career-venues/` are **reused in place** (not copied).

## Levels (source of truth: persisted metadata)

Level = the highest of `content.eventClass`, calendar `presentation.tier` and tournament importance `level`; `circuit` only when none is recorded. Qualifiers are capped at **National** (Q-School at **Floor**); a non-qualifying World Championship is always **The Palace**.

| Level | From | Catalogue v5 events | Light | Typical venues |
|---|---|---|---|---|
| Club | GRASSROOTS · LOCAL · level 1 | 12 | warm lamp | pub/social club |
| County | REGIONAL · STANDARD | 7 | hall spots | county hall |
| National | NATIONAL, INTERNATIONAL_OPEN · FEATURED · level 2 | 30 | hall spots | halls, ballrooms, arenas |
| Pro Floor | PROFESSIONAL_TOUR, SECONDARY_TOUR | 18 | LED strips | professional floor, studio |
| Stage | STAGE_SERIES · TELEVISED · level 3 | 17 | coloured beams | theatres, arenas, studio |
| Major | MAJOR · level 4 | 7 | white/gold beam fan | major arenas |
| The Palace | WORLD_CHAMPIONSHIP · WORLD · level 5 | 1 | gold crown of beams | the Palace |

The backdrop is always the event's own `venue.venueType`. Without a recorded venue the level's default plate is used and **no venue name is shown**; with no metadata at all a neutral studio is used and no level is claimed.

## Spectacle ladder (same moment, different stage)

| Moment | Club | County | National | Floor | Stage | Major | Palace |
|---|---|---|---|---|---|---|---|
| Arrival | banner | banner | banner | banner, stronger light | banner, stronger light | stage | stage |
| Match intro (final) | inline card | inline | inline | banner | stage, follow-spot | full stage, follow-spot | full stage, follow-spot |
| Qualification | banner | banner | banner | banner | banner | banner | banner |
| **Victory** | banner, lamp | banner | silver confetti (light) | banner | follow-spot, silver confetti | **gold confetti + pyro** | **gold ticker tape + pyro**, full height |
| Milestone | banner | banner | banner | banner | banner | banner, intensity 3 | banner, intensity 3 |
| Documentary chapter | archival grade + film grain on the chapter's level plate |

The victory variant (Tournament · Major · World) is derived from the event, never passed by the caller: only a non-qualifying World Championship can say "World Champion".

## Design catalogue

**Plates.** There are 17 plate keys, mapping to 16 images:
- **Reused (14):** the 14 venue-family photographs, each with focal and stage points in `manifest.ts`.
- **Rendered (2):** `palace-stage.webp` (2400×1350, used for both the `palace` and `palace-stage` keys) and `neutral.webp`.

The Palace plate is a fictional Victorian great hall (Alexandra Grand Hall). It has an iron-and-glass vault, a rose window, galleries, chandeliers, a seated crowd at tables and a lit championship stage. It contains no trophy and no branding. It replaces `career-palace-arena.png` for World Championship scenes, because that image is a gold trophy still-life and would misrepresent the Sovereign. That file is left untouched for the venue atlas.

**Light layers (screen blend):** `light-lamp`, `light-hall`, `light-floor`, `light-beams`, `light-beams-major`, `light-beams-palace`, `spotlight` (shifted onto each plate's stage point), `pyro`.
**Celebration layers (alpha, PBR, motion-blurred):** `confetti-silver`, `confetti-gold`, `tickertape-palace`.
**Documentary:** `grain` (tileable).

## Integration steps (for the integration owner)

1. **Tournament hero / arrival** (`tournament/components.tsx` `TournamentHero` / `ArrivalCeremony`): wrap with `<CareerEventAtmosphere event={atmosphereFromTournament(v.event)} animate={v.depth.animate}>…existing facts…</CareerEventAtmosphere>`. Respect `v.depth.arrival`: when false, skip the atmosphere.
2. **Walk-on / match intro**: `<CareerMomentScene moment="MATCH_INTRO" event={atmosphereFromTournament(v.event)} headline={stageOf(match, rounds)} matchStage={…FINAL/SEMI_FINAL from stageOf…} participants={[humanName, opponentName]} animate={v.depth.animate} />` only when `v.depth.walkOn`.
3. **Completion**: `moment="VICTORY"` only when `v.achievements.tournamentChampion` is true; `QUALIFICATION` only from recorded `routes`/entitlements. Pass real facts (prize from `v.money`, opponent from the final) via `facts`.
4. **Milestones / newsroom**: `moment="MILESTONE"` with the milestone's own event context.
5. **A Career Remembered** (`legacy/components.tsx` `Documentary`): per chapter, `moment="DOCUMENTARY_CHAPTER" event={atmosphereFromLegacyMoment(chapter.moments[0])} headline={chapter.title}`.
6. Put interactive controls in `children` (they render above the art) or outside the scene. Art never takes pointer events.

## Accessibility & performance

- Art is `aria-hidden` with empty `alt`; scenes are labelled regions with a real heading. Text sits on a scrim in the bottom-left band.
- Motion (plate push-in, light fade, confetti fall, pyro flicker) runs only under `prefers-reduced-motion: no-preference` **and** `animate` (pass the server's `depth.animate`).
- Images are lazy except premium (intensity ≥ 3) scenes; a failed image hides itself and the scene falls back to its dark base.
- three.js is used only at build time (`scripts/atmosphere-render/`) and is not in the app bundle.

## Regenerating renders

`cd artifacts/tkdl && node scripts/atmosphere-render/render-atmosphere.mjs [ids…]`. Set `THREE_DIR` to a local `three@0.170.0` to work offline; otherwise it installs into `node_modules/.cache/atmosphere-render`. Scenes are seeded and recompose identically; byte-identical output across machines is not guaranteed.

## Visual production limitations

- **Rendering:** new artwork is real-time 3D (three.js on SwiftShader) with additive volumetric light, not path-traced. Beams are shaded cones with procedural haze, not true volumetrics.
- **Palace crowd:** it is instanced silhouettes, softened by depth of field. Read up close, it is clearly CG, unlike the photographic venue plates. It works as a backdrop, not as a hero close-up.
- **Venue photographs:** they are 1024×1024. Wide desktop crops are upscaled about 1.4× behind a grade and scrim, and the focal and stage points are approximate.
- **Layer alignment:** light layers are generic per level rather than per venue. Only the follow-spot is aligned to each plate's stage.
- **No match-specific imagery:** there are no players, walk-on footage or crowd reactions, because those would require invented likenesses.
