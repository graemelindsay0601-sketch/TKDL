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

test("short of money: the guide says so and points to cheap nights", () => {
  const g = buildGuide(base({ balancePence: 0, events: [ev("x", "GRASSROOTS", 11, 1, { human: { canEnter: false, eligible: true, relationship: "AVAILABLE", denials: ["INSUFFICIENT_FUNDS"] } })] }));
  const tip = g.nextSteps.find(s => s.key === "path-none");
  assert.equal(tip?.title, "Raise some entry money");
  assert.equal(tip?.action.href, "/career/s/local");
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
