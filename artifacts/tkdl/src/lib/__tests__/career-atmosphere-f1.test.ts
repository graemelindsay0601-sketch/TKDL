/**
 * Workstream F1 — broadcast atmosphere. Pins tier mapping against the real
 * catalogue, venue identity, legacy fallbacks, the spectacle ladder, honesty
 * (no invented results), assets, accessibility and reduced motion.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import { catalogueFor } from "../../../../api-server/src/career/calendar/catalogue.ts";
import { identity } from "../../../../api-server/src/career/content/events.ts";
import { VENUE_CONTENT, VENUE_FAMILIES as SERVER_FAMILIES, venueContent } from "../../../../api-server/src/career/content/world.ts";
import { importance } from "../../../../api-server/src/career/tournament/service.ts";
import { generateSeason } from "../../../../api-server/src/career/calendar/generation.ts";
import {
  ATMOSPHERE_LEVELS, VENUE_FAMILIES, levelFromMomentTier, resolveAtmosphere, spectacleFor, victoryVariant, type AtmosphereInput, type AtmosphereLevel,
} from "../../features/career/atmosphere/model.ts";
import { atmosphereFromCalendarEvent, atmosphereFromLegacyMoment, atmosphereFromTournament } from "../../features/career/atmosphere/adapters.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const ATMOS = path.join(ROOT, "public/assets/career-atmosphere");
const VENUES = path.join(ROOT, "public/images/career-venues");
const MODULE = path.join(ROOT, "src/features/career/atmosphere");
const rank = (l: AtmosphereLevel | null) => (l ? ATMOSPHERE_LEVELS.indexOf(l) : -1);

/** Exactly what the tournament read sends for a scheduled instance of each definition. */
const venueOf = (d: ReturnType<typeof catalogueFor>[number]) => {
  const s = d.schedule as { kind: string; slots?: { venue: string }[]; venueKind?: string };
  return venueContent(s.kind === "FIXED" ? s.slots![0].venue : s.venueKind === "CLUB" ? "club-ayrshire" : "county-hall-ayrshire");
};
const fromCatalogue = (d: ReturnType<typeof catalogueFor>[number]): AtmosphereInput => {
  const content = (d as { content?: ReturnType<typeof identity> }).content ?? identity(d);
  return atmosphereFromTournament({ name: d.name, definitionKey: d.key, circuit: d.circuit, classification: d.classification,
    level: importance(d.presentation.tier, d.circuit, d.classification), content, venue: venueOf(d) });
};
const CATALOGUE = catalogueFor(5);
const resolved = new Map(CATALOGUE.map(d => [d.key, resolveAtmosphere(fromCatalogue(d))]));

// ---------------------------------------------------------------- tier mapping
test("every current catalogue event resolves to one of seven levels; all seven are used", () => {
  for (const [k, a] of resolved) assert.ok(a.level && ATMOSPHERE_LEVELS.includes(a.level), k);
  assert.deepEqual([...new Set([...resolved.values()].map(a => a.level))].sort(), [...ATMOSPHERE_LEVELS].sort());
});

test("tier mapping follows the persisted classification: Palace, majors, stage, floor, national, county, club", () => {
  const L = (k: string) => resolved.get(k)!.level;
  assert.equal(L("world-darts-championship"), "PALACE");
  assert.deepEqual([...resolved].filter(([, a]) => a.level === "PALACE").map(([k]) => k), ["world-darts-championship"], "only the World Championship is The Palace");
  for (const k of ["double-crown", "open-championship", "grand-slam-of-champions", "long-format-matchplay", "pro-circuit-finals", "european-championship", "women-world-championship"]) assert.equal(L(k), "MAJOR", k);
  for (const k of ["world-dart-series", "european-dart-series", "champions-masters", "vault-nights", "international-open"]) assert.equal(L(k), "STAGE", k);
  for (const k of ["pro-circuit-championship", "challenger-event", "vault-tour"]) assert.equal(L(k), "FLOOR", k);
  for (const k of ["amateur-masters", "national-amateur-gbr", "women-masters"]) assert.equal(L(k), "NATIONAL", k);
  for (const k of ["county-championship", "county-501-open", "regional-open"]) assert.equal(L(k), "COUNTY", k);
  for (const k of ["friday-night-501", "sunday-league-sprint", "town-open"]) assert.equal(L(k), "CLUB", k);
});

test("qualifiers and Q-School never receive championship spectacle", () => {
  for (const d of CATALOGUE.filter(d => d.classification === "QUALIFIER" || d.circuit === "Q_SCHOOL")) {
    const a = resolved.get(d.key)!;
    assert.ok(rank(a.level) <= rank(d.circuit === "Q_SCHOOL" ? "FLOOR" : "NATIONAL"), `${d.key} → ${a.level}`);
    assert.equal(victoryVariant(a), "TOURNAMENT", d.key);
  }
  assert.equal(resolved.get("world-championship-qualifier")!.level, "NATIONAL", "a WC qualifier is above a club night but never The Palace");
  assert.equal(resolveAtmosphere({ circuit: "WORLD_CHAMPIONSHIP", classification: "QUALIFIER", presentationTier: "WORLD" }).level, "NATIONAL");
});

// ---------------------------------------------------------------- venue identity
test("the backdrop is the event's own venue family; every server venue family has a plate", async () => {
  assert.deepEqual([...VENUE_FAMILIES].sort(), [...SERVER_FAMILIES].sort(), "client families mirror the server's");
  for (const d of CATALOGUE) { const a = resolved.get(d.key)!, v = venueOf(d);
    assert.equal(a.venueFamily, v.venueType, d.key); assert.equal(a.plateSource, "VENUE", d.key);
    assert.equal(a.plate, v.venueType === "palace" ? "palace-stage" : v.venueType, d.key);
    assert.ok(a.venueName?.startsWith(v.displayName), d.key); }
  const { PLATES } = await M();
  for (const v of VENUE_CONTENT) assert.ok(PLATES[resolveAtmosphere({ venue: v }).plate], v.id);
  assert.equal(resolved.get("world-darts-championship")!.venueName, "Alexandra Grand Hall · The Palace");
  assert.doesNotMatch(JSON.stringify(PLATES), /career-palace-arena\.png/, "the Palace trophy still-life is not used as a venue plate");
});

test("legacy fallbacks: missing metadata never invents a venue or a level", () => {
  const none = resolveAtmosphere(undefined);
  assert.deepEqual([none.level, none.plate, none.plateSource, none.venueName], [null, "neutral", "NEUTRAL", null]);
  const levelOnly = resolveAtmosphere({ level: 4 });
  assert.deepEqual([levelOnly.level, levelOnly.plate, levelOnly.plateSource, levelOnly.venueName], ["MAJOR", "major-arena", "LEVEL_DEFAULT", null]);
  const cityOnly = resolveAtmosphere({ eventClass: "REGIONAL", venueFallback: { city: "Ayr", country: "GBR" } });
  assert.deepEqual([cityOnly.venueName, cityOnly.venueCity, cityOnly.plateSource], [null, "Ayr", "LEVEL_DEFAULT"]);
  const unknownVenue = resolveAtmosphere({ eventClass: "MAJOR", venue: { venueType: "space-station", displayName: "Nowhere" } });
  assert.deepEqual([unknownVenue.venueFamily, unknownVenue.venueName, unknownVenue.plate], [null, null, "major-arena"], "unknown family is not trusted");
  assert.equal(resolveAtmosphere({ eventClass: "NOT_A_CLASS", circuit: "COUNTY" }).level, "COUNTY", "falls back to circuit");
  assert.equal(resolveAtmosphere({ level: Number.NaN }).level, null);
  assert.equal(levelFromMomentTier("WORLD"), "PALACE"); assert.equal(levelFromMomentTier(undefined), null); assert.equal(levelFromMomentTier("??"), null);
  assert.deepEqual(atmosphereFromLegacyMoment({ label: "County Championship", tier: "STANDARD" }), { eventName: "County Championship", presentationTier: "STANDARD" });
  assert.equal(atmosphereFromCalendarEvent({ name: "X", presentation: { tier: "TELEVISED" }, content: { eventClass: "STAGE_SERIES" } }).presentationTier, "TELEVISED");
});

// ---------------------------------------------------------------- spectacle ladder
test("the same moment escalates with level; celebrations, pyro and ticker tape are reserved for the right stages", () => {
  let prev = -1;
  for (const l of ATMOSPHERE_LEVELS) { const s = spectacleFor("VICTORY", l); assert.ok(s.intensity >= prev, `${l} victory is never smaller than a lower level's`); prev = s.intensity; }
  assert.equal(spectacleFor("VICTORY", "CLUB").celebration, "none"); assert.equal(spectacleFor("VICTORY", "COUNTY").celebration, "none");
  assert.equal(spectacleFor("VICTORY", "CLUB").scale, "banner");
  assert.equal(spectacleFor("VICTORY", "PALACE").celebration, "palace-tickertape"); assert.equal(spectacleFor("VICTORY", "PALACE").scale, "full");
  for (const l of ATMOSPHERE_LEVELS) {
    const s = spectacleFor("VICTORY", l);
    assert.equal(s.pyro, l === "MAJOR" || l === "PALACE", `${l} pyro`);
    if (s.celebration === "palace-tickertape") assert.equal(l, "PALACE");
    if (s.celebration === "gold-dense") assert.equal(l, "MAJOR");
  }
  assert.ok(spectacleFor("VICTORY", "PALACE").intensity > spectacleFor("VICTORY", "CLUB").intensity);
  assert.ok(spectacleFor("MATCH_INTRO", "MAJOR", { matchStage: "FINAL" }).intensity > spectacleFor("MATCH_INTRO", "MAJOR", { matchStage: "EARLY" }).intensity);
  assert.equal(spectacleFor("MATCH_INTRO", "CLUB", { matchStage: "FINAL" }).scale, "inline", "a club final is not a stage walk-on");
  assert.equal(spectacleFor("ARRIVAL", null).intensity, 0); assert.equal(spectacleFor("VICTORY", null).celebration, "none");
  for (const m of ["ARRIVAL", "MATCH_INTRO", "QUALIFICATION", "VICTORY", "MILESTONE", "DOCUMENTARY_CHAPTER"] as const)
    for (const l of [...ATMOSPHERE_LEVELS, null]) assert.ok(spectacleFor(m, l).intensity >= 0, `${m} ${l}`);
});

// ---------------------------------------------------------------- components
let vite: ViteDevServer; let mod: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
const M = async () => mod;
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  mod = await vite.ssrLoadModule("/src/features/career/atmosphere/index.ts");
});
after(async () => { await vite?.close(); });
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const ev = (k: string) => fromCatalogue(CATALOGUE.find(d => d.key === k)!);

test("victory variant comes from the event: only the World Championship says World Champion", () => {
  const wc = html(h(mod.CareerMomentScene, { moment: "VICTORY", event: ev("world-darts-championship") }));
  assert.match(wc, /data-victory="WORLD"/); assert.match(wc, /World Champion/); assert.match(wc, /tickertape-palace\.webp/); assert.match(wc, /palace-stage\.webp/);
  const major = html(h(mod.CareerMomentScene, { moment: "VICTORY", event: ev("open-championship") }));
  assert.match(major, /data-victory="MAJOR"/); assert.doesNotMatch(major, /World Champion(?!ship)/); assert.match(major, /confetti-gold\.webp/); assert.match(major, /pyro\.webp/);
  const club = html(h(mod.CareerMomentScene, { moment: "VICTORY", event: ev("friday-night-501") }));
  assert.match(club, /Tournament winner/); assert.doesNotMatch(club, /confetti|pyro|spotlight|Champion/);
  const qual = html(h(mod.CareerMomentScene, { moment: "VICTORY", event: ev("world-championship-qualifier") }));
  assert.match(qual, /data-victory="TOURNAMENT"/); assert.doesNotMatch(qual, /World Champion(?!ship)|palace-stage|tickertape/);
});

test("no fabricated data: scenes print only what they are given", () => {
  const bare = html(h(mod.CareerMomentScene, { moment: "VICTORY", event: {} }));
  assert.doesNotMatch(bare, /<h2/, "no title without real data"); assert.doesNotMatch(bare.replace(/<[^>]+>/g, " "), /\d/, "no numbers without real data");
  const out = html(h(mod.CareerMomentScene, { moment: "MATCH_INTRO", event: ev("open-championship"), headline: "Final", matchStage: "FINAL",
    participants: ["A. Player", "B. Player"], facts: [{ label: "Format", value: "Best of 21 legs" }] }));
  assert.match(out, /A\. Player/); assert.match(out, /Best of 21 legs/); assert.match(out, /The Open Masters/);
  const strip = (s: string) => s.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(strip(out), /\b(won|beat|defeated|£|prize|ranked)\b/i);
  const src = readdirSync(MODULE).filter(f => /\.tsx?$/.test(f)).map(f => readFileSync(path.join(MODULE, f), "utf8")).join("\n");
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/, "deterministic presentation");
});

test("event atmosphere shows recorded venue and level; arrival spectacle differs by level", () => {
  const palace = html(h(mod.CareerEventAtmosphere, { event: ev("world-darts-championship") }));
  assert.match(palace, /Alexandra Grand Hall · The Palace/); assert.match(palace, /data-level="PALACE"/); assert.match(palace, /ca-scale-stage/); assert.match(palace, /light-beams-palace/);
  const club = html(h(mod.CareerEventAtmosphere, { event: ev("friday-night-501") }));
  assert.match(club, /ca-scale-banner/); assert.match(club, /light-lamp/); assert.match(club, /career-venue-club\.jpg/);
  const floor = html(h(mod.CareerEventAtmosphere, { event: ev("pro-circuit-championship") }));
  assert.match(floor, /career-venue-floor\.jpg/); assert.match(floor, /light-floor/);
  const legacy = html(h(mod.CareerEventAtmosphere, { event: { eventName: "Old Event" } }));
  assert.match(legacy, /data-level="NONE"/); assert.doesNotMatch(legacy, /<img/, "no venue art claimed for an unknown event");
});

test("accessibility: art is decorative and behind content; sections are labelled; reduced motion is respected", () => {
  const out = html(h(mod.CareerMomentScene, { moment: "VICTORY", event: ev("open-championship"), headline: "The Open Masters" }));
  assert.match(out, /<section[^>]*aria-label="Major champion: The Open Masters"/);
  assert.match(out, /class="ca-backdrop[^"]*"[^>]*aria-hidden="true"/);
  for (const img of out.match(/<img[^>]*>/g) ?? []) { assert.match(img, /alt=""/); }
  assert.match(out, /<h2 class="ca-title">The Open Masters<\/h2>/);
  assert.match(out, /ca-anim/);
  assert.doesNotMatch(html(h(mod.CareerMomentScene, { moment: "VICTORY", event: ev("open-championship"), animate: false })), /ca-anim/, "Career depth.animate=false stops motion");
  const css = readFileSync(path.join(MODULE, "atmosphere.css"), "utf8");
  assert.match(css, /\.ca-backdrop\{[^}]*pointer-events:none/); assert.match(css, /\.ca-content\{[^}]*z-index:1/);
  const outside = css.replace(/@media \(prefers-reduced-motion:no-preference\)\{[\s\S]*?\n\}/, "");
  assert.doesNotMatch(outside, /animation:/, "every animation is inside prefers-reduced-motion: no-preference");
});

// ---------------------------------------------------------------- assets
test("assets: every referenced file exists, renders are WebP and the payload is budgeted", async () => {
  const { PLATES, LAYERS } = mod;
  const toDisk = (url: string) => url.includes("/images/career-venues/") ? path.join(VENUES, path.basename(url)) : path.join(ATMOS, path.basename(url));
  const files = [...Object.values(PLATES).map((p: any) => p.src), ...Object.values(LAYERS)] as string[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const f of files) assert.ok(existsSync(toDisk(f)), f);
  const reused = new Set(files.filter(f => f.includes("career-venues"))), rendered = new Set(files.filter(f => f.includes("career-atmosphere")));
  assert.equal(reused.size, 14, "14 venue photographs reused in place"); assert.equal(rendered.size, 14, "14 F1 renders");
  const manifest = JSON.parse(readFileSync(path.join(ATMOS, "atmosphere-renders.json"), "utf8"));
  const onDisk = readdirSync(ATMOS).filter(f => f.endsWith(".webp")).sort();
  assert.deepEqual(onDisk, Object.values(manifest.images).map((i: any) => i.file).sort(), "manifest lists exactly the rendered files"); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.deepEqual(onDisk, [...rendered].map(f => path.basename(f)).sort(), "every render is used");
  let total = 0;
  for (const f of onDisk) { const b = readFileSync(path.join(ATMOS, f)); total += b.length;
    assert.equal(b.toString("ascii", 0, 4), "RIFF"); assert.equal(b.toString("ascii", 8, 12), "WEBP");
    assert.ok(b.length < 400_000, `${f} is ${b.length} bytes`); }
  assert.ok(total < 1_400_000, `F1 renders total ${total} bytes`);
  for (const [id, i] of Object.entries(manifest.images) as [string, any][]) // eslint-disable-line @typescript-eslint/no-explicit-any
    assert.ok(["screen", "normal", "plate", "overlay"].includes(i.blend) && i.width >= 512, id);
  assert.ok(statSync(path.join(VENUES, "career-palace-arena.png")).size > 0, "existing venue art left untouched");
});

test("ownership: the atmosphere module is isolated and nothing server-side depends on it", () => {
  for (const f of readdirSync(MODULE).filter(f => /\.tsx?$/.test(f))) {
    const imports = [...readFileSync(path.join(MODULE, f), "utf8").matchAll(/from "([^"]+)"/g)].map(m => m[1]);
    for (const i of imports) assert.ok(i === "react" || i.startsWith("./"), `${f} imports ${i}`);
  }
  const shared = ["identity.tsx", "shell.tsx", "career.css", "index.tsx"].map(f => readFileSync(path.join(ROOT, "src/features/career", f), "utf8"));
  for (const s of shared) assert.doesNotMatch(s, /atmosphere/, "not wired into shared Career files by F1");
});

// ---------------------------------------------------------------- visual evidence (optional)
test("visual evidence scenes", { skip: !process.env.F1_BROWSER_DIR }, () => {
  const OUT = process.env.F1_BROWSER_DIR!; mkdirSync(OUT, { recursive: true });
  const css = readFileSync(path.join(MODULE, "atmosphere.css"), "utf8");
  const page = (title: string, inner: string) => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}
body{margin:0;background:#05070c;color:#e7edf5;font-family:system-ui,sans-serif}.wrap{max-width:1360px;margin:auto;padding:16px;display:grid;gap:18px}
h1{text-transform:uppercase;letter-spacing:.04em;margin:6px 0}.row{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:14px}
.cap{font-size:.75rem;color:#8fa0b8;margin:4px 0 0}button{font:inherit}</style><body><div class="wrap">${inner}</div></body></html>`;
  // Real generated instances (names and venues exactly as a save shows them).
  const season = generateSeason("f1".padEnd(64, "0"), 5, 1);
  const inst = (k: string): AtmosphereInput => { const d = season.find(x => x.definitionKey === k)!, def = CATALOGUE.find(x => x.key === k)!;
    const content = (d.snapshot as { content?: ReturnType<typeof identity> }).content ?? identity(def);
    return atmosphereFromTournament({ name: d.name, definitionKey: k, circuit: d.circuit, classification: d.classification,
      level: importance(d.presentationTier, d.circuit, d.classification), content, venue: venueContent(d.venueKey) }); };
  const keys = ["friday-night-501", "county-championship", "national-amateur-irl", "pro-circuit-championship", "european-dart-series", "open-championship", "world-darts-championship"];
  const events = keys.map(inst);
  for (const e of events) assert.doesNotMatch(e.eventName ?? "", /\{/, "gallery uses generated instance names");
  const gallery = [...events, { eventName: "Legacy save event (no metadata)" }];
  writeFileSync(path.join(OUT, "gallery.html"), page("Atmosphere gallery", `<h1>Career atmosphere · every level</h1>${html(h(mod.AtmosphereGallery, { events: gallery }))}`));
  // Levels side by side: arrival treatment.
  writeFileSync(path.join(OUT, "levels.html"), page("Levels", `<h1>Arrival · seven levels + legacy</h1><div class="row">${gallery.map(e => html(h(mod.CareerEventAtmosphere, { event: e, animate: false }))).join("")}</div>`));
  // Same moment, rising spectacle.
  writeFileSync(path.join(OUT, "victory-ladder.html"), page("Victory ladder", `<h1>Victory · same moment, level-appropriate spectacle</h1><div class="row">${events.map(e =>
    `<div>${html(h(mod.CareerMomentScene, { moment: "VICTORY", event: e, animate: false }))}<p class="cap">${e.eventName} · ${mod.spectacleSummary(spectacleFor("VICTORY", resolveAtmosphere(e).level))}</p></div>`).join("")}</div>`));
  // Full-size premium moments.
  const big = (m: string, k: string, extra: object = {}) => html(h(mod.CareerMomentScene, { moment: m, event: inst(k), animate: false, ...extra }));
  writeFileSync(path.join(OUT, "moments.html"), page("Moments", `<h1>Premium moments</h1>
    ${big("VICTORY", "world-darts-championship")}
    ${big("VICTORY", "open-championship")}
    ${big("MATCH_INTRO", "world-darts-championship", { headline: "Final", matchStage: "FINAL", participants: ["Your player", "Opponent"] })}
    ${big("QUALIFICATION", "world-championship-qualifier", { headline: "Qualified for the World Championship (preview)" })}
    ${big("MILESTONE", "european-dart-series", { headline: "Milestone (preview)" })}
    ${html(h(mod.CareerMomentScene, { moment: "DOCUMENTARY_CHAPTER", event: atmosphereFromLegacyMoment({ label: "Chapter 3 · Big moments (preview)", tier: "MAJOR" }), headline: "Big moments", animate: false }))}
    ${html(h(mod.CareerMomentScene, { moment: "VICTORY", event: { level: 4 }, headline: "Legacy save: level only", animate: false }))}`));
  // Interactive controls above the art.
  writeFileSync(path.join(OUT, "motion.html"), page("Motion", `<h1>Animated (motion allowed)</h1>${html(h(mod.CareerMomentScene, { moment: "VICTORY", event: inst("world-darts-championship") }))}`));
  writeFileSync(path.join(OUT, "controls.html"), page("Controls", `<h1>Controls stay on top</h1>${html(h(mod.CareerMomentScene, { moment: "VICTORY", event: inst("world-darts-championship"), animate: false,
    children: h("button", { id: "continue", type: "button", style: { alignSelf: "flex-start", marginTop: 8, padding: "10px 16px" } }, "Continue") }))}`));
});
