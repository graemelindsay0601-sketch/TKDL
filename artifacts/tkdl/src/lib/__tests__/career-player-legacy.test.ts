/**
 * Workstream D — player legacy screens. Fixtures are produced by the REAL server
 * projection (playerLegacy) over TEST-ONLY evidence, then rendered through Vite's
 * SSR loader with a seeded query cache. Assertions are about meaning, not pixels.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer, type ViteDevServer } from "vite";
import { zero } from "../../../../api-server/src/career/legacy/model.ts";
import { playerLegacy, type Rival } from "../../../../api-server/src/career/legacy/player.ts";
import type { Evidence, Result, Totals } from "../../../../api-server/src/career/legacy/types.ts";
import { overview, save, SAVE_ID } from "./career-fixtures.ts";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ROOT = path.resolve(import.meta.dirname, "../../..");
let vite: ViteDevServer; let M: Record<string, Any> = {};
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  const load = (p: string) => vite.ssrLoadModule(p);
  const [wouter, legacy, myCareer] = await Promise.all([load("wouter"), load("/src/features/career/legacy/components.tsx"), load("/src/features/career/pages/my-career.tsx")]);
  M = { ...legacy, ...myCareer, Router: wouter.Router };
});
after(async () => { await vite?.close(); });

const key = (...rest: unknown[]) => ["career", SAVE_ID, ...rest];
function render(el: ReactElement, seed: [unknown[], unknown][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false, staleTime: Infinity } } });
  for (const [k, v] of seed) client.setQueryData(k, v);
  try { return renderToStaticMarkup(h(QueryClientProvider, { client }, h(M.Router, { ssrPath: `/career/${SAVE_ID}/my-career`, ssrSearch: "" }, el))); } finally { client.clear(); }
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
function scene(name: string, html: string) {
  const out = process.env.PL_BROWSER_DIR; if (!out) return;
  mkdirSync(out, { recursive: true });
  const assets = path.join(ROOT, "dist/public/assets");
  const css = existsSync(assets) ? readdirSync(assets).filter(f => f.endsWith(".css")).map(f => readFileSync(path.join(assets, f), "utf8")).join("\n") : "";
  writeFileSync(path.join(out, `${name}.html`), `<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><style>${css}</style><body style="background:#080c14;color:#e7edf5;margin:0"><div style="max-width:1100px;margin:auto;padding:16px">${html}</div></body></html>`);
}

// ---------------------------------------------------------------- evidence → real projection
const total = (season: number, extra: Partial<Totals> = {}): Totals => ({ ...zero("HUMAN", season), appearances: 8, wins: 12, losses: 7, ...extra });
const result = (season: number, day: number, extra: Partial<Result> = {}): Result => ({ id: `result:ev-${season}-${day}:HUMAN`, key: `k-${day}`, name: `Event ${season}-${day}`, season, day,
  participant: "HUMAN", position: 9, champion: false, final: false, circuit: "COUNTY", tier: "STANDARD", classification: "RANKING", ...extra });
const base = (extra: Partial<Evidence> = {}): Evidence => ({ saveId: SAVE_ID, currentSeason: 1, currentWeek: 3, retired: false,
  players: [{ id: "HUMAN", name: "Ayr Arrow", startingAge: 19, createdSeason: 1, retiredSeason: null }], totals: [], results: [], rankings: [], cards: [], money: [], sponsors: [],
  qualifications: [], decisions: [], commitments: [], merchandise: null, productArchive: [], ...extra });
const rival: Rival = { id: "npc-callan", name: "Callan Thistledown", meetings: 5, humanWins: 2, npcWins: 3, labels: ["Recurring opponent"], firstSeason: 1, lastSeason: 3 };
const fresh = () => playerLegacy(base(), [], []);
function established(retired = false) {
  return playerLegacy(base({ currentSeason: 3, currentWeek: retired ? 30 : 12, retired,
    totals: [total(1, { titles: 1, finals: 2 }), total(2, { titles: 1, finals: 1, majorTitles: 1 }), total(3)],
    results: [result(1, 10), result(1, 20, { final: true, position: 2, name: "Ayrshire Masters" }), result(1, 30, { champion: true, final: true, position: 1, name: "Ayrshire Open" }),
      result(2, 100, { champion: true, final: true, position: 1, tier: "MAJOR", circuit: "MAJOR", name: "Fixture Masters" }),
      result(2, 200, { final: true, position: 2, tier: "WORLD", circuit: "WORLD_CHAMPIONSHIP", name: "World Darts Championship" })],
    rankings: [{ id: "r1", season: 2, week: 10, participant: "HUMAN", position: 40 }, { id: "r2", season: 2, week: 52, participant: "HUMAN", position: 12 }],
    cards: [{ id: "c1", participant: "HUMAN", source: "Q_SCHOOL_DIRECT", awardedSeason: 2, awardedWeek: 2, startSeason: 2, endSeason: 3, endedSeason: null, endedWeek: null, status: "ACTIVE" }],
    money: [{ season: 1, prizePence: 80_000, commercialPence: 0 }, { season: 2, prizePence: 6_200_000, commercialPence: 900_000 }],
    sponsors: [{ id: "s1", name: "Ochre Darts Co.", startSeason: 2, endSeason: 3, status: "ACTIVE" }] }), [], [rival]);
}
const ctx = (retired = false) => ({ save: save({ status: retired ? "RETIRED" : "ACTIVE", currentSeason: 3 }), overview: overview(), retired });
const presentation = { identity: { nickname: "The Ayr Arrow", primaryColour: "#20334A", secondaryColour: "#FFFFFF", accentColour: "#C8A050", kitDesignId: "kit-50-07" },
  placements: [{ brandName: "Ochre Darts Co.", slot: "PRIMARY_COMMERCIAL" }] };
const cabinet = (titles: Any[]) => ({ total: titles.length, nextOffset: null, authority: "A3", titles });
const title = (over: Any = {}) => ({ eventId: "ev-1", canonicalEventId: "ayrshire-open", name: "Ayrshire Open", season: 1, classification: "RANKING", circuit: "COUNTY",
  trophyIdentityId: "trophy:ayrshire-open", trophy: { id: "regional-craft", name: "Regional Craft Trophy", designKey: "regional-craft" }, venue: { displayName: "Ayr Town Hall" }, source: "ACTUAL_A3_CHAMPION_RESULT", ...over });
const sporting = (rank: number | null, card: boolean) => ({ worldRanking: { standing: rank ? { position: rank } : null }, tourCard: { holdsCard: card } });
const profileSeed = (v: Any, titles: Any[] = [], rank: number | null = null, card = false): [unknown[], unknown][] => [
  [key("legacy-player"), v], [key("trophy-cabinet", 0), cabinet(titles)], [key("sporting"), sporting(rank, card)],
  [key("profile"), { displayName: "Ayr Arrow", status: "COMPLETE", age: 22 }], [key("presentation"), presentation]];

// ---------------------------------------------------------------- D1 profile
test("new Career with no honours: honest empty profile, no trophies, no documentary call-to-action", () => {
  const html = render(h(M.PlayerLegacyProfile, { ctx: ctx() }), profileSeed(fresh()));
  const t = text(html);
  for (const x of ["Ayr Arrow", "“The Ayr Arrow”", "Open circuit", "Unranked", "No landmarks yet", "No titles yet. Your first one will show here.", "Age 22"]) assert.ok(t.includes(x), x);
  assert.doesNotMatch(html, /career-trophy-svg/); assert.doesNotMatch(t, /Watch A Career Remembered/);
  scene("profile-new", html);
});

test("established professional: real standing, landmarks in order, honours with catalogue trophies; no-trophy events get a plaque", () => {
  // Real event keys: E2 resolves awards by the event's actual key (Grand Slam = Wide Championship Cup; a weekly fixture awards none).
  const titles = [title({ eventId: "ev-major", canonicalEventId: "grand-slam-of-champions", name: "Fixture Masters", season: 2, circuit: "MAJOR", classification: "MAJOR", trophyIdentityId: "trophy:fixture-masters",
    trophy: { id: "championship-cup", name: "Wide Championship Cup", designKey: "wide-silver" } }), title({ trophy: null, canonicalEventId: "friday-night-501", circuit: "GRASSROOTS", name: "Club Night Cup", eventId: "ev-club", trophyIdentityId: "trophy:club" })];
  const html = render(h(M.PlayerLegacyProfile, { ctx: ctx() }), profileSeed(established(), titles, 21, true));
  const t = text(html);
  for (const x of ["Tour Card professional", "World #21", "Career high #12", "Titles 2", "Finals 3", "Major / World 1", "First final: Ayrshire Masters", "First title: Ayrshire Open",
    "Tour Card won", "Q-School day winner · season 2", "Fixture Masters", "Wide Championship Cup", "no trophy awarded"]) assert.ok(t.includes(x), x);
  assert.ok(t.indexOf("First final") < t.indexOf("Tour Card won"), "landmarks are chronological");
  assert.equal((html.match(/data-award="PHYSICAL_TROPHY"/g) ?? []).length, 1, "only the event with a catalogue trophy shows one");
  assert.match(html, /career-kit-library\/kit-50-07/, "the saved kit is the shirt");
  assert.doesNotMatch(t, /potential|ability|Legacy Score/i);
  scene("profile-pro", html);
});

test("retired Career: read-only archive label and the documentary entry point", () => {
  const t = text(render(h(M.PlayerLegacyProfile, { ctx: ctx(true) }), profileSeed(established(true))));
  assert.match(t, /Career archive · read-only/); assert.match(t, /Retired/); assert.match(t, /Watch A Career Remembered/);
});

test("profile load failure offers retry instead of a blank card", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false, staleTime: Infinity } } });
  client.getQueryCache().build(client, { queryKey: key("legacy-player") }).setState({ status: "error", error: new Error("boom"), fetchStatus: "idle" });
  const html = renderToStaticMarkup(h(QueryClientProvider, { client }, h(M.Router, { ssrPath: "/", ssrSearch: "" }, h(M.PlayerLegacyProfile, { ctx: ctx() }))));
  assert.match(text(html), /Retry|Try again/i);
});

// ---------------------------------------------------------------- D2 cabinet
test("trophy cabinet: majors shelf, grouped repeat wins, qualifier wins without trophies, finals and awards", () => {
  const titles = [
    title({ eventId: "m", canonicalEventId: "grand-slam-of-champions", name: "Fixture Masters", season: 2, circuit: "MAJOR", classification: "MAJOR", trophyIdentityId: "trophy:fm", trophy: { id: "championship-cup", name: "Wide Championship Cup", designKey: "wide-silver" } }),
    title({ eventId: "a1", canonicalEventId: "county-championship", season: 1 }), title({ eventId: "a2", canonicalEventId: "county-championship", season: 3 }),
    title({ eventId: "q", canonicalEventId: "q-school-first-uk_ireland-d2", name: "Q-School Day 2", circuit: "Q_SCHOOL", classification: "QUALIFIER", trophyIdentityId: "trophy:q" }),
  ];
  const awards = { honours: [{ kind: "BREAKTHROUGH_PLAYER", season: 2, participant: "HUMAN", name: "Ayr Arrow", reason: "Rose from #64 to #12.", sources: [] },
    { kind: "PLAYER_OF_THE_YEAR", season: 2, participant: "npc", name: "Someone", reason: "Not you.", sources: [] }] };
  const html = render(h(M.TrophyCabinet, { ctx: ctx() }), [[key("trophy-cabinet", 0), cabinet(titles)], [key("legacy-player"), established()], [key("legacy"), awards]]);
  const t = text(html);
  for (const x of ["4 titles won", "Majors & World Championship", "Fixture Masters", "Tournament titles", "Ayrshire Open", "Season 1 · Ayr Town Hall", "Season 3 · Ayr Town Hall",
    "Qualifier & session wins", "Q-School Day 2", "Runner-up finishes", "World Darts Championship", "Ayrshire Masters", "Breakthrough player · season 2", "Rose from #64 to #12."]) assert.ok(t.includes(x), x);
  assert.match(html, /aria-label="2 wins"/, "repeat wins share one trophy with a count");
  assert.equal((html.match(/data-award="PHYSICAL_TROPHY"/g) ?? []).length, 2, "the qualifier never gets a trophy");
  assert.doesNotMatch(t, /Not you\./, "other players' awards are not yours");
  scene("cabinet", html);
});

test("empty cabinet says so plainly", () => {
  const t = text(render(h(M.TrophyCabinet, { ctx: ctx() }), [[key("trophy-cabinet", 0), cabinet([])], [key("legacy-player"), fresh()], [key("legacy"), { honours: [] }]]));
  for (const x of ["0 titles won", "No major or World title yet.", "No tournament titles yet.", "No lost finals.", "No season awards yet."]) assert.ok(t.includes(x), x);
});

// ---------------------------------------------------------------- D3 timeline
test("season timeline: newest first, rank movement, titles marked, partial seasons labelled", () => {
  const html = render(h(M.CareerTimeline, { ctx: ctx() }), [[key("legacy-player"), established()]]);
  const t = text(html);
  assert.ok(t.indexOf("S3") < t.indexOf("S2") && t.indexOf("S2") < t.indexOf("S1"), "newest season first");
  assert.match(t, /#40 → #12/); assert.match(html, /pl-up/);
  assert.equal((t.match(/Season in progress/g) ?? []).length, 1, "only the current season is in progress");
  assert.equal((t.match(/Completed season · no review recorded/g) ?? []).length, 2);
  assert.equal((html.match(/has-title/g) ?? []).length, 2);
  scene("timeline", html);
});

// ---------------------------------------------------------------- D4 documentary
test("documentary navigation: begin, back, skip to the final record, jump, replay — all clamped", () => {
  const n = 6;
  assert.equal(M.docStep(-1, "next", n), 0); assert.equal(M.docStep(-1, "back", n), -1);
  assert.equal(M.docStep(2, "skip", n), 5); assert.equal(M.docStep(5, "next", n), 6); assert.equal(M.docStep(6, "next", n), 6);
  assert.equal(M.docStep(6, "replay", n), -1); assert.equal(M.docStep(0, { to: 3 }, n), 3); assert.equal(M.docStep(0, { to: 99 }, n), 6);
});

test("documentary: title card, evidence chapters, explained missing chapters, end card with replay and exit", () => {
  const v = established(true);
  const doc = (step: number) => render(h(M.Documentary, { v, saveId: SAVE_ID, preview: false, initialStep: step }));
  const title = text(doc(-1));
  for (const x of ["A Career Remembered", "Ayr Arrow", "Retired · season 3, week 30", "Begin", "Skip to the final record"]) assert.ok(title.includes(x), x);
  const breakthrough = text(doc(1));
  for (const x of ["Chapter 2 of 6", "The Breakthrough", "First final: Ayrshire Masters", "First title: Ayrshire Open", "Tour Card won", "First major title: Fixture Masters"]) assert.ok(breakthrough.includes(x), x);
  assert.match(text(doc(3)), /The Rivals.*Callan Thistledown.*5 meetings · 2–3/);
  assert.match(text(doc(4)), /Ochre Darts Co\./);
  const finalRecord = text(doc(5));
  for (const x of ["The Final Record", "2 titles · 3 finals", "Retired · season 3, week 30", "Finish"]) assert.ok(finalRecord.includes(x), x);
  const end = doc(6);
  for (const x of ["End of the retrospective", "Replay", "Return to My Career", "Browse the full history"]) assert.ok(text(end).includes(x), x);
  assert.match(end, /aria-label="Exit documentary"/);
  scene("documentary-title", doc(-1)); scene("documentary-chapter", doc(2));

  const empty = playerLegacy(base({ retired: true }), [], []);
  const missing = render(h(M.Documentary, { v: empty, saveId: SAVE_ID, preview: false, initialStep: 1 }));
  assert.match(text(missing), /The Breakthrough.*never came.*Nothing has been invented/);
  assert.match(missing, /is-missing/);
  scene("documentary-missing", missing);
});

test("active Career sees a labelled preview, never a fake retirement", () => {
  const t = text(render(h(M.Documentary, { v: established(), saveId: SAVE_ID, preview: true })));
  assert.match(t, /A Career Remembered · so far/); assert.match(t, /The full retrospective is presented when you retire/);
  assert.doesNotMatch(t, /Retired · season/);
});

test("My Career routes: overview profile, achievements cabinet, history timeline and the remembered section", () => {
  const seed: [unknown[], unknown][] = [...profileSeed(established()), [key("legacy"), { honours: [], pendingReview: null }]];
  assert.match(text(render(h(M.MyCareerPage, { ctx: ctx(), section: "remembered" }), seed)), /My Career · A Career Remembered/);
  assert.match(text(render(h(M.MyCareerPage, { ctx: ctx(), section: "achievements" }), seed)), /titles? won/);
});
