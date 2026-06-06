/**
 * Bot simulation engine for practice mode CPU opponents.
 * Named personas are fictional alter-egos of real pros — same skill archetype, different identity.
 */
import type { Dart } from "./dartboard";

export type BotLevel = "beginner" | "amateur" | "club" | "county" | "pro" | "elite";

export const BOT_LEVELS: Record<BotLevel, {
  label: string;
  color: string;
  avg: number;         // 3-dart average
  sd: number;          // standard deviation
  checkoutPct: number; // checkout success probability
  hitAcc: number;      // targeted accuracy (Cricket, Sequence etc.)
}> = {
  beginner: { label: "Beginner", color: "#94a3b8", avg: 26, sd: 18, checkoutPct: 0.05, hitAcc: 0.14 },
  amateur:  { label: "Amateur",  color: "#22c55e", avg: 45, sd: 15, checkoutPct: 0.18, hitAcc: 0.28 },
  club:     { label: "Club",     color: "#3b82f6", avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 },
  county:   { label: "County",   color: "#a78bfa", avg: 80, sd: 9,  checkoutPct: 0.52, hitAcc: 0.62 },
  pro:      { label: "Pro",      color: "#ffd24a", avg: 95, sd: 7,  checkoutPct: 0.70, hitAcc: 0.78 },
  elite:    { label: "Elite",    color: "#ff005c", avg: 108, sd: 5, checkoutPct: 0.82, hitAcc: 0.88 },
};

export type BotPersona = {
  id: string;
  name: string;
  nickname: string;
  nationality: string;
  flag: string;
  tagline: string;
  level: BotLevel;
  avg: number;  // display avg (persona-specific, may differ slightly from level default)
};

/** All bot personas — fictional alter-egos inspired by real pro darts players. */
export const BOT_PERSONAS: BotPersona[] = [
  // ── Elite (avg 100+) ─────────────────────────────────────────────────────────
  {
    id: "mikkel_van_garwin",
    name: "Mikkel van Garwin",
    nickname: "Green Machine",
    nationality: "Dutch",
    flag: "🇳🇱",
    tagline: "Averaging 100+. Every. Single. Night.",
    level: "elite",
    avg: 105,
  },
  {
    id: "bill_tailor",
    name: "Bill Tailor",
    nickname: "The Power",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "16 world titles. Doesn't plan on stopping.",
    level: "elite",
    avg: 101,
  },
  // ── Pro (avg 88–98) ───────────────────────────────────────────────────────────
  {
    id: "luca_scrawler",
    name: "Luca Scrawler",
    nickname: "The Nuke",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "Teenager. Already terrifying.",
    level: "pro",
    avg: 98,
  },
  {
    id: "perry_wight",
    name: "Perry Wight",
    nickname: "Snakebite",
    nationality: "Scottish",
    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    tagline: "The spikiest player in the game.",
    level: "pro",
    avg: 93,
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
    id: "barry_anderson",
    name: "Barry Anderson",
    nickname: "Flying Scotsman",
    nationality: "Scottish",
    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    tagline: "Two world titles and a chip on his shoulder.",
    level: "pro",
    avg: 88,
  },
  // ── County (avg 78–87) ────────────────────────────────────────────────────────
  {
    id: "dmitri_van_den_berg",
    name: "Dmitri Van den Berg",
    nickname: "DreamMaker",
    nationality: "Belgian",
    flag: "🇧🇪",
    tagline: "Dreams big. Throws bigger.",
    level: "county",
    avg: 86,
  },
  {
    id: "ronny_clapton",
    name: "Ronny Clapton",
    nickname: "The Ferret",
    nationality: "Welsh",
    flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    tagline: "Small, quick, deadly.",
    level: "county",
    avg: 82,
  },
  {
    id: "jono_de_souza",
    name: "Jono de Souza",
    nickname: "The Special One",
    nationality: "Portuguese",
    flag: "🇵🇹",
    tagline: "He knows exactly what he's doing.",
    level: "county",
    avg: 80,
  },
  {
    id: "bob_frost",
    name: "Bob Frost",
    nickname: "Voltage",
    nationality: "English",
    flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    tagline: "World champion. Still dangerous.",
    level: "county",
    avg: 79,
  },
  // ── Club (avg 65–77) ──────────────────────────────────────────────────────────
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
  // ── Amateur (avg 42–62) ───────────────────────────────────────────────────────
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
  if (remaining % 2 === 1 && remaining <= 41) {
    return [makeDart(1, 1), BOT_MISS, makeDart((remaining - 1) / 2, 2)];
  }

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
  level: BotLevel,
): [Dart, Dart, Dart] {
  const cfg = BOT_LEVELS[level];

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
  level: BotLevel,
): [Dart, Dart, Dart] {
  const cfg = BOT_LEVELS[level];
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
  level: BotLevel,
): [Dart, Dart, Dart] {
  const cfg = BOT_LEVELS[level];
  return Array.from({ length: 3 }, () =>
    Math.random() < cfg.hitAcc ? makeDart(targetSeg, targetMult) : BOT_MISS
  ) as [Dart, Dart, Dart];
}

// ── HalveIt visit ─────────────────────────────────────────────────────────────
export function botHalveItVisit(
  targetSeg: number,
  targetMult: 1 | 2 | 3,
  level: BotLevel,
): [Dart, Dart, Dart] {
  const cfg = BOT_LEVELS[level];
  return Array.from({ length: 3 }, () =>
    Math.random() < cfg.hitAcc ? makeDart(targetSeg, targetMult) : BOT_MISS
  ) as [Dart, Dart, Dart];
}

// ── CountUp visit ─────────────────────────────────────────────────────────────
export function botCountUpVisit(level: BotLevel, max = 180): [Dart, Dart, Dart] {
  const cfg = BOT_LEVELS[level];
  const total = Math.max(0, Math.min(max, Math.round(gauss(cfg.avg, cfg.sd))));
  return split3(total);
}
