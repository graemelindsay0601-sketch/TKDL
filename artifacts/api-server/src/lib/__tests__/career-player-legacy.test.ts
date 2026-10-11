import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import express from "express";
import { zero } from "../../career/legacy/model.ts";
import { playerLegacy, type Rival } from "../../career/legacy/player.ts";
import type { Card, Evidence, Player, Result, SeasonReview, Totals } from "../../career/legacy/types.ts";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSPHCommercial } from "../../db/migrations/create_career_sph_commercial.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { createCareerLegacyService } from "../../career/legacy/service.ts";
import { createCareerLegacyRouter } from "../../career/legacy/router.ts";
import { calendarHashOf } from "../../career/calendar/generation.ts";

// ---------------------------------------------------------------- pure model
const player = (id: string, extra: Partial<Player> = {}): Player => ({ id, name: id === "HUMAN" ? "Ayr Arrow" : id, startingAge: 19, createdSeason: 1, retiredSeason: null, ...extra });
const total = (season: number, extra: Partial<Totals> = {}): Totals => ({ ...zero("HUMAN", season), appearances: 4, wins: 6, losses: 4, ...extra });
const result = (season: number, day: number, extra: Partial<Result> = {}): Result => ({ id: `result:ev-${season}-${day}:HUMAN`, key: `k-${day}`, name: `Event ${season}-${day}`,
  season, day, participant: "HUMAN", position: 9, champion: false, final: false, circuit: "COUNTY", tier: "STANDARD", classification: "RANKING", ...extra });
const card = (extra: Partial<Card> = {}): Card => ({ id: "card-1", participant: "HUMAN", source: "Q_SCHOOL_OOM", awardedSeason: 2, awardedWeek: 3, startSeason: 2, endSeason: 3,
  endedSeason: null, endedWeek: null, status: "ACTIVE", ...extra });
const evidence = (extra: Partial<Evidence> = {}): Evidence => ({ saveId: "save-a", currentSeason: 1, currentWeek: 4, retired: false, players: [player("HUMAN"), player("npc")],
  totals: [], results: [], rankings: [], cards: [], money: [], sponsors: [], qualifications: [], decisions: [], commitments: [], merchandise: null, productArchive: [], ...extra });
const review = (season: number, extra: Partial<SeasonReview> = {}): SeasonReview => ({ version: 1, season, provenance: "CAPTURED", identity: `Season ${season} identity`, story: [],
  human: total(season), startingRank: null, finalRank: null, rankingMovement: null, prizePence: 0, commercialPence: 0, bestMajor: null, worldResult: null, cardStatus: "", changes: [],
  definingRival: null, biggestMoment: null, publicLife: { decisions: 0, completedWork: 0, threads: [] }, sponsors: [], awards: [],
  world: { numberOne: null, champions: [], leadingAmateur: null, retirements: [], newEntrants: [], cardChanges: [] }, records: [], recordEvents: [], notes: [], ...extra });
const rival = (extra: Partial<Rival> = {}): Rival => ({ id: "npc", name: "Callan Thistledown", meetings: 4, humanWins: 1, npcWins: 3, labels: ["Recurring opponent"], firstSeason: 1, lastSeason: 3, ...extra });

test("new Career with no honours: every chapter that lacks evidence explains itself; nothing is invented", () => {
  const v = playerLegacy(evidence(), [], []);
  assert.equal(v.totals.titles, 0); assert.deepEqual(v.titles, []); assert.equal(v.bestRanking, null);
  assert.deepEqual(Object.values(v.firsts).filter(Boolean), []);
  const by = Object.fromEntries(v.chapters.map(c => [c.key, c]));
  assert.deepEqual(v.chapters.map(c => c.title), ["The Beginning", "The Breakthrough", "The Big Moments", "The Rivals", "The Commercial Journey", "The Final Record"]);
  assert.equal(by.BREAKTHROUGH.available, false); assert.match(by.BREAKTHROUGH.unavailableReason!, /never came/);
  assert.equal(by.RIVALS.available, false); assert.match(by.RIVALS.unavailableReason!, /no rivalry is claimed/);
  assert.equal(by.COMMERCIAL.available, false); assert.match(by.COMMERCIAL.unavailableReason!, /Self-funded/);
  assert.equal(by.FINAL_RECORD.available, true, "the record always exists, even at zero");
  assert.equal(v.seasons.length, 1, "the current (partial) season is listed"); assert.equal(v.seasons[0].partial, true);
});

test("developing amateur: first event, first final and first title in order; qualifiers are not titles", () => {
  const e = evidence({ currentSeason: 2, totals: [total(1, { titles: 1, finals: 2 }), total(2)],
    results: [result(1, 10), result(1, 20, { final: true, position: 2 }), result(1, 30, { champion: true, final: true, position: 1, name: "Ayrshire Open" }),
      result(2, 5, { champion: true, final: true, position: 1, classification: "QUALIFIER", name: "Qualifier Night" })] });
  const v = playerLegacy(e, [review(1)], []);
  assert.equal(v.firsts.event!.label, "First recorded event: Event 1-10");
  assert.equal(v.firsts.final!.label, "First final: Event 1-20");
  assert.equal(v.firsts.title!.label, "First title: Ayrshire Open");
  assert.deepEqual(v.titles.map(t => t.label), ["Ayrshire Open"], "qualifier wins never become titles");
  assert.equal(v.chapters[1].moments[0].label, "First final: Event 1-20");
});

test("established professional: ranking endpoints prefer the captured review; Tour Card seasons; big moments ranked by stage", () => {
  const e = evidence({ currentSeason: 3, totals: [total(1), total(2, { titles: 1, majorTitles: 1 }), total(3)],
    results: [result(2, 100, { champion: true, final: true, position: 1, tier: "MAJOR", circuit: "MAJOR", name: "Fixture Masters" }),
      result(2, 200, { final: true, position: 2, tier: "WORLD", circuit: "WORLD_CHAMPIONSHIP", name: "World Darts Championship" }),
      result(3, 50, { position: 5, tier: "TELEVISED" })],
    rankings: [{ id: "r1", season: 2, week: 10, participant: "HUMAN", position: 40 }, { id: "r2", season: 2, week: 52, participant: "HUMAN", position: 12 },
      { id: "r3", season: 3, week: 4, participant: "HUMAN", position: 9 }],
    cards: [card()] });
  const v = playerLegacy(e, [review(2, { startingRank: { id: "x", season: 1, week: 52, participant: "HUMAN", position: 64 }, finalRank: { id: "y", season: 2, week: 52, participant: "HUMAN", position: 12 } })], []);
  const s2 = v.seasons.find(s => s.season === 2)!;
  assert.deepEqual([s2.startRank, s2.endRank, s2.tourCard, s2.partial, s2.reviewed], [64, 12, true, false, true]);
  assert.deepEqual([v.seasons[0].partial, v.seasons[0].reviewed], [false, false], "an older unreviewed season is complete, not in progress");
  assert.equal(v.seasons.at(-1)!.partial, true);
  assert.equal(v.seasons.find(s => s.season === 1)!.tourCard, false);
  assert.deepEqual(v.bestRanking, { position: 9, season: 3, week: 4 });
  assert.deepEqual(v.chapters[2].moments.slice(0, 2).map(m => m.kind), ["MAJOR_TITLE", "FINAL"]);
  assert.equal(v.firsts.majorTitle!.label, "First major title: Fixture Masters");
  assert.equal(v.firsts.tourCard!.detail, "Q-School Order of Merit · season 2");
});

test("titles, rivals and sponsorship: rivals need repeat meetings; commercial chapter uses recorded agreements and income", () => {
  const e = evidence({ currentSeason: 2, money: [{ season: 1, prizePence: 50_000, commercialPence: 120_000 }, { season: 2, prizePence: 10_000, commercialPence: 30_000 }],
    sponsors: [{ id: "s1", name: "Ochre Darts Co.", startSeason: 1, endSeason: 2, status: "COMPLETED" }],
    productArchive: [{ id: "p1", name: "Arrow 22g", manufacturer: "Ochre", type: "SIGNATURE_DARTS", launchSeason: 2, state: "LAUNCHED", unitsSold: 1200, grossPence: 0, royaltyPence: 9_000, salesBySeason: [] }] });
  const v = playerLegacy(e, [], [rival(), rival({ id: "once", name: "One-off", meetings: 1 })]);
  assert.deepEqual(v.rivals.map(r => r.name), ["Callan Thistledown"], "a single meeting is not a rivalry");
  const commercial = v.chapters.find(c => c.key === "COMMERCIAL")!;
  assert.deepEqual(commercial.moments.map(m => m.kind), ["SPONSOR", "PRODUCT", "INCOME"]);
  assert.match(commercial.moments.at(-1)!.label, /£1,500 sponsor & commercial income/);
  assert.equal(v.totals.prizePence, 60_000);
  assert.equal(v.seasons[0].sponsors[0], "Ochre Darts Co.");
});

test("retired Career: final record carries the retirement point; missing ages and reviews are tolerated", () => {
  const e = evidence({ retired: true, currentSeason: 4, currentWeek: 30, players: [player("HUMAN", { startingAge: null })], totals: [total(4)] });
  const v = playerLegacy(e, [], []);
  assert.deepEqual(v.retiredAt, { season: 4, week: 30 });
  assert.match(v.chapters.at(-1)!.moments.at(-1)!.label, /Retired · season 4, week 30/);
  assert.equal(v.chapters[0].moments.some(m => m.kind === "AGE"), false, "no age is invented");
  assert.equal(v.seasons.at(-1)!.identity, null);
});

test("stable saved records: identical evidence projects identically", () => {
  const e = evidence({ totals: [total(1, { titles: 1 })], results: [result(1, 3, { champion: true, final: true, position: 1 })] });
  assert.equal(JSON.stringify(playerLegacy(e, [], [rival()])), JSON.stringify(playerLegacy(structuredClone(e), [], [rival()])));
});

test("source boundary: player legacy reads only — no writes, RNG or hidden ratings", () => {
  const src = readFileSync(new URL("../../career/legacy/player.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /Math\.random|randomUUID|current_ability|potential|UPDATE |INSERT |DELETE /);
});

// ---------------------------------------------------------------- service, ownership, retirement
const pg = new PGlite(), db = drizzle(pg), saves = createCareerService(db), actor = { playerId: 1 };
const sporting = createCareerSportingService(db), legacyService = createCareerLegacyService(db);
let saveId = "", otherId = "";
before(async () => {
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY);INSERT INTO players VALUES(1),(2);
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false,'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerCalendar(db); await createCareerFinance(db);
  await createCareerSPHCommercial(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db); await createCareerFinanceSPC(db);
  await createCareerSponsorHQSPD(db); await createCareerNpcSponsorMarketSPF(db); await createCareerSponsorContractActionsSPE2(db); await createCareerSporting(db);
  saveId = (await saves.create(1, { slot: 1, dateOfBirth: "1995-05-05", homeLocality: "ayrshire" })).id;
  await sporting.initialize(actor, saveId);
  otherId = (await saves.create(2, { slot: 1, dateOfBirth: "1990-01-01", homeLocality: "ayrshire" })).id;
});
after(async () => await pg.close());

test("service: a new real save reads cleanly, and another player's save is invisible", async () => {
  const v = await legacyService.player(actor, saveId);
  assert.equal(v.saveId, saveId); assert.equal(v.retired, false); assert.equal(v.totals.titles, 0);
  assert.equal(v.chapters.length, 6); assert.equal(v.startingAge !== null, true, "the saved date of birth gives a starting age");
  await assert.rejects(legacyService.player(actor, otherId), (e: unknown) => [403, 404].includes((e as { status: number }).status));
  await assert.rejects(legacyService.player({ playerId: 2 }, saveId), (e: unknown) => [403, 404].includes((e as { status: number }).status));
});

test("service: reading the legacy changes no sporting, finance or world rows", async () => {
  const snapshot = async () => calendarHashOf((await db.execute(sql`SELECT jsonb_build_object('save',s,
    'results',(SELECT COUNT(*) FROM career_event_results r WHERE r.career_save_id=s.id),
    'finance',(SELECT COUNT(*) FROM career_finance_entries f WHERE f.career_save_id=s.id),
    'players',(SELECT COUNT(*) FROM career_world_players p WHERE p.career_save_id=s.id)) AS evidence FROM career_saves s WHERE s.id=${saveId}`)).rows);
  const before = await snapshot();
  await legacyService.player(actor, saveId); await legacyService.player(actor, saveId);
  assert.equal(await snapshot(), before);
});

test("route: authenticated, owned and never cached; retired saves stay readable", async () => {
  const app = express();
  app.use((req, _res, next) => { (req as unknown as { session: unknown }).session = { playerId: Number(req.headers["x-player"] ?? 0) }; next(); });
  app.use("/api/career", createCareerLegacyRouter(legacyService));
  const server = app.listen(0); const port = (server.address() as { port: number }).port;
  try {
    const get = (p: number, id = saveId) => fetch(`http://127.0.0.1:${port}/api/career/saves/${id}/legacy/player`, { headers: { "x-player": String(p) } });
    assert.equal((await get(0)).status, 401);
    const ok = await get(1); assert.equal(ok.status, 200); assert.equal(ok.headers.get("cache-control"), "no-store");
    assert.ok([403, 404].includes((await get(2)).status));
    await saves.retire(1, saveId);
    const retired = await (await get(1)).json() as { retired: boolean; retiredAt: unknown; chapters: { key: string; moments: { kind: string }[] }[] };
    assert.equal(retired.retired, true); assert.ok(retired.retiredAt);
    assert.ok(retired.chapters.find(c => c.key === "FINAL_RECORD")!.moments.some(m => m.kind === "RETIRED"));
  } finally { server.close(); }
});
