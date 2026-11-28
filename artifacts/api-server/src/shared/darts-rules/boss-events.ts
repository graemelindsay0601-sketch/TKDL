// Boss Battle events (pure, shared by the app and the server): the Daily and Weekly Boss with
// their twists, the monthly League Raid, and Be the Boss.
import { BOSS_ROSTER, type BossMode } from "./boss-roster.ts";

// ── Twists: what makes today's boss different ─────────────────────────────────
export type TwistId = "born-angry" | "frenzy" | "iron-hide" | "double-curse" | "sudden-death";
export const TWISTS: { id: TwistId; name: string; description: string; modes: BossMode[] }[] = [
  { id: "born-angry", name: "Born Angry", description: "Starts enraged: its nastiest move from the first dart.", modes: ["X01", "CRICKET", "ATW", "HALVEIT", "KILLER"] },
  { id: "frenzy", name: "Frenzy", description: "Throws a level better all fight.", modes: ["X01", "CRICKET", "ATW", "HALVEIT", "KILLER"] },
  { id: "iron-hide", name: "Iron Hide", description: "Its curses can't be stunned or broken.", modes: ["X01", "CRICKET"] },
  { id: "double-curse", name: "Double Curse", description: "Both of its first two curses are on you at once, until it enrages.", modes: ["X01", "CRICKET"] },
  { id: "sudden-death", name: "Sudden Death", description: "One leg. Winner takes all.", modes: ["X01", "CRICKET"] },
];

function hash(s: string): number { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export type BossEvent = { kind: "daily" | "weekly"; period: string; bossId: string; twist: TwistId };

/** Today's boss: any of the 20, with a twist that suits its game. Same for everyone. */
export function dailyBoss(day: string): BossEvent {
  const boss = BOSS_ROSTER[hash(`daily:${day}`) % BOSS_ROSTER.length];
  const twists = TWISTS.filter(t => t.modes.includes(boss.mode));
  return { kind: "daily", period: day, bossId: boss.id, twist: twists[hash(`twist:${day}`) % twists.length].id };
}

/** This week's boss: from the Arena or the Void, always a 501 or Cricket boss with a twist. */
export function weeklyBoss(week: string): BossEvent {
  const pool = BOSS_ROSTER.filter(b => (b.world === "arena" || b.world === "void") && (b.mode === "X01" || b.mode === "CRICKET"));
  const boss = pool[hash(`weekly:${week}`) % pool.length];
  const twists = TWISTS.filter(t => t.modes.includes(boss.mode));
  return { kind: "weekly", period: week, bossId: boss.id, twist: twists[hash(`wtwist:${week}`) % twists.length].id };
}

// ── The League Raid: one giant boss a month, the whole league chips away at it ──
export type RaidBoss = { name: string; title: string; lore: string; portrait: { face: "skull" | "horns" | "void" | "cyclops" | "crown" | "hood"; primary: string; secondary: string; eye: string } };
export const RAID_BOSSES: RaidBoss[] = [
  { name: "The Colossus", title: "Wakes in January", lore: "A board the size of a building. It has never been hit.", portrait: { face: "cyclops", primary: "#64748b", secondary: "#0f172a", eye: "#38bdf8" } },
  { name: "Old Frost", title: "Comes in with the cold", lore: "Freezes the oche solid. Every dart thrown at it chips a little ice away.", portrait: { face: "skull", primary: "#bae6fd", secondary: "#0c4a6e", eye: "#e0f2fe" } },
  { name: "The Storm", title: "Rolls in off the sea", lore: "Wind howls through the pub. It feeds on missed doubles.", portrait: { face: "void", primary: "#0ea5e9", secondary: "#020617", eye: "#f0f9ff" } },
  { name: "The Bloom", title: "Grows every spring", lore: "Vines crawl up the board. Every 180 cuts it back.", portrait: { face: "hood", primary: "#16a34a", secondary: "#052e16", eye: "#bbf7d0" } },
  { name: "The Kingmaker", title: "Holds court in May", lore: "Crowns whoever brings it down. Nobody has yet.", portrait: { face: "crown", primary: "#eab308", secondary: "#422006", eye: "#fff7ed" } },
  { name: "Midsummer", title: "Burns all June", lore: "The longest day, the hottest board. It doesn't set.", portrait: { face: "horns", primary: "#f97316", secondary: "#431407", eye: "#fde68a" } },
  { name: "The Heatwave", title: "Melts July", lore: "The air shimmers over the oche. Darts drift on the heat.", portrait: { face: "void", primary: "#ef4444", secondary: "#1c0505", eye: "#fecaca" } },
  { name: "The Kraken", title: "Surfaces in August", lore: "Tentacles round every number. The whole league has to haul it out.", portrait: { face: "cyclops", primary: "#0891b2", secondary: "#042f2e", eye: "#a5f3fc" } },
  { name: "The Harvester", title: "Reaps September", lore: "Takes a dart from every visit. Give it something back.", portrait: { face: "hood", primary: "#a16207", secondary: "#1c1003", eye: "#fde047" } },
  { name: "The Pumpkin King", title: "Haunts October", lore: "Grins from the top of the board. The candle never goes out.", portrait: { face: "skull", primary: "#ea580c", secondary: "#1c0a03", eye: "#fde047" } },
  { name: "The Fog", title: "Rolls in November", lore: "You can't see the board. Throw anyway. Everyone throw.", portrait: { face: "void", primary: "#94a3b8", secondary: "#0f172a", eye: "#f8fafc" } },
  { name: "The Grinch of the Oche", title: "Steals December", lore: "Takes the shine off every Christmas league night. Take it back.", portrait: { face: "horns", primary: "#22c55e", secondary: "#14532d", eye: "#fef08a" } },
];

export function raidFor(month: string): RaidBoss { return RAID_BOSSES[(Number(month.slice(5, 7)) || 1) - 1]; }

/** Raid health scales with the league so it's a month's work, not a weekend's. */
export function raidHealth(activePlayers: number): number { return Math.max(30000, Math.min(150000, Math.round(activePlayers * 2000 / 1000) * 1000)); }

/** Damage per thing you do. League matches hit hardest; boss fights count too. */
export const RAID_DAMAGE = { leagueMatch: 400, leagueWin: 150, perMax: 100, bossWin: 250, bossLoss: 60, eventWin: 300, eventLoss: 60 } as const;

export function leagueMatchDamage(won: boolean, maxes: number): number {
  return RAID_DAMAGE.leagueMatch + (won ? RAID_DAMAGE.leagueWin : 0) + RAID_DAMAGE.perMax * Math.max(0, maxes);
}

// ── Be the Boss: your own boss, three curses picked from bosses you've beaten ──
/** A curse is a boss's move: "bossId:1" (its first), ":2" (second), ":3" (enraged). */
export type CurseRef = `${string}:${1 | 2 | 3}`;
export function parseCurseRef(ref: string): { bossId: string; phase: 1 | 2 | 3 } | null {
  const m = /^([a-z0-9-]+):([123])$/.exec(ref);
  if (!m || !BOSS_ROSTER.some(b => b.id === m[1])) return null;
  return { bossId: m[1], phase: Number(m[2]) as 1 | 2 | 3 };
}
/** Only 501 bosses' curses (Be the Boss is a 501 fight), and only from bosses you've beaten. */
export function validCustomCurses(refs: unknown, defeated: Set<string>): string | null {
  if (!Array.isArray(refs) || refs.length !== 3) return "Pick three curses";
  for (const r of refs) {
    const p = typeof r === "string" ? parseCurseRef(r) : null;
    if (!p) return "That curse doesn't exist";
    if (BOSS_ROSTER.find(b => b.id === p.bossId)!.mode !== "X01") return "Only 501 curses work in Be the Boss";
    if (!defeated.has(p.bossId)) return "You can only use curses from bosses you've beaten";
  }
  return null;
}
