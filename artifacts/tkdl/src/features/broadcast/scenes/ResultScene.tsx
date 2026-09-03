// TKDL LIVE — ResultScene (sceneForSegment: third_league_current_state,
// supporting_story_or_checkin). A routine check-in: what's the state of
// this league / this supporting story right now — a compact graphic, one
// notch quieter than DeskScene's main-story treatment. The line being read
// is BroadcastPlayer.tsx's global LowerThird, not anything rendered here.
//
// justify="start": ScreenPanel's own box now stops short of the studio
// floor so it never grows down into the hosts standing at the real desk
// (StudioSet.tsx's ScreenPanel) — top-anchoring here means an oversized
// graphic trims at its own bottom instead of eating into the headline.
import { LEAGUE_ACCENT, LEAGUE_LABEL } from "../theme";
import { SceneShell, SceneEyebrow, SceneHeadline } from "./SceneShell";
import { renderGraphic, headlineFor, tierForSegment, type SceneProps } from "./scene-support";

export function ResultScene({ segment }: SceneProps) {
  const accent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : "#22c55e";
  const tier = tierForSegment(segment);
  const graphic = renderGraphic(segment, { compact: tier !== "major" });

  return (
    <SceneShell justify="start">
      <div className={tier === "major" ? "max-w-3xl w-full" : "max-w-xl"}>
        <SceneEyebrow label={segment.leagueType ? `${LEAGUE_LABEL[segment.leagueType]} · Check-in` : "Check-in"} color={accent} />
        <SceneHeadline tier={tier}>{headlineFor(segment)}</SceneHeadline>
        {/* Wrapper width tracks the graphics/*.tsx skin `compact` selects —
            see DeskScene's own comment on the same pattern. */}
        {graphic && <div className={`fade-in-up-delayed mt-4 w-full ${tier === "major" ? "max-w-2xl" : "max-w-md"}`}>{graphic}</div>}
      </div>
    </SceneShell>
  );
}
