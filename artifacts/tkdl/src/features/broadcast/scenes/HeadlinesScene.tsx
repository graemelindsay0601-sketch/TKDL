// TKDL LIVE — HeadlinesScene (sceneForSegment: headlines). Up to
// three of these play back-to-back near the top of the programme, right
// after the fixed opening sign-on (director.ts's own slot-2 tease of the
// day's top 3 stories, CurrentEdition
// .headlines — see BroadcastPlayer.tsx for how the two lists are stitched
// into one playlist). Each is its own brief tease, not a list of three —
// styled as a single rolling "coming up" banner rather than DeskScene's
// full treatment, since a tease is meant to be quick. The line being read is
// BroadcastPlayer.tsx's global LowerThird, not anything rendered here.
//
// justify="start": ScreenPanel's own box now stops short of the studio
// floor so it never grows down into the hosts standing at the real desk
// (StudioSet.tsx's ScreenPanel).
import { LEAGUE_ACCENT, LEAGUE_LABEL } from "../theme";
import { SceneShell, SceneEyebrow, SceneHeadline } from "./SceneShell";
import { renderGraphic, headlineFor, type SceneProps } from "./scene-support";

export function HeadlinesScene({ segment }: SceneProps) {
  const accent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : "#ffd24a";
  // A "coming up" tease is a real promo beat regardless of the story's own
  // Treatment underneath it (theme.ts's own VisualTier / SceneShell.tsx's
  // own HeadlineTier comment) — every darts broadcast still goes loud on
  // "UP NEXT," so this is the one scene that doesn't scale with tier.
  const graphic = renderGraphic(segment, { compact: true });

  return (
    <SceneShell justify="start">
      <SceneEyebrow label="Coming Up" color={accent} />
      <div className="flex flex-col lg:flex-row gap-8 items-center">
        <div className="flex-1 min-w-0">
          {segment.leagueType && (
            <div className="uppercase font-bold mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", letterSpacing: "0.14em", color: accent }}>
              {LEAGUE_LABEL[segment.leagueType]}
            </div>
          )}
          <SceneHeadline tier="tease">{headlineFor(segment)}</SceneHeadline>
        </div>
        {graphic && <div className="fade-in-up-delayed w-full lg:w-[300px] shrink-0 opacity-90">{graphic}</div>}
      </div>
    </SceneShell>
  );
}
