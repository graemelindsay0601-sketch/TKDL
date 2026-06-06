/**
 * Bot simulation engine for practice mode CPU opponents.
 * Named personas are fictional alter-egos of real pros — same skill archetype, different identity.
 */
import type { Dart } from "./dartboard";

export type BotLevel = "beginner" | "amateur" | "club" | "county" | "pro" | "elite";

/** Raw stats that drive every visit function. */
export type BotConfig = {
  avg: number;
  sd: number;
  checkoutPct: number;
  hitAcc: number;
};

export const BOT_LEVELS: Record<BotLevel, BotConfig & { label: string; color: string }> = {
  beginner: { label: "Beginner", color: "#94a3b8", avg: 26,  sd: 18, checkoutPct: 0.05, hitAcc: 0.14 },
  amateur:  { label: "Amateur",  color: "#22c55e", avg: 45,  sd: 15, checkoutPct: 0.18, hitAcc: 0.28 },
  club:     { label: "Club",     color: "#3b82f6", avg: 62,  sd: 12, checkoutPct: 0.34, hitAcc: 0.45 },
  county:   { label: "County",   color: "#a78bfa", avg: 80,  sd: 9,  checkoutPct: 0.52, hitAcc: 0.62 },
  pro:      { label: "Pro",      color: "#ffd24a", avg: 95,  sd: 7,  checkoutPct: 0.70, hitAcc: 0.78 },
  elite:    { label: "Elite",    color: "#ff005c", avg: 108, sd: 5,  checkoutPct: 0.82, hitAcc: 0.88 },
};

export function getBotConfig(level: BotLevel): BotConfig {
  const { avg, sd, checkoutPct, hitAcc } = BOT_LEVELS[level];
  return { avg, sd, checkoutPct, hitAcc };
}

// ── Level Bot (1–20) ───────────────────────────────────────────────────────────
const NUM_MIN_AVG  = 18;  const NUM_MAX_AVG  = 110;
const NUM_MIN_SD   = 18;  const NUM_MAX_SD   = 4;
const NUM_MIN_CO   = 0.03; const NUM_MAX_CO  = 0.86;
const NUM_MIN_HIT  = 0.10; const NUM_MAX_HIT = 0.92;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function numLevelConfig(n: number): BotConfig {
  const t = (Math.max(1, Math.min(20, n)) - 1) / 19;
  return {
    avg:         Math.round(lerp(NUM_MIN_AVG,  NUM_MAX_AVG,  t)),
    sd:          Math.round(lerp(NUM_MIN_SD,   NUM_MAX_SD,   t)),
    checkoutPct: parseFloat(lerp(NUM_MIN_CO,   NUM_MAX_CO,   t).toFixed(3)),
    hitAcc:      parseFloat(lerp(NUM_MIN_HIT,  NUM_MAX_HIT,  t).toFixed(3)),
  };
}

export function numLevelLabel(n: number): string {
  if (n <= 2)  return "Pub Rookie";
  if (n <= 4)  return "Casual";
  if (n <= 7)  return "Regular";
  if (n <= 10) return "Club Player";
  if (n <= 13) return "County";
  if (n <= 16) return "Semi-Pro";
  if (n <= 18) return "Pro Tour";
  if (n <= 19) return "Top 32";
  return "World Class";
}

export function numLevelColor(n: number): string {
  if (n <= 3)  return "#94a3b8";
  if (n <= 6)  return "#22c55e";
  if (n <= 10) return "#3b82f6";
  if (n <= 13) return "#a78bfa";
  if (n <= 17) return "#ffd24a";
  return "#ff005c";
}

// ── Persona type ───────────────────────────────────────────────────────────────
export type BotPersona = {
  id: string;
  name: string;
  nickname: string;
  nationality: string;
  flag: string;
  tagline: string;
  level: BotLevel;
  avg: number;
};

/** Fictional alter-egos of real pros — sorted elite → beginner. */
export const BOT_PERSONAS: BotPersona[] = [
  // ── Elite ────────────────────────────────────────────────────────────────────
  {
    id: "luke_harbours",
    name: "Luke Harbours",
    nickname: "The World Beater",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "World No.1. Clinical. Composed. Unstoppable.",
    level: "elite",
    avg: 109,
  },
  {
    id: "luca_scrawler",
    name: "Luca Scrawler",
    nickname: "The Nuke",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Teenager. Already terrifying.",
    level: "elite",
    avg: 107,
  },
  {
    id: "mikkel_van_garwin",
    name: "Mikkel van Garwin",
    nickname: "Green Machine",
    nationality: "Dutch",
    flag: "🇳🇱",
    tagline: "Three-time world champ. Still averaging 100+.",
    level: "elite",
    avg: 104,
  },
  {
    id: "bill_tailor",
    name: "Bill Tailor",
    nickname: "The Power",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "16 world titles. A darts god.",
    level: "elite",
    avg: 101,
  },
  // ── Pro ───────────────────────────────────────────────────────────────────────
  {
    id: "geert_van_veen",
    name: "Geert van Veen",
    nickname: "The Young Gun",
    nationality: "Dutch",
    flag: "🇳🇱",
    tagline: "Dutch teenager. Already bothering the top 8.",
    level: "pro",
    avg: 95,
  },
  {
    id: "nathan_aspley",
    name: "Nathan Aspley",
    nickname: "The Asp",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Lightning fast. Bites when cornered.",
    level: "pro",
    avg: 93,
  },
  {
    id: "perry_wight",
    name: "Perry Wight",
    nickname: "Snakebite",
    nationality: "Scottish",
    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    tagline: "The spikiest player in the game.",
    level: "pro",
    avg: 92,
  },
  {
    id: "gareth_prise",
    name: "Gareth Prise",
    nickname: "The Iceman",
    nationality: "Welsh",
    flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    tagline: "Ice in his veins, fire in his eyes.",
    level: "pro",
    avg: 90,
  },
  {
    id: "josh_stone",
    name: "Josh Stone",
    nickname: "The Rock",
    nationality: "Northern Irish",
    flag: "🇮🇪",
    tagline: "Hard as rock. Harder to beat.",
    level: "pro",
    avg: 89,
  },
  {
    id: "barry_anderson",
    name: "Barry Anderson",
    nickname: "Flying Scotsman",
    nationality: "Scottish",
    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    tagline: "Two world titles and a chip on his shoulder.",
    level: "pro",
    avg: 88,
  },
  {
    id: "steve_bunton",
    name: "Steve Bunton",
    nickname: "The Bullet",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Gritty, passionate, and very good.",
    level: "pro",
    avg: 87,
  },
  {
    id: "danny_hera",
    name: "Danny Hera",
    nickname: "The Heat",
    nationality: "Australian",
    flag: "🇦🇺",
    tagline: "Turning up the heat from down under.",
    level: "pro",
    avg: 85,
  },
  // ── County ────────────────────────────────────────────────────────────────────
  {
    id: "ryan_searsley",
    name: "Ryan Searsley",
    nickname: "Heavy Metal",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Tour card holder. Reliable. Dangerous on a good day.",
    level: "county",
    avg: 83,
  },
  {
    id: "dmitri_van_den_berg",
    name: "Dmitri Van den Berg",
    nickname: "DreamMaker",
    nationality: "Belgian",
    flag: "🇧🇪",
    tagline: "Dreams big. Throws bigger.",
    level: "county",
    avg: 81,
  },
  {
    id: "ronny_clapton",
    name: "Ronny Clapton",
    nickname: "The Ferret",
    nationality: "Welsh",
    flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    tagline: "Small, quick, deadly.",
    level: "county",
    avg: 79,
  },
  {
    id: "jono_de_souza",
    name: "Jono de Souza",
    nickname: "The Special One",
    nationality: "Portuguese",
    flag: "🇵🇹",
    tagline: "He knows exactly what he's doing.",
    level: "county",
    avg: 77,
  },
  {
    id: "bob_frost",
    name: "Bob Frost",
    nickname: "Voltage",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "World champion. Still dangerous.",
    level: "county",
    avg: 75,
  },
  // ── Club ──────────────────────────────────────────────────────────────────────
  {
    id: "dave_chiselton",
    name: "Dave Chiselton",
    nickname: "Chizzy",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Consistent. Underestimated. Dangerous.",
    level: "club",
    avg: 74,
  },
  {
    id: "james_blade",
    name: "James Blade",
    nickname: "The Machine",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Cold. Calculated. Reliable.",
    level: "club",
    avg: 70,
  },
  {
    id: "simon_whitfield",
    name: "Simon Whitfield",
    nickname: "The Wizard",
    nationality: "Australian",
    flag: "🇦🇺",
    tagline: "Makes darts look like magic. Sometimes.",
    level: "club",
    avg: 67,
  },
  // ── Amateur ───────────────────────────────────────────────────────────────────
  {
    id: "fallon_sherrick",
    name: "Fallon Sherrick",
    nickname: "Queen of the Oche",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "First woman to beat a pro at Worlds. Don't sleep on her.",
    level: "amateur",
    avg: 62,
  },
  {
    id: "lisa_ashford",
    name: "Lisa Ashford",
    nickname: "Lancashire Lass",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "All heart, all grit.",
    level: "amateur",
    avg: 55,
  },
  {
    id: "ned_bankley",
    name: "Ned Bankley",
    nickname: "The Count",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Two-time BDO champ. A different era.",
    level: "amateur",
    avg: 49,
  },
  // ── Beginner ──────────────────────────────────────────────────────────────────
  {
    id: "andy_hamish",
    name: "Andy Hamish",
    nickname: "The Hammer",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Hits the board. Mostly.",
    level: "beginner",
    avg: 32,
  },
  {
    id: "terry_jenkins_jr",
    name: "Terry Jenkins Jr",
    nickname: "Trincomalee",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Son of a journeyman. Still learning.",
    level: "beginner",
    avg: 28,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function gauss(mean: number, sd: number): number {
  const u1 = Math.max(Math.random(), 1e-10);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random());
  return mean + sd * z;
}

function makeDart(seg: number, mult: 1 | 2 | 3): Dart {
  const val = seg === 25 ? (mult === 2 ? 50 : 25) : seg * mult;
  const lbl =
    seg === 25 ? (mult === 2 ? "DB" : "Bull") :
    mult === 3 ? `T${seg}` : mult === 2 ? `D${seg}` : `${seg}`;
  return { segment: seg, multiplier: mult, value: val, label: lbl };
}

export const BOT_MISS: Dart = { segment: 0, multiplier: 1, value: 0, label: "Miss" };

function dartForValue(v: number): Dart {
  if (v === 0)  return BOT_MISS;
  if (v === 50) return makeDart(25, 2);
  if (v === 25) return makeDart(25, 1);
  if (v <= 20)  return makeDart(v, 1);
  if (v <= 40 && v % 2 === 0)  return makeDart(v / 2, 2);
  if (v <= 57 && v % 3 === 0)  return makeDart(v / 3, 3);
  if (v <= 40)  return makeDart(20, 1);
  return makeDart(20, 3);
}

function split3(total: number): [Dart, Dart, Dart] {
  if (total <= 0) return [BOT_MISS, BOT_MISS, BOT_MISS];
  const d1 = Math.min(60, total);
  const d2 = Math.min(60, Math.max(0, total - d1));
  const d3 = Math.max(0, total - d1 - d2);
  return [dartForValue(d1), dartForValue(d2), dartForValue(d3)];
}

function checkoutDarts(remaining: number): [Dart, Dart, Dart] | null {
  if (remaining === 50) return [BOT_MISS, BOT_MISS, makeDart(25, 2)];
  if (remaining >= 2 && remaining <= 40 && remaining % 2 === 0)
    return [BOT_MISS, BOT_MISS, makeDart(remaining / 2, 2)];
  if (remaining > 60 && remaining <= 110) {
    const rest = remaining - 60;
    if (rest === 50) return [makeDart(20, 3), BOT_MISS, makeDart(25, 2)];
    if (rest <= 40 && rest % 2 === 0) return [makeDart(20, 3), BOT_MISS, makeDart(rest / 2, 2)];
  }
  if (remaining > 57 && remaining <= 107) {
    const rest = remaining - 57;
    if (rest <= 40 && rest % 2 === 0) return [makeDart(19, 3), BOT_MISS, makeDart(rest / 2, 2)];
  }
  if (remaining % 2 === 1 && remaining <= 41)
    return [makeDart(1, 1), BOT_MISS, makeDart((remaining - 1) / 2, 2)];
  if (remaining > 100 && remaining <= 170) {
    const r2 = remaining - 120;
    if (r2 === 50) return [makeDart(20, 3), makeDart(20, 3), makeDart(25, 2)];
    if (r2 >= 2 && r2 <= 40 && r2 % 2 === 0) return [makeDart(20, 3), makeDart(20, 3), makeDart(r2 / 2, 2)];
    const r3 = remaining - 117;
    if (r3 >= 2 && r3 <= 40 && r3 % 2 === 0) return [makeDart(20, 3), makeDart(19, 3), makeDart(r3 / 2, 2)];
    const r4 = remaining - 60 - 40;
    if (r4 >= 1 && r4 <= 20) return [makeDart(20, 3), makeDart(r4, 1), makeDart(20, 2)];
  }
  return null;
}

// ── X01 visit ─────────────────────────────────────────────────────────────────
export function botX01Visit(
  remaining: number,
  doubleOut: boolean,
  cfg: BotConfig,
): [Dart, Dart, Dart] {
  if (remaining <= 170 && Math.random() < cfg.checkoutPct) {
    const co = checkoutDarts(remaining);
    if (co) return co;
  }
  const minLeft = doubleOut ? 2 : 0;
  const maxScore = Math.max(0, Math.min(180, remaining - minLeft));
  const visitScore = Math.max(0, Math.min(maxScore, Math.round(gauss(cfg.avg, cfg.sd))));
  return split3(visitScore);
}

// ── Cricket visit ─────────────────────────────────────────────────────────────
const CRICKET_NUMS = [20, 19, 18, 17, 16, 15, 25];

export function botCricketVisit(
  myMarks: number[],
  cfg: BotConfig,
): [Dart, Dart, Dart] {
  const darts: Dart[] = [];
  for (let i = 0; i < 3; i++) {
    if (Math.random() > cfg.hitAcc) {
      darts.push(BOT_MISS);
    } else {
      const priority = CRICKET_NUMS.filter((_, idx) => myMarks[idx] < 3);
      const pool = priority.length > 0 ? priority : CRICKET_NUMS;
      const seg = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
      const roll = Math.random();
      const mult: 1 | 2 | 3 = roll < cfg.hitAcc * 0.45 ? 3 : roll < cfg.hitAcc * 0.7 ? 2 : 1;
      darts.push(makeDart(seg, mult));
    }
  }
  return darts as [Dart, Dart, Dart];
}

// ── Sequence visit ────────────────────────────────────────────────────────────
export function botSequenceVisit(
  targetSeg: number,
  targetMult: 1 | 2 | 3,
  cfg: BotConfig,
): [Dart, Dart, Dart] {
  return Array.from({ length: 3 }, () =>
    Math.random() < cfg.hitAcc ? makeDart(targetSeg, targetMult) : BOT_MISS
  ) as [Dart, Dart, Dart];
}

// ── HalveIt visit ─────────────────────────────────────────────────────────────
export function botHalveItVisit(
  targetSeg: number,
  targetMult: 1 | 2 | 3,
  cfg: BotConfig,
): [Dart, Dart, Dart] {
  return Array.from({ length: 3 }, () =>
    Math.random() < cfg.hitAcc ? makeDart(targetSeg, targetMult) : BOT_MISS
  ) as [Dart, Dart, Dart];
}

// ── CountUp visit ─────────────────────────────────────────────────────────────
export function botCountUpVisit(cfg: BotConfig, max = 180): [Dart, Dart, Dart] {
  const total = Math.max(0, Math.min(max, Math.round(gauss(cfg.avg, cfg.sd))));
  return split3(total);
}
