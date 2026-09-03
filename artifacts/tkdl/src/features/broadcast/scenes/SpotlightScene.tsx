// TKDL LIVE — SpotlightScene (sceneForSegment: form_h2h_or_spotlight, and
// the non-ARCHIVE branch of lighter_or_archive_or_callback). A single
// subject — reuses index.css's own existing `.spotlight-strip` class
// (already built for the kiosk dashboard's "leader bar") rather than
// inventing a second hero-card style, so this scene reads as the same
// visual language as the rest of the app, not a one-off. The line being
// read is BroadcastPlayer.tsx's global LowerThird, not anything rendered
// here.
//
// Both of this scene's slots (director.ts's slot 6 form_h2h_or_spotlight,
// and slot 8's non-ARCHIVE fallback) are picked "unfiltered by treatment" —
// a Supporting-treatment FORM story lands here just as often as a Featured
// one — so despite the file's old header calling this "the hero treatment,"
// it was never actually reserved for major moments. That's exactly the
// uniform-loudness problem the tier system elsewhere in scenes/*.tsx exists
// to fix, so this scene now scales with tierForSegment() like DeskScene/
// ResultScene do, rather than always rendering at the same fixed size. The
// .spotlight-strip card shape itself (shared with the kiosk dashboard) is
// left alone — only the headline size and graphic density inside it scale.
//
// justify="start": ScreenPanel's own box now stops short of the studio
// floor so it never grows down into the hosts standing at the real desk
// (StudioSet.tsx's ScreenPanel).
import { LEAGUE_ACCENT, LEAGUE_LABEL } from "../theme";
import { SceneShell, SceneEyebrow, SceneHeadline } from "./SceneShell";
import { renderGraphic, headlineFor, tierForSegment, type SceneProps } from "./scene-support";

export function SpotlightScene({ segment }: SceneProps) {
  const accent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : "#ff005c";
  const tier = tierForSegment(segment);
  const graphic = renderGraphic(segment, { compact: tier !== "major" });

  return (
    <SceneShell justify="start">
      <SceneEyebrow label="Spotlight" color={accent} />

      <div className="spotlight-strip" style={{ borderColor: `${accent}47` }}>
        <div className="min-w-0">
          {segment.leagueType && (
            <div className="uppercase font-bold mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.16em", color: accent }}>
              {LEAGUE_LABEL[segment.leagueType]}
            </div>
          )}
          <SceneHeadline tier={tier}>{headlineFor(segment)}</SceneHeadline>
        </div>
        {graphic && <div className="fade-in-up-delayed w-full sm:w-[280px] shrink-0">{graphic}</div>}
      </div>
    </SceneShell>
  );
}
