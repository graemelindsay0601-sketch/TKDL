// TKDL LIVE — DeskScene (api-shapes.ts's sceneForSegment: main_story,
// second_major_story, the closing segment, and the rare no-story fallback).
// The default "presenters talking it through" composition: headline plus an
// optional graphic. Both hosts themselves are no longer this scene's own
// job to render — presenters/StudioSet.tsx's PresenterOverlay keeps them
// permanently visible, standing at the real desk baked into the studio
// backdrop, for every scene, not just this one. The line being read is
// BroadcastPlayer.tsx's global LowerThird, rendered in its own dock below
// the screen, not anything rendered here.
//
// `justify="start"` (was "center"): ScreenPanel's own box now caps its
// height so it never grows down into the hosts standing at the desk below
// it (see StudioSet.tsx's ScreenPanel for why) — a centred block eats into
// that headroom from both ends, so a tall graphic card clips its OWN top
// content off first. Top-anchored, the same box only ever trims the
// bottom of an oversized graphic, never the headline itself.
import { LEAGUE_ACCENT, LEAGUE_LABEL } from "../theme";
import { SceneShell, SceneEyebrow, SceneHeadline } from "./SceneShell";
import { renderGraphic, headlineFor, tierForSegment, type SceneProps } from "./scene-support";

export function DeskScene({ segment }: SceneProps) {
  const accent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : "#ff005c";
  const tier = tierForSegment(segment);
  const graphic = renderGraphic(segment, { compact: tier !== "major" });

  return (
    <SceneShell justify="start">
      <div className="flex flex-col items-center text-center max-w-2xl">
        <SceneEyebrow label={segment.leagueType ? LEAGUE_LABEL[segment.leagueType] : "TKDL LIVE"} color={accent} />
        <SceneHeadline tier={tier}>{headlineFor(segment)}</SceneHeadline>
      </div>

      {/* fade-in-up-delayed: the graphic arrives as its own beat after the headline (this file's own header links to the reasoning).
          Wrapper width tracks which graphics/*.tsx skin `compact` actually
          selects: major tier (compact=false) is kit.tsx's v3 BigBoard skin,
          which wants real width to dominate the frame per the user's "go
          big like this" direction; quiet/featured tier stays capped at the
          v2 Panel skin's own small-card width so routine play keeps its
          calmer, restrained treatment. */}
      {graphic && <div className={`fade-in-up-delayed mt-5 w-full ${tier === "major" ? "max-w-2xl" : "max-w-md"}`}>{graphic}</div>}
    </SceneShell>
  );
}
