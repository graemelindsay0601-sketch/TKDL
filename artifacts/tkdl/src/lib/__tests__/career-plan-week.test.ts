import { test } from "node:test";
import assert from "node:assert/strict";
import { planWeek, PLAN_MAX_EVENTS } from "../../features/career/model.ts";
import { event, human } from "./career-fixtures.ts";

// Week 2 runs days 8 to 14. A night on `day` costing `cost` that pays `win` to the winner, `semi` to semi-finalists and `last16` to the last 16.
const night = (day: number, cost: number, win: number, over: Parameters<typeof event>[0] = {}) => event({
  dates: { startWeek: 2, endWeek: 2, startDay: day, endDay: day, startDayOfWeek: day - 7 },
  finance: { estimatedPlayerCostPence: cost, availablePence: 10000, topPrizePence: win,
    prizeBands: [{ upToPosition: 1, amountPence: win }, { upToPosition: 4, amountPence: Math.round(win / 4) }, { upToPosition: 16, amountPence: Math.round(win / 16) }] },
  ...over,
});

test("plan my week: worth-it events, one a day, best first, shown in day order", () => {
  const tue = night(9, 400, 20000), tueWorse = night(9, 400, 8000), fri = night(12, 600, 16000), sat = night(13, 1000, 40000);
  const plan = planWeek([sat, tueWorse, fri, tue], 2);
  assert.deepEqual(plan.events.map(e => e.id), [tue.id, fri.id, sat.id]);
  assert.equal(plan.costPence, 2000);
  assert.equal(plan.upToPence, 76000);
  assert.equal(plan.leftPence, 8000);
});

test("plan my week: leaves out poor value, series, other weeks, booked days and what you cannot enter", () => {
  const poor = night(8, 5000, 4000);
  const league = night(9, 200, 20000, { series: { key: "league", day: 1 } });
  const nextWeek = night(16, 200, 20000, { dates: { startWeek: 3, endWeek: 3, startDay: 16, endDay: 16, startDayOfWeek: 2 } });
  const booked = night(10, 300, 9000, { human: human({ relationship: "ENTERED", canEnter: false }) });
  const sameDayAsBooked = night(10, 100, 30000);
  const closed = night(11, 100, 30000, { human: human({ canEnter: false, denials: ["REGISTRATION_CLOSED"] }) });
  const good = night(12, 300, 12000);
  assert.deepEqual(planWeek([poor, league, nextWeek, booked, sameDayAsBooked, closed, good], 2).events.map(e => e.id), [good.id]);
});

test("plan my week: stays within the money you have free and says how many it left out", () => {
  const big = night(13, 7000, 100000), mid = night(12, 4000, 60000), small = night(9, 2000, 30000);
  const plan = planWeek([big, mid, small], 2);
  assert.deepEqual(plan.events.map(e => e.id), [small.id, big.id]);
  assert.ok(plan.costPence <= plan.availablePence);
  assert.equal(plan.skippedForMoney, 1);
});

test("plan my week: at most four events in a week, counting what is already booked", () => {
  const booked = night(8, 300, 9000, { human: human({ relationship: "ENTERED", canEnter: false }) });
  const open = [9, 10, 11, 12, 13, 14].map(d => night(d, 100, 10000));
  assert.equal(planWeek([booked, ...open], 2).events.length, PLAN_MAX_EVENTS - 1);
});
