const TIER_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  Gold:   { label: "GOLD",   color: "#ffd24a", border: "rgba(255,210,74,0.4)",  bg: "rgba(255,210,74,0.1)" },
  Silver: { label: "SILVER", color: "#c0c8d8", border: "rgba(192,200,216,0.4)", bg: "rgba(192,200,216,0.08)" },
  Bronze: { label: "BRONZE", color: "#cd7f32", border: "rgba(205,127,50,0.4)",  bg: "rgba(205,127,50,0.08)" },
};

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
