// TKDL LIVE — shared layout primitives for scenes/*.tsx. Every scene is a
// distinct "one dominant subject" composition (15.3), so these are
// deliberately thin (a fade-in wrapper, an eyebrow label, a headline style)
// rather than a rigid template every scene is forced into — the scenes
// themselves still each own their own arrangement of graphic + dialogue.
import type { CSSProperties, ReactNode } from "react";
import type { VisualTier } from "../theme";

export type SceneShellProps = {
  children: ReactNode;
  /** Full CSS background value — lets BreakingScene/ChampionScene override the default near-black studio ground with their own tinted wash. */
  background?: string;
  justify?: "start" | "center";
};

/** Reuses index.css's own existing `.fade-in-up` keyframe (already used elsewhere in this app for card entrances) so a new segment settling into view doesn't need a second, bespoke transition animation. */
export function SceneShell({ children, background, justify = "start" }: SceneShellProps) {
  const style: CSSProperties = {
    background: background ?? "transparent",
    justifyContent: justify === "center" ? "center" : "flex-start",
  };
  return (
    <div className="fade-in-up flex-1 min-h-0 w-full flex flex-col overflow-hidden px-6 py-8 md:px-12 lg:px-16" style={style}>
      {children}
    </div>
  );
}

export function SceneEyebrow({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="font-black uppercase mb-2 flex items-center gap-2"
      style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", letterSpacing: "0.2em", color, textShadow: "0 2px 8px rgba(0,0,0,0.65)" }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </div>
  );
}

// "tease" is HeadlinesScene's own "coming up" reel — a genuine promo beat
// every darts broadcast still goes loud on ("UP NEXT..."), independent of
// the story's own Treatment. "major"/"featured"/"quiet" are theme.ts's own
// visualTierForImportance() buckets, carrying the real hierarchy-by-
// treatment idea: a routine Supporting story (the overwhelming majority of
// any Edition) now reads as a much quieter caption-scale headline, matching
// how a real broadcast reserves its biggest typographic moment for the
// rare story that actually earns it rather than shouting every result at
// the same volume. See theme.ts's own comment on VisualTier for the full
// reasoning (real user feedback: "everything seems so large and just in
// your face... doesnt quite feel like the way a tv version of a sports
// broadcast will go").
export type HeadlineTier = VisualTier | "tease";

const HEADLINE_SIZE: Record<HeadlineTier, string> = {
  tease: "clamp(2rem, 4.6vw, 3rem)",
  major: "clamp(1.8rem, 4vw, 2.7rem)",
  featured: "clamp(1.4rem, 3vw, 2rem)",
  quiet: "clamp(1.1rem, 2.3vw, 1.55rem)",
};

export function SceneHeadline({ children, tier = "quiet" }: { children: ReactNode; tier?: HeadlineTier }) {
  return (
    <h2
      className="font-black uppercase text-white"
      style={{
        fontFamily: "Oswald, sans-serif",
        fontSize: HEADLINE_SIZE[tier],
        lineHeight: 1.08,
        letterSpacing: "0.01em",
        textWrap: "balance",
        // Safety net for whatever's still too wide for its column even at
        // the sizes above (a longer single word, a narrower viewport than
        // typically tested): wraps rather than overflowing into whatever
        // sits next to it. `break-word` only kicks in once normal
        // word-boundary wrapping has nowhere left to go, so it changes
        // nothing for headlines that already fit.
        overflowWrap: "break-word",
        wordBreak: "break-word",
        // Headlines sit directly over the studio backdrop (StudioSet.tsx's
        // own header explains why there's no card behind them any more) —
        // this shadow is what keeps white text legible over the backdrop's
        // own busy art in place of a panel.
        textShadow: "0 2px 14px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.85)",
      }}
    >
      {children}
    </h2>
  );
}
