/**
 * Career mode achievements: bragging rights only. Counted across all of one player's saves from what Career already
 * records; nothing here is read back by Career. Darts feats use only matches the player threw live (summary.live).
 */
import type { AreaFacts } from "./evaluate.ts";

export type CareerSave = { id: string; status: string; retiredAt: Date | null };
export type CareerLive = { average: number; maximums: number; highestCheckout: number; nineDarters: number };
export type CareerMatch = { saveId: string; id: string; season: number; day: number; eventId: string; round: number; slot: number;
  won: boolean; completedAt: Date | null; live: CareerLive | null };
export type CareerResult = { saveId: string; eventId: string; season: number; endDay: number; champion: boolean; final: boolean;
  qualifier: boolean; tier: string; circuit: string; recordedAt: Date | null };
export type CareerCard = { saveId: string; status: string; source: string; awardedSeason: number; awardedWeek: number;
  endedSeason: number | null; endedWeek: number | null; createdAt: Date | null };
export type CareerData = { saves: CareerSave[]; matches: CareerMatch[]; results: CareerResult[]; cards: CareerCard[];
  bestRank: number | null; inducted: string[] };

const byMatch = (a: CareerMatch, b: CareerMatch) => a.saveId.localeCompare(b.saveId) || a.season - b.season || a.day - b.day
  || a.eventId.localeCompare(b.eventId) || a.round - b.round || a.slot - b.slot || a.id.localeCompare(b.id);
const byResult = (a: CareerResult, b: CareerResult) => a.season - b.season || a.endDay - b.endDay || a.eventId.localeCompare(b.eventId);

export function evaluateCareer(d: CareerData, now = new Date()): AreaFacts {
  const feats: Record<string, Date | null> = {};
  // keep the earliest real date for each feat
  const earn = (key: string, at: Date | null | undefined) => { const when = at ?? now; const was = feats[key]; if (!was || when < was) feats[key] = when; };

  const matches = [...d.matches].sort(byMatch);
  const titles = d.results.filter(r => r.champion && !r.qualifier);

  // streaks never run across saves
  let run = 0, save = "";
  for (const m of matches) {
    if (m.saveId !== save) { save = m.saveId; run = 0; }
    run = m.won ? run + 1 : 0;
    if (run >= 10) earn("hotStreak", m.completedAt);
    if (m.live) {
      if (m.live.highestCheckout >= 100) earn("tonPlusFinish", m.completedAt);
      if (m.live.highestCheckout === 170) earn("bigFish", m.completedAt);
      if (m.live.average >= 100) earn("onFire", m.completedAt);
      if (m.live.nineDarters > 0) earn("perfection", m.completedAt);
    }
  }
  for (const t of titles) {
    earn("maidenTitle", t.recordedAt);
    if (t.circuit === "WORLD_CHAMPIONSHIP") earn("worldChampion", t.recordedAt);
  }
  // three lost finals on a save before its first title
  for (const s of d.saves) {
    const mine = d.results.filter(r => r.saveId === s.id && !r.qualifier).sort(byResult);
    let lostFinals = 0;
    for (const r of mine) { if (r.champion) { if (lostFinals >= 3) earn("bridesmaid", r.recordedAt); break; } if (r.final) lostFinals++; }
    if (s.status === "RETIRED" && titles.some(t => t.saveId === s.id)) earn("goldWatch", s.retiredAt);
    if (d.inducted.includes(s.id)) earn("hallOfFamer", s.retiredAt);
  }
  // Tour Cards: the first one, and one won back after a card was lost (a renewal is not a regain)
  const cards = [...d.cards].sort((a, b) => a.saveId.localeCompare(b.saveId) || a.awardedSeason - b.awardedSeason || a.awardedWeek - b.awardedWeek);
  cards.forEach((c, i) => {
    earn("turningPro", c.createdAt);
    const prev = cards[i - 1];
    if (prev && prev.saveId === c.saveId && c.source !== "RANKING_RETENTION" && ["LOST", "EXPIRED", "SURRENDERED"].includes(prev.status)
      && prev.endedSeason !== null && prev.endedWeek !== null && prev.endedSeason * 52 + prev.endedWeek < c.awardedSeason * 52 + c.awardedWeek) earn("secondChance", c.createdAt);
  });

  const seasonsBySave = new Map<string, Set<number>>();
  for (const x of [...d.matches, ...d.results]) { const s = seasonsBySave.get(x.saveId) ?? new Set<number>(); s.add(x.season); seasonsBySave.set(x.saveId, s); }
  return {
    metrics: {
      careerWins: d.matches.filter(m => m.won).length,
      careerTitles: titles.length,
      careerMajors: titles.filter(t => t.tier === "MAJOR" || t.tier === "WORLD").length,
      career180s: d.matches.reduce((n, m) => n + (m.live?.maximums ?? 0), 0),
      careerBestRank: d.bestRank ?? 0,
      careerSeasons: Math.max(0, ...[...seasonsBySave.values()].map(s => s.size)),
    },
    feats, seasons: new Map(),
  };
}
