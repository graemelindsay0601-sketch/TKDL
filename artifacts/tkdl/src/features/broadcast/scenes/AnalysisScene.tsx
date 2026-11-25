// TKDL LIVE — AnalysisScene (sceneForSegment: analysis_or_predictor,
// what_to_watch). The deep-dive: the graphic leads (a Title Predictor or
// league-table read is the whole point of this segment, not a side note),
// closest to the user's reference clip's own dedicated "Title Predictor —
// Detailed View" frame. The line being read is BroadcastPlayer.tsx's global
// LowerThird, not anything rendered here.
//
// justify="start": ScreenPanel's own box now stops short of the studio
// floor so it never grows down into the hosts standing at the real desk
// (StudioSet.tsx's ScreenPanel) — top-anchoring here means an oversized
// graphic trims at its own bottom instead of eating into the headline.
import { LEAGUE_ACCENT, LEAGUE_LABEL } from "../theme";
import { StoryColumn } from "./SceneShell";
import { renderGraphic, headlineFor, tierForSegment, type SceneProps } from "./scene-support";

export function AnalysisScene({ segment }: SceneProps) {
  const accent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : "#0066ff";
  const tier = tierForSegment(segment);
  const graphic = renderGraphic(segment, { compact: false });
  return <StoryColumn eyebrow={`${segment.leagueType ? LEAGUE_LABEL[segment.leagueType] + " · " : ""}Analysis`} color={accent} tier={tier} headline={headlineFor(segment)} graphic={graphic} />;
}
