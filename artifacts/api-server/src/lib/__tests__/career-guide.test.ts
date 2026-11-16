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

test("a quiet stretch on the path names the next chance this season, or says it's next season", () => {
  const facts = { careerStarted: true, titles: 4, bestFinishByCircuit: { GRASSROOTS: 1, COUNTY: 2, CHALLENGER: 9 }, qualifications: [], professionalStatus: "AMATEUR" as const, tourCard: false, worldRanking: null };
  const pub = ev("pub", "GRASSROOTS", 10, 5, { finance: { estimatedPlayerCostPence: 300, travelBand: "LOCAL" } });
  const later = [{ circuit: "Q_SCHOOL", id: "qs", name: "Q-School Stage 1", week: 47, opensWeek: 40 }, { circuit: "PRO_TOUR", id: "pt", name: "Players Championship 20", week: 15, opensWeek: 12 }];
  const g = buildGuide(base({ facts, events: [pub], later }));
  assert.equal(g.path.current?.key, "tour-card");
  const tip = g.nextSteps.find(s => s.key === "path-none");
  assert.match(tip?.title ?? "", /next chance week 47/);
  assert.match(tip?.why ?? "", /Q-School Stage 1 is in week 47; entries open week 40\. Until then, local nights/);
  assert.ok(tip?.action.href?.endsWith("/events/qs"), "links to the event");
  assert.ok(g.nextSteps.some(s => s.action.enterEventId === "pub"), "keeps playing locally meanwhile");
  // Shut out of a circuit (every event in view says you can't play): its later events aren't a chance.
  const closed = ev("ct", "CHALLENGER", 11, 2, { human: { canEnter: false, eligible: false, relationship: "AVAILABLE", denials: ["NOT_ELIGIBLE"] } });
  const shut = buildGuide(base({ facts, events: [pub, closed], later: [{ circuit: "CHALLENGER", id: "ct9", name: "Challenge Tour 9", week: 20, opensWeek: 16 }] }));
  assert.match(shut.nextSteps.find(s => s.key === "path-none")?.title ?? "", /nothing more this season/);
  assert.match(shut.nextSteps.find(s => s.key === "path-none")?.why ?? "", /Q-School comes round at the start of next season \(weeks 2 to 4\): about £300 to enter/);
  const none = buildGuide(base({ facts, events: [pub], later: [] })).nextSteps.find(s => s.key === "path-none");
  assert.match(none?.title ?? "", /nothing more this season/);
  assert.match(none?.why ?? "", /Q-School comes round at the start of next season/);
});

test("a sponsor offer waiting is a step: what it's worth and when it closes", () => {
  const g = buildGuide(base({ sponsorOffer: { id: "o1", name: "Forge Workwear", signingBonusPence: 10_000, expiresWeek: 12, count: 2 } }));
  const s = g.nextSteps.find(x => x.key === "sponsor-offer:o1");
  assert.equal(s?.title, "Forge Workwear wants to sign you");
  assert.match(s?.why ?? "", /£100 for signing.*Open until week 12 · 2 offers waiting/);
  assert.ok(s?.action.href?.endsWith("/sponsors"));
  const last = buildGuide(base({ sponsorOffer: { id: "o1", name: "Forge Workwear", signingBonusPence: 0, expiresWeek: 10, count: 1 } })).nextSteps.find(x => x.key === "sponsor-offer:o1");
  assert.equal(last?.tone, "now");
  assert.match(last?.why ?? "", /^help with your costs.*Last week to answer\.$/);
});

test("closed entries aren't offered as the next step; a clash says you're booked", () => {
  const blocked = (id: string, denials: string[]) => ev(id, "GRASSROOTS", 11, 1, { human: { canEnter: false, eligible: true, relationship: "AVAILABLE", denials } });
  const closed = buildGuide(base({ events: [blocked("league", ["REGISTRATION_CLOSED"])] })).nextSteps.find(s => s.key === "path-none");
  assert.doesNotMatch(closed?.title ?? "", /league/);
  const clash = buildGuide(base({ events: [blocked("night", ["SCHEDULE_CONFLICT"])] })).nextSteps.find(s => s.key === "path-none");
  assert.match(clash?.title ?? "", /night: you're booked that night/);
});

test("a weekend event takes both nights: nothing else is suggested on its second day", () => {
  const weekend = ev("w", "GRASSROOTS", 10, 6, { dates: { startWeek: 10, startDayOfWeek: 6, startDay: 69, endDay: 70 }, registration: { opensWeek: 8, closesWeek: 10 }, finance: { estimatedPlayerCostPence: 300, travelBand: "LOCAL" } });
  const sunday = ev("s", "GRASSROOTS", 10, 7, { finance: { estimatedPlayerCostPence: 300, travelBand: "LOCAL" } });
  const g = buildGuide(base({ events: [weekend, sunday] }));
  const picks = g.nextSteps.map(s => s.action.enterEventId).filter(Boolean);
  assert.ok(picks.includes("w"), "the weekend event is offered");
  assert.ok(!picks.includes("s"), "not the Sunday night it overlaps");
});

test("a renewal says it's a renewal and what your titles earned you", () => {
  const g = buildGuide(base({ sponsorOffer: { id: "r1", name: "Forge Workwear", signingBonusPence: 10_000, expiresWeek: 12, count: 1, renewal: { raisePercent: 30, titles: 2, termsServed: 2 } } }));
  const step = g.nextSteps.find(s => s.key === "sponsor-offer:r1");
  assert.equal(step?.title, "Forge Workwear wants to renew your deal (+30%: 2 titles, 2 terms loyal)");
  assert.match(step?.why ?? "", /^£100 loyalty bonus, /);
});

test("an invitation you hold is a step on any path: free entry, what the winner gets", () => {
  const cup = ev("cup", "NATIONAL_AMATEUR", 11, 6, { name: "Grassroots Champions Cup", classification: "INVITATIONAL_EXHIBITION",
    finance: { estimatedPlayerCostPence: 0, topPrizePence: 200_000, travelBand: "DOMESTIC" } });
  const g = buildGuide(base({ focus: "DARTCAST_CREATOR", events: [cup] }));
  const step = g.nextSteps.find(s => s.key === "invite:cup");
  assert.equal(step?.title, "You're in: Grassroots Champions Cup");
  assert.match(step?.why ?? "", /free to enter · £2,000 to the winner\. An invitation/);
  assert.equal(step?.action.enterEventId, "cup");
  // A pub-level free night isn't an "invitation" step (it's an ordinary local pick).
  const pub = ev("free", "GRASSROOTS", 11, 2, { classification: "INVITATIONAL_EXHIBITION", finance: { estimatedPlayerCostPence: 0, travelBand: "LOCAL" } });
  assert.ok(!buildGuide(base({ events: [pub] })).nextSteps.some(s => s.key.startsWith("invite:")));
});

test("a sponsor appearance to book is a step with its deadline and what missing it costs; a booked one shows on its week", () => {
  const due = buildGuide(base({ appearance: { id: "a1", sponsor: "Forge Workwear", dueWeek: 11, scheduledWeek: null } })).nextSteps.find(s => s.key === "appearance:a1");
  assert.equal(due?.title, "Book your Forge Workwear appearance");
  assert.equal(due?.tone, "now", "due next week");
  assert.match(due?.why ?? "", /by week 11\. Miss it and you lose the loyalty bonus/);
  const thisWeek = buildGuide(base({ appearance: { id: "a1", sponsor: "Forge Workwear", dueWeek: 12, scheduledWeek: 10 } })).nextSteps.find(s => s.key === "appearance:a1");
  assert.equal(thisWeek?.title, "Forge Workwear appearance this week");
  assert.ok(!buildGuide(base({ appearance: { id: "a1", sponsor: "Forge Workwear", dueWeek: 14, scheduledWeek: 13 } })).nextSteps.some(s => s.key === "appearance:a1"), "booked for later: nothing to do");
});

test("a deal with a season check you don't meet yet says the catch before you sign", () => {
  const g = buildGuide(base({ sponsorOffer: { id: "p1", name: "Ironflight", signingBonusPence: 756_000, expiresWeek: 12, count: 1, catch: "hold a Tour Card" } }));
  assert.match(g.nextSteps.find(s => s.key === "sponsor-offer:p1")?.why ?? "", /Catch: hold a Tour Card by next season or they drop you\./);
});
