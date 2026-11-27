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
import { StoryColumn } from "./SceneShell";
import { renderGraphic, headlineFor, tierForSegment, type SceneProps } from "./scene-support";

export function DeskScene({ segment }: SceneProps) {
  const accent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : "#ff005c";
  const tier = tierForSegment(segment);
  const graphic = renderGraphic(segment, { compact: false });
  return <StoryColumn eyebrow={segment.leagueType ? LEAGUE_LABEL[segment.leagueType] : "TKDL LIVE"} color={accent} tier={tier} headline={headlineFor(segment)} graphic={graphic} />;
}
