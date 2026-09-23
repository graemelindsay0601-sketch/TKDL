import { SPOTLIGHT_STATS, type SpotlightStatKey, type SpotlightValues } from "@/lib/statSpotlight";

// Read-only display for a player's Featured Stat Spotlight (see
// lib/statSpotlight.ts) — renders next to <TrophyCase>. Renders nothing
// when no stat is featured, the values haven't loaded yet, or the featured
// stat's value isn't actually available (e.g. a player who's never hit a
// checkout picked "Best Checkout") — same graceful-degradation posture as
// the rest of this app's optional profile flair.
export function FeaturedStatBadge({ statKey, values }: { statKey: string | null | undefined; values: SpotlightValues | null }) {
  if (!statKey || !values) return null;
  const def = SPOTLIGHT_STATS[statKey as SpotlightStatKey];
  if (!def) return null;
  const formatted = def.format(values);
  if (formatted == null) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mb-3"
      style={{ background: "rgba(0,102,255,0.07)", border: "1px solid rgba(0,102,255,0.22)" }}>
      <span className="font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
        {def.shortLabel}
      </span>
      <span className="font-black" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", color: "#4d94ff" }}>
        {formatted}
      </span>
    </div>
  );
}
