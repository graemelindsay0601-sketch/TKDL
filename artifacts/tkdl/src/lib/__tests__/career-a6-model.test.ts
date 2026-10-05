import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatPence, movementLabel, ordinal, eventStatus, primaryAction, pickNextEvent, qSchoolState, financeHeadlines, careerChapter, routeLines, slotLines,
  activeNavKey, CAREER_NAV, formatLabel, eventLifecycle, milestoneLabel, matchesStatusFilter, MATCH_PLAY_STATUS, tierStyle, denialLabel,
} from "../../features/career/model.ts";
import type { CareerEvent, CareerSave, FinanceSummary, QSchoolPathwayView, SportingSummary, HumanView } from "../../features/career/types.ts";

// ---------------------------------------------------------------- fixtures (shape of real A3/A4/A5 DTOs)
const human = (o: Partial<HumanView> = {}): HumanView => ({ relationship: "AVAILABLE", eligible: true, eligibilityReasons: [], canEnter: true, denials: [], conflictsWith: [], entryStatus: null, result: null, ...o });
function ev(o: Partial<CareerEvent> & { id?: string } = {}): CareerEvent {
  return {
    id: "e1", instanceKey: "k", season: 1, name: "Kilbirnie Friday Night 501", definitionKey: "friday-night-501", family: "f", circuit: "GRASSROOTS", classification: "RANKING", rankingCategory: "AMATEUR_LOCAL",
    presentation: { tier: "LOCAL", featured: false, calendarPriority: 10 },
    dates: { startWeek: 3, endWeek: 3, startDay: 19, endDay: 19, startDayOfWeek: 5, grouping: "OPENING_SWING" }, registration: { opensWeek: 1, closesWeek: 3 },
    venue: { key: "v", name: "Club", city: "Kilbirnie", country: "GBR", region: "Ayrshire", zone: "UK_IRELAND", localityKey: "ayrshire" },
    format: { gameType: "X01", startingScore: 501, matchContext: "local", structure: "KNOCKOUT", stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound: [5, 5, 7] }], days: 1, sideSize: 1, inRule: "STRAIGHT", outRule: "DOUBLE", scoringUnit: "LEGS", legsPerSet: null },
    capability: { executable: true }, field: { size: 24, minimum: 4, entrants: 0, policy: "SELECTION" }, series: null, qSchool: null, seedingPolicy: { list: null, seeds: 0 },
    status: "REGISTRATION_OPEN", statusReason: null, champion: null, human: human(),
    finance: { affordable: true, currency: "GBP", travelBand: "LOCAL", nights: 0, entryFeePence: 500, entryFeeBasis: "PER_EVENT", estimatedTravelPence: 0, estimatedAccommodationPence: 0,
      sponsorCoverage: { entryFeePence: 0, travelPence: 0, accommodationPence: 0 }, estimatedPlayerCostPence: 500, balancePence: 25000, availablePence: 25000, prizeProfile: "p", topPrizePence: 2500, rankingEligible: true, commitment: null },
    ...o,
  };
}
const save = (o: Partial<CareerSave> = {}): CareerSave => ({ id: "s", slotNumber: 1, careerName: null, status: "ACTIVE", difficulty: "STANDARD", currentSeason: 1, currentWeek: 1, createdAt: "", updatedAt: "",
  retiredAt: null, balancePence: 25000, currency: "GBP", standing: "", professionalRanking: null, professionalRankingMoneyPence: 0, sponsor: null, hasTourCard: false, ...o });
const sporting = (o: { card?: boolean; pos?: number | null } = {}): Pick<SportingSummary, "tourCard" | "worldRanking" | "professionalStatus"> => ({
  professionalStatus: o.card ? "PROFESSIONAL" : "AMATEUR",
  tourCard: { holdsCard: !!o.card, current: null },
  worldRanking: { list: "pro-world", published: null, ranked: o.pos != null, careerHighPosition: o.pos ?? null, seasonHighPosition: null, cutLines: [],
    standing: o.pos != null ? { position: o.pos, participantKey: "HUMAN", kind: "HUMAN", name: "You", nationality: null, valuePence: 1, previousPosition: null, movement: null, isNew: true, gapAbovePence: null, gapBelowPence: null, careerHighPosition: o.pos, countedContributions: 1 } : null },
});

// ---------------------------------------------------------------- tests
test("money and ranking formatting", () => {
  assert.equal(formatPence(25000), "£250");
  assert.equal(formatPence(12345), "£123.45");
  assert.equal(formatPence(-2400), "−£24");
  assert.equal(formatPence(1500000, { compact: true }), "£15k");
  assert.equal(formatPence(50_000_000, { compact: true }), "£500k");
  assert.equal(formatPence(null), "—");
  assert.equal(ordinal(1), "1st"); assert.equal(ordinal(22), "22nd"); assert.equal(ordinal(13), "13th"); assert.equal(ordinal(103), "103rd");
  assert.deepEqual(movementLabel(4).text, "▲4"); assert.deepEqual(movementLabel(-2).text, "▼2");
  assert.equal(movementLabel(0).text, "–"); assert.equal(movementLabel(null, true).text, "NEW");
});

test("new Career save slot: unranked, no Tour Card, self-funded", () => {
  const lines = Object.fromEntries(slotLines(save()).map(l => [l.label, l.value]));
  assert.deepEqual(lines, { Season: "S1 · Wk 1", "World Rank": "Unranked", Balance: "£250", "Tour Card": "None", Sponsor: "Self-funded" });
  const pro = Object.fromEntries(slotLines(save({ professionalRanking: 28, hasTourCard: true, sponsor: "Ironflight", balancePence: 976000 })).map(l => [l.label, l.value]));
  assert.deepEqual([pro["World Rank"], pro["Tour Card"], pro.Sponsor, pro.Balance], ["28th", "Active", "Ironflight", "£9,760"]);
});

test("Career chapter is a factual state label (amateur / new pro / established / retired)", () => {
  assert.equal(careerChapter(sporting()).label, "Amateur");
  assert.equal(careerChapter(sporting({ card: true })).label, "New professional");
  assert.equal(careerChapter(sporting({ card: true, pos: 80 })).label, "Tour Card professional");
  assert.equal(careerChapter(sporting({ card: true, pos: 12 })).label, "Established professional");
  assert.equal(careerChapter(sporting({ pos: 140 })).label, "Ranked, no Tour Card");
  assert.equal(careerChapter(sporting({ card: true, pos: 1 }), { status: "RETIRED" }).label, "Retired Career");
});

test("affordable vs unaffordable: Enter is offered only when the server says canEnter", () => {
  const ok = ev();
  assert.equal(eventStatus(ok).key, "AVAILABLE");
  assert.deepEqual(primaryAction(ok), { kind: "ENTER", label: "Enter · £5", enabled: true });
  const broke = ev({ human: human({ canEnter: false, denials: ["INSUFFICIENT_FUNDS"] }), finance: { ...ev().finance!, affordable: false, availablePence: 100 } });
  assert.equal(eventStatus(broke).key, "CANNOT_AFFORD");
  assert.match(eventStatus(broke).detail!, /available £1/);
  assert.deepEqual(primaryAction(broke), { kind: "CANNOT_AFFORD", label: "Cannot afford", enabled: false });
  // Even an "affordable" preview never overrides a server denial.
  const denied = ev({ human: human({ canEnter: false, denials: ["REGISTRATION_CLOSED"] }) });
  assert.notEqual(primaryAction(denied).kind, "ENTER");
});

test("qualified vs not qualified come from A3 eligibility facts", () => {
  const notQ = ev({ circuit: "PRO_CIRCUIT", human: human({ eligible: false, canEnter: false, eligibilityReasons: ["REQUIRES_TOUR_CARD"], denials: ["REQUIRES_TOUR_CARD"] }) });
  assert.deepEqual([eventStatus(notQ).key, eventStatus(notQ).label], ["NOT_QUALIFIED", "Tour Card required"]);
  assert.equal(primaryAction(notQ).kind, "NOT_QUALIFIED");
  const q = ev({ human: human({ relationship: "QUALIFIED" }) });
  assert.equal(eventStatus(q).key, "QUALIFIED");
  assert.equal(eventStatus(ev({ human: human({ canEnter: false, denials: ["SCHEDULE_CONFLICT"] }) })).key, "CONFLICT");
  assert.equal(eventStatus(ev({ human: human({ canEnter: false, denials: ["REGISTRATION_NOT_OPEN"] }), registration: { opensWeek: 7, closesWeek: 9 } })).label, "Entries open wk 7");
  assert.equal(denialLabel("REQUIRES_INVITATION"), "Invitation only");
});

test("entered / in progress / completed / champion / withdrawn", () => {
  assert.equal(eventStatus(ev({ human: human({ relationship: "ENTERED", canEnter: false, entryStatus: "ENTERED", denials: ["ALREADY_ENTERED"] }) })).key, "ENTERED");
  assert.equal(eventStatus(ev({ status: "IN_PROGRESS", human: human({ relationship: "PLAYING", canEnter: false }) })).key, "IN_PROGRESS");
  assert.equal(eventStatus(ev({ status: "COMPLETED", human: human({ relationship: "COMPLETED", result: { finishingPosition: 5, stageReached: "QUARTER_FINAL", champion: false } }) })).label, "Finished — Quarter-final");
  assert.equal(eventStatus(ev({ status: "COMPLETED", human: human({ result: { finishingPosition: 1, stageReached: "CHAMPION", champion: true } }) })).key, "CHAMPION");
  assert.equal(eventStatus(ev({ human: human({ relationship: "WITHDRAWN", canEnter: false }) })).key, "WITHDRAWN");
  assert.equal(matchesStatusFilter(ev({ human: human({ relationship: "ENTERED", canEnter: false }) }), "MINE"), true);
  assert.equal(matchesStatusFilter(ev(), "MINE"), false);
});

test("unsupported and cancelled events are never presented as playable or played", () => {
  const wc = ev({ name: "World Darts Championship", capability: { executable: false, code: "UNSUPPORTED_FORMAT", reasons: ["SET_PLAY"] }, human: human({ canEnter: false, denials: ["UNSUPPORTED_FORMAT"] }),
    format: { ...ev().format, scoringUnit: "SETS", legsPerSet: 5, stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound: [3, 3, 5, 5, 7, 7, 13] }] } });
  assert.equal(eventStatus(wc).key, "UNSUPPORTED");
  assert.notEqual(primaryAction(wc).kind, "ENTER");
  assert.equal(formatLabel(wc.format), "501 · knockout · best of 3–13 sets");
  const cancelled = { ...wc, status: "CANCELLED" as const, statusReason: "UNSUPPORTED_FORMAT" };
  assert.match(eventStatus(cancelled).detail!, /not supported/);
  assert.deepEqual(eventLifecycle({ event: cancelled, draw: { matches: [] } }).key, "UNSUPPORTED");
  assert.equal(eventStatus(ev({ status: "CANCELLED", statusReason: "INSUFFICIENT_ENTRANTS" })).label, "Cancelled");
});

test("tournament lifecycle from persisted draw: draw, active, eliminated, completed", () => {
  const live = ev({ status: "IN_PROGRESS" });
  const m = (status: string, winner: string | null) => ({ a: { key: "HUMAN" }, b: { key: "npc" }, status, winnerKey: winner });
  assert.equal(eventLifecycle({ event: live, draw: { matches: [m("AWAITING_HUMAN", null)] } }).key, "ACTIVE");
  assert.equal(eventLifecycle({ event: live, draw: { matches: [m("COMPLETED", "npc")] } }).key, "ELIMINATED");
  assert.equal(eventLifecycle({ event: ev({ status: "COMPLETED" }), draw: { matches: [m("COMPLETED", "HUMAN")] } }).label, "Completed — champion");
  assert.equal(eventLifecycle({ event: ev({ status: "DRAWN" }), draw: { matches: [] } }).key, "DRAW");
});

test("Home picks the pending match first, then my entered event, then the best open entry", () => {
  const a = ev({ id: "open", dates: { ...ev().dates, startWeek: 4, startDay: 26 } });
  const mine = ev({ id: "mine", human: human({ relationship: "ENTERED", canEnter: false }), dates: { ...ev().dates, startWeek: 6, startDay: 40 } });
  const pend = ev({ id: "pend", status: "IN_PROGRESS", human: human({ relationship: "PLAYING", canEnter: false }) });
  const overview = { season: 1, week: 3, pendingHumanMatches: [] as { matchId: string; eventId: string }[] };
  assert.equal(pickNextEvent([a, mine], overview)!.event.id, "mine");
  assert.equal(pickNextEvent([a, mine, pend], { ...overview, pendingHumanMatches: [{ matchId: "m", eventId: "pend" }] })!.event.id, "pend");
  assert.equal(pickNextEvent([a], overview)!.event.id, "open");
  assert.equal(pickNextEvent([], overview), null);
  // A pending match is offered as PLAY_MATCH, never as a fabricated result.
  assert.equal(primaryAction(pend, { awaitingMatch: true }).kind, "PLAY_MATCH");
  // A6.5: the match-play boundary is connected to the real GameScorer (server-verified).
  assert.equal(MATCH_PLAY_STATUS.connected, true);
});

test("retired Career is read-only in every action", () => {
  assert.deepEqual(primaryAction(ev(), { retired: true }), { kind: "VIEW", label: "View event", enabled: true });
  assert.equal(primaryAction(ev(), { retired: true, awaitingMatch: true }).enabled, false);
});

test("Q-School standing, card line and Tour Card result", () => {
  const base: QSchoolPathwayView = { pathway: "UK_IRELAND", finalStage: { days: 4, completed: 2, dayWinners: [] },
    participant: { firstStage: [{ day: 1, position: 9 }], finalStageEntry: { route: "EVENT_RESULT", detail: {} }, wonDay: [], orderOfMerit: { position: 14, contenderPosition: 12, points: 4, insideCardLine: false } },
    cardLine: { orderOfMeritCards: 10, valueAtLinePoints: 6 }, standings: [], allocation: null };
  assert.equal(qSchoolState(base).stage, "FINAL_STAGE");
  assert.equal(qSchoolState({ ...base, participant: { ...base.participant, finalStageEntry: null, orderOfMerit: null } }).stage, "FIRST_STAGE");
  assert.equal(qSchoolState({ ...base, participant: { firstStage: [], finalStageEntry: null, wonDay: [], orderOfMerit: null } }).stage, "NOT_ENTERED");
  const alloc = (route: "DIRECT" | "ORDER_OF_MERIT") => ({ ...base, allocation: { allocatedWeek: 3, directCards: 4, unusedDirectCards: 0, orderOfMeritCards: 10,
    awards: [{ participantKey: "HUMAN", name: null, route, day: route === "DIRECT" ? 2 : null, orderOfMeritPosition: route === "DIRECT" ? null : 7, points: 9, cardId: "c" }] } });
  assert.equal(qSchoolState(alloc("DIRECT")).label, "Tour Card won — Final Stage Day 2 winner");
  assert.equal(qSchoolState(alloc("ORDER_OF_MERIT")).label, "Tour Card won — Order of Merit 7th");
  assert.equal(qSchoolState({ ...alloc("DIRECT"), allocation: { ...alloc("DIRECT").allocation!, awards: [] } }).stage, "NO_CARD");
});

test("finance shows exactly four separate headlines with A4 definitions", () => {
  const f: FinanceSummary = { currency: "GBP", balancePence: 976000, startingBalancePence: 25000, careerEarningsPence: 600000, sponsorEarningsPence: 300000, careerExpensesPence: 249000,
    sponsorCoveredExpensesPence: 52000, ledgerEntries: 30, reconciled: true, reservedForTravelPence: 4800, availablePence: 971200, sponsor: null, availableOffers: 1 };
  const h = financeHeadlines(f);
  assert.deepEqual(h.map(x => [x.key, x.label, x.pence]), [["BALANCE", "Balance", 976000], ["EARNINGS", "Career Earnings", 600000], ["SPONSOR", "Sponsor Earnings", 300000], ["EXPENSES", "Career Expenses", 249000]]);
  assert.equal(h[1].hint, "Prize money only");
  assert.match(h[0].hint, /£9,712 available/);
});

test("qualification routes render structured A5 facts (places outside a cut, Tour Card)", () => {
  const lines = routeLines({ type: "ANY", met: false, parts: [
    { type: "RANKING", met: false, list: "pro-world", maxPosition: 32, position: 38, placesOutside: 6 }, { type: "QUALIFICATION", met: false, held: false, qualifierRoutes: ["world-championship-qualifier"], targetKey: "world-championship" },
    { type: "TOUR_CARD", met: true } ] });
  assert.deepEqual(lines, [{ text: "Top 32 on World Ranking — you are 38th (6 places outside)", met: false }, { text: "or Qualifier route available", met: false }, { text: "or Tour Card required", met: true }]);
  assert.deepEqual(routeLines({ type: "RANKING", met: false, list: "pro-world", maxPosition: 16, position: null, placesOutside: null }), [{ text: "Top 16 on World Ranking — you are unranked", met: false }]);
});

test("milestones are neutral labels from A5 facts (no prose)", () => {
  assert.deepEqual(milestoneLabel({ kind: "TOUR_CARD_WON", list_key: null, detail: { source: "Q_SCHOOL_DIRECT" } }), { title: "Tour Card won", detail: "Q-School day winner", tone: "gold" });
  assert.equal(milestoneLabel({ kind: "ENTERED_TOP_32", list_key: "pro-world", detail: { position: 30 } }).detail, "World Ranking · 30th");
  assert.equal(milestoneLabel({ kind: "TOUR_CARD_LOST", list_key: null, detail: {} }).tone, "danger");
});

test("three-layer navigation and stable routes", () => {
  assert.deepEqual(CAREER_NAV.map(s => s.layer), ["HOME", "MY_CAREER", "DARTS_WORLD"]);
  assert.equal(CAREER_NAV.flatMap(s => s.items).length, 17);
  assert.equal(activeNavKey("/career/abc/world/players"),"world");
  assert.equal(activeNavKey("/career/abc/map"),"map");
  assert.equal(activeNavKey("/career/abc/guide"),"guide");
  assert.equal(activeNavKey("/career/abc/presentation"),"presentation");
  assert.equal(activeNavKey("/career/abc/recognition/npcs/example"), "recognition");
  assert.equal(activeNavKey("/career/abc/goals"), "goals");
  assert.equal(activeNavKey("/career/abc/relationships"), "relationships");
  assert.equal(activeNavKey("/career/abc"), "home");
  assert.equal(activeNavKey("/career/abc/rankings"), "rankings");
  assert.equal(activeNavKey("/career/abc/events/e1"), "calendar");
  assert.equal(activeNavKey("/career/abc/world-championship"), "world-championship");
});

test("presentation tiers escalate emphasis from LOCAL to WORLD without separate apps", () => {
  const order = ["LOCAL", "STANDARD", "FEATURED", "TELEVISED", "MAJOR", "WORLD"].map(t => tierStyle(t).emphasis);
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5]);
  assert.equal(tierStyle("WORLD").accent, "#ffd24a");
});

test("no RPG mechanics, coins or gambling vocabulary in the Career UI model", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../../features/career/", import.meta.url);
  const files = [...readdirSync(dir).filter(f => /\.(ts|tsx)$/.test(f)).map(f => new URL(f, dir)), ...readdirSync(new URL("pages/", dir)).map(f => new URL(`pages/${f}`, dir))];
  const source = files.map(f => readFileSync(f, "utf8")).join("\n");
  assert.ok(!/\b(xp|skill points?|stamina|loot|energy|gems?|bet(ting)?|casino|wager)\b/i.test(source.replace(/expected|experience/gi, "")));
  assert.ok(!/\/api\/(coins|currency|card-clash|tour\/)|player_currency|CoinBalance|useCoins/i.test(source), "no TKDL coins, currency or Classic Tour API in Career UI");
  assert.ok(!/Math\.random/.test(source), "nothing is invented client-side");
});
