const TIER_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  Diamond:  { label: "DIAMOND",  color: "#00e5ff", border: "rgba(0,229,255,0.4)",   bg: "rgba(0,229,255,0.1)" },
  Platinum: { label: "PLATINUM", color: "#e5e4e2", border: "rgba(229,228,226,0.4)", bg: "rgba(229,228,226,0.08)" },
  Gold:     { label: "GOLD",     color: "#ffd24a", border: "rgba(255,210,74,0.4)",  bg: "rgba(255,210,74,0.1)" },
  Silver:   { label: "SILVER",   color: "#c0c8d8", border: "rgba(192,200,216,0.4)", bg: "rgba(192,200,216,0.08)" },
  Bronze:   { label: "BRONZE",   color: "#cd7f32", border: "rgba(205,127,50,0.4)",  bg: "rgba(205,127,50,0.08)" },
};

// The flat tier→color map, exported so every other page that needs to tint
// something by tier (a text glow, a card border, an emoji legend) pulls
// from this ONE source instead of hand-copying the five hex values again.
// A visual-consistency sweep (2026-09-25) found six independently-typed
// copies of this exact map scattered across account.tsx, players.tsx,
// community.tsx, dashboard.tsx, leaderboard.tsx and broadcast.tsx, three of
// which had quietly drifted from these canonical values — leaderboard.tsx's
// was the worst, rendering Platinum as magenta (#e879f9) instead of the
// pale near-white every other page uses. Exporting the real source of
// truth here, and pointing every consumer at it, fixes the drift and
// (more importantly) makes it impossible for a seventh copy to drift next.
export const TIER_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(TIER_CONFIG).map(([tier, cfg]) => [tier, cfg.color])
);

export function TierBadge({ tier }: { tier?: string }) {
  const cfg = TIER_CONFIG[tier ?? ""] ?? TIER_CONFIG.Bronze!;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-bold"
      style={{
        color: cfg.color,
        borderColor: cfg.border,
        background: cfg.bg,
        border: "1px solid",
        borderRadius: "2px",
        fontFamily: "Oswald, sans-serif",
        letterSpacing: "0.1em",
      }}
    >
      {cfg.label}
    </span>
  );
}
