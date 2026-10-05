/**
 * A6 Career screen tests. Pages are loaded through Vite's SSR module loader (real
 * aliases, real components) and rendered to static markup with a React Query cache
 * pre-seeded from TEST-ONLY fixtures shaped like the real A1–A5 DTOs. Assertions are
 * about meaning (which facts/actions appear), never pixels.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer, type ViteDevServer } from "vite";
import { event, eventDetail, finance, human, overview, pathway, rankingMeta, row, save, SAVE_ID, sporting } from "./career-fixtures.ts";
import { FOCUSES, type GoalsView } from "../../../../api-server/src/career/goals/types.ts";
import { recognitionModel } from "../../../../api-server/src/career/recognition/model.ts";
import type { RecognitionView } from "../../../../api-server/src/career/recognition/types.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
let vite: ViteDevServer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let M: Record<string, any> = {};
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  const load = (p: string) => vite.ssrLoadModule(p);
   const [saves, home, rankings, qschool, finances, eventPage, history, shell, api, wouter, fetchMod, relationships, goals, recognition] = await Promise.all([
    load("/src/features/career/pages/saves.tsx"), load("/src/features/career/pages/home.tsx"), load("/src/features/career/pages/rankings.tsx"),
    load("/src/features/career/pages/q-school.tsx"), load("/src/features/career/pages/finances.tsx"), load("/src/features/career/pages/event.tsx"),
     load("/src/features/career/pages/history.tsx"), load("/src/features/career/shell.tsx"), load("/src/features/career/api.ts"), load("wouter"), load("/src/lib/api-fetch.ts"), load("/src/features/career/pages/relationships.tsx"), load("/src/features/career/pages/goals.tsx"), load("/src/features/career/pages/recognition.tsx")]);
   M = { ...saves, ...home, ...rankings, ...qschool, ...finances, ...eventPage, ...history, ...shell, ...api, ...relationships, ...goals, ...recognition, Router: wouter.Router, ApiRequestError: fetchMod.ApiRequestError };
});
after(async () => { await vite?.close(); });

const key = (...rest: unknown[]) => ["career", SAVE_ID, ...rest];
function render(el: ReactElement, seed: [unknown[], unknown][], at = `/career/${SAVE_ID}`, errors: [unknown[], unknown][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false, staleTime: Infinity } } });
  for (const [k, v] of seed) client.setQueryData(k, v);
  for (const [k, e] of errors) client.getQueryCache().build(client, { queryKey: k }).setState({ status: "error", error: e as Error, fetchStatus: "idle" });
  return renderToStaticMarkup(h(QueryClientProvider, { client }, h(M.Router, { ssrPath: at }, el)));
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const ctx = (s = save(), ov = overview()) => ({ save: s, overview: ov, retired: s.status === "RETIRED" });
const homeSeed = (s: ReturnType<typeof save>, events: ReturnType<typeof event>[], sp = sporting("UNRANKED_AMATEUR"), fin = finance()): [unknown[], unknown][] => [
  [key("sporting"), sp], [key("finance"), fin], [key("history", { participant: "HUMAN" }), []],
  [key("calendar", { scope: "WORLD", fromWeek: s.currentWeek, toWeek: Math.min(52, s.currentWeek + 8) }), { overview: overview({ week: s.currentWeek }), season: 1, scope: "WORLD", events }],
];

const goalsFixture=():GoalsView=>({careerSaveId:SAVE_ID,focus:"OPEN_SCHEDULE",focusOptions:Object.entries(FOCUSES).map(([value,d])=>({value:value as GoalsView["focus"],...d})),
  activeLimit:5,retired:false,goals:[],options:[{definition:{type:"WIN_TITLE"},label:"Win a Career title"}],
  context:{currentRank:null,holdsCard:false,earningsPence:0},opportunities:[]});
const recognitionFixture=(elite=false):RecognitionView=>({careerSaveId:SAVE_ID,subject:{kind:"HUMAN",id:"HUMAN",name:"Your Career",retired:false},relationships:[],
  ...recognitionModel({appearances:[],qualifications:[],cards:[],rankings:[],results:elite ? Array.from({length:4},(_,i)=>({
    fact:{id:`title-${i}`,source:"A3 event result",label:`National amateur title ${i+1}`,season:1,day:7,week:1,date:"2026-01-07",age:20,eventId:`event-${i}`},
    circuit:"NATIONAL_AMATEUR",classification:"RANKING",tier:"STANDARD",international:false,champion:true,stageReached:"CHAMPION"})) : []})});
test("A7.4 Recognition: elite amateur standing, independent contexts, factual evidence/history and no meters/scores",()=>{
  const data=recognitionFixture(true),html=render(h(M.RecognitionPage,{ctx:ctx()}),[[key("recognition"),data]]),t=text(html);
  for(const s of ["Elite amateur","Local","Amateur","Professional","Major / Stage","International","Why you're recognised","National amateur title","2026-01-07","Age 20","A3 event result","Recent recognition milestones"])assert.ok(t.includes(s),s);
  assert.match(t,/turning professional is optional/);assert.match(t,/Focus and personal goals do not grant recognition/);
  assert.ok(html.includes(`/career/${SAVE_ID}/events/event-0`));
  assert.doesNotMatch(html,/<progress|role="progressbar"|\d+\/100/);
  assert.doesNotMatch(t,/reputation points|XP|potential|current ability|level up|fame currency/i);
});
test("A7.4 empty and retired Recognition remain meaningful, readable and without mutation controls",()=>{
  const data=recognitionFixture(),empty=text(render(h(M.RecognitionPage,{ctx:ctx()}),[[key("recognition"),data]]));
  assert.match(empty,/Building a sporting record/);assert.match(empty,/No qualifying sporting evidence/);assert.match(empty,/No dated recognition milestones/);
  data.subject.retired=true;
  const retired=text(render(h(M.RecognitionPage,{ctx:ctx(save({status:"RETIRED"}))}),[[key("recognition"),data]]));
  assert.match(retired,/Retired Career/);assert.match(retired,/creates no further progression/);assert.doesNotMatch(retired,/Enter event|Select goal|Spend|Upgrade/);
});
test("A7.4 Hub summary limits badges to strongest contexts and history renders only sourced milestone dates",()=>{
  const data=recognitionFixture(true),summary=render(h(M.RecognitionSummary,{saveId:SAVE_ID}),[[key("recognition"),data]]);
  assert.match(text(summary),/Career standing.*Elite amateur/);assert.ok(summary.includes(`/career/${SAVE_ID}/recognition`));
  assert.doesNotMatch(text(summary),/Professional ·|Major \/ Stage ·|International ·/);
  const history=text(render(h(M.RecognitionTimeline,{saveId:SAVE_ID}),[[key("recognition"),data]]));
  assert.match(history,/Recognition threshold history/);assert.match(history,/Amateur recognition — Elite/);assert.match(history,/2026-01-07/);
  const home=text(render(h(M.HomePage,{ctx:ctx()}),[...homeSeed(save(),[]),[key("recognition"),data]]));
  assert.match(home,/Career standing.*Elite amateur/);
});
test("A7.4 on-demand NPC Recognition and relationship links expose public sporting evidence only",()=>{
  const data=recognitionFixture(true);data.subject={kind:"NPC",id:"public-npc",name:"Public Opponent",retired:true};
  const html=render(h(M.RecognitionPage,{ctx:ctx(),npcId:"public-npc"}),[[key("recognition","npc","public-npc"),data]]);
  assert.match(text(html),/Public opponent recognition/);assert.match(text(html),/Public Opponent/);assert.match(text(html),/Retired player/);
  assert.ok(html.includes(`/career/${SAVE_ID}/relationships`));assert.doesNotMatch(text(html),/potential|ability|development score/i);
});
test("A7.4 loading/error and week-precision milestones never imply an exact sporting date",()=>{
  assert.match(text(render(h(M.RecognitionPage,{ctx:ctx()}),[])),/Reading sporting recognition/);
  assert.match(text(render(h(M.RecognitionPage,{ctx:ctx()}),[],undefined,[[key("recognition"),new Error("Recognition unavailable")]])),/Recognition unavailable/);
  const data=recognitionFixture(true);
  data.milestones[0]={...data.milestones[0],precision:"WEEK",week:3,day:null,date:null,age:null};
  const t=text(render(h(M.RecognitionTimeline,{saveId:SAVE_ID}),[[key("recognition"),data]]));
  assert.match(t,/S1 · W3/);assert.doesNotMatch(t,/2026-01-07|Age 20/);
});
test("A7.3 optional focus/goals render guidance, an unrestricted calendar link, contextual choices and empty state",()=>{
  const data=goalsFixture();
  const html=render(h(M.GoalsPage,{ctx:ctx()}),[[key("goals"),data]]);
  const t=text(html);
  assert.match(t,/Optional sporting ambitions, not quests/);assert.match(t,/Every eligible pathway remains available/);
  for (const f of Object.values(FOCUSES)) assert.ok(t.includes(f.label));
  assert.match(t,/No active goals/);assert.match(t,/No matching upcoming opportunity/);assert.match(t,/Select goal/);
  assert.ok(html.includes(`/career/${SAVE_ID}/calendar`));assert.match(t,/no penalty/i);
});
test("A7.3 recommendations retain exact costs, eligibility blockers and event links; completions show evidence/date/age",()=>{
  const data=goalsFixture();data.focus="PRIZE_MONEY";data.context.currentRank=81;
  data.opportunities=[{id:"event-1",name:"Regional Open",season:1,startDay:7,circuit:"REGIONAL",classification:"RANKING",tier:"LOCAL",status:"REGISTRATION_OPEN",
    eligible:true,canEnter:false,denials:["INSUFFICIENT_FUNDS"],relationship:"NONE",majorRoute:false,firstPrizePence:1000000,estimatedCostPence:10000,
    registration:{opensWeek:1,closesWeek:1},reason:"Published first prize and estimated costs; winning and profit are not guaranteed"}];
  data.goals=[{id:"goal-1",definition:{type:"WIN_TITLE"},label:"Win a Career title",status:"COMPLETED",created:{season:1,week:1},
    progress:{current:1,target:1,unit:"achievement",note:null},completion:{id:"result:one",source:"A3 event result",label:"Regional Open",season:1,day:7,week:1,date:"2026-01-07",age:20,eventId:"event-1"}}];
  const html=render(h(M.GoalsPage,{ctx:ctx()}),[[key("goals"),data]]),t=text(html);
  assert.match(t,/INSUFFICIENT_FUNDS/);assert.match(t,/not guaranteed/);assert.match(t,/10,000/);assert.match(t,/£100 estimated Career cost/);
  assert.match(t,/World ranking: #81/);assert.match(t,/2026-01-07/);assert.match(t,/Age 20/);assert.match(t,/A3 event result/);
  assert.ok(html.includes(`/career/${SAVE_ID}/events/event-1`));
  assert.doesNotMatch(t,/XP awarded|skill points|loot|level up/i);
});
test("A7.3 retired Careers retain readable goals/focus but no new-goal or abandon actions; Home has a compact summary",()=>{
  const data=goalsFixture();data.retired=true;
  data.goals=[{id:"pending",definition:{type:"WIN_TITLE"},label:"Win a Career title",status:"ACTIVE",created:{season:1,week:1},
    progress:{current:0,target:1,unit:"achievement",note:"Career retired; no further sporting progress."},completion:null}];
  const html=render(h(M.GoalsPage,{ctx:ctx(save({status:"RETIRED"}))}),[[key("goals"),data]]),t=text(html);
  assert.match(t,/Retired Career/);assert.match(t,/no further sporting progress/);
  assert.doesNotMatch(t,/Select goal|Abandon without penalty/);assert.match(html,/<select[^>]*disabled/);
  const summary=text(render(h(M.GoalsSummary,{saveId:SAVE_ID}),[[key("goals"),data]]));
  assert.match(summary,/Open Schedule/);assert.match(summary,/1 active goals/);assert.match(summary,/Win a Career title/);assert.match(summary,/Manage/);
});

test("A7.2 relationships render factual retired identity, H2H, cohorts, meetings, world context and no gameplay effects",()=>{
  const player={id:"fictional",name:"Fictional Opponent",nationality:"GBR",homeRegion:"Ayrshire",age:65,startingAge:20,createdSeason:1,retiredSeason:8,status:"RETIRED",worldRanking:null};
  const meeting={id:"m1",opponentId:player.id,eventId:"event-one",name:"Fictional Final",season:2,day:7,date:"2027-01-06",round:4,stage:"MAIN",won:true,final:true,major:true,qualification:false,legsHuman:6,legsNpc:3,setsHuman:null,setsNpc:null,humanAge:21};
  const opponent={player,labels:["Career Rival","Q-School Class"],evidence:["Repeated competitive meetings."],meetings:6,humanWins:4,npcWins:2,winPercentage:66.67,eventCount:6,seasonCount:2,finals:1,majorMeetings:1,qualificationMeetings:0,firstMeeting:meeting,latestMeeting:meeting,history:[meeting],cohorts:[{opponentId:player.id,kind:"Q-School Class",season:1,session:"q-school-first-uk",name:"UK first session"}]};
  const data={careerSaveId:SAVE_ID,opponents:[opponent],world:{players:[player],active:0,retired:1,newEntrants:0,youngPlayers:0,youngAgeMaximum:23}};
  const html=render(h(M.RelationshipsPage,{ctx:ctx(save({status:"RETIRED"}))}),[[key("relationships"),data]]);
  const t=text(html);
  for (const s of ["Fictional Opponent","H2H 4–2","66.67% wins","Career Rival","Q-School Class","Retired (season 8)","No current World Ranking","Legs 6–3","Fictional Final","never change scoring","Career generations"]) assert.ok(t.includes(s),s);
  assert.ok(html.includes(`/career/${SAVE_ID}/events/event-one`));
  assert.ok(!/Rivalry Score|Potential|Current ability/.test(t));
  const empty=text(render(h(M.RelationshipsPage,{ctx:ctx()}),[[key("relationships"),{...data,opponents:[],world:{...data.world,players:[]}}]]));
  assert.ok(empty.includes("No opponent history here yet"));
});

// ---------------------------------------------------------------- saves
test("save selection: three slots, empty slot, archive and lifecycle actions", () => {
  const list = { slots: [{ slotNumber: 1, career: save({ careerName: "Progressed", professionalRanking: 42, hasTourCard: true, sponsor: "Ochre Darts Co." }) },
    { slotNumber: 2, career: save({ id: "22222222-2222-4222-8222-222222222222", slotNumber: 2, careerName: "Fresh" }) }, { slotNumber: 3, career: null }],
    archived: [save({ id: "33333333-3333-4333-8333-333333333333", careerName: "Old Career", status: "RETIRED", retiredAt: "2026-10-04", slotNumber: 3 })] };
  const t = text(render(h(M.SavesPage), [[["career", "saves"], list]], "/career"));
  for (const s of ["Slot 1", "Slot 2", "Slot 3", "Empty slot", "New Career", "Progressed", "42nd", "Ochre Darts Co.", "Unranked", "Self-funded", "Old Career", "View record", "Retired archive"]) assert.ok(t.includes(s), s);
  assert.equal((t.match(/Continue/g) ?? []).length, 2, "Continue on each active slot only");
  for (const s of ["Restart", "Retire", "Delete"]) assert.ok(t.includes(s), s);
  assert.ok(t.includes("Classic Tour / Trophy Hunt"), "Career is presented as separate from Classic Tour");
});

test("save selection: feature-gated 404 shows an honest unavailable state", () => {
  const t = text(render(h(M.SavesPage), [], "/career", [[["career", "saves"], new M.ApiRequestError("Career not available", 404, "/api/career/saves")]]));
  assert.ok(t.includes("Career is not available yet"), t.slice(0, 600));
});

// ---------------------------------------------------------------- home
test("Career Home, new amateur: unranked, no Tour Card, self-funded, affordable Enter", () => {
  const s = save();
  const t = text(render(h(M.HomePage, { ctx: ctx(s) }), homeSeed(s, [event({ name: "Newcastle Friday Night 501" })])));
  for (const x of ["Newcastle Friday Night 501", "Enter · £65", "Unranked", "No Tour Card", "Self-funded", "£250", "Nothing entered", "No results yet"]) assert.ok(t.includes(x), x);
});

test("Career Home: unaffordable next event says Cannot afford and offers no Enter", () => {
  const s = save();
  const e = event({ name: "Vault Qualifier", human: human({ canEnter: false, denials: ["INSUFFICIENT_FUNDS"] }), finance: { affordable: false, estimatedPlayerCostPence: 69000 } });
  const html = render(h(M.HomePage, { ctx: ctx(s) }), homeSeed(s, [e]));
  assert.ok(text(html).includes("Cannot afford"));
  assert.ok(!/>\s*Enter/.test(html), "no Enter button");
});

test("Career Home, ranked professional with sponsor and a pending match: real figures and the live Play match action (A6.5)", () => {
  const s = save({ currentWeek: 12, professionalRanking: 42, hasTourCard: true });
  const live = event({ name: "Pro Circuit Championship 9", status: "IN_PROGRESS", dates: { startWeek: 12, startDay: 79 }, human: human({ relationship: "PLAYING", canEnter: false }) });
  const seed = homeSeed(s, [live], sporting("RANKED_PRO"), finance({ balancePence: 1469000, sponsor: { contractId: "c", sponsorKey: "ochre", displayName: "Ochre Darts Co.", tier: "REGIONAL", endSeason: 1, endWeek: 52 } }));
  seed[3] = [seed[3][0], { overview: overview({ week: 12, pendingHumanMatches: [{ matchId: "m1", eventId: live.id }] }), season: 1, scope: "WORLD", events: [live] }];
  seed.push([key("event", live.id), eventDetail(live, { human: { nextMatch: { id: "m1", stage: "main", round: 1, roundName: "LAST_128", slot: 31, bestOf: 11, scheduledDay: 79,
    a: { key: "HUMAN", name: "You" }, b: { key: "npc", name: "Arno Auenberg" }, status: "AWAITING_HUMAN", winnerKey: null, legs: null, firstThrow: null, firstThrowMethod: "BULL_UP", resultSource: null, summary: null }, result: null } })]);
  const html = render(h(M.HomePage, { ctx: ctx(s, overview({ week: 12, pendingHumanMatches: [{ matchId: "m1", eventId: live.id }] })) }), seed);
  const t = text(html);
  assert.match(html, /aria-label="Down 3"/);
  for (const x of ["42nd", "Career high 20th", "£14,690", "Active", "Ochre Darts Co.", "Your match is waiting", "You vs Arno Auenberg", "Play match", "checked by the server"]) assert.ok(t.includes(x), x);
  // A6.5: a real link into the live session route (GameScorer); never a client-reported result and no stale "not connected" copy.
  assert.match(html, new RegExp(`href="/career/${SAVE_ID}/matches/m1/play"`), "Play match opens the live Career session");
  assert.ok(!t.includes("not connected yet"), "no stale A6 boundary copy");
});

test("retired Career Home is read-only: no next-event hero, no Enter, no Continue", () => {
  const s = save({ status: "RETIRED", retiredAt: "2026-10-04T05:39:45Z" });
  const html = render(h(M.HomePage, { ctx: ctx(s) }), homeSeed(s, [event()]));
  const t = text(html);
  assert.ok(t.includes("Career record") && t.includes("Retired"));
  assert.ok(!/>\s*Enter/.test(html));
  assert.ok(!t.includes("Open for entry"));
});

test("retired Career shell shows the read-only notice and no advance control", () => {
  const s = save({ status: "RETIRED", retiredAt: "2026-10-04" });
  const t = text(render(h(M.CareerShell, { saveId: SAVE_ID, children: () => h("p", null, "child") }),
    [[key("save"), s], [key("calendar", { scope: "WORLD", fromWeek: 1, toWeek: 1 }), { overview: overview(), season: 1, scope: "WORLD", events: [] }]]));
  assert.ok(t.includes("This Career is retired"));
  assert.ok(!t.includes("Continue"));
  assert.ok(t.includes("child"));
});

// ---------------------------------------------------------------- rankings
test("Rankings default to Around Me, highlight the human and draw A5 cut lines", () => {
  const meta = rankingMeta();
  const rows = [30, 31, 32, 33, 42].map(p => p === 42 ? row(42, { participantKey: "HUMAN", kind: "HUMAN", name: null, nationality: null, movement: -3 }) : row(p, { movement: 2 }));
  const html = render(h(M.RankingsPage, { ctx: ctx() }), [[key("ranking-lists"), [meta]],
    [key("ranking", "pro-world", { view: "AROUND", participant: "HUMAN", radius: 6 }), { list: "pro-world", name: "World Ranking", view: "AROUND", published: meta.published, participant: { key: "HUMAN", position: 42 }, rows }],
    [key("ranking-history", "pro-world", "HUMAN", 12), { list: "pro-world", participantKey: "HUMAN", careerHigh: { position: 20, publicationIndex: 6 }, seasonHighs: [], snapshots: [] }]]);
  const t = text(html);
  assert.match(html, /aria-pressed="true"[^>]*>Around me/);
  assert.match(html, /data-me="true"/);
  assert.ok(t.includes("Top 32 cut"), "cut line after position 32");
  for (const x of ["42nd", "Top 32", "£3,000 behind", "Player 30"]) assert.ok(t.includes(x), x);
  assert.ok(!/ability|potential/i.test(t), "no hidden NPC attributes");
});

test("Rankings for an unranked player default to the top of the table", () => {
  const meta = rankingMeta({ human: { ranked: false, standing: null, careerHighPosition: null, seasonHighPosition: null, cutLines: [] } });
  const t = text(render(h(M.RankingsPage, { ctx: ctx() }), [[key("ranking-lists"), [meta]],
    [key("ranking", "pro-world", { view: "TOP", limit: 32 }), { list: "pro-world", name: "World Ranking", published: meta.published, participant: null, rows: [row(1), row(2)] }]]));
  assert.ok(t.includes("Unranked"));
  assert.ok(!t.includes("Around me"));
});

// ---------------------------------------------------------------- Q-School
test("Q-School shows pathways, standing vs card line and an unmistakable Tour Card result", () => {
  const uk = pathway({ finalStage: { days: 4, completed: 4, dayWinners: [{ day: 1, status: "COMPLETED", winner: "HUMAN" }] },
    participant: { firstStage: [{ day: 1, position: 1 }], finalStageEntry: { route: "EVENT_RESULT", detail: null }, wonDay: [1], orderOfMerit: { position: 10, contenderPosition: 0, points: 9, insideCardLine: true } },
    standings: [{ participantKey: "npc", position: 1, points: 16, bestDayFinish: 1, scoringDays: 4, name: "Callan Thistledown", dayWinner: true },
      { participantKey: "HUMAN", position: 10, points: 9, bestDayFinish: 1, scoringDays: 2, name: "You", dayWinner: true }],
    allocation: { allocatedWeek: 3, directCards: 4, unusedDirectCards: 0, orderOfMeritCards: 10, awards: [{ participantKey: "HUMAN", name: "You", route: "DIRECT", day: 1, orderOfMeritPosition: null, points: 9, cardId: "c" }] } });
  const eu = pathway({ pathway: "EUROPE", cardLine: { orderOfMeritCards: 6, valueAtLinePoints: 9 } });
  const t = text(render(h(M.QSchoolPage, { ctx: ctx() }), [[key("q-school", 1), { season: 1, participantKey: "HUMAN", tieBreaks: ["POINTS_DESC"], pathways: [uk, eu] }],
    [key("calendar", { scope: "WORLD", season: 1, circuit: "Q_SCHOOL" }), { overview: overview(), season: 1, scope: "WORLD", events: [] }]]));
  for (const x of ["UK & Ireland · yours", "Europe", "Tour Card won — Final Stage Day 1 winner", "Not a contender — card already won", "Callan Thistledown", "Day winner — card", "Order of Merit"]) assert.ok(t.includes(x), x);
});

test("Q-School before any participation: Not entered, outside-the-pathway facts only", () => {
  const t = text(render(h(M.QSchoolPage, { ctx: ctx() }), [[key("q-school", 1), { season: 1, participantKey: "HUMAN", tieBreaks: [], pathways: [pathway(), pathway({ pathway: "EUROPE" })] }],
    [key("calendar", { scope: "WORLD", season: 1, circuit: "Q_SCHOOL" }), { overview: overview(), season: 1, scope: "WORLD", events: [] }]]));
  assert.ok(t.includes("Not entered"));
  assert.ok(t.includes("No Final Stage results yet"));
  assert.ok(!t.includes("Tour Card result"));
});

// ---------------------------------------------------------------- finance
test("Finances: four separate headline figures, sponsor terms and no money-buying actions", () => {
  const terms = { sponsorKey: "ochre", displayName: "Ochre Darts Co.", tier: "REGIONAL", duration: { kind: "REMAINDER_OF_SEASON" }, signingBonusPence: 50000, eventPayment: null,
    coverage: [{ costTypes: ["ENTRY_FEE"], percent: 100, perEventCapPence: 5000, seasonCapPence: null, circuits: null }], performanceBonuses: [], renewalRequirement: null, retentionRequirement: null, presentation: { colour: "#c08a3e" } };
  const html = render(h(M.FinancesPage, { ctx: ctx() }), [
    [key("finance"), finance({ balancePence: 1469000, careerEarningsPence: 1200000, sponsorEarningsPence: 95000, careerExpensesPence: 351000 })],
    [key("sponsors"), { active: { id: "c", sponsorKey: "ochre", tier: "REGIONAL", terms, status: "ACTIVE", endReason: null, start: { season: 1, week: 2 }, end: { season: 1, week: 52 }, totals: { paidPence: 95000, coveredPence: 35000 } },
      offers: [{ id: "o1", sponsorKey: "iron", tier: "PROFESSIONAL", kind: "NEW", terms: { ...terms, displayName: "Ironflight" }, status: "OFFERED", statusReason: null, offered: { season: 1, week: 5 }, expires: { season: 1, week: 9 } }],
      history: { contracts: [], offers: [] } }],
    [key("calendar", { scope: "MY_SCHEDULE", season: 1 }), { overview: overview(), season: 1, scope: "MY_SCHEDULE", events: [] }],
    [key("ledger", 25, null), { entries: [{ id: "l1", category: "PRIZE", headline: "INCOME", amountPence: 150000, direction: "CREDIT", season: 1, week: 10, eventId: null, grossAmountPence: null, sponsorCoveredPence: 0, reason: "Prize money — Pro Circuit Championship 8", createdAt: "x" }], next: null }]]);
  const t = text(html);
  for (const x of ["Balance", "£14,690", "Career Earnings", "£12,000", "Sponsor Earnings", "£950", "Career Expenses", "£3,510", "Ochre Darts Co.", "Signing bonus £500", "Ironflight", "Accept", "Decline", "+£1,500"]) assert.ok(t.includes(x), x);
  assert.ok(!/coins?|buy|loan|debt|bet/i.test(t.replace(/Accept|Decline/g, "")), "no coin conversion, purchase, loan, debt or betting");
});

test("Finances: no sponsor and no offers are explicit empty states", () => {
  const t = text(render(h(M.FinancesPage, { ctx: ctx() }), [[key("finance"), finance()], [key("sponsors"), { active: null, offers: [], history: { contracts: [], offers: [] } }],
    [key("calendar", { scope: "MY_SCHEDULE", season: 1 }), { overview: overview(), season: 1, scope: "MY_SCHEDULE", events: [] }], [key("ledger", 25, null), { entries: [], next: null }]]));
  for (const x of ["Self-funded", "No offers right now", "No upcoming commitments", "No transactions on this page"]) assert.ok(t.includes(x), x);
});

// ---------------------------------------------------------------- event
test("unsupported event (World Championship) is presented as not playable, with no Enter and no fabricated draw", () => {
  const wc = event({ name: "World Darts Championship", presentation: { tier: "WORLD" }, circuit: "WORLD_CHAMPIONSHIP", status: "SCHEDULED", capability: { executable: false, code: "UNSUPPORTED_FORMAT", reasons: ["SET_PLAY"] },
    format: { scoringUnit: "SETS", stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound: [3, 13] }] }, human: human({ canEnter: false, denials: ["REGISTRATION_NOT_OPEN", "UNSUPPORTED_FORMAT"] }) });
  const html = render(h(M.EventView, { ctx: ctx(), detail: eventDetail(wc) }), []);
  const t = text(html);
  for (const x of ["Format not playable yet", "Not playable yet", "best of 3–13 sets", "Format not yet playable"]) assert.ok(t.includes(x), x);
  assert.ok(!/>\s*Enter/.test(html));
  assert.ok(!t.includes(">Draw<") && !/aria-pressed="false"[^>]*>Draw</.test(html), "no Draw tab without a persisted draw");
});

test("entered event offers Withdraw; completed event shows the persisted result", () => {
  const entered = event({ human: human({ relationship: "ENTERED", canEnter: false, entryStatus: "ENTERED", denials: ["ALREADY_ENTERED"] }) });
  assert.ok(text(render(h(M.EventView, { ctx: ctx(), detail: eventDetail(entered) }), [])).includes("Withdraw"));
  const done = event({ status: "COMPLETED", human: human({ relationship: "COMPLETED", canEnter: false, result: { finishingPosition: 2, stageReached: "FINAL", champion: false } }) });
  const t = text(render(h(M.EventView, { ctx: ctx(), detail: eventDetail(done, { results: [
    { participantKey: "npc", name: "Callan Thistledown", position: 1, stageReached: "CHAMPION", champion: true, wins: 5, losses: 0, legsFor: 25, legsAgainst: 9 },
    { participantKey: "HUMAN", name: "You", position: 2, stageReached: "FINAL", champion: false, wins: 4, losses: 1, legsFor: 20, legsAgainst: 15 }] }) }), []));
  for (const x of ["Callan Thistledown", "Runner-up", "4W 1L"]) assert.ok(t.includes(x), x);
  assert.ok(!t.includes("Withdraw"));
});

// ---------------------------------------------------------------- history
test("Trophy room is Career-only and states its separation from the Classic Tour trophies", () => {
  const won = [{ eventId: "e1", season: 1, name: "Kilbirnie Friday Night 501", definitionKey: "k", circuit: "GRASSROOTS", classification: "RANKING", presentationTier: "LOCAL", week: 3,
    country: "GBR", participantKey: "HUMAN", position: 1, stageReached: "CHAMPION", champion: true, wins: 5, losses: 0 }];
  const t = text(render(h(M.HistoryPage, { ctx: ctx(), initialTab: "TROPHIES" }), [[key("facts"), { results: won }]]));
  assert.ok(t.includes("Kilbirnie Friday Night 501"));
  assert.ok(t.includes("Separate from the Classic Tour's 305 Trophy Hunt trophies"));
  const empty = text(render(h(M.HistoryPage, { ctx: ctx(), initialTab: "TROPHIES" }), [[key("facts"), { results: [] }]]));
  assert.ok(empty.includes("The cabinet is empty"));
});

// ---------------------------------------------------------------- mutations (real endpoints, mocked transport)
test("every Career mutation hits the real A1–A5 endpoint with the right method and body", async () => {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (init.method === "DELETE" && /\/saves\/[^/]+$/.test(url)) return new Response(null, { status: 204 });
    const payload = /\/saves$|restart$/.test(url) ? { id: "new-save" } : { ok: true, entered: true, withdrawn: true, denials: [] };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const r = M.careerRequests;
    await r.enter("s", "e"); await r.withdraw("s", "e"); await r.acceptOffer("s", "o"); await r.declineOffer("s", "o");
    await r.advance("s", { season: 1, week: 12, target: { kind: "NEXT_MEANINGFUL" } }, "ui-fixed-key");
    assert.equal((await r.create({ slot: 3, careerName: "New" })).id, "new-save");
    assert.equal((await r.restart("s")).id, "new-save", "restart adopts the NEW save id");
    await r.retire("s"); assert.equal(await r.remove("s"), null);
    assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
      "POST /api/career/saves/s/events/e/entry", "DELETE /api/career/saves/s/events/e/entry",
      "POST /api/career/saves/s/sponsors/offers/o/accept", "POST /api/career/saves/s/sponsors/offers/o/decline",
      "POST /api/career/saves/s/calendar/advance",
      "POST /api/career/saves", "POST /api/career/saves/new-save/initialize",
      "POST /api/career/saves/s/restart", "POST /api/career/saves/new-save/initialize",
      "POST /api/career/saves/s/retire", "DELETE /api/career/saves/s"]);
    assert.deepEqual(calls[4].body, { operationKey: "ui-fixed-key", expectedSeason: 1, expectedWeek: 12, target: { kind: "NEXT_MEANINGFUL" } });
    assert.deepEqual(calls[5].body, { slot: 3, careerName: "New" });
    assert.ok(!Object.keys(r).some(k => /result|score|record/i.test(k)), "no client path to report a human match result");
  } finally { globalThis.fetch = original; }
});

test("Career delete rejects on HTTP errors and network failures instead of reporting success", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "Career save not found" }), { status: 404 })) as typeof fetch;
    await assert.rejects(M.careerRequests.remove("s"), (e: { status?: number; message?: string }) => e.status === 404 && e.message === "Career save not found");
    globalThis.fetch = (async () => { throw new TypeError("network down"); }) as typeof fetch;
    await assert.rejects(M.careerRequests.remove("s"), /network down/);
  } finally { globalThis.fetch = original; }
});
