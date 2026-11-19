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
  "big-night": "bolt",
  "big-shift": "chips",
  "boss-clean-sweep": "crownskull",
  "both-sides": "yinyang",
  "bounce-back": "bounce",
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
  "grudge-match": "flame",
  "hat-trick": "hat",
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
  "marathon-night": "clock",
  "maximum-pressure": "max",
  "midnight-oil": "candle",
  "milestone-match": "hundred",
  "nemesis": "eye",
  "never-gave-up": "flagpeak",
  "new-year": "fireworks",
  "night-owl": "moon",
  "night-shift": "moonstar",
  "overtime": "plusclock",
  "perfect-week": "calendar",
  "podium-pair": "podium",
  "quick-clear": "stopwatch",
  "reunited": "chain",
  "revenge": "swords",
  "rivalry": "vs",
  "safe-pair-of-hands": "pair",
  "seven-days": "seven",
  "survivor": "heart",
  "threes-company": "trio",
  "ton-up-session": "tonup",
  "top-pair": "twostar",
  "unbeaten-season": "shield",
  "upset-of-the-night": "bang",
  "variety-pack": "shapes",
  "weekend-grinder": "weekend"
};
const SHOWPIECES = new Set(["clean-sweep", "inseparable", "iron-discipline", "m501-world-champion", "boss-slayer"]);

/** A track's piece in its metal (the gold piece stands in, as a silhouette, while locked). */
export const trackArt = (key: string, metal: Metal | null) => `${BASE}/${key}-${(metal ?? "GOLD").toLowerCase()}.webp`;
export const isShowpiece = (key: string) => SHOWPIECES.has(key);
/** A feat's seal, or the showpiece for the few that have one. */
export const featArt = (key: string) => SHOWPIECES.has(key) ? `${BASE}/${key}-showpiece.webp` : `${BASE}/seal-${SEAL[key] ?? "star"}.webp`;
/** CSS that turns a piece into a locked silhouette. */
export const LOCKED = { filter: "brightness(0) drop-shadow(0 0 1px rgba(255,255,255,.35))", opacity: 0.5 } as const;
