// TKDL LIVE — a presenter's on-screen identity. Renders the real rendered
// portrait from PresenterPortrait.tsx (presenter-config.ts's own header has
// the full history of what this replaced). Used standalone — DeskScene
// shows both presenters at the desk even when only one is currently
// speaking, via the "bust" variant. LowerThird.tsx (the caption for whoever
// is actually talking) renders its own small photo insert directly rather
// than reusing this component, since a lower third's photo is a hard-edged
// strip bled flush to the caption bar, not this component's badge/bust
// framing.
import type { CSSProperties } from "react";
import { PRESENTERS, type PresenterId, type PresenterState } from "./presenters/presenter-config";
import { PresenterPortrait } from "./presenters/PresenterPortrait";

export type PresenterProps = {
  speaker: PresenterId;
  /** The presenter currently reading a line gets full presence; the other one dims — same "one dominant subject" rule 15.3 applies to the graphic also applies to which presenter is speaking. */
  active?: boolean;
  size?: "sm" | "md" | "lg";
  /** Which of the 8 rendered poses to show — see presenter-state.ts's activeStateForScene(). Defaults to "neutral" for call sites that don't (yet) have scene context. */
  state?: PresenterState;
  /** "badge" (default): circular crop, for next to a dialogue line. "bust": the full uncropped cutout — PresenterOverlay's standing-at-the-desk presence. */
  variant?: "badge" | "bust";
  /**
   * Bust variant only. Defaults to true, but PresenterOverlay renders both
   * hosts with this off: a name/role tag under a static standing figure
   * would push the portrait's own foot-crop up and away from the real desk
   * edge it's meant to align with, and none of the reference broadcasts
   * float a persistent name tag over an idle presenter anyway — only the
   * lower third (LowerThird.tsx) actually names whoever is currently
   * speaking. Kept as an opt-out, not a deletion, for any future call site
   * that wants the label back (e.g. a static roster/about screen).
   */
  showLabel?: boolean;
};

const BADGE_SIZE: Record<NonNullable<PresenterProps["size"]>, number> = { sm: 40, md: 56, lg: 88 };
const BUST_SIZE: Record<NonNullable<PresenterProps["size"]>, number> = { sm: 88, md: 140, lg: 200 };

export function Presenter({ speaker, active = true, size = "md", state = "neutral", variant = "badge", showLabel = true }: PresenterProps) {
  const presenter = PRESENTERS[speaker];
  const dimension = variant === "bust" ? BUST_SIZE[size] : BADGE_SIZE[size];

  const frameStyle: CSSProperties = variant === "bust"
    ? {
        transition: "opacity 0.4s ease, filter 0.4s ease",
        flexShrink: 0,
        lineHeight: 0,
      }
    : {
        borderRadius: "50%",
        boxShadow: active ? `0 0 0 3px ${presenter.accent}22, 0 0 24px ${presenter.accent}55` : "none",
        opacity: active ? 1 : 0.45,
        transition: "opacity 0.25s ease, box-shadow 0.25s ease",
        flexShrink: 0,
        lineHeight: 0,
      };

  const portraitClass = variant === "bust"
    ? `presenter-bust-filter ${active ? "presenter-bust-active" : "presenter-bust-inactive"}`
    : "";

  const portrait = <div className={portraitClass}><PresenterPortrait speaker={speaker} size={dimension} state={state} variant={variant} /></div>;

  if (variant === "bust") {
    return (
      <div data-broadcast-presenter={speaker} className="flex flex-col items-center gap-2" style={{ transition: "opacity 0.4s ease, transform 0.4s ease", transform: active ? "scale(1.02)" : "scale(0.98)" }}>
        {/* A soft dark pool behind the bust — real broadcast desks light
            standing presenters against their own backdrop for exactly this
            reason: without it, a presenter dims/greys straight into a busy
            or brightly-coloured studio backdrop (this bit us on the gold
            Champion backdrop) rather than staying legible against ANY wall
            art behind them. */}
        <div className="relative" style={{ lineHeight: 0 }}>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "12% 10% -8% 10%",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 70%)",
              zIndex: 0,
            }}
          />
          <div style={{ ...frameStyle, position: "relative", zIndex: 1 }}>{portrait}</div>
        </div>
        {showLabel && (
          <div className="text-center">
            <div className="font-black uppercase leading-tight" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.95rem", letterSpacing: "0.04em", color: active ? "#fff" : "rgba(255,255,255,0.6)" }}>
              {presenter.name}
            </div>
            <div className="uppercase leading-tight" style={{ fontSize: "0.6rem", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>
              {presenter.role}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5" style={{ opacity: active ? 1 : 0.55, transition: "opacity 0.25s ease" }}>
      <div style={frameStyle} aria-hidden="true">{portrait}</div>
      {size !== "sm" && (
        <div className="min-w-0">
          <div className="font-black uppercase leading-tight" style={{ fontFamily: "Oswald, sans-serif", fontSize: size === "lg" ? "1.05rem" : "0.85rem", letterSpacing: "0.04em", color: "#fff" }}>
            {presenter.name}
          </div>
          <div className="uppercase leading-tight" style={{ fontSize: "0.62rem", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>
            {presenter.role}
          </div>
        </div>
      )}
    </div>
  );
}
