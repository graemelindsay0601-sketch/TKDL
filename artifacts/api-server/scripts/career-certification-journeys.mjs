#!/usr/bin/env node
/**
 * DEV-ONLY Career 2.0 release-candidate certification journeys. Runs the 15 release scenarios
 * over HTTP against scripts/career-certification-server.ts (production Career routers, PGlite).
 * Every check uses the routes the UI calls. The only writes are the player actions a scenario
 * names (enter, presentation edit, refused sponsor signings, advance, retire).
 *
 *   node scripts/career-certification-journeys.mjs [--base=http://localhost:8790] [--out=journeys.json]
 *
 * Each scenario reports PASS, FAIL or BLOCKED (with the reason). BLOCKED is never counted as a
 * pass. Exit code 0 only if every scenario passed.
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
const scenario = async (id, title, fn) => {
  current = { id, title, checks: [], status: "PASS" };
  try { await fn(); } catch (e) { current.checks.push({ ok: false, check: "unexpected error", detail: String(e?.stack ?? e).slice(0, 400) }); }
  if (current.checks.some(c => !c.ok)) current.status = "FAIL";
  else if (current.blocked) current.status = "BLOCKED";
  results.push(current);
  console.log(`${current.status.padEnd(7)} ${id.padEnd(4)} ${title}`);
  if (current.blocked) console.log(`        • BLOCKED: ${current.blocked}`);
  for (const c of current.checks.filter(c => !c.ok)) console.log(`        ✗ ${c.check}${c.detail ? ` — ${c.detail}` : ""}`);
};
const check = (ok, what, detail) => { current.checks.push({ ok: !!ok, check: what, ...(detail !== undefined ? { detail: typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300) } : {}) }); return ok; };
const block = reason => { current.blocked = reason; };
const advance = async (saveId, weeks = 1, key = randomUUID()) => {
  const s = (await get(`/saves/${saveId}`)).body;
  return { key, before: s, res: await api("POST", `/saves/${saveId}/calendar/advance`, { operationKey: key, expectedSeason: s.currentSeason, expectedWeek: s.currentWeek, target: { kind: "WEEKS", weeks } }) };
};
async function ledger(saveId) {
  const all = []; let before;
  for (let i = 0; i < 60; i++) {
    const q = before ? `&beforeCreatedAt=${encodeURIComponent(before.beforeCreatedAt)}&beforeId=${before.beforeId}` : "";
    const page = (await get(`/saves/${saveId}/finance/ledger?limit=100${q}`)).body;
    all.push(...(page.entries ?? [])); if (!page.next) break; before = page.next;
  }
  return all;
}
const seasonSave = (await get(`/saves/${state.season}`)).body;
const crossedSeason = seasonSave.currentSeason >= 2;

await scenario("S1", "Create a new Career", async () => {
  const list = await get("/saves");
  check(list.status === 200, "save list loads", list.status);
  const s = await get(`/saves/${state.fresh}`);
  check(s.status === 200 && s.body.currentSeason === 1 && s.body.currentWeek === 1 && s.body.status === "ACTIVE" && s.body.eventDatabaseVersion === 5,
    "the new save is ACTIVE at season 1 week 1 on the current event database (v5)", s.body);
  for (const p of ["sporting", "finance", "calendar", "sponsors", "rankings", "life", "legacy", "trophy-cabinet?offset=0&limit=50", "relationships", "world-content", "presentation"]) {
    const r = await get(`/saves/${state.fresh}/${p}`); check(r.status === 200, `GET ${p.split("?")[0]} → 200`, r.status === 200 ? undefined : r.body);
  }
  check((await get(`/saves/${state.fresh}/trophy-cabinet?offset=0&limit=50`)).body?.total === 0, "a new Career has no titles");
  check(state.steps?.includes("createCareerNpcSponsorMarketSPF") && state.steps?.includes("reapplyCareerLedgerConstraintSPE2AfterA9"), "the harness schema is the app.ts startup sequence including both repairs", state.steps);
});

await scenario("S2", "Resume an active Career", async () => {
  check(seasonSave.status === "ACTIVE", "the season save is ACTIVE", seasonSave.status);
  for (const p of ["calendar", "sporting", "finance", "sponsors", "rankings", "legacy", "tournaments", "presentation", "life"]) {
    const r = await get(`/saves/${state.season}/${p}`); check(r.status === 200, `GET ${p} → 200`, r.status === 200 ? undefined : r.body);
  }
  const again = (await get(`/saves/${state.season}`)).body;
  check(again.currentSeason === seasonSave.currentSeason && again.currentWeek === seasonSave.currentWeek, "reading a save never moves its clock");
});

await scenario("S3", "Resume a legacy Career (event database v2, created before the A9 upgrade)", async () => {
  const s = (await get(`/saves/${state.legacy}`)).body;
  check(s.eventDatabaseVersion === 2, "the save keeps its pinned event database version", s.eventDatabaseVersion);
  for (const p of ["calendar", "sporting", "finance", "legacy", "rankings", "presentation", "trophy-cabinet?offset=0&limit=50"]) {
    const r = await get(`/saves/${state.legacy}/${p}`); check(r.status === 200, `GET ${p.split("?")[0]} → 200`, r.status === 200 ? undefined : r.body);
  }
  const pres = (await get(`/saves/${state.legacy}/presentation`)).body;
  check(pres.identity && pres.identity.kitDesignId === undefined, "an older save without a premium kit ID keeps its original template shirt (no kit substituted)", pres.identity);
  const a = await advance(state.legacy, 1);
  check(a.res.status === 200, "advance after the upgrade succeeds", a.res.body);
  check((await get(`/saves/${state.legacy}`)).body.eventDatabaseVersion === 2, "advancing never silently rewrites the version");
});

await scenario("S4", "Enter and complete tournaments", async () => {
  const cal = (await get(`/saves/${state.fresh}/calendar`)).body;
  const open = (cal.events ?? []).filter(e => e.status === "REGISTRATION_OPEN");
  check(open.length > 0, "the calendar offers open events", (cal.events ?? []).length);
  let entered = null;
  for (const e of open) { const r = await api("POST", `/saves/${state.fresh}/events/${e.id}/entry`, {}); if (r.status < 300) { entered = e; break; } }
  if (check(entered, "the player can enter an open event")) {
    const dup = await api("POST", `/saves/${state.fresh}/events/${entered.id}/entry`, {});
    check([200, 201, 409].includes(dup.status), "re-entering is idempotent or explicitly refused", dup.status);
    const fees = (await ledger(state.fresh)).filter(e => e.category === "ENTRY_FEE");
    check(fees.length <= 1, "the entry fee posts at most once", fees.length);
  }
  const hist = (await get(`/saves/${state.season}/history?participant=HUMAN`)).body;
  check(hist.length > 0, "the season save completed tournaments", hist.length);
  const done = hist.at(-1); const tv = done && (await get(`/saves/${state.season}/tournaments/${done.eventId}`)).body;
  check(tv && ["CHAMPION", "ELIMINATED", "COMPLETE", "COMPLETED"].some(p => String(tv.phase).includes(p)), "a completed tournament reads as finished", tv?.phase);
});

await scenario("S5", "Verify winner and loser outcomes", async () => {
  const hist = (await get(`/saves/${state.season}/history?participant=HUMAN`)).body;
  const titles = hist.filter(r => r.champion), losses = hist.filter(r => !r.champion);
  check(titles.length > 0, "recorded wins exist", titles.length); check(losses.length > 0, "recorded losses exist", losses.length);
  const won = titles.at(-1), lost = losses.at(-1);
  if (won) { const tv = (await get(`/saves/${state.season}/tournaments/${won.eventId}`)).body;
    check(tv.achievements?.tournamentChampion === true && tv.championKey === "HUMAN", "a won tournament reports the recorded champion"); }
  if (lost) { const tv = (await get(`/saves/${state.season}/tournaments/${lost.eventId}`)).body;
    check(tv.achievements?.tournamentChampion !== true && tv.championKey !== "HUMAN", "a lost tournament never reports the player as champion", { champ: tv.championKey }); }
  const cab = (await get(`/saves/${state.season}/trophy-cabinet?offset=0&limit=100`)).body;
  check(cab.total === titles.length, "cabinet total equals recorded champion results", { cabinet: cab.total, history: titles.length });
  const ids = new Set(titles.map(t => t.eventId));
  check(cab.titles.every(t => ids.has(t.eventId) && t.source === "ACTUAL_A3_CHAMPION_RESULT"), "every cabinet row is a recorded champion result");
});

await scenario("S6", "Verify rankings and prize settlements", async () => {
  const lists = (await get(`/saves/${state.season}/rankings`)).body;
  check(Array.isArray(lists) && lists.length > 0, "ranking lists load", Array.isArray(lists) ? lists.length : lists);
  const all = await ledger(state.season);
  const keys = all.map(e => e.operationKey ?? e.operation_key).filter(Boolean);
  check(new Set(keys).size === keys.length, "every ledger operation key is unique (no double settlement)", { entries: keys.length, unique: new Set(keys).size });
  const prizes = all.filter(e => e.category === "PRIZE");
  check(prizes.length > 0 && prizes.every(p => Number(p.amountPence ?? p.amount_pence) > 0), "prize money settled for recorded results, all positive", prizes.length);
  const fin = (await get(`/saves/${state.season}/finance`)).body;
  const sum = all.reduce((a, e) => a + Number(e.amountPence ?? e.amount_pence ?? 0), 0);
  check(fin?.balancePence !== undefined && sum === Number(fin.balancePence), "balance equals the sum of the ledger", { sum, balance: fin?.balancePence });
});

await scenario("S7", "Sign an eligible sponsor (listed signability agrees with signing)", async () => {
  const probes = (state.sponsorLog ?? []).filter(l => l.startsWith("probe "));
  check(probes.length > 0, "the seed probed every offer listed at week 9", state.sponsorLog);
  const disagree = probes.filter(l => /listed=signable signing=refused/.test(l) || /listed=unsignable:\S+ signing=accepted/.test(l));
  check(disagree.length === 0, "no listed offer disagrees with the signing endpoint (P1-2)", disagree);
  check((state.sponsorLog ?? []).some(l => l.startsWith("accepted ")), "an eligible offer was signed through the real acceptance path", state.sponsorLog);
  const sp = (await get(`/saves/${state.season}/sponsors`)).body;
  check((sp.activeContracts ?? []).length + (sp.history?.contracts ?? []).length > 0, "the signed agreement is recorded", sp.activeContracts?.length);
  for (const o of (sp.offers ?? []).filter(o => o.acceptance && !o.acceptance.signable).slice(0, 5)) {
    const r = await api("POST", `/saves/${state.season}/sponsors/offers/${o.id}/accept`, {});
    check(r.status === 409, `an offer listed unsignable (${o.acceptance.code}) is refused over HTTP`, r.status);
  }
  check((sp.offers ?? []).every(o => o.acceptance && typeof o.acceptance.signable === "boolean"), "every listed offer carries server signability");
});

await scenario("S8", "Verify guaranteed payments", async () => {
  const sp = (await get(`/saves/${state.season}/sponsors`)).body;
  const contracts = [...(sp.activeContracts ?? []), ...(sp.history?.contracts ?? [])];
  const withGuarantees = contracts.filter(c => (c.terms?.contractFoundation?.guaranteedPayments ?? []).length > 0);
  if (!withGuarantees.length) { block("no signed agreement in this run carries guaranteed payments"); return; }
  const paid = (await ledger(state.season)).filter(e => e.category === "SPONSOR_GUARANTEED_PAYMENT");
  check(paid.length > 0, "guaranteed instalments were posted to the ledger by the weekly advance", paid.length);
  check(paid.every(e => Number(e.amountPence ?? e.amount_pence) > 0), "every instalment is a positive sponsor payment");
  const keys = paid.map(e => e.operationKey ?? e.operation_key);
  check(new Set(keys).size === keys.length, "each instalment posts once", keys);
  check(Number(sp.commercial?.cashReceivedPence?.guarantees ?? 0) >= 0, "Sponsor HQ reports guarantee cash", sp.commercial?.cashReceivedPence);
});

await scenario("S9", "Expire or conclude a sponsor agreement", async () => {
  const sp = (await get(`/saves/${state.season}/sponsors`)).body;
  const ended = (sp.history?.contracts ?? []).filter(c => ["COMPLETED", "EXPIRED", "TERMINATED"].includes(String(c.status)));
  if (!ended.length) { if (!crossedSeason) block("the harness was seeded in --quick mode; no agreement reached its end"); else check(false, "an agreement concluded during the season run", sp.history?.contracts); return; }
  const c = ended[0];
  check(c.endReason, "the concluded agreement records why it ended", c);
  const pres = (await get(`/saves/${state.season}/presentation`)).body;
  check(!pres.placements.some(p => p.contractId === c.id), "a concluded agreement no longer prints its logo", pres.placements);
  const journeys = sp.journeys ?? [];
  check(journeys.some(j => j.timeline?.some(e => e.type === "CONTRACT_CONCLUDED")), "the sponsor timeline records the conclusion", journeys.map(j => j.timeline?.map(e => e.type)));
  const later = (await ledger(state.season)).filter(e => e.category === "SPONSOR_GUARANTEED_PAYMENT" && e.contractId === c.id
    && (Number(e.season) > Number(c.end?.season) || (Number(e.season) === Number(c.end?.season) && Number(e.week) > Number(c.end?.week))));
  check(later.length === 0, "no guaranteed payment posts after the agreement ended", later);
});

await scenario("S10", "Shirt and logo behaviour (maker rights, stable brand IDs, edit window)", async () => {
  const fresh = (await get(`/saves/${state.fresh}/presentation`)).body;
  check(fresh.canEdit === true && fresh.placements.length === 0, "a new Career can edit its kit in week 1 and prints no partner logos", { canEdit: fresh.canEdit, placements: fresh.placements });
  const maker = await api("POST", `/saves/${state.fresh}/presentation`, { kitDesignId: "kit-250-151" });
  check(maker.status === 409, "a manufacturer-range shirt is refused without that maker's agreement", maker.status);
  const open = await api("POST", `/saves/${state.fresh}/presentation`, { kitDesignId: "kit-250-150" });
  check(open.status === 200 && (await get(`/saves/${state.fresh}/presentation`)).body.identity.kitDesignId === "kit-250-150", "an open-range premium shirt is saved", open.body);
  const season = (await get(`/saves/${state.season}/presentation`)).body;
  const active = (await get(`/saves/${state.season}/sponsors`)).body.activeContracts ?? [];
  check(season.placements.length === active.length && season.placements.every(p => active.some(c => c.id === p.contractId && c.sponsorKey === p.brandId)),
    "every printed logo is a current active agreement, carrying its stable brandId (= sponsor key)", { placements: season.placements, active: active.map(c => [c.id, c.sponsorKey]) });
  if (season.currentWeek !== 1 && season.week !== 1) {
    const late = await api("POST", `/saves/${state.season}/presentation`, { kitDesignId: "kit-250-150" });
    check(late.status === 409, "kit edits outside the season opening week are refused", late.status);
  }
  const tours = (await get(`/saves/${state.season}/history?participant=HUMAN`)).body;
  const tv = tours.length && (await get(`/saves/${state.season}/tournaments/${tours.at(-1).eventId}`)).body;
  const players = tv?.field ?? [];
  check(players.length > 0 && players.every(p => (p.sponsors ?? []).every(s => typeof s.brandId === "string" && s.brandId.length > 0)), "tournament partner marks carry stable brand IDs", players.slice(0, 3).map(p => p.sponsors));
});

await scenario("S11", "Confirm stable NPC wardrobes", async () => {
  const tours = (await get(`/saves/${state.season}/history?participant=HUMAN`)).body;
  const tv = (await get(`/saves/${state.season}/tournaments/${tours.at(-1).eventId}`)).body;
  const npcs = (tv.field ?? []).filter(p => p.key !== "HUMAN").slice(0, 6);
  check(npcs.length > 0, "the tournament field lists NPCs", npcs.length);
  const read = async id => (await get(`/saves/${state.season}/world-players?id=${id}`)).body.players?.[0];
  const before = {};
  for (const n of npcs) {
    const wp = await read(n.key); before[n.key] = JSON.stringify(wp?.shirt);
    check(wp && JSON.stringify(wp.shirt) === JSON.stringify(n.shirt), `${n.name}: directory and tournament shirt identity agree`, { directory: wp?.shirt, tournament: n.shirt });
    check(wp && wp.shirt && wp.shirt.kitDesignId === undefined, `${n.name}: no maker or premium kit is asserted server-side (client wardrobe is a function of the NPC id)`, wp?.shirt);
  }
  const a = await advance(state.season, 1);
  check(a.res.status === 200, "the season save advances a week (rankings and portfolios move)", a.res.body?.stop);
  for (const n of npcs) check(JSON.stringify((await read(n.key))?.shirt) === before[n.key], `${n.name}: shirt identity unchanged after the world moves`);
});

await scenario("S12", "Complete a season transition", async () => {
  if (!crossedSeason) { block(`harness seeded in --quick mode (season ${seasonSave.currentSeason} week ${seasonSave.currentWeek})`); return; }
  check(seasonSave.currentSeason >= 2, "the season save rolled into season 2", { season: seasonSave.currentSeason, week: seasonSave.currentWeek });
  const review = await get(`/saves/${state.season}/legacy/seasons/1`);
  check(review.status === 200, "the season 1 review loads", review.status === 200 ? undefined : review.body);
  const cal = (await get(`/saves/${state.season}/calendar`)).body;
  check((cal.events ?? []).some(e => Number(e.season ?? seasonSave.currentSeason) >= 2), "a season 2 calendar exists", (cal.events ?? []).length);
  const hist = (await get(`/saves/${state.season}/history?participant=HUMAN`)).body;
  check(hist.some(r => Number(r.season) === 1), "season 1 results are preserved after the transition", hist.length);
  const sporting = (await get(`/saves/${state.season}/sporting`)).body;
  check(sporting && sporting.tourCard !== undefined, "Tour Card state is readable after the season review", Object.keys(sporting ?? {}));
});

await scenario("S13", "Review the trophy cabinet and achievements", async () => {
  for (const p of ["legacy", "recognition", "goals", "trophy-cabinet?offset=0&limit=50", "history?participant=HUMAN", "milestones?limit=20", "legacy/player"]) {
    const r = await get(`/saves/${state.season}/${p}`); check(r.status === 200, `GET ${p.split("?")[0]} → 200`, r.status === 200 ? undefined : r.body);
  }
  const cab = (await get(`/saves/${state.season}/trophy-cabinet?offset=0&limit=100`)).body;
  check(cab.titles.every(t => t.canonicalEventId && t.circuit && t.classification), "every cabinet row carries the event key, circuit and classification E2 resolves by", cab.titles.slice(0, 2));
});

await scenario("S14", "Retire and reopen a save", async () => {
  const r = await api("POST", `/saves/${state.legacy}/retire`, { confirmation: "RETIRE CAREER" });
  check(r.status === 200, "retirement succeeds with explicit confirmation", r.body);
  const s = (await get(`/saves/${state.legacy}`)).body;
  check(s.status === "RETIRED", "the reopened save is RETIRED", s.status);
  const leg = (await get(`/saves/${state.legacy}/legacy/player`)).body;
  check(leg.retired === true && (leg.chapters ?? []).length === 6, "A Career Remembered opens with six chapters", { retired: leg.retired, chapters: (leg.chapters ?? []).length });
  const leg2 = (await get(`/saves/${state.retired}/legacy/player`)).body;
  check((leg2.chapters ?? []).some(c => c.available), "the seeded retired save's documentary has real chapters", (leg2.chapters ?? []).map(c => c.available));
});

await scenario("S15", "Confirm retired saves remain read-only", async () => {
  for (const id of [state.retired, state.legacy]) {
    const s = (await get(`/saves/${id}`)).body;
    for (const p of ["calendar", "sporting", "finance", "legacy", "sponsors", "presentation", "trophy-cabinet?offset=0&limit=50"]) { const r = await get(`/saves/${id}/${p}`); check(r.status === 200, `read ${p.split("?")[0]} → 200`, r.status); }
    const adv = await advance(id, 1); check(adv.res.status >= 400, "advance refused", adv.res.status);
    const ev = ((await get(`/saves/${id}/calendar`)).body.events ?? []).find(e => e.status === "REGISTRATION_OPEN");
    if (ev) { const r = await api("POST", `/saves/${id}/events/${ev.id}/entry`, {}); check(r.status >= 400, "event entry refused", r.status); }
    const offers = (await get(`/saves/${id}/sponsors`)).body.offers ?? [];
    if (offers[0]) { const r = await api("POST", `/saves/${id}/sponsors/offers/${offers[0].id}/accept`, {}); check(r.status >= 400, "sponsor acceptance refused", r.status); }
    const kit = await api("POST", `/saves/${id}/presentation`, { kitDesignId: "kit-250-150" }); check(kit.status >= 400, "kit edit refused", kit.status);
    const prof = await api("PUT", `/saves/${id}/profile`, { nickname: "Edited" }); check(prof.status >= 400, "profile edit refused", prof.status);
    const after = (await get(`/saves/${id}`)).body;
    check(after.currentWeek === s.currentWeek && after.currentSeason === s.currentSeason && after.status === "RETIRED", "clock and status unchanged");
  }
});

const summary = { base: BASE, state, generated: new Date().toISOString(), results };
if (OUT) writeFileSync(OUT, JSON.stringify(summary, null, 2));
const n = s => results.filter(r => r.status === s).length;
console.log(`\n${results.length} scenarios · ${n("PASS")} pass · ${n("FAIL")} fail · ${n("BLOCKED")} blocked`);
process.exit(n("PASS") === results.length ? 0 : 1);
