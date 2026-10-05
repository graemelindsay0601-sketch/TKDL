import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeNavKey, cardLineText, careerChapter, eventLifecycle, eventStatus, financeHeadlines, formatLabel, matchesStatusFilter, milestoneLabel, movementLabel,
  navLayerOf, pickNextEvent, primaryAction, qSchoolState, routeLines, slotLines, CAREER_NAV,
} from "../../features/career/model.ts";
import { event, finance, human, overview, pathway, save, sporting } from "./career-fixtures.ts";

// ---------------------------------------------------------------- saves / status
test("save slot shows unranked, no Tour Card and self-funded for a new Career", () => {
  const lines = Object.fromEntries(slotLines(save()).map(l => [l.label, l.value]));
  assert.equal(lines["World Rank"], "Unranked");
  assert.equal(lines["Tour Card"], "None");
  assert.equal(lines.Sponsor, "Self-funded");
  assert.equal(lines.Balance, "£250");
  assert.equal(lines.Season, "S1 · Wk 1");
});

test("save slot shows real rank, active card and sponsor when A1 caches carry them", () => {
  const lines = Object.fromEntries(slotLines(save({ professionalRanking: 42, hasTourCard: true, sponsor: "Ochre Darts Co.", balancePence: 1469000, currentWeek: 12 })).map(l => [l.label, l.value]));
  assert.deepEqual([lines["World Rank"], lines["Tour Card"], lines.Sponsor, lines.Balance], ["42nd", "Active", "Ochre Darts Co.", "£14,690"]);
});

test("career chapter is a neutral factual label derived from card + ranking", () => {
  assert.equal(careerChapter(sporting("UNRANKED_AMATEUR")).label, "Amateur");
  assert.equal(careerChapter(sporting("RANKED_PRO")).label, "Tour Card professional");
  const newPro = sporting("RANKED_PRO", { worldRanking: { standing: null } });
  assert.equal(careerChapter(newPro).label, "New professional");
  const established = sporting("RANKED_PRO", { worldRanking: { standing: { position: 12 } } });
  assert.equal(careerChapter(established).label, "Established professional");
  const rankedNoCard = sporting("RANKED_PRO", { tourCard: { holdsCard: false, current: null } });
  assert.equal(careerChapter(rankedNoCard).label, "Ranked, no Tour Card");
  assert.equal(careerChapter(sporting("RANKED_PRO"), { status: "RETIRED" }).label, "Retired Career");
});

// ---------------------------------------------------------------- entry actions never contradict the backend
test("affordable, eligible event offers Enter with the server's cost", () => {
  const e = event();
  assert.equal(eventStatus(e).key, "AVAILABLE");
  assert.deepEqual(primaryAction(e), { kind: "ENTER", label: "Enter · £65", enabled: true });
});

test("unaffordable event is 'Cannot afford' and never offers Enter", () => {
  const e = event({ human: human({ canEnter: false, denials: ["INSUFFICIENT_FUNDS"] }), finance: { affordable: false, estimatedPlayerCostPence: 69000, availablePence: 25000 } });
  assert.equal(eventStatus(e).key, "CANNOT_AFFORD");
  assert.match(eventStatus(e).detail ?? "", /£690.*£250/);
  assert.equal(primaryAction(e).kind, "CANNOT_AFFORD");
  assert.equal(primaryAction(e).enabled, false);
});

test("not-qualified event shows the backend reason and no Enter", () => {
  const e = event({ human: human({ eligible: false, canEnter: false, relationship: "NOT_ELIGIBLE", eligibilityReasons: ["REQUIRES_TOUR_CARD"], denials: ["REQUIRES_TOUR_CARD"] }) });
  assert.deepEqual([eventStatus(e).key, eventStatus(e).label], ["NOT_QUALIFIED", "Tour Card required"]);
  assert.equal(primaryAction(e).kind, "NOT_QUALIFIED");
});

test("qualified event (entitlement held) is highlighted and enterable", () => {
  const e = event({ human: human({ relationship: "QUALIFIED" }) });
  assert.equal(eventStatus(e).key, "QUALIFIED");
  assert.equal(primaryAction(e).kind, "ENTER");
});

test("entered, in-progress and completed states come from the human relationship/result", () => {
  assert.equal(eventStatus(event({ human: human({ relationship: "ENTERED", canEnter: false, denials: ["ALREADY_ENTERED"], entryStatus: "ENTERED" }) })).key, "ENTERED");
  assert.equal(eventStatus(event({ status: "IN_PROGRESS", human: human({ relationship: "PLAYING", canEnter: false }) })).key, "IN_PROGRESS");
  const done = event({ status: "COMPLETED", human: human({ relationship: "COMPLETED", canEnter: false, result: { finishingPosition: 17, stageReached: "LAST_32", champion: false } }) });
  assert.deepEqual([eventStatus(done).key, eventStatus(done).label], ["COMPLETED", "Finished — Last 32"]);
  const won = event({ status: "COMPLETED", human: human({ relationship: "COMPLETED", canEnter: false, result: { finishingPosition: 1, stageReached: "CHAMPION", champion: true } }) });
  assert.equal(eventStatus(won).key, "CHAMPION");
});

test("a pending human match exposes Play match (the UI then shows the not-connected boundary)", () => {
  const e = event({ status: "IN_PROGRESS", human: human({ relationship: "PLAYING", canEnter: false }) });
  assert.equal(primaryAction(e, { awaitingMatch: true }).kind, "PLAY_MATCH");
  assert.equal(primaryAction(e, { awaitingMatch: true, retired: true }).enabled, false);
});

test("unsupported and cancelled events are presented as such, never as playable", () => {
  const wc = event({ name: "World Darts Championship", capability: { executable: false, code: "UNSUPPORTED_FORMAT", reasons: ["SET_PLAY"] }, status: "SCHEDULED",
    human: human({ canEnter: false, denials: ["UNSUPPORTED_FORMAT"] }) });
  assert.equal(eventStatus(wc).key, "UNSUPPORTED");
  assert.notEqual(primaryAction(wc).kind, "ENTER");
  assert.equal(eventStatus(event({ status: "CANCELLED", statusReason: "INSUFFICIENT_ENTRANTS", human: null })).key, "CANCELLED");
  const life = eventLifecycle({ event: { ...wc, status: "CANCELLED", statusReason: "UNSUPPORTED_FORMAT" }, draw: { matches: [] } });
  assert.equal(life.key, "UNSUPPORTED");
});

test("retired Career never offers Enter even if a stale DTO says canEnter", () => {
  assert.equal(primaryAction(event(), { retired: true }).kind, "VIEW");
});

test("event lifecycle distinguishes eliminated, completed-champion and drawn", () => {
  const e = event({ status: "IN_PROGRESS" });
  const m = (winnerKey: string | null, status = "COMPLETED") => ({ a: { key: "HUMAN" }, b: { key: "npc" }, status, winnerKey });
  assert.equal(eventLifecycle({ event: e, draw: { matches: [m("npc")] } }).key, "ELIMINATED");
  assert.equal(eventLifecycle({ event: { ...e, status: "COMPLETED" }, draw: { matches: [m("HUMAN")] } }).label, "Completed — champion");
  assert.equal(eventLifecycle({ event: { ...e, status: "DRAWN" }, draw: { matches: [m(null, "PENDING")] } }).key, "DRAW");
});

test("Home's next event: pending match beats entered event beats open entry", () => {
  const open = event({ dates: { startWeek: 2, startDay: 10 } });
  const mine = event({ dates: { startWeek: 3, startDay: 20 }, human: human({ relationship: "ENTERED", canEnter: false }) });
  const live = event({ status: "IN_PROGRESS", dates: { startWeek: 4, startDay: 30 }, human: human({ relationship: "PLAYING", canEnter: false }) });
  assert.equal(pickNextEvent([open, mine], overview())?.event.id, mine.id);
  assert.equal(pickNextEvent([open, mine, live], overview({ pendingHumanMatches: [{ matchId: "m", eventId: live.id }] }))?.reason, "Your match is waiting");
  assert.equal(pickNextEvent([open], overview())?.reason, "Open for entry");
  const blocked = event({ human: human({ canEnter: false, denials: ["INSUFFICIENT_FUNDS"] }) });
  assert.equal(pickNextEvent([blocked], overview())?.reason, "Next event you are eligible for");
  assert.equal(pickNextEvent([], overview()), null);
});

test("calendar status filters follow the derived (server-backed) status", () => {
  const afford = event({ human: human({ canEnter: false, denials: ["INSUFFICIENT_FUNDS"] }) });
  assert.equal(matchesStatusFilter(afford, "AFFORD"), true);
  assert.equal(matchesStatusFilter(afford, "OPEN"), false);
  assert.equal(matchesStatusFilter(event(), "OPEN"), true);
});

// ---------------------------------------------------------------- formats / rankings
test("format label reports sets for set-play events (World Championship) and legs otherwise", () => {
  assert.equal(formatLabel(event().format), "501 · knockout · best of 5–7 legs");
  const wc = event({ format: { scoringUnit: "SETS", legsPerSet: 5, stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound: [3, 3, 5, 5, 7, 7, 13] }] } }).format;
  assert.equal(formatLabel(wc), "501 · knockout · best of 3–13 sets");
});

test("movement labels are text + aria, not colour alone", () => {
  assert.deepEqual(movementLabel(-3), { text: "▼3", tone: "danger", aria: "Down 3" });
  assert.deepEqual(movementLabel(5), { text: "▲5", tone: "success", aria: "Up 5" });
  assert.equal(movementLabel(null, true).text, "NEW");
});

test("ranking qualification routes describe cut, position and gap from A5 facts", () => {
  const lines = routeLines({ type: "ANY", met: true, parts: [
    { type: "RANKING", met: false, list: "pro-world", maxPosition: 32, position: 42, placesOutside: 10 },
    { type: "RANKING", met: true, list: "pro-circuit", maxPosition: 32, position: 21 }] });
  assert.deepEqual(lines, [{ text: "Top 32 on World Ranking — you are 42nd (10 places outside)", met: false }, { text: "or Top 32 on Pro Circuit — you are 21st", met: true }]);
  assert.equal(routeLines({ type: "RANKING", met: false, list: "pro-world", maxPosition: 64, position: null })[0].text, "Top 64 on World Ranking — you are unranked");
});

// ---------------------------------------------------------------- Q-School
test("Q-School state: not entered, first stage, final stage, card won directly / via OoM, no card", () => {
  assert.equal(qSchoolState(pathway()).stage, "NOT_ENTERED");
  assert.equal(qSchoolState(pathway({ participant: { firstStage: [{ day: 1, position: 5 }] } })).stage, "FIRST_STAGE");
  const final = pathway({ participant: { finalStageEntry: { route: "EVENT_RESULT", detail: null }, orderOfMerit: { position: 14, contenderPosition: 12, points: 5, insideCardLine: false } } });
  assert.equal(qSchoolState(final).stage, "FINAL_STAGE");
  const alloc = (awards: NonNullable<ReturnType<typeof pathway>["allocation"]>["awards"]) => ({ allocatedWeek: 4, directCards: 4, unusedDirectCards: 0, orderOfMeritCards: 10, awards });
  const direct = { ...final, allocation: alloc([{ participantKey: "HUMAN", name: "You", route: "DIRECT", day: 1, orderOfMeritPosition: null, points: 9, cardId: "c" }]) };
  assert.deepEqual([qSchoolState(direct).stage, qSchoolState(direct).label], ["CARD_WON_DIRECT", "Tour Card won — Final Stage Day 1 winner"]);
  const oom = { ...final, allocation: alloc([{ participantKey: "HUMAN", name: "You", route: "ORDER_OF_MERIT", day: null, orderOfMeritPosition: 9, points: 7, cardId: "c" }]) };
  assert.equal(qSchoolState(oom).label, "Tour Card won — Order of Merit 9th");
  assert.equal(qSchoolState({ ...final, allocation: alloc([]) }).stage, "NO_CARD");
});

test("Q-School card line: inside, outside and already-carded (contenderPosition 0)", () => {
  assert.equal(cardLineText({ contenderPosition: 4, insideCardLine: true }, 10, false).text, "Inside (4th of 10 OoM places)");
  assert.equal(cardLineText({ contenderPosition: 12, insideCardLine: false }, 10, false).tone, "warning");
  assert.equal(cardLineText({ contenderPosition: 0, insideCardLine: true }, 10, false).text, "Not a contender — card already won");
  assert.equal(cardLineText(null, 10, false).text, "—");
});

// ---------------------------------------------------------------- finance
test("four finance headlines map 1:1 to the four separate A4 figures", () => {
  const h = financeHeadlines(finance({ balancePence: 1469000, careerEarningsPence: 1200000, sponsorEarningsPence: 95000, careerExpensesPence: 351000, sponsorCoveredExpensesPence: 35000 }));
  assert.deepEqual(h.map(x => [x.key, x.label, x.pence]), [["BALANCE", "Balance", 1469000], ["EARNINGS", "Career Earnings", 1200000], ["SPONSOR", "Sponsor Earnings", 95000], ["EXPENSES", "Career Expenses", 351000]]);
  assert.match(h[3].hint, /£350 more covered by sponsors/);
});

// ---------------------------------------------------------------- milestones / navigation
test("milestones render as neutral factual labels (no prose)", () => {
  assert.deepEqual(milestoneLabel({ kind: "TOUR_CARD_WON", list_key: null, detail: { source: "Q_SCHOOL_DIRECT" } }), { title: "Tour Card won", detail: "Q-School day winner", tone: "gold" });
  assert.equal(milestoneLabel({ kind: "FIRST_MAJOR", list_key: null, detail: { eventName: "The Open Championship" } }).detail, "The Open Championship");
});

test("navigation: five destinations, legacy screens remain reachable, events belong to Calendar", () => {
  assert.deepEqual(CAREER_NAV.map(l => l.label), ["Home","Map","Calendar","Darts World","My Career"]);
  assert.equal(CAREER_NAV.flatMap(l => l.items).length, 13);
  assert.equal(navLayerOf(activeNavKey("/career/abc/recognition/npcs/example")).label, "My Career");
  assert.equal(navLayerOf(activeNavKey("/career/abc/goals")).label, "My Career");
  assert.equal(navLayerOf(activeNavKey("/career/abc/relationships")).label, "My Career");
  assert.equal(activeNavKey("/career/abc/events/xyz"), "calendar");
  assert.equal(navLayerOf(activeNavKey("/career/abc/world-championship")).label, "Darts World");
  assert.equal(navLayerOf(activeNavKey("/career/abc/finances")).label, "My Career");
  assert.equal(activeNavKey("/career/abc"), "home");
});
