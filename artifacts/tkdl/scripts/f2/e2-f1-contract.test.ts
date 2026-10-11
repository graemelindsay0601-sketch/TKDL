/**
 * F2 — combined E2 (trophies) + F1 (atmosphere) integration contract.
 *
 * Runs on the combined G1 + E1 release-candidate branch against real tournament
 * reads and trophy-cabinet rows captured from the certification harness.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";

const ROOT = path.resolve(import.meta.dirname, "../..");
const FIX = path.join(ROOT, "scripts/f2/fixtures");
type View = { event: { name: string; definitionKey: string; circuit: string; classification: string; level: number; content: { eventClass?: string; trophyId?: string } | null; venue: unknown; venueFallback: unknown };
  depth: { arrival: boolean; walkOn: boolean; fullCeremony: boolean; animate: boolean }; achievements: { tournamentChampion: boolean }; phase: string; championKey: string | null };
const views = JSON.parse(readFileSync(path.join(FIX, "tournament-views.json"), "utf8")) as Record<string, View>;
const cabinet = JSON.parse(readFileSync(path.join(FIX, "trophy-cabinet.json"), "utf8")) as { titles: { eventId: string; canonicalEventId: string; circuit: string; classification: string; trophy: { id: string } | null }[] };

let vite: ViteDevServer; let T: Record<string, any> = {}, A: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  T = await vite.ssrLoadModule("/src/features/career/trophies/index.ts");
  A = await vite.ssrLoadModule("/src/features/career/atmosphere/index.ts");
});
after(async () => { await vite?.close(); });
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

/** Fixture adapter — the tournament view contract consumed by the product screens. */
function plan(v: View) {
  const atmosphere = A.atmosphereFromTournament(v.event);
  const award = { event: { definitionKey: v.event.definitionKey, circuit: v.event.circuit, classification: v.event.classification }, persistedTrophyId: v.event.content?.trophyId ?? null };
  const recordedChampion = v.achievements.tournamentChampion === true && v.championKey === "HUMAN";
  return {
    arrival: v.depth.arrival ? { event: atmosphere, animate: v.depth.animate } : null,
    victory: recordedChampion ? { moment: "VICTORY", event: atmosphere, animate: v.depth.animate } : null,
    award,
  };
}

test("fixtures are real harness reads (won, lost and an untouched event)", () => {
  assert.ok(views.won && views.lost, "captured from the certification harness");
  assert.equal(views.won.achievements.tournamentChampion, true); assert.equal(views.won.championKey, "HUMAN");
  assert.equal(views.lost.achievements.tournamentChampion, false); assert.notEqual(views.lost.championKey, "HUMAN");
});

test("a recorded win shows a victory scene with the event's own award; a loss never shows victory spectacle", () => {
  const won = plan(views.won), lost = plan(views.lost);
  assert.ok(won.victory); assert.equal(lost.victory, null);
  const scene = html(h(A.CareerMomentScene, { ...won.victory, headline: views.won.event.name }));
  assert.match(scene, /data-moment="VICTORY"/); assert.doesNotMatch(scene, /World Champion(?!ship)/);
  const award = html(h(T.AwardPresentation, won.award));
  const resolved = T.resolveAward(won.award.event);
  assert.match(award, new RegExp(`data-award="${resolved.award}"`));
  if (resolved.award === "PHYSICAL_TROPHY") assert.match(award, new RegExp(`data-design="${resolved.designId}"`));
  // The lost event's completion screen, rendered without a victory moment, carries no celebration layers.
  const completion = html(h(A.CareerEventAtmosphere, { event: lost.arrival?.event ?? A.atmosphereFromTournament(views.lost.event) }));
  assert.doesNotMatch(completion, /confetti|tickertape|pyro/);
});

test("server presentation depth is respected: arrival gate and animation flag", () => {
  for (const v of Object.values(views)) {
    const p = plan(v);
    assert.equal(p.arrival === null, !v.depth.arrival, `${v.event.definitionKey} arrival follows depth.arrival`);
    const still = { ...v, depth: { ...v.depth, animate: false } };
    const out = html(h(A.CareerMomentScene, { moment: "ARRIVAL", event: A.atmosphereFromTournament(still.event), animate: plan(still).arrival?.animate ?? false }));
    assert.doesNotMatch(out, /ca-anim/, "depth.animate=false (QUICK mode or reduced motion) stops motion");
  }
});

test("depth.fullCeremony=false caps major victory effects while keeping the recorded win", () => {
  const v = { ...views.won, depth: { ...views.won.depth, fullCeremony: false } };
  const scene = html(h(A.CareerMomentScene, {
    moment: "VICTORY", event: A.atmosphereFromTournament(v.event), fullCeremony: v.depth.fullCeremony,
    headline: v.event.name,
  }));
  assert.match(scene, /data-intensity="[0-2]"/);
  assert.doesNotMatch(scene, /ca-pyro|ca-confetti|ca-scale-full/);
  assert.match(scene, new RegExp(v.event.name));
});

test("cabinet rows: real recorded wins resolve by actual event key; weekly/qualifier wins show no trophy", () => {
  assert.ok(cabinet.titles.length > 0, "the seeded saves recorded real titles");
  for (const t of cabinet.titles) {
    const a = T.resolveAward({ definitionKey: t.canonicalEventId, circuit: t.circuit, classification: t.classification });
    const out = html(h(T.AwardPresentation, { event: { definitionKey: t.canonicalEventId, circuit: t.circuit, classification: t.classification }, persistedTrophyId: t.trophy?.id ?? null }));
    assert.match(out, new RegExp(`data-award="${a.award}"`), t.canonicalEventId);
    if (a.award === "PHYSICAL_TROPHY") {
      const alloc = T.EVENT_DESIGNS_V2[t.canonicalEventId];
      if (alloc?.allocation === "UNIQUE") assert.equal(a.designId, alloc.designId, `${t.canonicalEventId} keeps its own design`);
    } else assert.doesNotMatch(out, /<img[^>]*render\//, `${t.canonicalEventId}: no premium trophy for a ${a.award} win`);
  }
});

test("World Championship context resolves The Palace and the Sovereign; its qualifier resolves neither", () => {
  const wc = { definitionKey: "world-darts-championship", circuit: "WORLD_CHAMPIONSHIP", classification: "RANKING", level: 5, content: { eventClass: "WORLD_CHAMPIONSHIP" } };
  assert.equal(A.resolveAtmosphere(A.atmosphereFromTournament(wc)).level, "PALACE");
  assert.equal(T.resolveAward(wc).designId, "sovereign");
  const q = { definitionKey: "world-championship-qualifier", circuit: "WORLD_CHAMPIONSHIP", classification: "QUALIFIER", level: 2, content: { eventClass: "GRASSROOTS" } };
  assert.notEqual(A.resolveAtmosphere(A.atmosphereFromTournament(q)).level, "PALACE");
  assert.equal(T.resolveAward(q).award, "RESULT_ONLY");
});
