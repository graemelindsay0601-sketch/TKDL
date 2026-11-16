import test from "node:test";
import assert from "node:assert/strict";
import { buildGuide, type GuideEvent, type GuideInput } from "../../career/guide/model.ts";

const ev = (id: string, circuit: string, week: number, dow: number, over: Partial<GuideEvent> = {}): GuideEvent => ({ id, name: `${circuit} ${id}`, circuit, status: "REGISTRATION_OPEN",
  dates: { startWeek: week, startDayOfWeek: dow, startDay: (week - 1) * 7 + dow }, registration: { opensWeek: week - 2, closesWeek: week },
  finance: { estimatedPlayerCostPence: 500 }, human: { canEnter: true, eligible: true, relationship: "AVAILABLE", denials: [] }, ...over });
const base = (over: Partial<GuideInput> = {}): GuideInput => ({ saveId: "s", season: 1, balancePence: 10_000, focus: "OPEN_SCHEDULE",
  today: { week: 10, dayOfWeek: 1, phase: "START_OF_WEEK" },
  facts: { careerStarted: true, titles: 0, bestFinishByCircuit: {}, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null },
  sponsorTiers: [], events: [], pendingMatch: null, activeTournament: null, booked: null, streaming: null, moneyChallenge: null, ...over });

test("a new player is on the first stage and is pointed at a local event today", () => {
  const g = buildGuide(base({ events: [ev("a", "GRASSROOTS", 10, 1), ev("b", "COUNTY", 10, 3)] }));
  assert.equal(g.path.current?.key, "first-event");
  assert.equal(g.today.dayName, "Monday");
  assert.deepEqual(g.today.options.map(o => o.id), ["a"]);
  assert.equal(g.nextSteps[0].action.enterEventId, "a");
  assert.match(g.today.headline, /Nothing booked yet/);
});

test("stages follow the facts: one title moves you to three titles", () => {
  const g = buildGuide(base({ facts: { careerStarted: true, titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 }, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null } }));
  assert.equal(g.path.current?.key, "three-titles");
  assert.equal(g.path.current?.progress, "1 of 3 won");
  assert.equal(g.path.done, 2);
});

test("a pending match comes first, and mid-week says what the week waits on", () => {
  const g = buildGuide(base({ today: { week: 10, dayOfWeek: 6, phase: "MID_WEEK" }, pendingMatch: { matchId: "m", eventId: "e", name: "Summer Open" } }));
  assert.equal(g.nextSteps[0].key, "match");
  assert.match(g.today.headline, /waiting on you/);
  assert.equal(g.today.options.length, 0, "mid-week the rest of the week has been played");
});

test("a booked stream mid-week is what the week waits on", () => {
  const g = buildGuide(base({ today: { week: 10, dayOfWeek: 7, phase: "MID_WEEK" }, streaming: { tierKey: "NEWCOMER", tierName: "Newcomer", followers: 3, nextTier: null,
    week: 10, scheduledNights: [2, 3], streamsThisWeek: 0, perWeek: 2, live: null } }));
  assert.match(g.today.waitingOn[0].label, /DartCast show \(Tue, Wed\)/);
  assert.equal(g.nextSteps[0].tone, "now");
});

test("missed: an event on your path you were free for and didn't enter", () => {
  const g = buildGuide(base({ events: [
    ev("gone", "GRASSROOTS", 9, 2, { status: "COMPLETED", human: { canEnter: false, eligible: true, relationship: "AVAILABLE", denials: ["EVENT_FINISHED"] } }),
    ev("busy", "GRASSROOTS", 9, 3, { status: "COMPLETED", human: { canEnter: false, eligible: true, relationship: "AVAILABLE", denials: ["EVENT_FINISHED", "SCHEDULE_CONFLICT"] } }),
    ev("played", "GRASSROOTS", 9, 4, { status: "COMPLETED", human: { canEnter: false, eligible: true, relationship: "COMPLETED", denials: ["EVENT_FINISHED"] } }),
  ] }));
  assert.deepEqual(g.missed.map(m => m.id), ["gone"]);
});

test("short of money: the guide names what to save for and how", () => {
  const g = buildGuide(base({ balancePence: 0, events: [ev("x", "GRASSROOTS", 11, 1, { human: { canEnter: false, eligible: true, relationship: "AVAILABLE", denials: ["INSUFFICIENT_FUNDS"] } })] }));
  const tip = g.nextSteps.find(s => s.key === "path-none");
  assert.match(tip?.title ?? "", /save up for it/);
  assert.match(tip?.why ?? "", /You have £0: local nights and money matches/);
});

test("the creator path runs on followers", () => {
  const g = buildGuide(base({ focus: "DARTCAST_CREATOR", streaming: { tierKey: "AFFILIATE", tierName: "Affiliate", followers: 400, nextTier: null, week: 10, scheduledNights: [], streamsThisWeek: 0, perWeek: 2, live: null } }));
  assert.equal(g.path.current?.key, "tier-PARTNER");
  assert.equal(g.path.current?.progress, "400 of 1,000 followers");
});

test("a waiting season review comes first; one event never appears twice", () => {
  const g = buildGuide(base({ pendingReview: 3, events: [ev("a", "GRASSROOTS", 10, 5)] }));
  assert.equal(g.nextSteps[0].key, "review");
  assert.equal(g.nextSteps.filter(s => s.action.enterEventId === "a").length, 1);
});

test("make it pay: stages run on prize money and the pick is the best prize for the cost", () => {
  const g = buildGuide(base({ focus: "PRIZE_MONEY", earningsPence: 25_000, events: [
    ev("small", "COUNTY", 11, 2, { finance: { estimatedPlayerCostPence: 500, topPrizePence: 2_000 } }),
    ev("rich", "COUNTY", 11, 4, { finance: { estimatedPlayerCostPence: 2_000, topPrizePence: 20_000 } }),
  ] }));
  assert.equal(g.path.current?.key, "prize-100000");
  assert.equal(g.path.current?.progress, "£250 won so far");
  assert.equal(g.nextSteps.find(s => s.key.startsWith("path:"))?.action.enterEventId, "rich");
});

test("sensible picks: near and affordable first, a second night, no far-flung trips", () => {
  const far = (id: string, dow: number) => ev(id, "GRASSROOTS", 10, dow, { finance: { estimatedPlayerCostPence: 19_000, travelBand: "UK_IRELAND" } });
  const local = (id: string, dow: number) => ev(id, "GRASSROOTS", 10, dow, { finance: { estimatedPlayerCostPence: 300, travelBand: "LOCAL" } });
  const g = buildGuide(base({ events: [far("galway", 1), local("mon", 1), local("fri", 5)] }));
  const picked = g.nextSteps.map(s => s.action.enterEventId).filter(Boolean);
  assert.ok(!picked.includes("galway"), "never a flight for a pub night");
  assert.ok(picked.includes("mon") && picked.includes("fri"), `two nights suggested: ${picked.join(",")}`);
});

test("missed ignores far events and nights you were busy", () => {
  const done = (id: string, dow: number, band: string, rel = "AVAILABLE") => ev(id, "GRASSROOTS", 9, dow, { status: "COMPLETED", finance: { travelBand: band },
    human: { canEnter: false, eligible: true, relationship: rel, denials: ["EVENT_FINISHED"] } });
  const g = buildGuide(base({ events: [done("near", 5, "LOCAL"), done("abroad", 5, "EUROPE"), done("played", 2, "LOCAL", "COMPLETED"), done("same-night", 2, "LOCAL")] }));
  assert.deepEqual(g.missed.map(m => m.id), ["near"]);
});

test("no long trips or big spends at pub level, on any path; the creator's darts nights don't claim to fit", () => {
  const trip = ev("cardiff", "GRASSROOTS", 10, 7, { finance: { estimatedPlayerCostPence: 19_200, travelBand: "DOMESTIC" } });
  const home = ev("home", "GRASSROOTS", 10, 5, { finance: { estimatedPlayerCostPence: 500, travelBand: "LOCAL" } });
  for (const focus of ["OPEN_SCHEDULE", "PROFESSIONAL_PATHWAY", "PRIZE_MONEY"] as const) {
    const g = buildGuide(base({ focus, balancePence: 25_000, events: [trip, home] }));
    assert.ok(!g.nextSteps.some(s => s.action.enterEventId === "cardiff"), `${focus}: no £192 pub night`);
  }
  const creator = buildGuide(base({ focus: "DARTCAST_CREATOR", events: [home] }));
  assert.ok(!creator.nextSteps.some(s => /fits your next step/.test(s.why)));
});

test("when the next step isn't open, the guide says when and keeps you playing locally", () => {
  const facts = { careerStarted: true, titles: 4, bestFinishByCircuit: { GRASSROOTS: 1, COUNTY: 2, CHALLENGER: 9 }, qualifications: [], professionalStatus: "AMATEUR" as const, tourCard: false, worldRanking: null };
  const qschool = ev("qs", "Q_SCHOOL", 12, 1, { finance: { estimatedPlayerCostPence: 45_000 }, registration: { opensWeek: 11, closesWeek: 12 },
    human: { canEnter: false, eligible: true, relationship: "AVAILABLE", denials: ["REGISTRATION_NOT_OPEN"] } });
  const g = buildGuide(base({ facts, events: [qschool, ev("pub", "GRASSROOTS", 10, 5, { finance: { estimatedPlayerCostPence: 300, travelBand: "LOCAL" } })] }));
  assert.equal(g.path.current?.key, "tour-card");
  const tip = g.nextSteps.find(s => s.key === "path-none");
  assert.match(tip?.title ?? "", /entries open week 11|save up/);
  assert.ok(g.nextSteps.some(s => s.action.enterEventId === "pub"), "keeps playing locally meanwhile");
});

test("booked DartCast shows are named at the start of the week", () => {
  const g = buildGuide(base({ streaming: { tierKey: "NEWCOMER", tierName: "Newcomer", followers: 3, nextTier: null, week: 10, scheduledNights: [1, 5, 7], streamsThisWeek: 0, perWeek: 3, live: null } }));
  assert.match(g.nextSteps.find(s => s.key === "shows")?.title ?? "", /Mon, Fri, Sun/);
});

test("two suggestions in a week stay within a sensible spend together", () => {
  const facts = { careerStarted: true, titles: 4, bestFinishByCircuit: { GRASSROOTS: 1, COUNTY: 2 }, qualifications: [], professionalStatus: "AMATEUR" as const, tourCard: false, worldRanking: null };
  const ct = (id: string, dow: number) => ev(id, "CHALLENGER", 10, dow, { finance: { estimatedPlayerCostPence: 22_800, travelBand: "DOMESTIC" } });
  const g = buildGuide(base({ facts, balancePence: 54_200, events: [ct("sat", 6), ct("sun", 7)] }));
  assert.equal(g.nextSteps.filter(s => s.action.enterEventId).length, 1);
});

test("never two suggestions on the same night", () => {
  const wed = (id: string) => ev(id, "GRASSROOTS", 10, 3, { finance: { estimatedPlayerCostPence: 300, travelBand: "LOCAL" } });
  const g = buildGuide(base({ events: [wed("flier"), wed("open")] }));
  const days = g.nextSteps.map(s => s.action.enterEventId).filter(Boolean);
  assert.equal(days.length, 1, `one Wednesday pick, got ${days.join(",")}`);
});
