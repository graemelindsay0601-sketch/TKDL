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
import { EVENT_AWARDS, EVENT_DESIGNS_V2, AWARD_POLICY_VERSION, resolveAward, awardsPhysicalTrophy } from "../../features/career/trophies/manifest/award-policy.ts";
import { EVENT_DESIGN_IDS, FAMILY_IDS, RECOGNITION_ART, TROPHY_ART } from "../../features/career/trophies/manifest/trophy-manifest.ts";
import { TROPHY_RENDERS } from "../../features/career/trophies/manifest/render-manifest.ts";
import { FAMILY_IDS as RENDER_FAMILY_IDS, EVENT_DESIGN_IDS as RENDER_EVENT_IDS } from "../../../scripts/trophy-render/designs-list.mjs";
import { auditRows, reachability } from "../../../scripts/career-award-report.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const ASSETS = path.join(ROOT, "public/assets/career-trophies");
const svg = (file: string) => readFileSync(path.join(ASSETS, file), "utf8");
const body = (s: string) => s.replace(/<defs>[\s\S]*?<\/defs>/, "").replace(/<!--[\s\S]*?-->/g, "");

// ---------------------------------------------------------------- artwork
const RENDER = path.join(ASSETS, "render");
const webpSize = (buf: Buffer) => {
  assert.equal(buf.toString("ascii", 0, 4), "RIFF"); assert.equal(buf.toString("ascii", 8, 12), "WEBP");
  assert.equal(buf.toString("ascii", 12, 16), "VP8X", "extended WebP (alpha channel)");
  assert.ok(buf[20] & 0x10, "has alpha: isolated on a transparent background");
  return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
};
const SOURCE3D = readFileSync(path.join(ROOT, "scripts/trophy-render/trophies3d.mjs"), "utf8");
const builder = (id: string) => { const m = SOURCE3D.split(/^DESIGNS\[/m).find(b => b.startsWith(`"${id}"]`)); return m ?? ""; };

test("all 18 catalogue trophy identities stay in the manifest unchanged, plus event-specific designs (30 distinct)", () => {
  assert.equal(TROPHIES.length, 18);
  for (const t of TROPHIES) {
    const a = TROPHY_ART[t.id];
    assert.ok(a, `missing premium art for ${t.id}`); assert.ok(a.family, t.id);
    assert.equal(a.name, t.name, t.id); assert.equal(a.designKey, t.designKey, t.id);
  }
  assert.deepEqual([...FAMILY_IDS].sort(), TROPHIES.map(t => t.id).sort(), "families are exactly the catalogue identities");
  assert.equal(EVENT_DESIGN_IDS.length, 12);
  for (const id of EVENT_DESIGN_IDS) { assert.ok(!TROPHIES.some(t => t.id === id), `${id} must not collide with a catalogue id`); assert.match(id, /^[a-z0-9-]+$/); }
  assert.equal(Object.keys(TROPHY_ART).length, 30);
  assert.deepEqual([...RENDER_FAMILY_IDS], [...FAMILY_IDS], "render script lists the same families");
  assert.deepEqual([...RENDER_EVENT_IDS].sort(), [...EVENT_DESIGN_IDS].sort(), "render script lists the same event designs");
});

test("every design has a physically based render: transparent WebP, 720×960, real detail, a plate inside the frame", () => {
  const images = TROPHY_RENDERS.images as Record<string, { file: string; width: number; height: number; plate: Record<string, number> }>;
  assert.deepEqual(Object.keys(images).sort(), Object.keys(TROPHY_ART).sort(), "one render per design, no orphans");
  assert.deepEqual(readdirSync(RENDER).filter(f => f.endsWith(".webp")).sort(), Object.values(images).map(i => i.file).sort(), "no stray render assets");
  for (const [id, r] of Object.entries(images)) {
    const buf = readFileSync(path.join(RENDER, r.file));
    assert.deepEqual(webpSize(buf), [720, 960], id); assert.deepEqual([r.width, r.height], [720, 960], id);
    assert.ok(buf.length > 10_000 && buf.length < 400_000, `${id} render is ${buf.length} bytes`);
    const p = r.plate;
    assert.ok(p.left > 0.2 && p.right < 0.8 && p.left < p.right && p.top > 0.8 && p.bottom <= 1 && p.top < p.bottom, `${id} plate rect`);
  }
  const manifestJson = JSON.parse(readFileSync(path.join(RENDER, "render-manifest.json"), "utf8"));
  assert.deepEqual(manifestJson.images, TROPHY_RENDERS.images, "typed manifest matches the generated JSON");
});

test("each design is distinct: unique render bytes and a separate scene builder per design", () => {
  const images = Object.values(TROPHY_RENDERS.images as Record<string, { file: string }>);
  const hashes = new Set(images.map(i => createHash("sha256").update(readFileSync(path.join(RENDER, i.file))).digest("hex")));
  assert.equal(hashes.size, 30, "every render differs");
  const bodies = Object.keys(TROPHY_ART).map(id => { const b = builder(id); assert.ok(b.length > 200, `${id} has its own builder`); return b.replace(/^"[^"]+"\]/, ""); });
  assert.equal(new Set(bodies).size, 30, "no design reuses another's builder");
  assert.doesNotMatch(SOURCE3D, /<text|fillText\(|sponsor/i, "no text or sponsor marks drawn into the trophies");
});

test("vector artwork (families + recognitions) remains self-contained SVG for xs and as a load fallback", () => {
  const files = [...Object.values(TROPHY_ART).flatMap(a => a.vector ? [a.vector] : []), ...Object.values(RECOGNITION_ART).map(r => r.file)];
  assert.equal(files.length, 20);
  for (const f of files) {
    const s = svg(f);
    assert.match(s, /^<\?xml/); assert.match(s, /viewBox="0 0 240 320"/);
    assert.doesNotMatch(s, /<image|https?:\/\/(?!www\.w3\.org)|<script|<text|xlink:href="http/, `${f} must be self-contained`);
    assert.doesNotMatch(body(s), /<rect[^>]*width="240"[^>]*height="320"/, `${f} must not paint a background`);
  }
  assert.deepEqual(readdirSync(ASSETS).filter(f => f.endsWith(".svg")).sort(), files.sort(), "no stray assets");
  for (const id of EVENT_DESIGN_IDS) assert.equal(TROPHY_ART[id].vector, null, `${id} is render-only`);
});

test("special cases: Sovereign is a sculpture not a crown; Double Crown paired arches; crystal designs use glass", () => {
  assert.match(TROPHY_ART.sovereign.description, /not a crown/); assert.equal(TROPHY_ART.sovereign.designKey, "distinctive-tall-silver-not-a-crown");
  assert.equal(TROPHY_ART["double-crown"].designKey, "paired-silver-arches");
  assert.match(builder("sovereign"), /flutedSpire/); assert.doesNotMatch(builder("sovereign").replace(/\/\/.*$/gm, ""), /crown/i, "no crown geometry");
  for (const id of ["crystal-column", "cut-glass", "wwc-crystal-flame", "ywc-star-orb", "noughts-crosses-block"]) assert.match(builder(id), /M\.glass/, `${id} uses the glass material`);
  assert.match(builder("wood-silver-shield"), /M\.wood/); assert.match(builder("cricket-scoreboard"), /M\.wood/);
  assert.match(builder("international-globe"), /globeTexture/); assert.match(builder("awm-globe-cup"), /globeTexture/);
});

test("vector generation is deterministic (regenerated files are byte-identical)", () => {
  const before = Object.fromEntries(readdirSync(ASSETS).filter(f => f.endsWith(".svg")).map(f => [f, readFileSync(path.join(ASSETS, f), "utf8")]));
  execFileSync(process.execPath, [path.join(ROOT, "scripts/build-career-trophies.mjs")], { stdio: "ignore" });
  for (const [f, s] of Object.entries(before)) assert.equal(readFileSync(path.join(ASSETS, f), "utf8"), s, `${f} changed on regeneration`);
});

// ---------------------------------------------------------------- policy
const rows = auditRows();
test("every event definition in every catalogue version has an explicit award mapping", () => {
  assert.equal(rows.length, 152);
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

test("v2 allocation: every physical event has a design with art and a render; unique designs belong to one event; shared groups are named", () => {
  assert.equal(AWARD_POLICY_VERSION, 2); assert.ok(Object.isFrozen(EVENT_DESIGNS_V2));
  const physical = rows.filter(r => resolveAward({ definitionKey: r.key }).award === "PHYSICAL_TROPHY").map(r => r.key);
  assert.deepEqual(Object.keys(EVENT_DESIGNS_V2).sort(), [...physical].sort(), "exactly the physical-trophy events are allocated");
  const users = new Map<string, string[]>();
  for (const [k, d] of Object.entries(EVENT_DESIGNS_V2)) {
    assert.ok(TROPHY_ART[d.designId], `${k} → ${d.designId} art`); assert.ok((TROPHY_RENDERS.images as Record<string, unknown>)[d.designId], `${k} render`);
    if (d.allocation !== "UNIQUE") assert.ok(d.group && d.group.length > 3, `${k} shared/historic allocation is named`);
    users.set(d.designId, [...(users.get(d.designId) ?? []), k]);
  }
  for (const [k, d] of Object.entries(EVENT_DESIGNS_V2)) if (d.allocation === "UNIQUE")
    assert.deepEqual(users.get(d.designId)!.filter(u => EVENT_DESIGNS_V2[u].allocation !== "HISTORIC"), [k], `${d.designId} is unique to ${k}`);
  assert.equal(new Set([...users.keys()]).size, 30, "all 30 distinct designs are in use");
  for (const k of ["world-darts-championship", "double-crown", "open-championship", "grand-slam-of-champions", "long-format-matchplay", "pro-circuit-finals",
    "european-championship", "women-world-championship", "youth-world-championship"]) assert.equal(EVENT_DESIGNS_V2[k].allocation, "UNIQUE", `${k} has its own design`);
  assert.equal(EVENT_DESIGNS_V2["pro-circuit-championship"].designId, "championship-plate", "routine pro rounds keep the modest shared plate");
});

test("historical compatibility: v1 shows the family, a differing stored trophyId is kept, non-trophy events never gain a design", () => {
  const v1 = resolveAward({ definitionKey: "amateur-masters" }, { version: 1 });
  assert.deepEqual([v1.trophyId, v1.designId, v1.designSource, v1.policyVersion], ["silver-cup", "silver-cup", "FAMILY", 1]);
  const v2 = resolveAward({ definitionKey: "amateur-masters" });
  assert.deepEqual([v2.trophyId, v2.designId, v2.designSource], ["silver-cup", "amateur-masters-tankard", "EVENT_DESIGN"], "trophyId never changes, only the presentation design");
  const kept = resolveAward({ definitionKey: "amateur-masters" }, { persistedTrophyId: "crystal-column" });
  assert.deepEqual([kept.designId, kept.designSource], ["crystal-column", "PERSISTED"], "a stored identity that differs from today's catalogue is shown as recorded");
  assert.equal(resolveAward({ definitionKey: "amateur-masters" }, { persistedTrophyId: "silver-cup" }).designSource, "EVENT_DESIGN", "matching stored identity uses the event design");
  for (const k of ["friday-night-501", "q-school-final-europe-d2", "world-championship-qualifier", "regional-open"]) {
    const a = resolveAward({ definitionKey: k }, { persistedTrophyId: "sovereign" });
    assert.equal(a.designId, null, k); assert.notEqual(a.award, "PHYSICAL_TROPHY", k);
  }
  for (const r of rows) { const a = resolveAward({ definitionKey: r.key }, { version: 1 }), b = resolveAward({ definitionKey: r.key });
    assert.deepEqual([a.award, a.kind, a.trophyId, a.inscription], [b.award, b.kind, b.trophyId, b.inscription], `${r.key}: v2 changes presentation only`); }
  assert.equal(resolveAward({ definitionKey: "future-major", tier: "MAJOR" }).designSource, "FAMILY", "unallocated future majors fall back to a family design");
});

test("reachability: special-format and league trophies are authored but benched; only scheduled events can produce an award", () => {
  for (const k of ["snooker-darts-cup", "noughts-and-crosses-trophy", "national-cricket", "national-halve-it"]) assert.deepEqual([reachability(k).status, reachability(k).reasons], ["BENCHED", ["GAME_TYPE"]], k);
  assert.deepEqual([reachability("treble-out-trophy").status, reachability("treble-out-trophy").reasons], ["BENCHED", ["OUT_RULE"]]);
  assert.deepEqual([reachability("regional-champions-league").status, reachability("regional-champions-league").reasons], ["BENCHED", ["STRUCTURE"]]);
  assert.equal(reachability("double-start-grand-prix").status, "LEGACY"); assert.equal(reachability("vault-masters").status, "LEGACY");
  for (const k of ["world-darts-championship", "double-crown", "open-championship", "european-championship", "women-world-championship", "youth-world-championship", "amateur-masters", "county-championship", "pro-circuit-championship"])
    assert.equal(reachability(k).status, "SCHEDULED", k);
  const physical = rows.filter(r => resolveAward({ definitionKey: r.key }).award === "PHYSICAL_TROPHY");
  assert.deepEqual(physical.map(r => reachability(r.key).status).reduce((m, s) => ({ ...m, [s]: (m[s] ?? 0) + 1 }), {} as Record<string, number>), { SCHEDULED: 73, BENCHED: 6, LEGACY: 2 });
  // Benched instances are generated cancelled and never drawn, played or resulted.
  const engine = readFileSync(path.join(ROOT, "../api-server/src/career/calendar/engine.ts"), "utf8");
  assert.match(engine, /CASE WHEN r\.executable THEN 'SCHEDULED' ELSE 'CANCELLED' END/);
  assert.match(engine, /CASE WHEN r\.executable THEN NULL ELSE 'INTENTIONALLY_BENCHED' END/);
  assert.match(readFileSync(path.join(ROOT, "../api-server/src/career/calendar/service.ts"), "utf8"), /if \(!event\.executable\) denials\.push\("UNSUPPORTED_FORMAT"\)/);
});

test("special-format designs are never substituted for unrelated championships", () => {
  const special = ["snooker-darts-cup", "noughts-crosses-block", "treble-triangles", "cricket-scoreboard", "league-shield-ring"];
  for (const d of special) assert.deepEqual(Object.entries(EVENT_DESIGNS_V2).filter(([, a]) => a.designId === d).map(([, a]) => a.allocation), ["UNIQUE"], `${d} belongs to exactly one event`);
  for (const r of rows) for (const v of [1, 2] as const) { const a = resolveAward({ definitionKey: r.key }, { version: v });
    if (a.designId && special.includes(a.designId)) assert.equal(EVENT_DESIGNS_V2[r.key]?.designId, a.designId, `${r.key} v${v}`); }
  for (const t of ["MAJOR", "WORLD", "LOCAL"]) assert.ok(!special.includes(resolveAward({ definitionKey: "future-x", tier: t }).designId ?? ""), "rule fallback never yields a special design");
  assert.deepEqual(EVENT_DESIGN_IDS.filter(id => TROPHIES.some(t => t.id === id)), [], "no catalogue content can store an event-design id");
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
  assert.match(report, /distinct event definitions: \*\*152\*\*/);
  assert.match(report, /## Reachability through normal Career scheduling/); assert.match(report, /Designs a new Career can actually award: \*\*25\*\* of 30/);
  for (const k of ["snooker-darts-cup", "noughts-and-crosses-trophy", "treble-out-trophy", "national-cricket"]) assert.match(report, new RegExp(`\\(\`${k}\`\\) \\| [^\\n]*\\*\\*benched\\*\\*`), k);
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
  assert.match(out, /src="\/assets\/career-trophies\/render\/sovereign\.webp"/); assert.match(out, /data-artwork="render"/);
  assert.match(out, /aria-label="The Sovereign Trophy — World Darts Championship: The Sovereign Trophy: a tall sculptural twisted, fluted silver spire[^"]*not a crown"/);
  assert.match(out, /WORLD CHAMPION<\/span>/); assert.match(out, /ct-size-hero/);
  assert.match(html(h(M.PremiumTrophy, { trophy: { trophyId: "regional-craft" } })), /render\/regional-craft\.webp/, "accepts content trophyId");
  assert.match(html(h(M.PremiumTrophy, { trophy: { id: "sovereign" }, size: "xs" })), /career-trophies\/sovereign\.svg/, "families use the crisp vector at xs");
  assert.match(html(h(M.PremiumTrophy, { trophy: { id: "sovereign" }, size: "xs", artwork: "render" })), /sovereign\.webp/);
  assert.match(html(h(M.PremiumTrophy, { trophy: { id: "treble-triangles" }, size: "xs" })), /render\/treble-triangles\.webp/, "event designs are render-only");
  assert.match(out, /style="left:3\d(\.\d+)?%;width:2\d(\.\d+)?%;top:9\d(\.\d+)?%/, "plate placed from the render's projected plate rect");
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
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "world-darts-championship" } })), /data-design="sovereign" data-design-source="EVENT_DESIGN"[\s\S]*sovereign\.webp[\s\S]*WORLD CHAMPION/);
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "amateur-masters" } })), /amateur-masters-tankard\.webp/, "v2 event design");
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "amateur-masters" }, policyVersion: 1 })), /data-design-source="FAMILY"[\s\S]*render\/silver-cup\.webp/, "v1 pinned shows the family");
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "amateur-masters" }, persistedTrophyId: "crystal-column" })), /data-design-source="PERSISTED"[\s\S]*crystal-column\.webp/, "historic stored identity is preserved");
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "amateur-masters" }, persistedTrophyId: "not-real" })), /amateur-masters-tankard\.webp/, "unknown stored ids fall back to the policy design");
  const sub = html(h(M.AwardPresentation, { event: { definitionKey: "open-championship" }, persistedTrophyId: "snooker-darts-cup" }));
  assert.match(sub, /open-masters-heritage\.webp/, "an event-design id is never accepted as a stored identity"); assert.doesNotMatch(sub, /snooker/);
  assert.match(html(h(M.AwardPresentation, { event: { definitionKey: "friday-night-501" }, persistedTrophyId: "wood-silver-shield" })), /data-award="RESULT_ONLY"/,
    "a stored trophyId alone never creates a physical trophy");
});

test("repeat wins keep accurate counts; long inscriptions shrink to fit the plate", () => {
  const g = M.groupTrophyWins([{ eventId: "a", trophyIdentityId: "trophy:open" }, { eventId: "b", trophyIdentityId: "trophy:open" }, { eventId: "c", trophyIdentityId: "trophy:wc" }]);
  assert.deepEqual(g.map((x: { key: string; count: number }) => [x.key, x.count]), [["trophy:open", 2], ["trophy:wc", 1]]);
  assert.ok(Number(M.plateScale("REGIONAL CHAMPIONS LEAGUE")) < Number(M.plateScale("WORLD CHAMPION")));
  assert.ok(Number(M.plateScale("CUP")) <= 0.028);
});

test("contact sheet renders all 30 designs with names", () => {
  const out = html(h(M.TrophyContactSheet, { ids: Object.keys(TROPHY_ART) }));
  assert.equal((out.match(/data-trophy="/g) ?? []).length, 30);
  for (const a of Object.values(TROPHY_ART)) assert.ok(out.includes(a.name.replace(/&/g, "&amp;")), a.name);
});

/** Optional visual evidence (E2_BROWSER_DIR): real components + trophies.css; serve next to public/assets. */
test("visual evidence scenes", { skip: !process.env.E2_BROWSER_DIR }, () => {
  const OUT = process.env.E2_BROWSER_DIR!; mkdirSync(OUT, { recursive: true });
  const css = readFileSync(path.join(ROOT, "src/features/career/trophies/trophies.css"), "utf8");
  const page = (title: string, inner: string) => `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
body{margin:0;background:#080c14;color:#e7edf5;font-family:system-ui,sans-serif}.wrap{max-width:1360px;margin:auto;padding:16px}h1,h2{text-transform:uppercase;letter-spacing:.04em;margin:8px 0 12px}h2{margin-top:28px;font-size:1rem;color:#9fb3cf}
.row{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end}.card{padding:16px;border-radius:16px;background:radial-gradient(70% 60% at 50% 35%,#1d2738,#0c111a);border:1px solid #233046;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;min-width:0}
.card small{color:rgba(255,255,255,.65);max-width:260px}.ba{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.ba .card{flex-direction:row;justify-content:center;flex-wrap:wrap}
.ba .card>div{display:flex;flex-direction:column;align-items:center;gap:4px}.tag{font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:#7f93ad}
table{border-collapse:collapse;width:100%;font-size:.8rem}td code{word-break:break-all}td,th{border-bottom:1px solid #1d2738;padding:4px 6px;text-align:left;vertical-align:middle}
.hero{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:20px;border-radius:20px;background:linear-gradient(135deg,#132036,#0a0f18);border:1px solid #233046}
.reveal{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 12px;border-radius:20px;background:radial-gradient(60% 60% at 50% 40%,#2a3a58,#080c14)}
.profile{display:flex;align-items:center;gap:12px;padding:10px;border-radius:14px;background:#0f1622;border:1px solid #1d2738}.profile>div:last-child{flex:1;min-width:0}
.cab{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.cab .card{position:relative}.count{position:absolute;top:8px;right:10px;background:#c9a24a;color:#111;border-radius:99px;padding:1px 8px;font-weight:700;font-size:.75rem}
@media (max-width:600px){.hero{grid-template-columns:1fr;justify-items:center;text-align:center}}</style><body><div class="wrap">${inner}</div></body></html>`;
  const name = (k: string) => k.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const award = (k: string, size: string, extra: Record<string, unknown> = {}) => html(h(M.AwardPresentation, { event: { definitionKey: k }, size, eventName: name(k), ...extra }));
  const D = EVENT_DESIGNS_V2 as Record<string, { designId: string; allocation: string; group?: string }>;

  writeFileSync(path.join(OUT, "contact-sheet.html"), page("All premium trophies", `<h1>Career premium trophies · ${Object.keys(TROPHY_ART).length} distinct designs</h1>
    <h2>Catalogue families (18)</h2>${html(h(M.TrophyContactSheet, { ids: [...FAMILY_IDS], size: "lg" }))}
    <h2>Event-specific designs (${EVENT_DESIGN_IDS.length})</h2>${html(h(M.TrophyContactSheet, { ids: [...EVENT_DESIGN_IDS], size: "lg" }))}`));

  const majors = ["world-darts-championship", "double-crown", "open-championship", "grand-slam-of-champions", "long-format-matchplay", "pro-circuit-finals", "european-championship", "women-world-championship", "youth-world-championship"];
  writeFileSync(path.join(OUT, "majors.html"), page("Major championships", `<h1>Major championships · full size</h1><div class="row">${majors.map(k =>
    `<div class="card">${award(k, "hero")}<strong>${TROPHY_ART[D[k].designId].name}</strong><small>${name(k)}</small></div>`).join("")}</div>`));

  const physical = Object.keys(D);
  writeFileSync(path.join(OUT, "before-after.html"), page("Before and after", `<h1>Before (v1 vector family) → after (v2 rendered design)</h1><div class="ba">${physical.map(k => {
    const v1 = resolveAward({ definitionKey: k }, { version: 1 });
    return `<div class="card"><div><span class="tag">before · v1</span>${html(h(M.PremiumTrophy, { trophy: { id: v1.trophyId }, size: "md", artwork: "vector" }))}</div>
      <div><span class="tag">after · v2</span>${award(k, "md")}</div><small style="flex-basis:100%">${name(k)} · ${D[k].allocation.toLowerCase()}${D[k].group ? ` · ${D[k].group}` : ""}</small></div>`; }).join("")}</div>`));

  const rowsHtml = physical.map(k => `<tr><td>${html(h(M.PremiumTrophy, { trophy: { id: D[k].designId }, size: "xs", artwork: "render" }))}</td><td><code>${k}</code></td><td>${TROPHY_ART[D[k].designId].name}</td><td>${D[k].allocation}</td><td>${D[k].group ?? ""}</td></tr>`).join("");
  writeFileSync(path.join(OUT, "allocation.html"), page("Allocation", `<h1>v2 allocation · ${physical.length} trophy events → 30 designs</h1><table><tr><th></th><th>Event</th><th>Design</th><th>Allocation</th><th>Group</th></tr>${rowsHtml}</table>`));

  const cabinet: [string, number][] = [["world-darts-championship", 2], ["european-championship", 1], ["amateur-masters", 3], ["national-amateur-gbr", 1], ["pro-circuit-championship", 6], ["treble-out-trophy", 1], ["county-championship", 2], ["regional-open", 4], ["friday-night-501", 11]];
  writeFileSync(path.join(OUT, "ui-contexts.html"), page("UI contexts", `<h1>UI contexts</h1>
    <h2>Tournament hero</h2><div class="hero"><div><div class="tag">Major · Alexandra Hall</div><h1 style="margin:4px 0">European Championship</h1><small>Best of 21 legs · £400,000 prize fund</small></div>${award("european-championship", "lg")}</div>
    <h2>Winner reveal</h2><div class="reveal">${award("world-darts-championship", "hero").replace('class="ct-award"', 'class="ct-award ct-reveal"')}<strong>WORLD CHAMPION</strong><small>Defeated R. Hale 7–5</small></div>
    <h2>Profile honours</h2>${["women-world-championship", "youth-world-championship", "noughts-and-crosses-trophy"].map(k => `<div class="profile">${award(k, "sm")}<div><strong>${name(k)}</strong><br><small>Season 3 · Champion</small></div></div>`).join("")}
    <h2>Trophy cabinet</h2><div class="cab">${cabinet.map(([k, n]) => `<div class="card"><span class="count">×${n}</span>${award(k, "md")}<small>${name(k)}</small></div>`).join("")}</div>
    <h2>Small sizes</h2><div class="row">${["sovereign", "double-crown", "cut-glass", "vault-geometric", "ec-continental-crest", "league-shield-ring"].map(id =>
      `<div class="card">${["xs", "sm", "md"].map(sz => html(h(M.PremiumTrophy, { trophy: { id }, size: sz, engraving: "CHAMPION" }))).join("")}<small>${id}</small></div>`).join("")}</div>
    <h2>Long engravings</h2><div class="row">${["grand-slam-of-champions", "regional-champions-league", "noughts-and-crosses-trophy", "amateur-world-masters"].map(k => `<div class="card">${award(k, "lg")}<small>${resolveAward({ definitionKey: k }).inscription}</small></div>`).join("")}</div>`));
});
