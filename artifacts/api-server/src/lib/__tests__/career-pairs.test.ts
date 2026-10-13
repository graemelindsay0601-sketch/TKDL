import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, throwDart, pairsSeat, pairsSeats, planBotX01Visit, seededRandom, botOptionsFor, type Dart, type X01Format, type X01MatchState } from "../../shared/darts-rules/index.ts";
import { assessCapability } from "../../career/calendar/formats.ts";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { generateSeason } from "../../career/calendar/generation.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { nationTeams, localTeams, dartsNation, selectionRank } from "../../career/calendar/pairs.ts";
import { teamComposite } from "../../career/world/team.ts";
import { verifyBotVisits, matchFacts, seatBot, type SessionTeam } from "../../career/live/service.ts";
// The browser's own planners (artifacts/tkdl), loaded by URL so this package's typecheck stays inside its root.
type LiveModel = { careerBotVisit: (...a: unknown[]) => Dart[]; careerPartnerVisit: (...a: unknown[]) => Dart[] | null; shouldCheckpoint: (...a: unknown[]) => boolean };
const { careerBotVisit, careerPartnerVisit, shouldCheckpoint } = await import(new URL("../../../../tkdl/src/features/career/live-model.ts", import.meta.url).href) as LiveModel;
import type { Npc } from "../../career/world/types.ts";

const FORMAT = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 5 } as X01Format;
const cfg = (avg: number) => ({ avg, sd: 18, checkoutPct: 38, hitAcc: 0.4 });
const BOT = { config: cfg(85), seed: "a".repeat(32) };
const TEAM: SessionTeam = { partner: { key: "p", config: cfg(78), seed: "b".repeat(32) }, opponentPartner: { key: "q", config: cfg(80), seed: "c".repeat(32) } };

test("pairs throwing order: visits alternate inside each team for the whole match; singles indexing is unchanged", () => {
  const visits = [0, 1, 0, 1, 0, 1, 1, 0].map(thrower => ({ thrower: thrower as 0 | 1 }));
  assert.deepEqual(pairsSeats(visits).map(s => [s.team, s.member, s.memberVisit]),
    [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]);
  assert.deepEqual(pairsSeat(visits, 1), { team: 1, member: 0, memberVisit: 2 });
  assert.deepEqual(pairsSeats(visits, 1).filter(s => s.team === 1).map(s => s.memberVisit), [0, 1, 2, 3], "singles: the bot's own visit count");
  assert.equal(seatBot({ team: 0, member: 0, memberVisit: 0 }, BOT.config, BOT.seed, TEAM), null, "your own visits are self-reported");
  assert.equal(seatBot({ team: 0, member: 1, memberVisit: 0 }, BOT.config, BOT.seed, TEAM), TEAM.partner);
  assert.equal(seatBot({ team: 1, member: 1, memberVisit: 0 }, BOT.config, BOT.seed, TEAM), TEAM.opponentPartner);
});

/** Play a whole pairs match the way the browser does: the live-model planners for every bot visit, a fixed planner for "you". */
function playPairs(firstThrower: 0 | 1, you = cfg(70)) {
  const session = { bot: BOT, format: FORMAT, team: { partner: { ...TEAM.partner, name: "P" }, opponentPartner: { ...TEAM.opponentPartner, name: "Q" } } } as never;
  let state: X01MatchState = createMatch(FORMAT, firstThrower);
  const darts: Dart[] = [];
  let yours = 0;
  while (!state.complete) {
    const ctx = { remaining: state.scores[state.turn], opened: state.opened[state.turn] };
    const plan = state.turn === 1 ? careerBotVisit(session, firstThrower, darts, ctx)
      : careerPartnerVisit(session, firstThrower, darts, ctx) ?? planBotX01Visit(ctx.remaining, you, { ...botOptionsFor(FORMAT), opened: ctx.opened, rng: seededRandom("you", "v", yours++) });
    const turn = state.turn, visitsBefore = state.visits.length;
    for (const d of plan) {
      const dart = { segment: d.segment, multiplier: d.multiplier, value: d.value } as Dart;
      state = throwDart(state, dart).state; darts.push(dart);
      if (state.complete || state.visits.length > visitsBefore || state.turn !== turn) break;
    }
  }
  return { state, darts };
}

test("a pairs match planned by the browser verifies on the server; a tampered partner or opposing-partner visit is refused", () => {
  for (const first of [0, 1] as const) {
    const { state } = playPairs(first);
    assert.ok(state.complete);
    assert.doesNotThrow(() => verifyBotVisits(state, BOT.config, BOT.seed, TEAM));
    const seats = pairsSeats(state.visits);
    for (const [label, team, member] of [["Partner", 0, 1], ["Opponent", 1, 1], ["Opponent", 1, 0]] as const) {
      const at = seats.findIndex(s => s.team === team && s.member === member && state.visits[seats.indexOf(s)].darts.length === 3);
      const visits = state.visits.map((v, i) => i === at ? { ...v, darts: [{ segment: 0, multiplier: 1, value: 0 } as Dart, ...v.darts.slice(1)] } : v);
      assert.throws(() => verifyBotVisits({ ...state, visits }, BOT.config, BOT.seed, TEAM), new RegExp(`${label} visit`), `${label} member ${member}`);
    }
    // Your own visits are self-reported: changing one never trips the bot verifier.
    const mine = seats.findIndex(s => s.team === 0 && s.member === 0);
    const visits = state.visits.map((v, i) => i === mine ? { ...v, darts: [{ segment: 0, multiplier: 1, value: 0 } as Dart] } : v);
    assert.doesNotThrow(() => verifyBotVisits({ ...state, visits }, BOT.config, BOT.seed, TEAM));
    // The same log is not a valid singles log (the partner's visits are not yours to report, and the opponent indexing differs).
    assert.throws(() => verifyBotVisits(state, BOT.config, BOT.seed, null));
  }
});

test("pairs facts: your average counts only your own visits; the team and partner are reported separately", () => {
  const { state } = playPairs(0, cfg(60));
  const f = matchFacts(state, true) as ReturnType<typeof matchFacts> & { partner: { darts: number }; team: { darts: number } };
  assert.equal(f.human.darts + f.partner.darts, f.team.darts);
  const own = state.visits.filter((v, i) => pairsSeats(state.visits)[i].team === 0 && pairsSeats(state.visits)[i].member === 0).reduce((n, v) => n + v.darts.length, 0);
  assert.equal(f.human.darts, own);
  assert.equal(matchFacts(state).human.darts, f.team.darts, "singles facts are unchanged");
});

test("checkpoints: never in the middle of your partner's visit", () => {
  const { darts } = playPairs(0);
  const state = createMatch(FORMAT, 0);
  let s = state, partnerMid = 0, yoursMid = 0;
  for (let i = 0; i < darts.length; i++) {
    const before = s; s = throwDart(s, darts[i]).state;
    if (!s.visit || s.visit.thrower !== 0) continue;
    const member = pairsSeat(s.visits, 0).member;
    const cp = shouldCheckpoint(FORMAT, 0, darts.slice(0, i + 1), true);
    if (member === 1) { partnerMid++; assert.equal(cp, false); } else { yoursMid++; assert.equal(cp, true); }
    void before;
  }
  assert.ok(partnerMid > 0 && yoursMid > 0);
});

test("v13: Pub Doubles and the World Cup run; v12 keeps pairs benched; singles formats are unaffected", () => {
  const pub = (v: number) => catalogueFor(v).find(d => d.key === "pub-doubles")!;
  assert.equal(assessCapability(pub(12).format, true).executable, false);
  assert.equal(assessCapability(pub(13).format, true).executable, true);
  const wc = catalogueFor(13).find(d => d.key === "world-cup-of-darts")!;
  assert.ok(wc && !catalogueFor(12).some(d => d.key === "world-cup-of-darts"));
  assert.deepEqual([wc.format.sideSize, wc.format.pairing, wc.fieldSize, wc.classification, wc.rankingCategory], [2, "NATION", 32, "INVITATIONAL_EXHIBITION", null]);
  assert.equal(assessCapability({ ...pub(13).format, pairing: undefined }, true).executable, false, "pairs need a pairing rule");
  assert.equal(assessCapability({ ...pub(13).format, scoringUnit: "SETS", legsPerSet: 3 }, true).executable, false, "pairs run as legs");
  const season = generateSeason(HARNESS_SEED, 13, 1);
  assert.ok(season.some(d => d.definitionKey === "world-cup-of-darts" && d.executable));
  assert.ok(season.filter(d => d.definitionKey === "pub-doubles").every(d => d.executable));
});

test("World Cup selection: home nations play separately; each nation's best two by World, then Open, then Amateur ranking", () => {
  assert.deepEqual(["ayrshire", "south-wales", "northern-ireland", "midlands"].map(l => dartsNation("GBR", l)), ["SCO", "WAL", "NIR", "ENG"]);
  assert.equal(dartsNation("NLD", null), "NLD");
  assert.deepEqual([selectionRank({ "pro-world": 40, "open-world": 1 }), selectionRank({ "open-world": 3 }), selectionRank({ amateur: 9 }), selectionRank({})], [40, 1003, 2009, undefined]);
  const c = (key: string, country: string, rank: number) => ({ key, npcId: key === "HUMAN" ? null : key, country, rank });
  const { teams, players } = nationTeams([c("e1", "ENG", 1), c("e2", "ENG", 4), c("e3", "ENG", 2), c("HUMAN", "SCO", 30), c("s1", "SCO", 9), c("s2", "SCO", 50),
    c("w1", "WAL", 1004), c("n1", "NLD", 3), c("n2", "NLD", 5), c("x1", "BEL", 7)], 3);
  assert.deepEqual(teams.map(t => [t.nation, t.captain_key, t.partner_key]), [["ENG", "e1", "e3"], ["NLD", "n1", "n2"], ["SCO", "HUMAN", "s1"]],
    "best two per nation; nations by combined ranking; the human captains; one-player nations miss out");
  assert.equal(players.length, 6);
});

test("local pairs: you partner the first selected player from your area, then your country; the odd player out is left out", () => {
  const npc = (id: string, nationality: string, homeRegion: string) => ({ id, nationality, homeRegion }) as Npc;
  const field = [{ key: "HUMAN", npc: null }, { key: "a", npc: npc("a", "IRL", "Leinster") }, { key: "b", npc: npc("b", "GBR", "Midlands") },
    { key: "c", npc: npc("c", "GBR", "Ayrshire") }, { key: "d", npc: npc("d", "GBR", "Midlands") }];
  const { teams, unpaired } = localTeams(field, { country: "GBR", locality: "ayrshire" });
  assert.deepEqual(teams.map(t => [t.captain_key, t.partner_key]), [["HUMAN", "c"], ["a", "b"]]);
  assert.deepEqual(unpaired, ["d"]);
  assert.deepEqual(localTeams(field.slice(0, 3), { country: "GBR", locality: "highlands" }).teams[0].partner_key, "b", "same country when nobody is local");
});

test("a pair plays as the average of its two players; identity stays the captain's", () => {
  const base = { ability: { scoring: 60, finishing: 50, consistency: 40, pressure: 70, powerScoring: 30, clutch: 20 }, form: 2, tendencies: { local: 1, floor: 0, stage: -1, qualifier: 0, major: 2 } };
  const a = { ...base, id: "a" } as unknown as Npc, b = { id: "b", ability: { scoring: 80, finishing: 70, consistency: 60, pressure: 50, powerScoring: 50, clutch: 40 }, form: -2,
    tendencies: { local: -1, floor: 2, stage: 1, qualifier: 0, major: 0 } } as unknown as Npc;
  const t = teamComposite(a, b);
  assert.equal(t.id, "a");
  assert.deepEqual(t.ability, { scoring: 70, finishing: 60, consistency: 50, pressure: 60, powerScoring: 40, clutch: 30 });
  assert.equal(t.form, 0); assert.deepEqual(t.tendencies, { local: 0, floor: 1, stage: 0, qualifier: 0, major: 1 });
});
