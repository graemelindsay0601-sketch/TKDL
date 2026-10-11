import { CareerEventAtmosphere, CareerMomentScene, spectacleSummary } from "./components";
import { ATMOSPHERE_LEVELS, LEVEL_PROFILE, MOMENTS, resolveAtmosphere, spectacleFor, type AtmosphereInput, type AtmosphereLevel, type MomentKind } from "./model";

/**
 * Preview gallery for review and integration (not routed). Pass real catalogue
 * events; the gallery shows every level and every moment. Moments are labelled
 * previews: no result, score or champion is invented.
 */
export type GalleryEvent = AtmosphereInput & { note?: string };
const PREVIEW: Record<MomentKind, string> = {
  ARRIVAL: "Arrival", MATCH_INTRO: "Final introduction (preview)", QUALIFICATION: "Qualification (preview)",
  VICTORY: "Victory treatment (preview, no result)", MILESTONE: "Milestone (preview)", DOCUMENTARY_CHAPTER: "Documentary chapter (preview)",
};
export function AtmosphereGallery({ events, moments = [...MOMENTS], animate = false }: { events: GalleryEvent[]; moments?: MomentKind[]; animate?: boolean }) {
  const byLevel = new Map<AtmosphereLevel | "NONE", GalleryEvent[]>();
  for (const e of events) { const l = resolveAtmosphere(e).level ?? "NONE"; byLevel.set(l, [...(byLevel.get(l) ?? []), e]); }
  return <div className="ca-gallery">
    {[...ATMOSPHERE_LEVELS, "NONE" as const].filter(l => byLevel.has(l)).map(l => (
      <section key={l} className="ca-gallery__level" aria-label={l === "NONE" ? "No metadata" : LEVEL_PROFILE[l].label}>
        <h2 className="ca-gallery__h">{l === "NONE" ? "Legacy save · no event metadata" : `${LEVEL_PROFILE[l].label} · ${LEVEL_PROFILE[l].kicker}`}</h2>
        {byLevel.get(l)!.map(e => (
          <div key={`${e.definitionKey}-${e.venue?.id ?? "none"}`} className="ca-gallery__event">
            <CareerEventAtmosphere event={e} animate={animate} headingLevel={3} />
            <div className="ca-gallery__moments">
              {moments.filter(m => m !== "ARRIVAL").map(m => (
                <figure key={m} className="ca-gallery__moment">
                  <CareerMomentScene moment={m} event={e} animate={animate} headingLevel={3}
                    headline={m === "MATCH_INTRO" ? "Final" : m === "DOCUMENTARY_CHAPTER" ? "Chapter preview" : m === "MILESTONE" ? "Milestone preview" : null}
                    matchStage={m === "MATCH_INTRO" ? "FINAL" : null} participants={m === "MATCH_INTRO" ? ["Your player", "Opponent"] : null} />
                  <figcaption>{PREVIEW[m]} · {spectacleSummary(spectacleFor(m, resolveAtmosphere(e).level, { matchStage: m === "MATCH_INTRO" ? "FINAL" : null }))}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </section>
    ))}
  </div>;
}
