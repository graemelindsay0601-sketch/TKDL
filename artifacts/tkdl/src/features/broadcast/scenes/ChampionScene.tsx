// TKDL LIVE — ChampionScene (sceneForSegment: storyType === "CHAMPION",
// checked before every other rule — the single biggest moment the show can
// air). Reuses index.css's own existing gold-treatment vocabulary
// (`.shimmer-gold`, `.tier-ring-gold`, `pulse-glow-gold`) rather than
// inventing a new celebratory style, matching 15.3's own instruction: "Gold
// remains reserved for title/champion/special moments" — this is that
// moment, so it's the one scene allowed to spend it. The line being read is
// BroadcastPlayer.tsx's global LowerThird, not anything rendered here.
//
// This used to sit on a near-opaque (98%) black wash, back when the studio
// backdrop behind it was a plain CSS gradient with nothing worth seeing.
// Now that StudioSet.tsx's "champion" backdrop is a real gold dartboard
// render, hiding it behind an almost-solid scrim wastes exactly the asset
// this moment is supposed to spend gold on — so the wash is now a gradient
// that stays dark only where the headline text actually sits, and opens up
// toward the bottom so the real artwork shows through everywhere else.
//
// This also used to centre the headline block vertically in the whole
// frame, then attach an optional stats graphic card below it. That was
// fine while nothing else lived down there, but PresenterOverlay now
// stands both hosts right at the real podium's own rim (~53% down) — a
// centred block, and especially one with a graphic card attached, grew
// tall enough to land right on top of them, text and card both. Anchored
// to the top and stripped of the card, the headline is short enough to
// always clear the podium: the eyebrow + shimmering name IS the moment
// here (15.3's "one dominant subject"), and the real gold dartboard/podium
// art below now carries the celebratory weight a stats card used to —
// supporting numbers (score, checkout) still reach the viewer via the
// dialogue/LowerThird same as every other scene.
import { LEAGUE_LABEL } from "../theme";
import { SceneShell } from "./SceneShell";
import { headlineFor, type SceneProps } from "./scene-support";

const GOLD = "#ffd24a";

export function ChampionScene({ segment }: SceneProps) {
  return (
    <SceneShell
      justify="start"
      background="linear-gradient(180deg, rgba(6,4,14,0.92) 0%, rgba(6,4,14,0.78) 40%, rgba(6,4,14,0.35) 72%, transparent 100%)"
    >
      <div className="text-center flex flex-col items-center">
        <div className="font-black uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", letterSpacing: "0.3em", color: GOLD }}>
          {segment.leagueType ? `${LEAGUE_LABEL[segment.leagueType]} Champion` : "Champion"}
        </div>
        <h1 className="shimmer-gold font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(2.6rem, 7vw, 5rem)", lineHeight: 1, textWrap: "balance" }}>
          {headlineFor(segment)}
        </h1>
      </div>
    </SceneShell>
  );
}
