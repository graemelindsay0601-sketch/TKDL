/**
 * Workstream B — tournament experience. Model tests run on plain fixtures; screen
 * tests render the real components through Vite's SSR loader with a seeded query
 * cache. Fixtures are TEST-ONLY and shaped like the server's tournament read.
 * Assertions are about meaning (facts, actions, honesty), never pixels.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer, type ViteDevServer } from "vite";
import {
  bracketColumns, dossier, humanPath, opponentIfWin, prizeLadder, resultMoment, roundLabel, runSummary, tierFromEvent, tierProfile,
} from "../../features/career/tournament/model.ts";
import { event, eventDetail, overview, save, SAVE_ID } from "./career-fixtures.ts";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------------------------------------------------------- fixtures
const entrant = (key: string, name: string, over: Record<string, unknown> = {}) => ({ key, name, nickname: null, nationality: "Scotland", ranking: null, titles: 0,
  badges: [], source: "OPEN_ENTRY", status: "LOCKED", seed: null, sponsors: [], shirt: { primaryColour: "#20334A", secondaryColour: "#FFFFFF", accentColour: "#C8A050" }, ...over });
let seq = 0;
const match = (round: number, slot: number, a: string | null, b: string | null, over: Record<string, unknown> = {}) => ({
  id: `m-${round}-${slot}-${++seq}`, stage_key: "main", round, slot, best_of: round === 3 ? 13 : 11, scheduled_day: 100 + round, a_key: a, b_key: b,
  status: "SCHEDULED", winner_key: null, legs_a: null, legs_b: null, result_source: null, summary: null, ...over });
const won = (winner: string, la: number, lb: number, source = "A2_SIMULATION") => ({ status: "COMPLETED", winner_key: winner, legs_a: la, legs_b: lb, result_source: source });

/** An 8-player major: you won your opener and await the semi-final; the other half is still being decided. */
function majorView(over: Record<string, unknown> = {}): Any {
  seq = 0;
  const matches = [
    match(1, 1, "HUMAN", "npc1", won("HUMAN", 6, 4, "HUMAN_LIVE")),
    match(1, 2, "npc2", "npc3", won("npc3", 2, 6)),
    match(1, 3, "npc4", "npc5", won("npc5", 5, 6)),
    match(1, 4, "npc6", "npc7"),
    match(2, 1, "HUMAN", "npc3", { status: "AWAITING_HUMAN" }),
    match(2, 2, "npc5", null),
    match(3, 1, null, null),
  ];
  return {
    saveId: SAVE_ID,
    event: { id: "major", name: "Fixture Masters", definitionKey: "grand-slam-of-champions", season: 2, week: 30, startDay: 205, endDay: 207, status: "IN_PROGRESS",
      circuit: "MAJOR", classification: "MAJOR", level: 4, format: { inRule: "STRAIGHT", scoringUnit: "LEGS", legsPerSet: 5 }, executable: true, fieldLocked: true, drawLocked: true,
      venue: { displayName: "Northgate Arena", nickname: null, city: "Manchester", venueType: "major-arena", capacityBand: "ARENA", stageConfiguration: "FEATURE_BOARD",
        atmosphereTags: ["live-crowd", "major-arena"] },
      venueFallback: { city: "Manchester", country: "England" },
      content: { eventClass: "MAJOR", fieldDescription: "The season's leading players by ranking and qualification.", trophyId: "championship-cup" },
      trophy: { id: "championship-cup", name: "Wide Championship Cup", designKey: "wide-silver" }, qualificationOutputs: [], qSchool: null },
    presentation: { mode: "FULL", reducedMotion: false },
    depth: { arrival: true, drawReveal: true, walkOn: true, fullCeremony: true, animate: true, skippable: true, sportingEffects: false },
    phase: "MATCH_READY",
    field: [entrant("HUMAN", "Fixture Player", { ranking: 21, titles: 2, seed: 4, shirt: { primaryColour: "#20334A", secondaryColour: "#FFFFFF", accentColour: "#C8A050", kitDesignId: "kit-50-07" } }), entrant("npc1", "Arno Auenberg"),
      entrant("npc2", "Bram Visser"), entrant("npc3", "Callan Thistledown", { ranking: 3, titles: 9, nickname: "The Thistle", seed: 1, badges: [{ label: "Defending champion", source: "x" }] }),
      entrant("npc4", "Dario Ferro"), entrant("npc5", "Elias Brandt"), entrant("npc6", "Finn Okafor"), entrant("npc7", "Gus Laine")],
    routes: [], matches, groups: [],
    opponents: [{ key: "npc3", labels: ["Recurring opponent"], evidence: [], meetings: 3, humanWins: 1, npcWins: 2, firstMeeting: null,
      latestMeeting: { name: "Fixture Open", season: 1 } }],
    history: { source: "A3", previousAppearances: [{ id: "old", name: "Fixture Masters", season: 1, start_day: 205, finishing_position: 8, is_champion: false }],
      bestFinish: 8, recentChampions: [{ id: "old", season: 1, champion_name: "Callan Thistledown" }], palace: null },
    nextMatchId: matches[4].id, session: null, latestMatch: matches[0], humanResult: null, results: [], groupBull: null, championKey: null, position: 4,
    money: { securedPence: 1_000_000, paid: false, prize: null, ledger: [],
      bands: [{ upToPosition: 1, amountPence: 6_000_000 }, { upToPosition: 2, amountPence: 3_000_000 }, { upToPosition: 4, amountPence: 1_000_000 },
        { upToPosition: 8, amountPence: 500_000 }] },
    achievements: { groupWinner: false, tournamentChampion: false }, readOnly: false,
    ...over,
  };
}

// ---------------------------------------------------------------- model
test("tier identity distinguishes grassroots, regional, professional, major and World Championship", () => {
  assert.equal(tierProfile(1, "GRASSROOTS").key, "GRASSROOTS");
  assert.equal(tierProfile(1, "REGIONAL").key, "REGIONAL");
  assert.equal(tierProfile(2, "PROFESSIONAL_TOUR").key, "PROFESSIONAL");
  assert.equal(tierProfile(4, "MAJOR").key, "MAJOR");
  assert.equal(tierProfile(5, null).key, "WORLD");
  assert.equal(tierFromEvent("LOCAL", "GRASSROOTS").key, "GRASSROOTS");
  assert.equal(tierFromEvent("STANDARD", "COUNTY").key, "REGIONAL");
  assert.equal(tierFromEvent("STANDARD", "PRO_CIRCUIT").key, "PROFESSIONAL");
  assert.equal(tierFromEvent("STANDARD", "CHALLENGER").key, "DEVELOPMENT", "second-tier tours are not the professional tour");
  assert.equal(tierFromEvent("TELEVISED", "CHALLENGER").key, "DEVELOPMENT");
  assert.equal(tierProfile(3, "SECONDARY_TOUR").key, "DEVELOPMENT");
  assert.equal(tierFromEvent("MAJOR", "MAJOR").key, "MAJOR");
  assert.equal(tierFromEvent("WORLD", "WORLD_CHAMPIONSHIP").key, "WORLD");
});

test("round names follow A3's remaining-player rule", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(r => roundLabel(r, 7)), ["Last 128", "Last 64", "Last 32", "Last 16", "Quarter-final", "Semi-final", "Final"]);
});

test("bracket columns keep persisted slot order and never invent players", () => {
  const v = majorView();
  const cols = bracketColumns(v);
  assert.deepEqual(cols.map(c => c.label), ["Quarter-final", "Semi-final", "Final"]);
  assert.deepEqual(cols[0].matches.map((m: Any) => m.slot), [1, 2, 3, 4]);
  assert.equal(cols[2].matches[0].a_key, null, "the final stays TBC until A3 fills it");
});

test("next-opponent preview reads only the stored bracket: known sibling winner, or the undecided feeder", () => {
  const v = majorView();
  const semi = v.matches[4];
  const ifWin = opponentIfWin(v, semi);
  assert.equal(ifWin.kind, "PENDING", "the other semi still needs a player");
  assert.deepEqual(ifWin.kind === "PENDING" && [ifWin.feeder.a_key, ifWin.feeder.b_key], ["npc5", null]);
  const qf = v.matches[0];
  const known = opponentIfWin(v, qf);
  assert.deepEqual(known.kind === "KNOWN" && known.key, "npc3", "slot 1's semi-final opponent is already placed by A3");
  assert.equal(opponentIfWin(v, v.matches[6]).kind, "NONE", "nobody after the final");
});

test("opponent dossier uses published ranking, recorded titles, A7.2 meetings and this event's saved results only", () => {
  const d = dossier(majorView(), "npc3")!;
  assert.equal(d.ranking, "World #3");
  assert.equal(d.titles, "9 recorded titles");
  assert.deepEqual(d.meetings && [d.meetings.played, d.meetings.humanWins, d.meetings.npcWins, d.meetings.latest], [3, 1, 2, "Fixture Open, season 1"]);
  assert.deepEqual(d.thisEvent, [{ round: "Quarter-final", opponent: "Bram Visser", score: "6–2", how: "Won" }]);
  const fresh = dossier(majorView(), "npc5")!;
  assert.equal(fresh.meetings, null, "no fabricated head-to-head");
  assert.equal(fresh.ranking, "Unranked");
  assert.equal(fresh.titles, "No recorded titles");
});

test("result significance separates ordinary wins, milestones, elimination, runner-up and titles", () => {
  const v = majorView();
  const qfWin = resultMoment(v, v.matches[0])!;
  assert.equal(qfWin.significance, "SEMI_REACHED"); assert.equal(qfWin.milestone, true); assert.match(qfWin.headline, /semi-final/);
  // A 32-player draw: winning the opener only reaches the last 16 — an ordinary win.
  const big = { ...v, matches: [16, 8, 4, 2, 1].flatMap((n, r) => Array.from({ length: n }, (_, i) =>
    r === 0 ? match(1, i + 1, i === 0 ? "HUMAN" : `x${i}`, `y${i}`, i === 0 ? won("HUMAN", 6, 1) : {}) : match(r + 1, i + 1, null, null))) };
  const ordinary = resultMoment(big, big.matches[0])!;
  assert.equal(ordinary.significance, "WIN"); assert.equal(ordinary.milestone, false); assert.match(ordinary.headline, /last 16/);
  const intoQf = resultMoment(big, { ...big.matches[16], a_key: "HUMAN", b_key: "z", ...won("HUMAN", 6, 3) })!;
  assert.equal(intoQf.significance, "QUARTER_REACHED"); assert.equal(intoQf.milestone, true);
  const out = resultMoment(v, { ...v.matches[0], ...won("npc1", 2, 6) })!;
  assert.equal(out.significance, "ELIMINATED"); assert.match(out.headline, /Out in the quarter-final/);
  const final = { ...v.matches[6], a_key: "HUMAN", b_key: "npc5", ...won("npc5", 3, 7) };
  assert.equal(resultMoment(v, final)!.significance, "RUNNER_UP");
  const finalWin = { ...final, ...won("HUMAN", 7, 3) };
  assert.equal(resultMoment(v, finalWin)!.significance, "WIN", "not a title until the server records the champion");
  assert.equal(resultMoment({ ...v, phase: "CHAMPION", achievements: { groupWinner: false, tournamentChampion: true } }, finalWin)!.significance, "TITLE");
  const group = { ...v.matches[0], stage_key: "groups:A", ...won("npc1", 1, 3) };
  assert.equal(resultMoment(v, group)!.significance, "GROUP_LOSS");
  assert.match(resultMoment(v, group)!.detail, /does not end your event/);
  assert.equal(resultMoment(v, { ...v.matches[0], status: "BYE" }), null, "a bye is never presented as a result");
});

test("prize ladder distinguishes current estimates from A4-settled awards; A4 amounts unchanged", () => {
  const ladder = prizeLadder(majorView().money.bands, 4);
  assert.deepEqual(ladder.map(s => [s.label, s.amountPence, s.current]), [["Winner", 6_000_000, false], ["Runner-up", 3_000_000, false],
    ["Semi-finalists", 1_000_000, true], ["Quarter-finalists", 500_000, false]]);
  assert.deepEqual(prizeLadder([], 1), []);
  assert.equal(prizeLadder(majorView().money.bands, null).some(s => s.current), false, "no position, nothing secured");
});

test("run summary counts played darts and walkovers from saved fixtures; byes excluded", () => {
  const v = majorView();
  v.matches.push(match(0, 9, "HUMAN", null, { status: "BYE", winner_key: "HUMAN" }));
  assert.deepEqual(runSummary(v), { matches: 1, played: 1, won: 1, legsFor: 6, legsAgainst: 4 });
  assert.equal(humanPath(v).length, 3);
});

// ---------------------------------------------------------------- screens
const ROOT = path.resolve(import.meta.dirname, "../../..");
let vite: ViteDevServer;
let M: Record<string, Any> = {};
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  const load = (p: string) => vite.ssrLoadModule(p);
  const [wouter, tournament, components, eventPage] = await Promise.all([load("wouter"), load("/src/features/career/pages/tournament.tsx"),
    load("/src/features/career/tournament/components.tsx"), load("/src/features/career/pages/event.tsx")]);
  M = { ...tournament, ...components, ...eventPage, Router: wouter.Router };
});
after(async () => { await vite?.close(); });

const key = (...rest: unknown[]) => ["career", SAVE_ID, ...rest];
function render(el: ReactElement, seed: [unknown[], unknown][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false, staleTime: Infinity } } });
  for (const [k, v] of seed) client.setQueryData(k, v);
  try { return renderToStaticMarkup(h(QueryClientProvider, { client }, h(M.Router, { ssrPath: `/career/${SAVE_ID}`, ssrSearch: "" }, el))); } finally { client.clear(); }
}
/** Optional visual evidence (TB_BROWSER_DIR): real components + the production CSS bundle, seeded TEST fixtures only. */
function scene(name: string, html: string) {
  const out = process.env.TB_BROWSER_DIR;
  if (!out) return;
  mkdirSync(out, { recursive: true });
  const assets = path.join(ROOT, "dist/public/assets");
  const css = existsSync(assets) ? readdirSync(assets).filter(f => f.endsWith(".css")).map(f => readFileSync(path.join(assets, f), "utf8")).join("\n") : "";
  writeFileSync(path.join(out, `${name}.html`), `<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><style>${css}</style><body style="background:#080c14;color:#e7edf5;margin:0"><div style="max-width:1100px;margin:auto;padding:16px">${html}</div></body></html>`);
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const ctx = () => ({ save: save(), overview: overview(), retired: false });

test("major hub: broadcast identity, tale of the tape, your path, prize ladder — all from the saved tournament", () => {
  const html = render(h(M.TournamentPage, { ctx: ctx(), eventId: "major" }), [[key("tournament", "major"), majorView()]]);
  scene("hub-major", html);
  const t = text(html);
  for (const x of ["Major championship", "Fixture Masters", "Northgate Arena", "Wide Championship Cup", "The season's leading players",
    "Semi-final · Fixture Player vs Callan Thistledown", "Head to head", "World #3", "9 recorded titles", "“The Thistle”",
    "Defending champion", "3 played meetings", "last: Fixture Open, season 1", "Callan's run this event", "Won 6–2 v Bram Visser",
    "Your path", "vs Arno Auenberg", "6–4", "Winner of Elias Brandt v To be decided", "Prize ladder", "Semi-finalists", "Current position · estimate", "£60,000",
    "Prepare match", "Concede this match", "Withdraw from tournament", "Official draw locked"]) assert.ok(t.includes(x), x);
  assert.match(html, /aria-label="Tale of the tape"/);
  assert.match(t, /Into the semi-final/, "latest result reads as a milestone");
  assert.doesNotMatch(t, /potential|ability|form rating/i);
});

test("grassroots hub is modest and skips ceremonies; no invented head-to-head", () => {
  const v = majorView({ event: { ...majorView().event, level: 1, name: "Social Club Friday 501", definitionKey: "friday-night-501", circuit: "GRASSROOTS", classification: "RANKING",
    content: { eventClass: "GRASSROOTS", fieldDescription: "Local players", trophyId: "wood-silver-shield" }, trophy: null },
    depth: { arrival: false, drawReveal: false, walkOn: false, fullCeremony: false, animate: false, skippable: true, sportingEffects: false }, opponents: [] });
  const t = text(render(h(M.TournamentPage, { ctx: ctx(), eventId: "major" }), [[key("tournament", "major"), v]]));
  assert.match(t, /Grassroots Club & community darts/);
  assert.match(t, /First recorded meeting/);
  assert.doesNotMatch(t, /Event arrival|Reveal official draw|Major championship/);
});

test("draw tab renders the persisted bracket with your path highlighted", () => {
  const html = render(h(M.BracketBoard, { v: majorView() }));
  scene("bracket", `<section class="pdc-card p-4">${html}</section>`);
  assert.equal((html.match(/class="tb-bm[ "]/g) ?? []).length, 7, "one card per stored match");
  assert.equal((html.match(/is-path/g) ?? []).length, 2, "your two fixtures are highlighted");
  assert.match(text(html), /Fixture Player \(you\)/);
  assert.match(html, /aria-label="Knockout bracket"/);
});

test("walk-on introduces both real players and hands over to the real bull-up", () => {
  const v = majorView();
  const html = render(h(M.WalkOn, { v, match: v.matches[4], playHref: `/career/${SAVE_ID}/matches/x/play`, onSkip: () => undefined }));
  scene("walk-on", html.replace("is-animated", ""));
  const t = text(html);
  for (const x of ["Fixture Masters · Semi-final", "Walking on first", "Callan Thistledown", "And now walking on", "Fixture Player", "first throw decided by the real bull-up", "Skip"])
    assert.ok(t.includes(x), x);
  assert.match(html, /is-animated/);
  const calm = render(h(M.WalkOn, { v: { ...v, presentation: { mode: "FULL", reducedMotion: true } }, match: v.matches[4], playHref: "/x", onSkip: () => undefined }));
  assert.doesNotMatch(calm, /is-animated/, "reduced motion removes the animated entrance");
});

test("completed runner-up summary: authoritative A4 prize, ranking money, run stats and a recorded best finish", () => {
  const v = majorView({ phase: "COMPLETE", position: 2, championKey: "npc5", nextMatchId: null,
    humanResult: { wins: 2, losses: 1, matches_played: 3 },
    money: { ...majorView().money, paid: true, prize: { cash_award_pence: 3_000_000, ranking_eligible_pence: 3_000_000, finishing_position: 2 } } });
  v.matches[4] = { ...v.matches[4], ...won("HUMAN", 6, 5, "HUMAN_LIVE") };
  v.matches[6] = { ...v.matches[6], a_key: "HUMAN", b_key: "npc5", ...won("npc5", 4, 7, "HUMAN_LIVE") };
  v.latestMatch = v.matches[6];
  const done = render(h(M.TournamentPage, { ctx: ctx(), eventId: "major" }), [[key("tournament", "major"), v]]);
  scene("complete-runner-up", done);
  const t = text(done);
  for (const x of ["Runner-up", "£30,000", "Ranking money", "Best ever finish here (previously 8th)", "Champion: Elias Brandt", "16–16", "Prize settled: £30,000",
    "2 wins · 1 losses · 3 played matches", "Settled finish"]) assert.ok(t.includes(x), x);
  assert.match(t, /Milestone Runner-up/);
  assert.doesNotMatch(t, /Tournament Champion|World Champion/);
});

test("entry screen explains what makes the event worth entering from A3/A4 previews", () => {
  const e = event({ name: "County Open", circuit: "COUNTY", presentation: { tier: "STANDARD" }, field: { size: 64, entrants: 20 } });
  const entry = render(h(M.EventView, { ctx: ctx(), detail: eventDetail(e) }));
  scene("entry", entry);
  const t = text(entry);
  for (const x of ["Regional", "Winner's prize", "£25", "Prize money counts for rankings", "20 entered · 64 places · open draw", "Your cost", "£65"]) assert.ok(t.includes(x), x);
  const covered = event({ finance: { estimatedPlayerCostPence: 0, sponsorCoverage: { entryFeePence: 500, travelPence: 6000, accommodationPence: 0 } } });
  assert.match(text(render(h(M.EventView, { ctx: ctx(), detail: eventDetail(covered) }))), /Fully covered by your sponsor/);
  const done = event({ status: "COMPLETED" });
  assert.doesNotMatch(text(render(h(M.EventView, { ctx: ctx(), detail: eventDetail(done) }))), /Winner's prize/, "no entry pitch for a finished event");
});

test("Palace champion: Sovereign Trophy, World Champion label, first title record and settled prize", () => {
  const v = majorView({ phase: "CHAMPION", position: 1, championKey: "HUMAN", nextMatchId: null, humanResult: { wins: 7, losses: 0, matches_played: 7 },
    event: { ...majorView().event, level: 5, name: "World Darts Championship", definitionKey: "world-darts-championship", circuit: "WORLD_CHAMPIONSHIP", classification: "WORLD",
      format: { inRule: "STRAIGHT", scoringUnit: "SETS", legsPerSet: 5 }, trophy: null,
      venue: { displayName: "Alexandra Grand Hall", nickname: "The Palace", city: "London", venueType: "palace", capacityBand: "ARENA", stageConfiguration: "FEATURE_BOARD", atmosphereTags: ["historic-facade"] },
      content: { eventClass: "WORLD_CHAMPIONSHIP", fieldDescription: "The world's best.", trophyId: "sovereign" } },
    history: { ...majorView().history, palace: { firstAppearance: true, appearanceNumber: 1, formerWorldChampion: false }, previousAppearances: [] },
    achievements: { groupWinner: false, tournamentChampion: true },
    money: { ...majorView().money, paid: true, prize: { cash_award_pence: 6_000_000, ranking_eligible_pence: 6_000_000, finishing_position: 1 } } });
  v.matches[4] = { ...v.matches[4], ...won("HUMAN", 6, 2, "HUMAN_LIVE") };
  v.matches[6] = { ...v.matches[6], a_key: "HUMAN", b_key: "npc5", ...won("HUMAN", 7, 4, "HUMAN_LIVE") };
  v.latestMatch = v.matches[6];
  const html = render(h(M.TournamentPage, { ctx: ctx(), eventId: "major" }), [[key("tournament", "major"), v]]);
  scene("complete-palace-champion", html);
  const t = text(html);
  for (const x of ["World Championship", "The Palace", "World Champion · Sovereign Trophy", "World Champion", "First title at this event", "World Championship debut",
    "Prize settled: £60,000", "Set play · 5 legs per set"]) assert.ok(t.includes(x), x);
  assert.match(html, /data-award="PHYSICAL_TROPHY"[^>]*data-design="sovereign"/, "E2 Sovereign: the tall silver sculpture, not a crown");
  assert.doesNotMatch(t, /Best ever finish/, "a debut cannot also be a best-ever finish");
  assert.match(t, /Matches 7–0/, "A3 recorded wins/losses take precedence");
  assert.match(html, /tb-tier-world/);
});

test("title defended only when the previous edition was won by the player", () => {
  const base = { phase: "CHAMPION", position: 1, championKey: "HUMAN", achievements: { groupWinner: false, tournamentChampion: true } };
  const prev = { id: "old", name: "Fixture Masters", season: 1, start_day: 205, finishing_position: 1, is_champion: true };
  const defended = majorView({ ...base, history: { ...majorView().history, previousAppearances: [prev], recentChampions: [{ id: "old", season: 1, champion_name: "Fixture Player" }] } });
  assert.match(text(render(h(M.CompletionSummary, { v: defended }))), /Title defended/);
  const gap = majorView({ ...base, history: { ...majorView().history, previousAppearances: [prev], recentChampions: [{ id: "newer", season: 2, champion_name: "Elias Brandt" }] } });
  const t = text(render(h(M.CompletionSummary, { v: gap })));
  assert.match(t, /Title number 2 at this event/); assert.doesNotMatch(t, /Title defended/);
});

test("bull-up context strip names the real event, tier, stage and format", () => {
  const v = majorView();
  v.event.format = { ...v.event.format, gameType: "X01", startingScore: 701, inRule: "STRAIGHT", outRule: "MASTER" };
  const t = text(render(h(M.MatchContextStrip, { saveId: SAVE_ID, eventId: "major", matchId: v.matches[4].id }), [[key("tournament", "major"), v]]));
  for (const x of ["Major", "Fixture Masters", "Semi-final", "X01 · 701 · straight-in, master-out · best of 11 legs"]) assert.ok(t.includes(x), x);
  assert.doesNotMatch(t, /501 ·/);
  assert.equal(render(h(M.MatchContextStrip, { saveId: SAVE_ID, eventId: "major", matchId: "unknown" }), [[key("tournament", "major"), v]]), "", "nothing invented for an unknown match");
});

test("grassroots hub scene", () => {
  const v = majorView({ event: { ...majorView().event, level: 1, name: "Social Club Friday 501", definitionKey: "friday-night-501", circuit: "GRASSROOTS", classification: "RANKING",
    venue: { displayName: "Kilbirnie Social Club", nickname: null, city: "Kilbirnie", venueType: "social-club", capacityBand: "CLUB", stageConfiguration: "MULTI_BOARD_FLOOR", atmosphereTags: ["live-crowd"] },
    content: { eventClass: "GRASSROOTS", fieldDescription: "Local players from the area.", trophyId: "wood-silver-shield" }, trophy: { id: "wood-silver-shield", name: "Wood & Silver Shield", designKey: "wood-silver" } },
    depth: { arrival: false, drawReveal: false, walkOn: false, fullCeremony: false, animate: false, skippable: true, sportingEffects: false }, opponents: [] });
  const html = render(h(M.TournamentPage, { ctx: ctx(), eventId: "major" }), [[key("tournament", "major"), v]]);
  scene("hub-grassroots", html);
  // E2/P1-1: a weekly club fixture awards result and prize only; its stored catalogue trophy is not shown as silverware.
  assert.match(html, /tb-tier-grassroots/); assert.doesNotMatch(text(html), /Wood & Silver Shield/); assert.doesNotMatch(html, /data-award="PHYSICAL_TROPHY"/);
});
