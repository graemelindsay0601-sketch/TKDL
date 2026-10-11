/**
 * Workstream D — the human player's legacy, projected from the same immutable
 * evidence the Legacy archive uses (A3 results, A5 published rankings and cards,
 * A4 money/sponsors, A7.2 meetings). Pure and read-only: no sporting, finance or
 * ranking authority is touched, no RNG, and nothing is invented. Missing facts are
 * reported as unavailable with a reason.
 */
import type { Card, Evidence, Result, SeasonReview } from "./types.ts";

export type Rival = { id: string; name: string; meetings: number; humanWins: number; npcWins: number; labels: string[];
  firstSeason: number | null; lastSeason: number | null };
export type Moment = { kind: string; label: string; detail: string; season: number | null; eventId?: string; tier?: string };
export type Chapter = { key: "BEGINNING" | "BREAKTHROUGH" | "BIG_MOMENTS" | "RIVALS" | "COMMERCIAL" | "FINAL_RECORD";
  number: number; title: string; available: boolean; summary: string; moments: Moment[]; unavailableReason: string | null };
export type SeasonRow = {
  season: number; partial: boolean; reviewed: boolean; appearances: number; titles: number; finals: number; wins: number; losses: number;
  prizePence: number; commercialPence: number; startRank: number | null; endRank: number | null; tourCard: boolean;
  identity: string | null; provenance: SeasonReview["provenance"] | null; bestFinish: { name: string; position: number; champion: boolean; eventId: string } | null;
  titleNames: string[]; sponsors: string[]; rival: { name: string; meetings: number; wins: number; losses: number } | null;
};
export type PlayerLegacy = {
  version: 1; saveId: string; name: string; retired: boolean; retiredAt: { season: number; week: number } | null; startingAge: number | null;
  currentSeason: number; firsts: { event: Moment | null; final: Moment | null; title: Moment | null; majorTitle: Moment | null; ranking: Moment | null; tourCard: Moment | null };
  bestRanking: { position: number; season: number; week: number } | null;
  totals: { seasons: number; appearances: number; titles: number; finals: number; majorTitles: number; worlds: number; wins: number; losses: number;
    prizePence: number; commercialPence: number };
  titles: Moment[]; finals: Moment[]; seasons: SeasonRow[]; rivals: Rival[];
  commercial: { sponsors: { id: string; name: string; startSeason: number; endSeason: number; status: string }[];
    products: { id: string; name: string; manufacturer: string; launchSeason: number; unitsSold: number; royaltyPence: number }[];
    merchandise: Evidence["merchandise"] };
  cards: { source: string; startSeason: number; endSeason: number; status: string }[];
  chapters: Chapter[]; source: string;
};

const TIER: Record<string, number> = { WORLD: 4, MAJOR: 3, TELEVISED: 2 };
const tierOf = (r: Result) => r.classification === "QUALIFIER" ? 0 : TIER[r.tier] ?? 1;
const eventId = (r: Result) => r.id.split(":")[1];
const chrono = (a: { season: number; day?: number }, b: { season: number; day?: number }) => a.season - b.season || (a.day ?? 0) - (b.day ?? 0);
const ord = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };
const finish = (r: Result) => r.champion ? "Champion" : r.final ? "Runner-up" : `Finished ${ord(r.position)}`;
const moment = (kind: string, r: Result, label?: string): Moment =>
  ({ kind, label: label ?? r.name, detail: `${finish(r)} · season ${r.season}`, season: r.season, eventId: eventId(r), tier: r.tier });
const pounds = (p: number) => `£${Math.round(p / 100).toLocaleString("en-GB")}`;

export function playerLegacy(e: Evidence, reviews: SeasonReview[], rivalsIn: Rival[]): PlayerLegacy {
  const human = e.players.find(p => p.id === "HUMAN");
  const mine = e.results.filter(r => r.participant === "HUMAN").sort(chrono);
  const main = mine.filter(r => r.classification !== "QUALIFIER");
  const ranks = e.rankings.filter(r => r.participant === "HUMAN").sort((a, b) => a.season - b.season || a.week - b.week);
  const cards = e.cards.filter(c => c.participant === "HUMAN").sort((a, b) => a.awardedSeason - b.awardedSeason || a.awardedWeek - b.awardedWeek);
  const titles = main.filter(r => r.champion);
  const finals = main.filter(r => r.final && !r.champion);
  const best = [...ranks].sort((a, b) => a.position - b.position || a.season - b.season || a.week - b.week)[0] ?? null;
  const money = (s: number) => e.money.find(m => m.season === s) ?? { season: s, prizePence: 0, commercialPence: 0 };
  const rivals = [...rivalsIn].filter(r => r.meetings >= 2).sort((a, b) => b.meetings - a.meetings || a.name.localeCompare(b.name)).slice(0, 5);

  const firstEvent = mine[0] ?? null, firstFinal = main.find(r => r.final) ?? null, firstTitle = titles[0] ?? null;
  const firstMajor = titles.find(r => tierOf(r) >= 3) ?? null, firstRank = ranks[0] ?? null, firstCard = cards[0] ?? null;
  const firsts = {
    event: firstEvent && moment("FIRST_EVENT", firstEvent, `First recorded event: ${firstEvent.name}`),
    final: firstFinal && moment("FIRST_FINAL", firstFinal, `First final: ${firstFinal.name}`),
    title: firstTitle && moment("FIRST_TITLE", firstTitle, `First title: ${firstTitle.name}`),
    majorTitle: firstMajor && moment("FIRST_MAJOR", firstMajor, `First major title: ${firstMajor.name}`),
    ranking: firstRank && { kind: "FIRST_RANKING", label: `First published World ranking: #${firstRank.position}`, detail: `Season ${firstRank.season}, week ${firstRank.week}`, season: firstRank.season },
    tourCard: firstCard && { kind: "FIRST_CARD", label: "Tour Card won", detail: `${cardSource(firstCard)} · season ${firstCard.awardedSeason}`, season: firstCard.awardedSeason },
  };

  const lastSeason = e.currentSeason;
  const seasons: SeasonRow[] = [];
  for (let s = 1; s <= lastSeason; s++) {
    const t = e.totals.find(x => x.id === "HUMAN" && x.season === s);
    const review = reviews.find(r => r.season === s) ?? null;
    const m = money(s);
    const inSeason = ranks.filter(r => r.season === s);
    const played = main.filter(r => r.season === s);
    if (!t && !review && !inSeason.length && !m.prizePence && !m.commercialPence && s !== lastSeason) continue;
    const top = [...played].sort((a, b) => Number(b.champion) - Number(a.champion) || tierOf(b) - tierOf(a) || a.position - b.position)[0] ?? null;
    seasons.push({
      season: s, partial: s === lastSeason && !review, reviewed: !!review, appearances: t?.appearances ?? 0, titles: t?.titles ?? 0, finals: t?.finals ?? 0, wins: t?.wins ?? 0, losses: t?.losses ?? 0,
      prizePence: m.prizePence, commercialPence: m.commercialPence,
      // A review captured at season end is authoritative for that season's rank endpoints; otherwise published snapshots.
      startRank: review?.startingRank?.position ?? inSeason[0]?.position ?? null,
      endRank: review?.finalRank?.position ?? inSeason.at(-1)?.position ?? null,
      tourCard: cards.some(c => c.startSeason <= s && c.endSeason >= s && (c.endedSeason === null || c.endedSeason >= s)),
      identity: review?.identity ?? null, provenance: review?.provenance ?? null,
      bestFinish: top ? { name: top.name, position: top.position, champion: top.champion, eventId: eventId(top) } : null,
      titleNames: played.filter(r => r.champion).map(r => r.name),
      sponsors: e.sponsors.filter(x => x.startSeason <= s && x.endSeason >= s).map(x => x.name),
      rival: review?.definingRival ? { name: review.definingRival.name, meetings: review.definingRival.meetings, wins: review.definingRival.wins, losses: review.definingRival.losses } : null,
    });
  }

  const sum = (k: "appearances" | "titles" | "finals" | "majorTitles" | "worlds" | "wins" | "losses") =>
    e.totals.filter(t => t.id === "HUMAN").reduce((n, t) => n + t[k], 0);
  const totals = { seasons: seasons.length, appearances: sum("appearances"), titles: sum("titles"), finals: sum("finals"), majorTitles: sum("majorTitles"),
    worlds: sum("worlds"), wins: sum("wins"), losses: sum("losses"),
    prizePence: e.money.reduce((n, m) => n + m.prizePence, 0), commercialPence: e.money.reduce((n, m) => n + m.commercialPence, 0) };
  const commercial = {
    sponsors: e.sponsors.map(s => ({ id: s.id, name: s.name, startSeason: s.startSeason, endSeason: s.endSeason, status: s.status })),
    products: e.productArchive.map(p => ({ id: p.id, name: p.name, manufacturer: p.manufacturer, launchSeason: p.launchSeason, unitsSold: p.unitsSold, royaltyPence: p.royaltyPence })),
    merchandise: e.merchandise,
  };
  const name = human?.name ?? "You";

  // ------------------------------------------------------------ documentary chapters
  const beginning: Moment[] = [];
  if (firsts.event) beginning.push(firsts.event);
  if (human?.startingAge) beginning.push({ kind: "AGE", label: `Started at ${human.startingAge}`, detail: "Age at the Career start date", season: 1 });
  const s1 = seasons[0];
  if (s1 && s1.appearances) beginning.push({ kind: "FIRST_SEASON", label: `Season ${s1.season}: ${s1.appearances} events`, detail: `${s1.wins} match wins · ${s1.losses} losses`, season: s1.season });

  const breakthrough = [firsts.final, firsts.title, firsts.ranking, firsts.tourCard, firsts.majorTitle].filter((m): m is Moment => !!m)
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0));

  const big: Moment[] = [...main].filter(r => r.champion || (r.final && tierOf(r) >= 2) || tierOf(r) >= 3)
    .sort((a, b) => Number(b.champion) - Number(a.champion) || tierOf(b) - tierOf(a) || a.position - b.position || chrono(a, b)).slice(0, 6)
    .map(r => moment(r.champion ? (tierOf(r) >= 3 ? "MAJOR_TITLE" : "TITLE") : r.final ? "FINAL" : "BIG_STAGE", r));
  if (best) big.push({ kind: "BEST_RANKING", label: `World #${best.position}`, detail: `Highest published ranking · season ${best.season}, week ${best.week}`, season: best.season });

  const rivalMoments = rivals.slice(0, 3).map(r => ({ kind: "RIVAL", label: r.name, detail: `${r.meetings} meetings · ${r.humanWins}–${r.npcWins}${r.labels.length ? ` · ${r.labels.join(", ")}` : ""}`,
    season: r.lastSeason }));

  const commercialMoments: Moment[] = [
    ...commercial.sponsors.map(s => ({ kind: "SPONSOR", label: s.name, detail: `Seasons ${s.startSeason}–${s.endSeason} · ${s.status.toLowerCase().replace(/_/g, " ")}`, season: s.startSeason })),
    ...commercial.products.map(p => ({ kind: "PRODUCT", label: p.name, detail: `${p.manufacturer} · launched season ${p.launchSeason} · ${p.unitsSold.toLocaleString("en-GB")} sold`, season: p.launchSeason })),
    ...(commercial.merchandise ? [{ kind: "MERCH", label: `Merchandise: ${commercial.merchandise.category}`, detail: `Signed season ${commercial.merchandise.signedSeason}`, season: commercial.merchandise.signedSeason }] : []),
  ];
  if (totals.commercialPence > 0) commercialMoments.push({ kind: "INCOME", label: `${pounds(totals.commercialPence)} sponsor & commercial income`, detail: "Recorded A4 ledger", season: null });

  const finalMoments: Moment[] = [
    { kind: "SEASONS", label: `${totals.seasons} season${totals.seasons === 1 ? "" : "s"}`, detail: `${totals.appearances} recorded tournament appearances`, season: null },
    { kind: "HONOURS", label: `${totals.titles} title${totals.titles === 1 ? "" : "s"} · ${totals.finals} final${totals.finals === 1 ? "" : "s"}`, detail: `${totals.majorTitles} major/World titles · ${totals.worlds} World Championships`, season: null },
    { kind: "RECORD", label: `${totals.wins}–${totals.losses}`, detail: "Match wins and losses in completed results", season: null },
    { kind: "PRIZE", label: pounds(totals.prizePence), detail: "Career prize money (A4)", season: null },
  ];
  if (best) finalMoments.push({ kind: "BEST_RANKING", label: `Highest World ranking #${best.position}`, detail: `Season ${best.season}`, season: best.season });
  if (e.retired) finalMoments.push({ kind: "RETIRED", label: `Retired · season ${e.currentSeason}, week ${e.currentWeek}`, detail: "The Career is preserved read-only", season: e.currentSeason });

  const chapter = (key: Chapter["key"], number: number, title: string, moments: Moment[], summary: string, reason: string): Chapter =>
    ({ key, number, title, available: moments.length > 0, summary: moments.length ? summary : reason, moments, unavailableReason: moments.length ? null : reason });
  const chapters: Chapter[] = [
    chapter("BEGINNING", 1, "The Beginning", beginning,
      firstEvent ? `${name}'s recorded Career began at ${firstEvent.name} in season ${firstEvent.season}.` : "", "No completed tournament was recorded, so there is no beginning to tell yet."),
    chapter("BREAKTHROUGH", 2, "The Breakthrough", breakthrough,
      breakthrough.length ? `The first landmark came in season ${breakthrough[0].season}: ${breakthrough[0].label.replace(/^First /, "first ")}.` : "",
      "No final, title, published ranking or Tour Card was recorded — the breakthrough never came in this Career."),
    chapter("BIG_MOMENTS", 3, "The Big Moments", big, `${big.length} defining result${big.length === 1 ? "" : "s"} from the record.`,
      "No title, final or big-stage appearance was recorded."),
    chapter("RIVALS", 4, "The Rivals", rivalMoments, rivals.length ? `${rivals[0].name} was the most-met opponent: ${rivals[0].meetings} meetings.` : "",
      "No opponent was met in more than one played match, so no rivalry is claimed."),
    chapter("COMMERCIAL", 5, "The Commercial Journey", commercialMoments,
      `${commercial.sponsors.length} sponsor agreement${commercial.sponsors.length === 1 ? "" : "s"}${commercial.products.length ? ` and ${commercial.products.length} signature product${commercial.products.length === 1 ? "" : "s"}` : ""}.`,
      "Self-funded throughout — no sponsor, product or commercial agreement was recorded."),
    chapter("FINAL_RECORD", 6, "The Final Record", finalMoments, e.retired ? `The final record of ${name}.` : `${name}'s record so far.`, ""),
  ];

  return {
    version: 1, saveId: e.saveId, name, retired: e.retired, retiredAt: e.retired ? { season: e.currentSeason, week: e.currentWeek } : null,
    startingAge: human?.startingAge ?? null, currentSeason: e.currentSeason, firsts, bestRanking: best ? { position: best.position, season: best.season, week: best.week } : null,
    totals, titles: titles.map(r => moment(tierOf(r) >= 3 ? "MAJOR_TITLE" : "TITLE", r)).reverse(), finals: finals.map(r => moment("FINAL", r)).reverse(),
    seasons, rivals, commercial, cards: cards.map(c => ({ source: cardSource(c), startSeason: c.startSeason, endSeason: c.endSeason, status: c.status })),
    chapters, source: "A3 results · A5 rankings & cards · A4 money & sponsors · A7.2 meetings · A7.6 season reviews",
  };
}
function cardSource(c: Card) {
  return c.source === "Q_SCHOOL_DIRECT" ? "Q-School day winner" : c.source === "Q_SCHOOL_OOM" ? "Q-School Order of Merit" : c.source.replace(/_/g, " ").toLowerCase().replace(/^\w/, x => x.toUpperCase());
}

