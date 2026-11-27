import type { Metal } from "./api";

/**
 * Achievements v2 artwork (rendered in 3D, served from /public/achievements-v2):
 * every track has one image per metal, every feat a seal, and each area's showpiece its own piece.
 */
const BASE = "/achievements-v2";
const SEAL: Record<string, string> = {
  "all-in": "spade",
  "answer-back": "bubble",
  "back-from-the-brink": "one",
  "big-fish": "fish",
  "big-night": "bolt",
  "big-shift": "chips",
  "boss-clean-sweep": "crownskull",
  "both-sides": "yinyang",
  "bounce-back": "bounce",
  "bridesmaid": "rings",
  "champions-scalp": "crown",
  "clocking-in": "card",
  "debut-win": "star",
  "double-or-quits": "dice",
  "double-take": "repeat",
  "doubles-debut": "mask",
  "early-bird": "bird",
  "early-doors": "sun",
  "employee-of-the-month": "rosette",
  "festive-fixture": "tree",
  "first-time": "first",
  "founding-member": "key",
  "friday-13th": "cat",
  "friday-feeling": "pint",
  "full-house": "house",
  "full-rota": "rota",
  "giant-killer": "skull",
  "giant-leap": "up",
  "gold-watch": "watch",
  "grudge-match": "flame",
  "hall-of-famer": "pillar",
  "hat-trick": "hat",
  "hot-streak": "ten",
  "ice-cold": "snow",
  "in-sync": "sync",
  "iron-man": "anvil",
  "kingmaker": "king",
  "lone-wolf": "wolf",
  "long-session": "hourglass",
  "m501-clean-tier": "broom",
  "m501-flawless": "gem",
  "m501-last-gasp": "pulse",
  "m501-speed-run": "rocket",
  "m501-tier-jumper": "stairs",
  "maiden-title": "trophy",
  "marathon-night": "clock",
  "maximum-pressure": "max",
  "midnight-oil": "candle",
  "milestone-match": "hundred",
  "nemesis": "eye",
  "never-gave-up": "flagpeak",
  "new-year": "fireworks",
  "night-owl": "moon",
  "night-shift": "moonstar",
  "on-fire": "torch",
  "overtime": "plusclock",
  "perfect-week": "calendar",
  "perfection": "nine",
  "podium-pair": "podium",
  "quick-clear": "stopwatch",
  "reunited": "chain",
  "revenge": "swords",
  "rivalry": "vs",
  "safe-pair-of-hands": "pair",
  "second-chance": "loop",
  "seven-days": "seven",
  "survivor": "heart",
  "threes-company": "trio",
  "ton-plus-finish": "ton",
  "ton-up-session": "tonup",
  "top-pair": "twostar",
  "turning-pro": "ticket",
  "unbeaten-season": "shield",
  "upset-of-the-night": "bang",
  "variety-pack": "shapes",
  "weekend-grinder": "weekend",
  // Nov 2026
  "burns-night": "thistle",
  "st-andrews-day": "saltire",
  "hogmanay": "clock",
  "bonfire-night": "fireworks",
  "trick-or-treat": "pumpkin",
  "sweetheart": "heart",
  "leap-day": "n29",
  "lunch-break": "sun",
  "weekend-warrior": "weekend",
  "three-peat": "repeat",
  "double-header": "pair",
  "weekend-shift": "weekend",
  "big-day": "hourglass",
  "deadeye": "target",
  "ton-average": "hundred",
  "christmas-cracker": "tree",
  "party-animal": "mask",
  "m501-never-say-die": "bounce",
  "curse-collector": "shapes",
  "boss-regular": "crownskull"
};
const SHOWPIECE_MODEL: Record<string, string> = { "clean-sweep": "grand-slam", "inseparable": "inseparable", "iron-discipline": "grindstone",
  "m501-world-champion": "dart-in-stone", "boss-slayer": "boss-slayer", "world-champion": "world-champion" };
const SHOWPIECES = new Set(["clean-sweep", "inseparable", "iron-discipline", "m501-world-champion", "boss-slayer", "world-champion"]);

/** Tracks added in Nov 2026 share two award families (a medallion for practice games, a crest for the rest); the emblem and the plinth name tell them apart. */
export const TRACK_PIECE: Record<string, string> = {
  "league-x01-wins": "crest~x01~X01 wins",
  "league-cricket-wins": "crest~stumps~Cricket wins",
  "league-darts": "crest~dartx~Darts thrown",
  "league-170s": "crest~n170~170 club",
  "doubles-stake-points": "crest~chips~Team stakes",
  "practice-wins": "crest~trophy~Practice wins",
  "practice-best-average": "crest~avg~Best average",
  "game-x01": "legend~x01~X01",
  "game-cricket": "legend~stumps~Cricket",
  "game-clock": "legend~clock~Round the clock",
  "game-shanghai": "legend~sh~Shanghai",
  "game-halve-it": "legend~half~Halve-It",
  "game-killer": "legend~skull~Killer",
  "game-bobs-27": "legend~n27~Bob's 27",
  "game-baseball": "legend~baseball~Baseball",
  "game-golf": "legend~golf~Golf",
  "game-football": "legend~football~Football",
  "game-checkout": "legend~n170~Checkout drills",
  "game-scoring": "legend~t20~Scoring drills",
  "game-99-darts": "legend~n99~99 Darts",
  "game-bull": "legend~target~Bull games",
  "game-tennis": "legend~tennis~Tennis",
  "game-battleship": "legend~ship~Battleship",
  "game-snooker": "legend~ball8~Snooker",
  "game-noughts": "legend~xo~Noughts & Crosses",
  "game-races": "legend~chequer~Race games",
  "game-party": "legend~mask~Party games",
  "game-pro-drills": "legend~pro~Pro drills",
  "m501-legs": "crest~legs~Legs won",
  "m501-tiers": "crest~stairs~Tiers cleared",
  "board-curse-played": "crest~flame~Board Curse",
  "boss-attempts": "crest~crownskull~Boss fights",
  "boss-wins": "crest~crown~Boss wins",
};
/** A track's piece in its metal (the gold piece stands in, as a silhouette, while locked). */
export const trackArt = (key: string, metal: Metal | null) => `${BASE}/${key}-${(metal ?? "GOLD").toLowerCase()}.webp`;
export const isShowpiece = (key: string) => SHOWPIECES.has(key);
/** A feat's seal, or the showpiece for the few that have one. */
export const featArt = (key: string) => SHOWPIECES.has(key) ? `${BASE}/${key}-showpiece.webp` : `${BASE}/seal-${SEAL[key] ?? "star"}.webp`;
/** CSS that turns a piece into a locked silhouette. */
export const LOCKED = { filter: "brightness(0) drop-shadow(0 0 1px rgba(255,255,255,.35))", opacity: 0.5 } as const;

/** The 3D model behind a piece of art: a track in a metal, a feat's seal, or a showpiece. */
export const trackModel = (key: string, metal: Metal) => ({ id: TRACK_PIECE[key] ?? key, tier: metal });
export const featModel = (key: string) => SHOWPIECES.has(key) ? { id: SHOWPIECE_MODEL[key] ?? key, tier: "SHOWPIECE" } : { id: `feat-seal~${SEAL[key] ?? "star"}`, tier: "GOLD" };
const METAL_ORDER: Metal[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
/** Metal for a track level (mirrors the server): Diamond only when complete; the rest spread across the other four. */
export function metalFor(level: number, levels: number): Metal | null {
  if (level <= 0) return null;
  if (level >= levels) return "DIAMOND";
  return METAL_ORDER[Math.min(4, 1 + Math.floor(((level - 1) / (levels - 1)) * 4)) - 1];
}
