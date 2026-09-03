// TKDL LIVE — BreakingScene (sceneForSegment: importance "major" +
// BREAKING_WORTHY_STORY_TYPES — a PREPARED segment's own heaviest
// treatment, distinct from the unplanned 11.4 live-insert BREAKING banner,
// LiveInsertOverlay.tsx). This is the one scene modelled closely on the
// user's own reference clip, which is almost entirely this exact moment:
// full-bleed red wash, no boxed graphic card, the story's own subject +
// facts read as plain oversized text rather than the shared GraphicFrame
// chrome every other scene uses — a deliberate exception, since the whole
// point of this scene is "stop everything," not "here is a data panel."
// The line being read is BroadcastPlayer.tsx's global LowerThird, not
// anything rendered here.
//
// This used to stay a near-opaque (98%) wash all the way to the bottom of
// the frame, back when there was nothing real behind it. Now that
// StudioSet.tsx's "breaking" backdrop is a real photographic studio (glass
// desk corner and all) and PresenterOverlay stands the hosts right at that
// desk's own edge, an opaque floor-to-ceiling wash would blacken out
// exactly the desk they're meant to be standing at — the same fix already
// applied to ChampionScene's wash. So this now stays strong only where the
// big headline actually needs the contrast, and opens up well before the
// desk line (~67% down) so the real art shows through underneath the hosts.
//
// This also used to centre vertically (a `justify="center"` block, same as
// ChampionScene). With the hosts now standing low-left at the desk's own
// line, a vertically-centred block landed low enough to run its headline
// and facts row straight into them. Anchored to the top instead — same fix
// as ChampionScene, for the same reason — the text block comfortably
// clears the desk regardless of how many facts a given story attaches.
import { LEAGUE_ACCENT, LEAGUE_LABEL, humanizeFactKey, formatFactValue } from "../theme";
import { SceneShell } from "./SceneShell";
import { headlineFor, type SceneProps } from "./scene-support";

const BREAKING_RED = "#ff005c";

export function BreakingScene({ segment }: SceneProps) {
  const leagueAccent = segment.leagueType ? LEAGUE_ACCENT[segment.leagueType] : BREAKING_RED;
  const facts = Object.entries(segment.graphic?.data ?? {}).slice(0, 3);

  return (
    <SceneShell
      justify="start"
      background={`linear-gradient(180deg, ${BREAKING_RED}22 0%, rgba(6,4,14,0.9) 28%, rgba(6,4,14,0.74) 48%, rgba(6,4,14,0.32) 64%, transparent 82%)`}
    >
      <div className="flex items-center gap-3 mb-5">
        <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: BREAKING_RED }} />
        <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", letterSpacing: "0.3em", color: BREAKING_RED }}>
          Breaking
        </span>
        {segment.leagueType && (
          <span className="font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.14em", color: leagueAccent }}>
            {LEAGUE_LABEL[segment.leagueType]}
          </span>
        )}
      </div>

      <h1 className="font-black uppercase text-white" style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(2.4rem, 7vw, 4.5rem)", lineHeight: 1.02, letterSpacing: "0.01em", textWrap: "balance" }}>
        {headlineFor(segment)}
      </h1>

      {facts.length > 0 && (
        <div className="flex flex-wrap gap-x-10 gap-y-2 mt-5">
          {facts.map(([key, value]) => (
            <div key={key} className="font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: "#ffd24a", letterSpacing: "0.02em" }}>
              {formatFactValue(key, value)}
              <span className="ml-2 font-medium normal-case" style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>{humanizeFactKey(key)}</span>
            </div>
          ))}
        </div>
      )}
    </SceneShell>
  );
}
