/**
 * Your fan following: how many people follow your darts, worked out only from what happened in your Career
 * (results by stage and level, nine-darters, viral stream clips, and how you present yourself in interviews). Wins at home build a
 * home following; wins abroad build an international one. A core of fans stays with you; casual fans drift away
 * in seasons when you are out of the spotlight. It is never spent and never changes how you throw.
 */
export const FANS = Object.freeze({
  /** Fans gained per result by presentation tier: [appearance, final reached, title]. */
  byTier: { LOCAL: [3, 15, 40], STANDARD: [8, 60, 180], FEATURED: [20, 150, 450], TELEVISED: [120, 900, 3000], MAJOR: [300, 2500, 9000], WORLD: [900, 8000, 30000] } as Record<string, [number, number, number]>,
  nineDarter: { base: 2500, televised: 15000 },
  /** Interview style: showmanship and confidence draw a crowd (each answer adds 2%, at most +30%). */
  personaPerAnswer: 0.02, personaCap: 0.3,
  /** Share of each season's new fans who stay for good; the rest fade by this much each later season. */
  core: 0.4, fadePerSeason: 0.35,
  milestones: [1_000, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
});

export type FanResult = { season: number; tier: string; country: string; champion: boolean; final: boolean; qualifier: boolean };
export type FanEvidence = { currentSeason: number; homeCountry: string | null; results: readonly FanResult[];
  nineDarters: readonly { season: number; televised: boolean; country: string }[]; showmanAnswers: number;
  /** Fans won by viral stream clips, by season (they fade like any other fans). */
  streamFans?: readonly { season: number; fans: number }[] };
export type FanFollowing = {
  total: number; home: number; international: number;
  /** New fans won this season (before any fading). */
  thisSeason: number;
  bySeason: { season: number; total: number }[];
  label: string;
  /** Milestones passed, with the season each was first reached. */
  milestones: { fans: number; season: number }[];
};

const LABELS: [number, string][] = [[0, "No following yet"], [500, "A few local supporters"], [5_000, "A local following"], [25_000, "A national following"],
  [100_000, "A big following"], [400_000, "A darts superstar's following"]];
export const fanLabel = (fans: number) => [...LABELS].reverse().find(([min]) => fans >= min)![1];

export function fanFollowing(e: FanEvidence): FanFollowing {
  const multiplier = 1 + Math.min(FANS.personaCap, e.showmanAnswers * FANS.personaPerAnswer);
  const gains = new Map<number, { home: number; abroad: number }>();
  const gain = (season: number, home: boolean, n: number) => {
    const g = gains.get(season) ?? { home: 0, abroad: 0 }; if (home) g.home += n; else g.abroad += n; gains.set(season, g);
  };
  for (const r of e.results) {
    if (r.qualifier) continue;
    const [appear, final, title] = FANS.byTier[r.tier] ?? FANS.byTier.LOCAL;
    gain(r.season, r.country === e.homeCountry, (r.champion ? title : r.final ? final : appear) * multiplier);
  }
  for (const c of e.streamFans ?? []) gain(c.season, true, c.fans);
  for (const n of e.nineDarters) gain(n.season, n.country === e.homeCountry, (n.televised ? FANS.nineDarter.televised : FANS.nineDarter.base) * multiplier);
  // Followers at the end of season s: every season's gains, the faded casual share shrinking each later season.
  const at = (s: number) => {
    let home = 0, abroad = 0;
    for (const [season, g] of gains) if (season <= s) {
      const kept = FANS.core + (1 - FANS.core) * Math.pow(1 - FANS.fadePerSeason, s - season);
      home += g.home * kept; abroad += g.abroad * kept;
    }
    return { home: Math.round(home), abroad: Math.round(abroad) };
  };
  const seasons = Array.from({ length: Math.max(0, e.currentSeason) }, (_, i) => i + 1);
  const bySeason = seasons.map(season => { const v = at(season); return { season, total: v.home + v.abroad }; });
  const now = at(e.currentSeason), total = now.home + now.abroad;
  const milestones = FANS.milestones.flatMap(m => { const first = bySeason.find(b => b.total >= m); return first ? [{ fans: m, season: first.season }] : []; });
  const g = gains.get(e.currentSeason);
  return { total, home: now.home, international: now.abroad, thisSeason: Math.round((g?.home ?? 0) + (g?.abroad ?? 0)), bySeason, label: fanLabel(total), milestones };
}

/** Extra signature-product units a week from your following (a big following sells shirts and darts). */
export const fanDemandUnits = (fans: number) => Math.min(20, Math.floor(Math.sqrt(Math.max(0, fans)) / 25));
/** A sponsor's signing-bonus premium for your following (up to +50%). */
export const fanSponsorPremium = (fans: number) => Math.min(0.5, Math.floor(fans / 20_000) * 0.05);
/** How a crowd treats you: at home your following leads; abroad your international following and how divisive you are. */
export function crowdSupport(f: Pick<FanFollowing, "home" | "international">, divisive: boolean) {
  const lean = (n: number) => n >= 100_000 ? "Firmly behind you" : n >= 20_000 ? "Behind you" : n >= 2_000 ? "Warm" : "Neutral";
  return { home: lean(f.home), away: divisive && f.international < 100_000 ? "Mixed — some will boo" : lean(f.international) };
}
