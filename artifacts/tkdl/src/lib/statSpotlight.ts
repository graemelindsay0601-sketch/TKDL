import { useEffect, useState } from "react";

// Featured Stat Spotlight — a free (not coin-gated) profile customization:
// a player picks one stat from this fixed shortlist to headline next to
// their Trophy Case (see components/TrophyCase.tsx and components/
// FeaturedStatBadge.tsx). Backed by players.featuredStatKey (a plain string
// key, validated server-side against SPOTLIGHT_STAT_KEYS in routes/
// players.ts — never free text) and GET /players/:id/stats/spotlight for
// the live computed values.
export const SPOTLIGHT_STAT_KEYS = ["bestCheckout", "highestAverage", "longestWinStreak", "most180s", "matchesPlayed", "bestLeg"] as const;
export type SpotlightStatKey = (typeof SPOTLIGHT_STAT_KEYS)[number];

export interface SpotlightValues {
  bestCheckout: number | null;
  highestAverage: number | null;
  longestWinStreak: number;
  most180s: number;
  matchesPlayed: number;
  bestLeg: number | null;
}

// format() returns null when the underlying value isn't available yet (e.g.
// a player who's never hit a checkout) — callers use that to hide the badge
// rather than show a confusing "Best Checkout: —".
export const SPOTLIGHT_STATS: Record<SpotlightStatKey, { label: string; shortLabel: string; format: (v: SpotlightValues) => string | null }> = {
  bestCheckout:     { label: "Best Checkout",      shortLabel: "Best Checkout",   format: v => v.bestCheckout != null ? `${v.bestCheckout}` : null },
  highestAverage:   { label: "Highest Average",    shortLabel: "Best Average",    format: v => v.highestAverage != null ? v.highestAverage.toFixed(1) : null },
  longestWinStreak: { label: "Longest Win Streak", shortLabel: "Win Streak",      format: v => v.longestWinStreak > 0 ? `${v.longestWinStreak}` : null },
  most180s:         { label: "Most 180s",          shortLabel: "180s",           format: v => v.most180s > 0 ? `${v.most180s}` : null },
  matchesPlayed:    { label: "Matches Played",     shortLabel: "Matches Played",  format: v => v.matchesPlayed > 0 ? `${v.matchesPlayed}` : null },
  bestLeg:          { label: "Best Leg (fewest darts)", shortLabel: "Best Leg",   format: v => v.bestLeg != null ? `${v.bestLeg} darts` : null },
};

export function useSpotlightValues(playerId: number | null | undefined): SpotlightValues | null {
  const [values, setValues] = useState<SpotlightValues | null>(null);
  useEffect(() => {
    if (!playerId) { setValues(null); return; }
    let live = true;
    fetch(`/api/players/${playerId}/stats/spotlight`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setValues(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [playerId]);
  return values;
}
