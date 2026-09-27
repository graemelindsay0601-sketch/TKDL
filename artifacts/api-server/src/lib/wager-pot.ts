export type StakeMode = "per-player" | "total";

// Missing mode preserves existing clients and saved matches. New live-scorer
// uneven matches explicitly send a total; headcounts only determine turns/splits.
export function wagerPot(stake: number, side1Count: number, side2Count: number, mode: StakeMode = "per-player"): number {
  return mode === "total" ? stake : stake * Math.max(side1Count, side2Count);
}

export function computeWagerShares(stake: number, winnerCount: number, loserCount: number, mode: StakeMode = "per-player") {
  const pot = wagerPot(stake, winnerCount, loserCount, mode);
  const split = (count: number) => Array.from({ length: count }, (_, i) => Math.floor(pot / count) + (i < pot % count ? 1 : 0));
  return { pot, winnerShares: split(winnerCount), loserShares: split(loserCount) };
}
