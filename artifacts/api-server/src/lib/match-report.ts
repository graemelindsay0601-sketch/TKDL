/**
 * Automatic match reports: a short, TV-style write-up of a singles league match, built only from what was
 * actually recorded (the match row, head-to-head before it, and the dart log when the match was scored dart
 * by dart). Pure, so it is unit tested directly. Nothing here is invented: a line only appears when the
 * fact behind it exists.
 */
export type ReportDart = { seg: number; mult: number; val: number; phase?: string; typed?: boolean };
export type ReportSide = {
  name: string;
  darts?: number | null; s100?: number | null; s140?: number | null; s170?: number | null; s180?: number | null;
  coAttempts?: number | null; coHits?: number | null;
  log?: ReportDart[] | null;
};
export type ReportFacts = {
  matchId: number; gameType: string; stake: number; upset: boolean;
  winner: ReportSide; loser: ReportSide;
  meetingNumber?: number | null; winnerWinsBefore?: number | null; loserWinsBefore?: number | null;
};
export type MatchReport = { headline: string; standfirst: string; paragraphs: string[]; keyStats: { label: string; winner: string; loser: string }[]; ticker: string | null };

const pick = <T,>(seed: number, list: T[]): T => list[Math.abs(seed) % list.length];
const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const isX01 = (g: string) => /^\d{3,4}(_|$)/.test(g);
const gameName = (g: string) => g.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
const some = (k: number, one: string, many = `${one}s`) => (k === 1 ? `a ${one}` : plural(k, one, many));

/** Three-dart average over the scoring darts only (score above 170), so busts at the finish don't skew it. */
export function scoringAverage(log?: ReportDart[] | null): number | null {
  const darts = (log ?? []).filter(d => !d.typed && d.phase === "scoring");
  if (darts.length < 6) return null;
  return Math.round((darts.reduce((t, d) => t + d.val, 0) / darts.length) * 3 * 10) / 10;
}

/** The double the match was won on, read from the winner's last dart. */
export function winningDouble(log?: ReportDart[] | null): string | null {
  const last = (log ?? []).at(-1);
  if (!last || last.typed || last.mult !== 2) return null;
  if (last.seg === 25) return "the bull";
  return last.seg >= 1 && last.seg <= 20 ? `D${last.seg}` : null;
}

const rate = (s: ReportSide) => { const a = n(s.coAttempts), h = n(s.coHits); return a && h != null ? Math.round(h / a * 100) : null; };

export function writeMatchReport(f: ReportFacts): MatchReport {
  const W = f.winner.name, L = f.loser.name, seed = f.matchId;
  const w180 = n(f.winner.s180) ?? 0, l180 = n(f.loser.s180) ?? 0;
  const wAvg = isX01(f.gameType) ? scoringAverage(f.winner.log) : null;
  const lAvg = isX01(f.gameType) ? scoringAverage(f.loser.log) : null;
  const dbl = isX01(f.gameType) ? winningDouble(f.winner.log) : null;
  const wRate = rate(f.winner), lRate = rate(f.loser);
  const meeting = n(f.meetingNumber), wPrev = n(f.winnerWinsBefore), lPrev = n(f.loserWinsBefore);
  const firstMeeting = meeting === 1;
  const revenge = wPrev != null && lPrev != null && lPrev > wPrev && lPrev >= 2;
  const dominance = wPrev != null && lPrev != null && wPrev >= 3 && wPrev >= lPrev * 2;

  // Headline: the strongest true angle wins.
  let headline: string, ticker: string | null = null;
  if (f.upset) { headline = pick(seed, [`${W} stuns ${L}`, `Upset: ${W} topples ${L}`, `${W} pulls off the upset against ${L}`]); ticker = "upset"; }
  else if (w180 >= 2) { headline = `${W} fires ${plural(w180, "maximum")} past ${L}`; ticker = plural(w180, "180"); }
  else if (revenge) { headline = pick(seed, [`${W} bites back against ${L}`, `${W} closes the gap on ${L}`]); ticker = "revenge win"; }
  else if (firstMeeting) { headline = `${W} wins the first meeting with ${L}`; ticker = "first meeting"; }
  else if (dominance) { headline = pick(seed, [`${W} has ${L}'s number again`, `Same story: ${W} beats ${L}`]); ticker = `${wPrev! + 1}–${lPrev} in the series`; }
  else if (dbl) { headline = pick(seed, [`${W} finds ${dbl} to beat ${L}`, `${dbl} does it for ${W} against ${L}`]); }
  else headline = pick(seed, [`${W} beats ${L}`, `${W} gets the better of ${L}`, `${W} sees off ${L}`]);
  if (!ticker && dbl) ticker = `out on ${dbl}`;
  if (!ticker && w180 === 1) ticker = "a 180";

  const standfirst = `${gameName(f.gameType)}${f.stake ? ` · ${f.stake} points on the line` : ""}${meeting ? ` · meeting #${meeting}` : ""}`;

  const paras: string[] = [];
  // 1. The result.
  const open = f.upset
    ? `${W} came into this one behind ${L} in the table and left with the win${f.stake ? ` and ${f.stake} points` : ""}.`
    : pick(seed + 1, [
      `${W} beat ${L} at ${gameName(f.gameType)}${f.stake ? `, taking ${f.stake} points off the table` : ""}.`,
      `${W} took the win over ${L}${f.stake ? ` and with it ${f.stake} points` : ""}.`,
    ]);
  paras.push(open);

  // 2. Scoring.
  const scoring: string[] = [];
  if (wAvg != null && lAvg != null) {
    const gap = Math.round((wAvg - lAvg) * 10) / 10;
    scoring.push(gap >= 0
      ? `${W} scored better, averaging ${wAvg} with the scoring darts against ${lAvg} from ${L}.`
      : `${L} actually outscored ${W}, averaging ${lAvg} to ${wAvg}, but it came down to the finish.`);
  } else if (wAvg != null) scoring.push(`${W} averaged ${wAvg} with the scoring darts.`);
  if (w180 || l180) {
    if (w180 && l180) scoring.push(`Both found the treble 20s: ${plural(w180, "180")} for ${W}, ${plural(l180, "180")} for ${L}.`);
    else scoring.push(`${w180 ? W : L} hit ${some(w180 || l180, "180")}${w180 ? "" : " in a losing cause"}.`);
  }
  const w140 = n(f.winner.s140), l140 = n(f.loser.s140);
  if (!w180 && !l180 && w140 != null && l140 != null && (w140 || l140)) scoring.push(`${plural(w140, "ton-forty")} for ${W}, ${plural(l140, "ton-forty")} for ${L}.`);
  if (scoring.length) paras.push(scoring.join(" "));

  // 3. Finishing.
  const fin: string[] = [];
  if (dbl) fin.push(`${W} won it on ${dbl}.`);
  if (wRate != null && lRate != null) {
    if (wRate > lRate + 15) fin.push(`The doubles told the story: ${wRate}% for ${W} against ${lRate}% for ${L}.`);
    else if (lRate > wRate + 15) fin.push(`${L} was sharper on the doubles at ${lRate}% to ${wRate}%, and still came up short.`);
    else fin.push(`Little between them on the doubles: ${wRate}% to ${lRate}%.`);
  }
  const wDarts = n(f.winner.darts);
  if (wDarts && isX01(f.gameType) && wDarts <= 18) fin.push(`It took just ${wDarts} darts.`);
  if (fin.length) paras.push(fin.join(" "));

  // 4. The rivalry.
  if (firstMeeting) paras.push(`It was the first time these two had met in the league.`);
  else if (meeting && wPrev != null && lPrev != null) {
    const nowW = wPrev + 1;
    const series = nowW > lPrev ? `${W} leads the head-to-head ${nowW}–${lPrev}` : nowW === lPrev ? `the head-to-head is level at ${nowW}–${lPrev}` : `${L} still leads the head-to-head ${lPrev}–${nowW}`;
    const lead = revenge ? `${L} had won ${lPrev} of their previous ${meeting - 1} meetings, so this one will mean a bit more to ${W}. ` : "";
    paras.push(`${lead}After ${plural(meeting, "meeting")}, ${series}.`);
  }

  const keyStats: MatchReport["keyStats"] = [];
  if (wAvg != null || lAvg != null) keyStats.push({ label: "Scoring average", winner: wAvg != null ? String(wAvg) : "—", loser: lAvg != null ? String(lAvg) : "—" });
  if (wRate != null || lRate != null) keyStats.push({ label: "Doubles", winner: wRate != null ? `${wRate}%` : "—", loser: lRate != null ? `${lRate}%` : "—" });
  if (f.winner.s180 != null || f.loser.s180 != null) keyStats.push({ label: "180s", winner: String(w180), loser: String(l180) });

  return { headline, standfirst, paragraphs: paras, keyStats, ticker };
}
