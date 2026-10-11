/**
 * Workstream E2 — premium trophy artwork, award presentation policy and renderer.
 * The artwork itself is reviewed visually via the contact sheet; these tests pin
 * coverage, structure, distinctness, determinism and the locked award policy.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import { TROPHIES } from "../../../../api-server/src/career/content/world.ts";
import { EVENT_AWARDS, resolveAward, awardsPhysicalTrophy } from "../../features/career/trophies/manifest/award-policy.ts";
import { RECOGNITION_ART, TROPHY_ART } from "../../features/career/trophies/manifest/trophy-manifest.ts";
import { auditRows } from "../../../scripts/career-award-report.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const ASSETS = path.join(ROOT, "public/assets/career-trophies");
const svg = (file: string) => readFileSync(path.join(ASSETS, file), "utf8");
const body = (s: string) => s.replace(/<defs>[\s\S]*?<\/defs>/, "").replace(/<!--[\s\S]*?-->/g, "");

// ---------------------------------------------------------------- artwork
test("all 18 catalogue trophy identities resolve in the premium manifest with matching names and design keys", () => {
  assert.equal(TROPHIES.length, 18);
  for (const t of TROPHIES) {
    const a = TROPHY_ART[t.id];
    assert.ok(a, `missing premium art for ${t.id}`);
    assert.equal(a.name, t.name, t.id); assert.equal(a.designKey, t.designKey, t.id);
  }
  assert.deepEqual(Object.keys(TROPHY_ART).sort(), TROPHIES.map(t => t.id).sort(), "no orphan art");
});

test("every artwork file exists, is an isolated self-contained SVG on a transparent background, with no text or sponsor marks", () => {
  const files = [...Object.values(TROPHY_ART).map(a => a.file), ...Object.values(RECOGNITION_ART).map(r => r.file)];
  assert.equal(files.length, 20);
  for (const f of files) {
    assert.ok(existsSync(path.join(ASSETS, f)), f);
    const s = svg(f);
    assert.match(s, /^<\?xml/); assert.match(s, /viewBox="0 0 240 320"/);
    assert.doesNotMatch(s, /<image|https?:\/\/(?!www\.w3\.org)|<script|<text|xlink:href="http/, `${f} must be self-contained`);
    assert.doesNotMatch(body(s), /<rect[^>]*width="240"[^>]*height="320"/, `${f} must not paint a background`);
    assert.ok(body(s).length > 1500, `${f} is detailed artwork, not a stub`);
    assert.ok((s.match(/<path/g) ?? []).length >= (f.startsWith("recognition-") ? 3 : 6), `${f} has real shape detail`);
  }
  assert.deepEqual(readdirSync(ASSETS).filter(f => f.endsWith(".svg")).sort(), files.sort(), "no stray assets");
});

test("each identity is distinct artwork: unique files and dissimilar drawing structure", () => {
  const ids = Object.keys(TROPHY_ART);
  const hashes = new Set(ids.map(id => createHash("sha256").update(body(svg(TROPHY_ART[id].file))).digest("hex")));
  assert.equal(hashes.size, ids.length, "every file differs");
  // The shared plinth and contact shadow are deliberately identical; compare only the trophy itself.
  const tokens = (s: string) => new Set((body(s).replace(/<g class="plinth">[\s\S]*?<\/g>/, "").match(/d="[^"]{12,}"/g) ?? []));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = tokens(svg(TROPHY_ART[ids[i]].file)), b = tokens(svg(TROPHY_ART[ids[j]].file));
    const shared = [...a].filter(x => b.has(x)).length;
    const similarity = shared / Math.min(a.size, b.size);
    assert.ok(similarity < 0.5, `${ids[i]} vs ${ids[j]} share ${Math.round(similarity * 100)}% of their shape paths`);
  }
});

test("special cases: Sovereign is a sculpture not a crown; Double Crown paired arches; crystal is translucent; wood shield has grain; globe has meridians", () => {
  assert.match(TROPHY_ART.sovereign.description, /not a crown/); assert.equal(TROPHY_ART.sovereign.designKey, "distinctive-tall-silver-not-a-crown");
  assert.equal(TROPHY_ART["double-crown"].designKey, "paired-silver-arches");
  assert.equal((body(svg("double-crown.svg")).match(/stroke="url\(#silver\)" stroke-width="14"/g) ?? []).length, 2, "two arches");
  assert.doesNotMatch(body(svg("sovereign.svg")), /stroke-width="14"/, "the Sovereign is not the paired-arch form");
  for (const id of ["crystal-column", "cut-glass"]) assert.match(body(svg(`${id}.svg`)), /url\(#crystal\)/, `${id} uses the translucent crystal material`);
  assert.match(svg("crystal-column.svg"), /stop-opacity="0?\.3/);
  assert.match(body(svg("wood-silver-shield.svg")), /url\(#wood\)[\s\S]*stroke="#2b170b"/, "wooden backing with grain lines");
  assert.match(body(svg("international-globe.svg")), /globeSea[\s\S]*<ellipse cx="120" cy="140" rx="22" ry="62"\/>/, "globe with meridians");
  assert.match(body(svg("vault-geometric.svg")), /L176 92 L176 172 L120 204 L64 172 L64 92Z/, "hexagonal vault form");
});

test("artwork generation is deterministic (regenerated files are byte-identical)", () => {
  const before = Object.fromEntries(readdirSync(ASSETS).map(f => [f, readFileSync(path.join(ASSETS, f), "utf8")]));
  execFileSync(process.execPath, [path.join(ROOT, "scripts/build-career-trophies.mjs")], { stdio: "ignore" });
  for (const [f, s] of Object.entries(before)) assert.equal(readFileSync(path.join(ASSETS, f), "utf8"), s, `${f} changed on regeneration`);
});

// ---------------------------------------------------------------- policy
const rows = auditRows();
test("every event definition in every catalogue version has an explicit award mapping", () => {
  assert.equal(rows.length, 95);
  const missing = rows.filter(r => resolveAward({ definitionKey: r.key }).source !== "EXPLICIT").map(r => r.key);
  assert.deepEqual(missing, []);
  assert.deepEqual(Object.keys(EVENT_AWARDS).filter(k => !rows.some(r => r.key === k)), [], "no stale policy rows");
});

test("physical trophies keep the event's stored content identity and always have art", () => {
  for (const r of rows) {
    const a = resolveAward({ definitionKey: r.key });
    if (a.award !== "PHYSICAL_TROPHY") { assert.equal(a.trophyId, null, r.key); continue; }
    assert.equal(a.trophyId, r.contentTrophy, `${r.key} must not drift from its catalogue trophy identity`);
    assert.ok(TROPHY_ART[a.trophyId!], `${r.key} art`);
    assert.ok(a.inscription && a.inscription.length <= 28, `${r.key} inscription`);
  }
});

test("locked policy: grassroots weekly no cups; routine county/tour rounds no trophy; selected championships do", () => {
  for (const k of ["friday-night-501", "sunday-league-sprint", "pub-doubles", "killer-night", "golf-night", "thursday-night-darts"]) assert.equal(resolveAward({ definitionKey: k }).award, "RESULT_ONLY", k);
  for (const k of ["county-501-open", "county-301-sprint", "county-701-open", "county-classic-dido", "challenger-event", "vault-tour", "women-tour", "development-tour"]) assert.equal(awardsPhysicalTrophy({ definitionKey: k }), false, k);
  assert.equal(resolveAward({ definitionKey: "county-championship" }).trophyId, "regional-craft");
  assert.equal(resolveAward({ definitionKey: "regional-champions-league" }).trophyId, "regional-craft");
  assert.equal(resolveAward({ definitionKey: "town-open" }).trophyId, "wood-silver-shield", "designated special local championship");
  assert.equal(resolveAward({ definitionKey: "junior-development-night" }).award, "RESULT_ONLY", "ordinary youth round");
  for (const k of ["youth-world-championship", "youth-masters", "junior-development-championship"]) assert.equal(resolveAward({ definitionKey: k }).trophyId, "youth-rising-star", k);
  assert.equal(resolveAward({ definitionKey: "pro-circuit-championship" }).trophyId, "championship-plate", "routine pro round gets the modest plate, not an ornate cup");
});

test("World Championship is the Sovereign Trophy; Double Crown is paired arches; every major gets a premium trophy", () => {
  assert.deepEqual([resolveAward({ definitionKey: "world-darts-championship" }).trophyId, resolveAward({ definitionKey: "world-darts-championship" }).inscription], ["sovereign", "WORLD CHAMPION"]);
  assert.equal(resolveAward({ definitionKey: "double-crown" }).trophyId, "double-crown");
  for (const r of rows.filter(r => r.circuit === "MAJOR" && r.classification !== "QUALIFIER")) assert.equal(resolveAward({ definitionKey: r.key }).award, "PHYSICAL_TROPHY", r.key);
});

test("Q-School and qualifiers can never display a championship trophy, explicitly or by rule", () => {
  for (const r of rows.filter(r => r.circuit === "Q_SCHOOL" || r.classification === "QUALIFIER")) {
    const a = resolveAward({ definitionKey: r.key });
    assert.equal(a.award, "RESULT_ONLY", r.key); assert.ok(["Q_SCHOOL_SESSION", "QUALIFIER"].includes(a.kind), r.key);
  }
  assert.equal(resolveAward({ definitionKey: "future-q-school-day", circuit: "Q_SCHOOL", tier: "MAJOR" }).award, "RESULT_ONLY");
  assert.equal(resolveAward({ definitionKey: "future-qualifier", classification: "QUALIFIER", tier: "WORLD" }).award, "RESULT_ONLY");
  const rule = resolveAward({ definitionKey: "future-world", circuit: "WORLD_CHAMPIONSHIP" });
  assert.deepEqual([rule.source, rule.trophyId], ["RULE", "sovereign"]);
  assert.equal(resolveAward({ definitionKey: "future-weekly", tier: "LOCAL" }).award, "RESULT_ONLY", "unknown events never get an invented trophy");
});

test("presentation boundary: policy is frozen, pure and unknown to sporting, finance and ranking code", () => {
  assert.ok(Object.isFrozen(EVENT_AWARDS));
  const policy = readFileSync(path.join(ROOT, "src/features/career/trophies/manifest/award-policy.ts"), "utf8");
  assert.doesNotMatch(policy, /^import /m, "the policy imports nothing");
  let found = "";
  try { found = execFileSync("grep", ["-rl", "career/trophies", path.join(ROOT, "../api-server/src")], { encoding: "utf8" }); } catch { found = ""; } // grep exits 1 when nothing matches
  const server = found.trim().split("\n").filter(Boolean).filter(f => !f.includes("__tests__"));
  assert.deepEqual(server, [], "no server sporting/finance/ranking module depends on award presentation");
});

test("the committed audit report is current and lists every definition", () => {
  const report = readFileSync(path.join(ROOT, "../../docs/career/e2-trophy-award-report.md"), "utf8");
  for (const r of rows) assert.ok(report.includes(`| \`${r.key}\` |`), r.key);
  assert.match(report, /distinct event definitions: \*\*95\*\*/);
});

// ---------------------------------------------------------------- renderer
let vite: ViteDevServer; let M: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  M = await vite.ssrLoadModule("/src/features/career/trophies/index.ts");
});
after(async () => { await vite?.close(); });
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("renderer: premium art with an accessible description and an engraved plate", () => {
  const out = html(h(M.PremiumTrophy, { trophy: { id: "sovereign", name: "The Sovereign Trophy" }, size: "hero", engraving: "WORLD CHAMPION", eventName: "World Darts Championship" }));
  assert.match(out, /src="\/assets\/career-trophies\/sovereign\.svg"/);
  assert.match(out, /aria-label="The Sovereign Trophy — World Darts Championship: The Sovereign Trophy: a tall sculptural silver spire[^"]*not a crown"/);
  assert.match(out, /WORLD CHAMPION<\/span>/); assert.match(out, /ct-size-hero/);
  assert.match(html(h(M.PremiumTrophy, { trophy: { trophyId: "regional-craft" } })), /regional-craft\.svg/, "accepts content trophyId");
  assert.match(html(h(M.PremiumTrophy, { trophy: { id: "championship-cup", name: "x", designKey: "wide-silver" }, size: "xs", engraving: "HIDDEN" })), /^(?!.*HIDDEN)/s, "no plate at xs");
});

test("renderer: an unknown identity shows an explicit labelled fallback, never the old generic shape", () => {
  const out = html(h(M.PremiumTrophy, { trophy: { id: "made-up-trophy", name: "Mystery Cup" } }));
  assert.match(out, /data-missing-trophy="made-up-trophy"/); assert.match(out, /Mystery Cup · artwork unavailable/);
  assert.doesNotMatch(out, /career-trophy-svg|<img/);
});

test("award presentation: weekly result-only, Q-School no trophy, regional plaque, persisted identity wins over policy design", () => {
  const weekly = html(h(M.AwardPresentation, { event: { definitionKey: "friday-night-501" } }));
  assert.match(weekly, /data-award="RESULT_ONLY"/); assert.match(weekly, /Result &amp; prize · no trophy/); assert.doesNotMatch(weekly, /<img/);
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "q-school-final-europe-d2" } })), /Q-School session win · no trophy/);
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "regional-open" } })), /recognition-plaque\.svg/);
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "world-darts-championship" } })), /sovereign\.svg[\s\S]*WORLD CHAMPION/);
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "amateur-masters" }, persistedTrophyId: "crystal-column" })), /crystal-column\.svg/, "historic stored identity is preserved");
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "amateur-masters" }, persistedTrophyId: "not-real" })), /silver-cup\.svg/, "unknown stored ids fall back to the policy design");
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "friday-night-501" }, persistedTrophyId: "wood-silver-shield" })), /data-award="RESULT_ONLY"/,
    "a stored trophyId alone never creates a physical trophy");
});

test("repeat wins keep accurate counts; long inscriptions shrink to fit the plate", () => {
  const g = M.groupTrophyWins([{ eventId: "a", trophyIdentityId: "trophy:open" }, { eventId: "b", trophyIdentityId: "trophy:open" }, { eventId: "c", trophyIdentityId: "trophy:wc" }]);
  assert.deepEqual(g.map((x: { key: string; count: number }) => [x.key, x.count]), [["trophy:open", 2], ["trophy:wc", 1]]);
  assert.ok(Number(M.plateScale("REGIONAL CHAMPIONS LEAGUE")) < Number(M.plateScale("WORLD CHAMPION")));
  assert.ok(Number(M.plateScale("CUP")) <= 0.032);
});

test("contact sheet renders all 18 identities with names", () => {
  const out = html(h(M.TrophyContactSheet, { ids: Object.keys(TROPHY_ART) }));
  assert.equal((out.match(/data-trophy="/g) ?? []).length, 18);
  for (const a of Object.values(TROPHY_ART)) assert.ok(out.includes(a.name.replace(/&/g, "&amp;")), a.name);
});

/** Optional visual evidence (E2_BROWSER_DIR): real components + trophies.css; serve next to public/assets. */
test("visual evidence scenes", { skip: !process.env.E2_BROWSER_DIR }, () => {
  const OUT = process.env.E2_BROWSER_DIR!; mkdirSync(OUT, { recursive: true });
  const css = readFileSync(path.join(ROOT, "src/features/career/trophies/trophies.css"), "utf8");
  const page = (title: string, inner: string) => `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
body{margin:0;background:#080c14;color:#e7edf5;font-family:system-ui,sans-serif}.wrap{max-width:1180px;margin:auto;padding:16px}h1,h2{text-transform:uppercase;letter-spacing:.04em;margin:8px 0 12px}
.row{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end}.card{padding:16px;border-radius:16px;background:radial-gradient(70% 60% at 50% 35%,#1d2738,#0c111a);border:1px solid #233046;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;min-width:0}
.card small{color:rgba(255,255,255,.65);max-width:240px}</style><body><div class="wrap">${inner}</div></body></html>`;
  const ids = Object.keys(TROPHY_ART);
  writeFileSync(path.join(OUT, "contact-sheet.html"), page("All premium trophies", `<h1>Career premium trophies · all ${ids.length} identities</h1>${html(h(M.TrophyContactSheet, { ids, size: "lg" }))}`));
  const hero = (id: string, eng: string, label: string) => `<div class="card">${html(h(M.PremiumTrophy, { trophy: { id }, size: "hero", engraving: eng }))}<strong>${TROPHY_ART[id].name}</strong><small>${label}</small></div>`;
  writeFileSync(path.join(OUT, "full-size.html"), page("Full-size examples", `<h1>Full-size examples</h1><div class="row">${hero("sovereign", "WORLD CHAMPION", "World Championship · The Palace")}${hero("double-crown", "DOUBLE CROWN", "Major · Double Crown")}${hero("regional-craft", "COUNTY CHAMPION", "Regional · County Championship")}${hero("youth-rising-star", "YOUTH WORLD CHAMPION", "Youth · Youth World Championship")}</div>`));
  const ex: [string, string][] = [["world-darts-championship", "World Darts Championship"], ["open-championship", "The Open Championship"], ["county-championship", "County Championship"], ["regional-open", "Regional Open"],
    ["town-open", "Town Open"], ["friday-night-501", "Friday Night 501"], ["q-school-final-uk_ireland-d2", "Q-School Final Stage · Day 2"], ["pro-circuit-championship", "Pro Circuit Championship"]];
  writeFileSync(path.join(OUT, "award-presentation.html"), page("Award presentation", `<h1>What each winner is shown receiving</h1><div class="row">${ex.map(([k, n]) => {
    const a = resolveAward({ definitionKey: k });
    return `<div class="card">${html(h(M.AwardPresentation, { event: { definitionKey: k }, size: "md", eventName: n }))}<strong>${n}</strong><small>${M.awardLabel(a)} · ${a.kind.replace(/_/g, " ").toLowerCase()}</small></div>`; }).join("")}
    <div class="card">${html(h(M.PremiumTrophy, { trophy: { id: "not-in-manifest", name: "Unknown Cup" }, size: "md" }))}<strong>Missing identity</strong><small>Explicit fallback, never a generic cup</small></div></div>
    <h2>Sizes</h2><div class="row">${["xs", "sm", "md", "lg"].map(sz => `<div class="card">${html(h(M.PremiumTrophy, { trophy: { id: "championship-cup" }, size: sz, engraving: "GRAND SLAM OF CHAMPIONS" }))}<small>${sz}</small></div>`).join("")}</div>`));
});
