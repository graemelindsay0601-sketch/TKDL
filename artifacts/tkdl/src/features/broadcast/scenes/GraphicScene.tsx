// TKDL LIVE — GraphicScene (sceneForSegment: lighter_or_archive_or_callback,
// ARCHIVE family only — a last-meeting/season-comparison/historical-H2H
// callback). The lightest-touch scene: the graphic itself IS the content and
// leads the layout, matching 9.3/10.4's own framing of ARCHIVE material as
// ambient "did you know" filler rather than a headline moment. The line
// being read is BroadcastPlayer.tsx's global LowerThird, not anything
// rendered here.
//
// justify="start": ScreenPanel's own box now stops short of the studio
// floor so it never grows down into the hosts standing at the real desk
// (StudioSet.tsx's ScreenPanel) — top-anchoring keeps this clear of them
// regardless of how tall the archive graphic itself renders.
import { LEAGUE_ACCENT, LEAGUE_LABEL } from "../theme";
import { StoryColumn } from "./SceneShell";
import { renderGraphic, headlineFor, tierForSegment, type SceneProps } from "./scene-support";

export function GraphicScene({ segment }: SceneProps) {
  const accent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : "#c084fc";
  const tier = tierForSegment(segment);
  const graphic = renderGraphic(segment, { compact: false });
  return <StoryColumn eyebrow={`${segment.leagueType ? LEAGUE_LABEL[segment.leagueType] + " · " : ""}From the Archive`} color={accent} tier={tier} headline={headlineFor(segment)} graphic={graphic} />;
}
