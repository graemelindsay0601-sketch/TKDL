// TKDL LIVE — the studio SET. The user sent real reference photos (Sky
// Sports' "Super Sunday" panel desk with a stadium backdrop, BBC Sport's
// Olympic-rings desk, Sky's blue-swirl two-shot) and said the show still
// read as a group chat, not a broadcast: "like a table with screens about
// and panels with stats or hosts holding tablets." Every one of those
// photos is the same recipe — a branded backdrop wall, a curved desk with
// the show's own branding on its front face, presenters anchored at it, big
// screens either side. BroadcastPlayer.tsx now composes exactly that (this
// file), instead of rendering each scene over a plain gradient with a
// caption floating in empty space.
//
// ── Why this doesn't literally recreate the reference photos ─────────────
// Every reference photo shows presenters SEATED at an angle, often holding
// a prop. The presenter art this show actually has
// (TKDL_LIVE_Hosts_Pack_Final) is front-facing bust/head-and-shoulders
// portraits — there's no seated, three-quarter-angle photography of Chalky
// or Ton to build from. Stretching or rotating a front-facing bust to fake
// a seated angle would produce exactly the "cheap-looking" result already
// rejected twice earlier in this feature. So this builds the parts of the
// reference photos that ARE achievable with real photographic portraits
// that were only ever posed face-on — a backdrop wall with its OWN real,
// photographic desk baked in, both hosts anchored standing at that real
// desk line, flanking screens either side of the main graphic — rather
// than faking a seated shot the source art was never posed for.
//
// ── The desk: real photo, not CSS (this file's second pivot) ─────────────
// The first version of this file drew its own desk shape in CSS/gradients,
// on the theory that the commissioned backdrop art would be wall-only (see
// the crop step referenced in this feature's own history). Once the user
// saw the three finished images they said the opposite of what was
// expected: "revert to using the desks in the ones i sent as these look
// much better... i really think th ecss ones are far too plain." Each of
// the three images already has its own real, professionally-rendered desk
// baked into the frame — better than anything CSS gradients can fake — so
// PresenterOverlay below no longer draws a desk at all. It only positions
// the two bust portraits so their own feet-line lands exactly on top of
// each image's real desk edge, standing "at" the real desk instead of a
// drawn one. See DESK_LINE for the per-image measurements this relies on.
import type { ReactNode } from "react";
import { Presenter } from "../Presenter";
import type { PresenterId, PresenterState } from "./presenter-config";
import { LISTENING_STATE } from "./presenter-state";

// ── Backdrop wall ──────────────────────────────────────────────────────────
// Real rendered studio-wall art (commissioned by the user from the handover
// brief this file's own history led to — see tkdl-live-backdrop-handover.md)
// replaces the earlier CSS/SVG dartboard-ring placeholder. Three variants,
// matching the three treatments the code already had before any art existed
// (LEAGUE_ACCENT's normal case, BreakingScene's BREAKING_RED, ChampionScene's
// GOLD) — one shared "main" wall for every routine segment, one for the
// full-bleed Breaking moment, one for the full-bleed Champion moment.
//
// Each source image also has its own real desk/podium baked into the lower
// part of the frame — used here at FULL size, uncropped. An earlier pass
// cropped that part off on the theory it would double up with a CSS-drawn
// desk; the user explicitly reversed that ("revert to using the desks in
// the ones i sent as these look much better"), so the full image ships and
// PresenterOverlay positions the hosts at the real desk's own edge instead
// of drawing one. See DESK_LINE below for the per-image desk-line data.
export type StudioBackdropVariant = "main" | "breaking" | "champion";

const BACKDROP_SRC: Record<StudioBackdropVariant, string> = {
  main: "/broadcast/studio/main.webp",
  breaking: "/broadcast/studio/breaking.webp",
  champion: "/broadcast/studio/champion.webp",
};

export function StudioBackdrop({ variant = "main" }: { variant?: StudioBackdropVariant }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        backgroundImage: `url(${BACKDROP_SRC[variant]})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* A light vignette, not a colour wash — the real art carries its own
          colour now; this just protects text/panel contrast at the edges. */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,4,14,0.15) 0%, transparent 20%, transparent 55%, rgba(6,4,14,0.55) 100%)" }} />
    </div>
  );
}

// ── Show-title bar ─────────────────────────────────────────────────────────
// A persistent corner-bug-style ID strip, not a full "SUPER SUNDAY" title
// card — real UK darts coverage keeps its permanent on-screen branding
// small and out of the way (theme.ts's own VisualTier comment has the full
// research this whole pass is built on), reserving actual scale for the
// moments that earn it (BreakingScene/ChampionScene). Trimmed down from a
// 64px full title-card bar to a slim strip closer to a channel bug's own
// footprint.
export function ShowTitleBar({ subtitle }: { subtitle: string }) {
  return (
    <div className="relative shrink-0" style={{ zIndex: 2 }}>
      <div
        className="flex items-center justify-between px-6 md:px-10"
        style={{
          height: 46,
          background: "linear-gradient(90deg, rgba(0,102,255,0.18) 0%, rgba(6,4,14,0.92) 42%, rgba(255,0,92,0.15) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-black uppercase text-white" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.02rem", letterSpacing: "0.01em" }}>
            TKDL<span style={{ color: "#ff005c" }}>LIVE</span>
          </span>
          <span className="live-dot" aria-hidden="true" />
        </div>
        <span className="font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.64rem", letterSpacing: "0.16em", color: "rgba(255,255,255,0.55)" }}>
          {subtitle}
        </span>
      </div>
      <div style={{ height: 2, background: "linear-gradient(90deg, #0066ff, #ff005c)" }} />
    </div>
  );
}

// ── The main screen ────────────────────────────────────────────────────────
// A segment's own headline/graphic (rendered by scenes/*.tsx, unchanged)
// used to sit inside a bezelled "big screen" — a bordered, solid-backed
// rounded rectangle standing in for a monitor built into the wall. Real
// user feedback, verbatim: "i dont like the big blocky board behind the
// hosts... make it more fluid and appealing... like a real live show rather
// than just big blocks with data in it." A real broadcast doesn't put its
// graphics inside a second screen-within-the-screen — headlines and stat
// chips (GraphicFrame.tsx's own "score-bug" chips, each with its own small
// glass fill) sit directly over the live picture. So this box now carries
// NO border, background, or shadow of its own — it's purely a layout
// region (inset margin so content clears the hosts and the frame edges),
// not a piece of visible set dressing. Legibility against the backdrop's
// own busy art comes from StudioBackdrop's existing vignette plus
// SceneShell.tsx's own text-shadow on headlines/eyebrows (added alongside
// this change) — not from a dark panel behind the text.
export type ScreenPanelProps = {
  children: ReactNode;
  /**
   * false for BreakingScene/ChampionScene — those two are deliberately
   * "stop everything, full-bleed" moments (see their own file headers),
   * and boxing that inside a bezelled monitor undercuts exactly the effect
   * they're built for. Every other scene gets the bezel + inset margin
   * that makes routine segments read as "a screen in the studio," not the
   * one or two moments meant to take over the whole frame. Framed is also
   * the only mode PresenterOverlay's "main" desk line has to share the
   * frame with (breaking/champion are always unframed).
   */
  framed?: boolean;
};

export function ScreenPanel({ children, framed = true }: ScreenPanelProps) {
  if (!framed) {
    return (
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden" style={{ zIndex: 1 }}>
        {children}
      </div>
    );
  }

  return (
    // `items-start` (dropping the flex default of stretching this row's
    // only child to full height) makes this box hug whatever height its own
    // content actually needs, instead of always stretching to fill the
    // entire available space — a short headline-only segment gets a small
    // box near the top, a segment with a stat card gets a taller one.
    //
    // An earlier pass here hard-capped this box's height (`maxHeight` +
    // `overflow: hidden`) to physically stop it reaching the hosts standing
    // at the real "main" desk line below. That traded one bug for a worse
    // one: real segment content varies enough — a one-line headline here, a
    // wrapped two-line headline plus a 4-fact graphic card there — that a
    // single fixed cap ended up SLICING OFF the actual number a story was
    // built to show (DeskScene's own headline stat disappearing mid-render
    // is worse than a layout looking a touch cosy). No hard cap any more:
    // `justify="start"` on every framed scene still keeps content anchored
    // to the top, and PresenterOverlay's "main"/"breaking" busts render at
    // the smaller "sm" size (see DESK_LINE) specifically to buy back
    // headroom a cap used to manufacture — a wider two-shot showing more of
    // the desk, a real editorial choice rather than a layout patch.
    // Side inset narrowed from lg:px-[21%] (real user feedback: the "go big,
    // one story at a time" direction — kit.tsx's v3 BigBoard skin — needs
    // real width to read as a dominant studio graphic rather than a small
    // card in a wide empty box; this still keeps a real margin off the
    // frame edges at every breakpoint, just not one sized for a ~320-440px
    // v1/v2 card.
    <div className="relative flex-1 min-h-0 flex items-start px-4 sm:px-10 md:px-16 lg:px-[8%] py-5 md:py-8" style={{ zIndex: 1 }}>
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ── The presenter overlay — hosts standing at the REAL desk ────────────────
// No drawn desk shape any more (see the file header). Each backdrop image
// bakes in its own real desk at a different height and horizontal position.
// These numbers come from a finer percentage-gridline overlay pass against
// the actual 941px-tall source art (every 5%, both axes) — re-measured
// directly against each desk's own visible TOP SURFACE (where a standing
// presenter's hands would actually rest), not the wider base/plinth below
// it, which is a lower and less accurate line to stand busts on:
//   champion — centred round podium; ring's top surface ~53% down the frame
//   main     — centred curved desk;  front top edge (blue neon strip) ~62%
//   breaking — glass desk corner, bottom-LEFT and much narrower — its own
//              top surface sits lower still, ~67% down, spanning only
//              roughly the left 45% of the frame width
// `StudioBackdrop` fills the exact same full-bleed box this overlay sits
// over (both are absolutely positioned across the whole player, and the
// source art's own aspect ratio is already ~16:9), so a bust's own bottom
// edge parked at `bottom: (100 - topPct)%` lines up with that image's real
// desk edge — reading as "standing right at the desk" without cropping or
// occluding anything.
//
// `bustSize`: "main" and "breaking" render at "sm" rather than Presenter's
// own "md" default — a smaller two-shot standing further back from camera,
// which reads as a perfectly normal wide studio shot AND buys back the
// headroom ScreenPanel needs above them for that segment's own headline/
// graphic (see ScreenPanel's own comment for why that headroom used to
// come from a content-clipping height cap instead). "champion" keeps "md"
// — ChampionScene's content is a short headline only, never tall enough to
// need the same trade.
const DESK_LINE: Record<StudioBackdropVariant, { bottomPct: number; align: "center" | "left"; gapPx: number; leftPadPct?: number; bustSize: "sm" | "md" }> = {
  champion: { bottomPct: 100 - 53, align: "center", gapPx: 64, bustSize: "md" },
  main: { bottomPct: 100 - 62, align: "center", gapPx: 48, bustSize: "sm" },
  breaking: { bottomPct: 100 - 67, align: "left", gapPx: 28, leftPadPct: 4, bustSize: "sm" },
};

export type PresenterOverlayProps = {
  variant: StudioBackdropVariant;
  activeSpeaker: PresenterId | null;
  activeState: PresenterState;
};

export function PresenterOverlay({ variant, activeSpeaker, activeState }: PresenterOverlayProps) {
  const line = DESK_LINE[variant];
  return (
    <div className="absolute inset-0" aria-hidden="true" style={{ zIndex: 2, pointerEvents: "none" }}>
      <div
        className="absolute flex items-end"
        style={{
          left: 0,
          right: 0,
          bottom: `${line.bottomPct}%`,
          justifyContent: line.align === "center" ? "center" : "flex-start",
          paddingLeft: line.leftPadPct ? `${line.leftPadPct}%` : undefined,
          gap: line.gapPx,
        }}
      >
        <Presenter speaker="A" active={activeSpeaker === "A"} state={activeSpeaker === "A" ? activeState : LISTENING_STATE} variant="bust" size={line.bustSize} showLabel={false} />
        <Presenter speaker="B" active={activeSpeaker === "B"} state={activeSpeaker === "B" ? activeState : LISTENING_STATE} variant="bust" size={line.bustSize} showLabel={false} />
      </div>
    </div>
  );
}

// ── Lower-third dock ────────────────────────────────────────────────────────
// The active speaker's caption used to render directly below the CSS desk's
// own front panel. That panel is gone, and a real broadcast's name-strap
// graphic doesn't move depending on what's behind it anyway (BroadcastPlayer
// .tsx's own header note) — so this docks it at a single fixed spot in the
// normal flex flow, just above the ticker, regardless of backdrop variant or
// where that variant's own real desk happens to sit.
export function LowerThirdDock({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div className="relative shrink-0 flex justify-center px-6 pb-3 pt-1 md:px-10" style={{ zIndex: 3 }}>
      {children}
    </div>
  );
}
