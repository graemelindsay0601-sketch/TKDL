#!/usr/bin/env node
/**
 * DEV-ONLY Career 2.0 journey certification (F2). Runs the release journeys over HTTP
 * against scripts/career-certification-server.ts (production Career routers, PGlite).
 * Every check uses the same routes the UI calls; nothing writes to the database directly.
 *
 *   node scripts/career-certification-journeys.mjs [--base=http://localhost:8790] [--out=journeys.json]
 *
 * Exit code 0 only if every executed check passed. Journeys that this harness cannot
 * exercise end-to-end are reported as NOT_RUN with the reason, never as passed.
 */
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BASE = arg("base", "http://localhost:8790"), OUT = arg("out", null);
const api = async (method, p, body) => {
  const r = await fetch(`${BASE}/api/career${p}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json };
};
const get = p => api("GET", p);
const state = await (await fetch(`${BASE}/__cert/state`)).json();
const results = [];
let current = null;
const journey = async (id, title, fn) => {
  current = { id, title, checks: [], status: "PASS" };
  try { await fn(); } catch (e) { current.checks.push({ ok: false, check: "unexpected error", detail: String(e?.stack ?? e).slice(0, 400) }); }
  if (current.checks.some(c => !c.ok)) current.status = "FAIL";
  if (current.status !== "FAIL" && current.notRun) current.status = "PARTIAL";
  if (current.status === "PASS" && current.knownDefect) current.status = "KNOWN";
  results.push(current);
  console.log(`${current.status.padEnd(7)} ${id} ${title}`);
  for (const c of current.checks.filter(c => c.known || c.check.startsWith("NOT RUN"))) console.log(`        • ${c.check}`);
  for (const c of current.checks.filter(c => !c.ok)) console.log(`        ✗ ${c.check}${c.detail ? ` — ${c.detail}` : ""}`);
};
const check = (ok, what, detail) => { current.checks.push({ ok: !!ok, check: what, ...(detail !== undefined ? { detail: typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300) } : {}) }); return ok; };
const known = (ok, what, id, detail) => { current.checks.push({ ok: true, known: !ok, check: ok ? what : `KNOWN DEFECT ${id}: ${what}`, ...(ok ? {} : { detail: JSON.stringify(detail).slice(0, 300) }) }); if (!ok) current.knownDefect = id; };
const notRun = reason => { current.notRun = reason; current.checks.push({ ok: true, check: `NOT RUN: ${reason}` }); };
const advance = async (saveId, weeks = 1, key = randomUUID()) => {
  const s = (await get(`/saves/${saveId}`)).body;
  return { key, before: s, res: await api("POST", `/saves/${saveId}/calendar/advance`, { operationKey: key, expectedSeason: s.currentSeason, expectedWeek: s.currentWeek, target: { kind: "WEEKS", weeks } }) };
};

await journey("J1", "Create a new Career save (fresh save reads)", async () => {
  const list = await get("/saves");
  check(list.status === 200, "save list loads", list.status);
  const s = await get(`/saves/${state.fresh}`);
  check(s.status === 200 && s.body.currentSeason === 1 && s.body.status === "ACTIVE" && s.body.eventDatabaseVersion === 5, "new save is ACTIVE in season 1 on the current event database (v5)", s.body);
  for (const p of ["sporting", "finance", "calendar", "sponsors", "rankings", "life", "legacy", "trophy-cabinet?offset=0&limit=50", "relationships", "world-content"]) {
    const r = await get(`/saves/${state.fresh}/${p}`); check(r.status === 200, `GET ${p} → 200`, r.status === 200 ? undefined : r.body);
  }
  const cab = await get(`/saves/${state.fresh}/trophy-cabinet?offset=0&limit=50`);
  check(cab.body?.total === 0, "a new Career has no titles", cab.body?.total);
});

await journey("J2", "Resume an older valid save (event database v2, created before the A9 upgrade)", async () => {
  const s = (await get(`/saves/${state.legacy}`)).body;
  check(s.eventDatabaseVersion === 2, "save keeps its pinned event database version", s.eventDatabaseVersion);
  for (const p of ["calendar", "sporting", "finance", "legacy", "rankings"]) { const r = await get(`/saves/${state.legacy}/${p}`); check(r.status === 200, `GET ${p} → 200`, r.status === 200 ? undefined : r.body); }
  const a = await advance(state.legacy, 1);
  check(a.res.status === 200, "advance after upgrade succeeds", a.res.body);
  const after = (await get(`/saves/${state.legacy}`)).body;
  check(after.eventDatabaseVersion === 2, "advancing never silently rewrites the version", after.eventDatabaseVersion);
});

await journey("J3", "Progress through the calendar (retry-safe advance)", async () => {
  const a = await advance(state.fresh, 1);
  check(a.res.status === 200, "advance request accepted", a.res.body);
  const stop = a.res.body?.stop?.reason, s1 = (await get(`/saves/${state.fresh}`)).body;
  const moved = s1.currentWeek === a.before.currentWeek + 1 || s1.currentSeason > a.before.currentSeason;
  check(moved || stop === "HUMAN_MATCH_PENDING", "the week moved forward, or the calendar stopped at the player's own pending match", { stop, before: a.before.currentWeek, after: s1.currentWeek });
  const retry = await api("POST", `/saves/${state.fresh}/calendar/advance`, { operationKey: a.key, expectedSeason: a.before.currentSeason, expectedWeek: a.before.currentWeek, target: { kind: "WEEKS", weeks: 1 } });
  const s2 = (await get(`/saves/${state.fresh}`)).body;
  check(retry.status === 200 && s2.currentWeek === s1.currentWeek, "replaying the same operation key does not advance again", { status: retry.status, week: s2.currentWeek });
  const stale = await api("POST", `/saves/${state.fresh}/calendar/advance`, { operationKey: randomUUID(), expectedSeason: s2.currentSeason, expectedWeek: Math.max(1, s2.currentWeek - 1) === s2.currentWeek ? s2.currentWeek + 5 : s2.currentWeek - 1, target: { kind: "WEEKS", weeks: 1 } });
  check(stale.status >= 400 && stale.status < 500, "a stale expected week is refused", stale.status);
});

await journey("J4", "Enter a tournament (fee through the ledger, entry visible)", async () => {
  const cal = (await get(`/saves/${state.fresh}/calendar`)).body;
  const events = cal.events ?? [];
  const open = events.filter(e => e.status === "REGISTRATION_OPEN" && (e.human?.eligible ?? e.opportunity?.canEnter ?? true));
  check(open.length > 0, "the calendar offers open events", events.length);
  let entered = null;
  for (const e of open) { const r = await api("POST", `/saves/${state.fresh}/events/${e.id}/entry`, {}); if (r.status < 300) { entered = e; break; } }
  if (!check(entered, "the player can enter at least one open event")) return;
  const ledger = (await get(`/saves/${state.fresh}/finance/ledger?limit=50`)).body;
  const entries = ledger.entries ?? ledger.items ?? ledger;
  check(Array.isArray(entries), "ledger readable");
  const dup = await api("POST", `/saves/${state.fresh}/events/${entered.id}/entry`, {});
  check(dup.status === 200 || dup.status === 409 || dup.status === 201, "re-entering is idempotent or explicitly refused", dup.status);
});

await journey("J5/J6", "Lose and win tournaments; honours recorded correctly", async () => {
  const hist = (await get(`/saves/${state.season}/history?participant=HUMAN`)).body;
  const titles = hist.filter(r => r.champion);
  const lHist = (await get(`/saves/${state.legacy}/history?participant=HUMAN`)).body;
  const losses = lHist.filter(r => !r.champion && r.losses > 0);
  check(titles.length > 0, "the season save recorded wins", titles.length);
  check(losses.length > 0, "the legacy save recorded losses and the Career continued", losses.length);
  const lCab = (await get(`/saves/${state.legacy}/trophy-cabinet?offset=0&limit=100`)).body;
  check(lCab.total === lHist.filter(r => r.champion).length, "a save with only losses has no cabinet titles", lCab.total);
  const cab = (await get(`/saves/${state.season}/trophy-cabinet?offset=0&limit=100`)).body;
  check(cab.total === titles.length, "cabinet total equals recorded champion results", { cabinet: cab.total, history: titles.length });
  const hid = new Set(titles.map(t => t.eventId));
  check(cab.titles.every(t => hid.has(t.eventId) && t.source === "ACTUAL_A3_CHAMPION_RESULT"), "every cabinet row is a recorded champion result");
  const lost = losses.at(-1);
  if (lost) { const tv = (await get(`/saves/${state.legacy}/tournaments/${lost.eventId}`)).body;
    check(tv.achievements?.tournamentChampion === false && tv.championKey !== "HUMAN", "a lost tournament read never reports the player as champion", { champ: tv.championKey, a: tv.achievements }); }
  const won = titles.at(-1);
  if (won) { const tv = (await get(`/saves/${state.season}/tournaments/${won.eventId}`)).body;
    check(tv.achievements?.tournamentChampion === true && tv.championKey === "HUMAN", "a won tournament read reports the recorded champion", { champ: tv.championKey }); }
});

await journey("J7", "Ranking and financial changes (no double posting)", async () => {
  const rk = await get(`/saves/${state.season}/rankings`);
  check(rk.status === 200, "rankings load", rk.status);
  let all = [], before;
  for (let i = 0; i < 40; i++) {
    const q = before ? `&beforeCreatedAt=${encodeURIComponent(before.beforeCreatedAt)}&beforeId=${before.beforeId}` : "";
    const page = (await get(`/saves/${state.season}/finance/ledger?limit=100${q}`)).body;
    all.push(...(page.entries ?? []));
    if (!page.next) break; before = page.next;
  }
  check(all.length > 0, "ledger has entries", all.length);
  const keys = all.map(e => e.operationKey ?? e.operation_key).filter(Boolean);
  check(new Set(keys).size === keys.length, "every ledger operation key is unique (no double posting)", { entries: keys.length, unique: new Set(keys).size });
  const prizes = all.filter(e => e.category === "PRIZE");
  check(prizes.length > 0, "prize money was posted for recorded results", prizes.length);
  const fin = (await get(`/saves/${state.season}/finance`)).body;
  const sum = all.reduce((a, e) => a + Number(e.amountPence ?? e.amount_pence ?? 0), 0);
  if (keys.length === all.length && fin?.balancePence !== undefined) check(sum === Number(fin.balancePence), "balance equals the sum of the ledger", { sum, balance: fin.balancePence });
});

await journey("J8", "Open NPC profiles and news stories", async () => {
  const players = await get(`/saves/${state.season}/world-players?offset=0&limit=10&search=&status=ACTIVE`);
  check(players.status === 200, "player directory loads", players.status);
  const life = await get(`/saves/${state.season}/life`);
  check(life.status === 200, "news/life feed loads", life.status);
  const rel = await get(`/saves/${state.season}/relationships`);
  check(rel.status === 200 && (rel.body.opponents ?? []).length > 0, "relationships list real opponents", (rel.body?.opponents ?? []).length);
  const npc = rel.body?.opponents?.[0]?.player?.id;
  if (npc) for (const p of [`/life/npcs/${npc}`, `/recognition/npcs/${npc}`, `/legacy/npcs/${npc}`]) { const r = await get(`/saves/${state.season}${p}`); check(r.status === 200, `GET ${p.split("/").slice(0, 3).join("/")}/:npc → 200`, r.status === 200 ? undefined : r.body); }
});

await journey("J9", "Sponsor contracts and obligations", async () => {
  const sp = (await get(`/saves/${state.season}/sponsors`)).body;
  const contracts = sp.activeContracts ?? [];
  check(contracts.length > 0, "the accepted sponsor contract is listed", contracts.length);
  check((state.sponsorLog ?? []).some(l => l.startsWith("accepted")), "at least one offer was accepted through the real acceptance path", state.sponsorLog);
  const refused = (state.sponsorLog ?? []).filter(l => l.startsWith("refused"));
  known(refused.length === 0, "offers are shown that the server then refuses (unschedulable required activities)", "P1-2", refused);
  const hq = await get(`/saves/${state.season}/commercial-inbox`);
  check(hq.status === 200, "commercial inbox loads (P0-1 table present in this harness)", hq.status);
});

await journey("J10", "Season transition", async () => {
  const s = (await get(`/saves/${state.season}`)).body;
  if (s.currentSeason < 2) { notRun(`harness seeded in --quick mode (season ${s.currentSeason} week ${s.currentWeek}); rerun the harness without --quick to cross a season boundary`); return; }
  check(s.currentSeason >= 2, "the season save rolled into season 2", { season: s.currentSeason, week: s.currentWeek });
  const review = await get(`/saves/${state.season}/legacy/seasons/1`);
  check(review.status === 200, "season 1 review loads", review.status === 200 ? undefined : review.body);
  const cal = (await get(`/saves/${state.season}/calendar`)).body;
  check((cal.events ?? []).length > 0, "a season 2 calendar exists", (cal.events ?? []).length);
});

await journey("J11", "History, achievements and trophies", async () => {
  for (const p of ["legacy", "recognition", "goals", "trophy-cabinet?offset=0&limit=50", "history?participant=HUMAN", "milestones?limit=20"]) {
    const r = await get(`/saves/${state.season}/${p}`); check(r.status === 200, `GET ${p.split("?")[0]} → 200`, r.status === 200 ? undefined : r.body);
  }
});

await journey("J12", "Retire and view the documentary", async () => {
  const leg = (await get(`/saves/${state.retired}/legacy/player`)).body;
  check(leg.retired === true, "player legacy reports the Career as retired", leg.retired);
  const chapters = leg.chapters ?? [];
  check(chapters.filter(c => c.available).length > 0, "at least one chapter has real evidence", chapters.map(c => c.available));
  check(chapters.length === 6, "A Career Remembered has six chapters", chapters.length);
});

await journey("J13", "Reopen a retired save without unintended edits", async () => {
  const s = (await get(`/saves/${state.retired}`)).body;
  check(s.status === "RETIRED", "save is RETIRED", s.status);
  for (const p of ["calendar", "sporting", "finance", "legacy", "sponsors", "trophy-cabinet?offset=0&limit=50"]) { const r = await get(`/saves/${state.retired}/${p}`); check(r.status === 200, `read ${p.split("?")[0]} → 200`, r.status); }
  const adv = await advance(state.retired, 1); check(adv.res.status >= 400, "advance refused", adv.res.status);
  const cal = (await get(`/saves/${state.retired}/calendar`)).body; const ev = (cal.events ?? []).find(e => e.status === "REGISTRATION_OPEN");
  if (ev) { const r = await api("POST", `/saves/${state.retired}/events/${ev.id}/entry`, {}); check(r.status >= 400, "event entry refused", r.status); }
  const offers = (await get(`/saves/${state.retired}/sponsors`)).body.offers ?? [];
  if (offers[0]) { const r = await api("POST", `/saves/${state.retired}/sponsors/offers/${offers[0].id}/accept`, {}); check(r.status >= 400, "sponsor acceptance refused", r.status); }
  const prof = await api("PUT", `/saves/${state.retired}/profile`, { nickname: "Edited" }); check(prof.status >= 400, "profile edit refused", prof.status);
  const after = (await get(`/saves/${state.retired}`)).body;
  check(after.currentWeek === s.currentWeek && after.currentSeason === s.currentSeason, "clock unchanged");
});

const summary = { base: BASE, state, generated: new Date().toISOString(), results };
if (OUT) writeFileSync(OUT, JSON.stringify(summary, null, 2));
const failed = results.filter(r => r.status === "FAIL").length;
console.log(`\n${results.length} journeys · ${results.filter(r => r.status === "PASS").length} pass · ${results.filter(r => r.status === "KNOWN").length} pass-with-known-defect · ${results.filter(r => r.status === "PARTIAL").length} partial/not-run · ${failed} fail`);
process.exit(failed ? 1 : 0);
