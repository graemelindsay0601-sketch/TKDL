// Curse Codex (Board Curse): every curse you've beaten. A curse counts once it hit you in a leg you
// went on to win (solo clear, duel win or a Curse Run leg). Complete a board's list for an
// exclusive unlock. The id lists mirror tkdl's board-curse-data.ts (a test keeps them in step).

export const X01_CURSE_IDS = [
  "off-night", "toll-booth", "dead-number", "wandering-aim", "heavy-hands", "full-send",
  "weakened", "dead-zone", "flattened", "butter-fingers", "missing-dart", "capped-visit", "fading-fast", "no-easy-points", "choke", "sunk-cost",
  "shackled", "heavy-toll", "minefield", "heavy-fog", "two-lost-darts", "iron-cap", "cold-open", "sudden-death", "no-way-out", "splintered", "dead-weight",
] as const;
export const CRICKET_CURSE_IDS = [
  "slow-hands", "one-down", "fumble", "one-shot",
  "narrowed", "half-marks", "bull-void", "missed-finish", "sniper-lock", "scoring-choke", "rationed",
  "locked-out", "narrow-path", "mark-erasure", "streak-breaker", "mark-drain", "pressure", "point-blank", "shutdown",
] as const;

export type CodexGame = "X01" | "CRICKET";
export const curseIdsFor = (g: CodexGame): readonly string[] => g === "X01" ? X01_CURSE_IDS : CRICKET_CURSE_IDS;
export const isCurseId = (g: CodexGame, id: string) => curseIdsFor(g).includes(id);

export type CurseReward = { id: string; category: "LEADERBOARD_TAG" | "FRAME" | "NAME_STYLE"; name: string; rarity: string; color?: string; gradient?: string; glow?: string; earnedBy: string };

export const CURSE_REWARDS: CurseReward[] = [
  { id: "tag-bc-hexbreaker", category: "LEADERBOARD_TAG", name: "HEXBREAKER", rarity: "EPIC", color: "#ff6a00", earnedBy: "Beat every 501 curse in Board Curse" },
  { id: "frame-bc-warded", category: "FRAME", name: "Warded", rarity: "EPIC", color: "#ff1744", glow: "#ff8a65", earnedBy: "Beat every Cricket curse in Board Curse" },
  { id: "name-bc-cursebound", category: "NAME_STYLE", name: "Cursebound", rarity: "LEGENDARY", gradient: "linear-gradient(90deg,#3b0a0a,#ff1744,#ffb400,#ff1744,#3b0a0a)", glow: "#ff6a00", earnedBy: "Complete the whole Curse Codex" },
  { id: "tag-bc-pact-keeper", category: "LEADERBOARD_TAG", name: "PACT KEEPER", rarity: "RARE", color: "#b388ff", earnedBy: "Clear a Curse Run leg with 3 Dark Pacts active" },
  { id: "tag-bc-run-king", category: "LEADERBOARD_TAG", name: "CURSE RUN KING", rarity: "LEGENDARY", color: "#ffd24a", earnedBy: "Set the all-time Curse Run record" },
];
export const CURSE_EARNED_BY: Record<string, string> = Object.fromEntries(CURSE_REWARDS.map(r => [r.id, r.earnedBy]));

/** Rewards a set of beaten curses has earned. */
export function codexRewards(beaten: { X01: Iterable<string>; CRICKET: Iterable<string> }): string[] {
  const x = new Set(beaten.X01), c = new Set(beaten.CRICKET);
  const xDone = X01_CURSE_IDS.every(id => x.has(id)), cDone = CRICKET_CURSE_IDS.every(id => c.has(id));
  return [...(xDone ? ["tag-bc-hexbreaker"] : []), ...(cDone ? ["frame-bc-warded"] : []), ...(xDone && cDone ? ["name-bc-cursebound"] : [])];
}

// ── Curse Run checks (the run itself is played in the app; the server just sanity-checks the result) ──
export const RUN_MAX_LEGS = 40;
/** Highest score a run of this many legs could reach (every leg finished in 1 visit, max multiplier). */
export function maxRunScore(legs: number): number {
  let total = 0;
  for (let leg = 1; leg <= legs; leg++) total += (200 + (24 + leg) * 100) * (1 + leg * 0.5 + leg * 0.25);
  return Math.round(total);
}
