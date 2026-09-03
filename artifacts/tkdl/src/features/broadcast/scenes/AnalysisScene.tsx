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
import { SceneShell, SceneEyebrow, SceneHeadline } from "./SceneShell";
import { renderGraphic, headlineFor, tierForSegment, type SceneProps } from "./scene-support";

export function AnalysisScene({ segment }: SceneProps) {
  const accent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : "#0066ff";
  const tier = tierForSegment(segment);
  // Analysis segments lead with the graphic (this file's own original
  // header: "the graphic itself IS the content and leads the layout") —
  // that's still true even at "quiet" tier, so this is the one call site
  // that keeps the fuller (non-compact) graphic regardless of treatment;
  // hierarchy-by-treatment still applies to the HEADLINE here.
  const graphic = renderGraphic(segment, { compact: false });

  return (
    <SceneShell justify="start">
      <SceneEyebrow label={`${segment.leagueType ? LEAGUE_LABEL[segment.leagueType] + " · " : ""}Analysis`} color={accent} />
      <SceneHeadline tier={tier}>{headlineFor(segment)}</SceneHeadline>

      {/* max-w-xl -> max-w-3xl: this scene always renders the graphic non-compact
          (see this file's own comment above), so it's always kit.tsx's v3
          BigBoard skin now — real user feedback ("go big like this, one
          story at a time") wants that skin filling most of the screen, not
          capped at a width tuned for the old ~440px-max v1/v2 card. */}
      {graphic && <div className="fade-in-up-delayed mt-5 w-full max-w-3xl">{graphic}</div>}
    </SceneShell>
  );
}
