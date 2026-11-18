import type { Area, Metal } from "./api";

/**
 * Placeholder medal until the artwork pass: a struck disc in the metal's colours with the area's mark.
 * Locked shows as a dim outline. Size in px.
 */
const METAL_STYLE: Record<Metal, { face: string; rim: string; ink: string; glow: string }> = {
  BRONZE:   { face: "radial-gradient(circle at 35% 30%, #f3c39a, #b06a3b 55%, #6e3a1c)", rim: "#8a4d27", ink: "#3d1f0c", glow: "rgba(205,127,50,0.35)" },
  SILVER:   { face: "radial-gradient(circle at 35% 30%, #ffffff, #c4c9d2 50%, #7c8390)", rim: "#9aa1ad", ink: "#2b2f36", glow: "rgba(200,210,225,0.35)" },
  GOLD:     { face: "radial-gradient(circle at 35% 30%, #fff3b0, #f2c230 50%, #a8740a)", rim: "#c9940f", ink: "#4a3300", glow: "rgba(255,210,74,0.45)" },
  PLATINUM: { face: "radial-gradient(circle at 35% 30%, #f4fbff, #a9d6e5 50%, #4f8fa6)", rim: "#6fb0c6", ink: "#123241", glow: "rgba(140,220,255,0.45)" },
  DIAMOND:  { face: "conic-gradient(from 210deg, #c7f9ff, #7cc8ff, #e0c3ff, #9ff5ff, #c7f9ff)", rim: "#bfe9ff", ink: "#0d2a4a", glow: "rgba(170,230,255,0.7)" },
};
const AREA_MARK: Record<Area, string> = { LEAGUE: "L", TEAMS: "T", PRACTICE: "P", MASTER501: "M", MODES: "B" };

export function Medal({ metal, area, size = 44, label }: { metal: Metal | null; area: Area; size?: number; label?: string }) {
  if (!metal) {
    return (
      <div aria-label={label ?? "Locked"} className="shrink-0 rounded-full flex items-center justify-center"
        style={{ width: size, height: size, border: "2px dashed rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.22)",
          fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: size * 0.38 }}>
        {AREA_MARK[area]}
      </div>
    );
  }
  const s = METAL_STYLE[metal];
  return (
    <div aria-label={label ?? metal.toLowerCase()} className="shrink-0 rounded-full flex items-center justify-center relative"
      style={{ width: size, height: size, background: s.face, border: `${Math.max(2, size / 16)}px solid ${s.rim}`,
        boxShadow: `0 0 ${size / 3}px ${s.glow}, inset 0 ${size / 14}px ${size / 10}px rgba(255,255,255,0.45), inset 0 -${size / 14}px ${size / 8}px rgba(0,0,0,0.3)`,
        color: s.ink, fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: size * 0.4, textShadow: "0 1px 0 rgba(255,255,255,0.4)" }}>
      {AREA_MARK[area]}
    </div>
  );
}

/** A feat's mark: a star seal, gold once earned. */
export function FeatSeal({ earned, secret, size = 40 }: { earned: boolean; secret: boolean; size?: number }) {
  return (
    <div className="shrink-0 flex items-center justify-center" style={{ width: size, height: size,
      clipPath: "polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
      background: earned ? "radial-gradient(circle at 40% 35%, #fff3b0, #f2c230 55%, #a8740a)" : "rgba(255,255,255,0.08)",
      color: earned ? "#4a3300" : "rgba(255,255,255,0.3)", fontWeight: 900, fontSize: size * 0.3 }}>
      {secret && !earned ? "?" : ""}
    </div>
  );
}
