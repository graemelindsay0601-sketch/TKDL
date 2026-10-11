/**
 * NPC and legacy shirt compatibility in the combined release candidate:
 * - one NPC wears the same shirt on every screen (rankings, directory, tournament, profile),
 *   whatever partner list that screen passes and however their stature changes;
 * - a player save without a premium kit ID keeps its original template shirt.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";

const ROOT = path.resolve(import.meta.dirname, "../../..");
let vite: ViteDevServer; let I: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  I = await vite.ssrLoadModule("/src/features/career/identity.tsx");
});
after(async () => { await vite?.close(); });

const kitOf = (html: string) => html.match(/career-kit-library\/(?:thumb\/)?([a-z0-9-]+)\.(?:webp|svg)/)?.[1] ?? null;
const shirt = (props: Record<string, unknown>) => renderToStaticMarkup(h(I.CareerShirt, { name: "NPC", ...props }));
const npcPalette = { shirtTemplate: "SPLIT", primaryColour: "#253C36", secondaryColour: "#ECDFBD", accentColour: "#90C8AB" };

test("an NPC's shirt is the same whatever partner list a screen passes (rankings, directory, tournament)", () => {
  for (const id of ["career-world-player-1044", "career-world-player-7", "a1b2c3d4-0000-4000-8000-000000000001"]) {
    const rankings = kitOf(shirt({ playerId: id, identity: npcPalette, sponsors: [], scale: "compact" }));
    const directory = kitOf(shirt({ playerId: id, identity: npcPalette, scale: "compact",
      sponsors: [{ brandId: "blackforge-darts", brandName: "Blackforge Darts", slot: "EQUIPMENT_PARTNER" }, { brandId: "vela-sport", brandName: "Vela Sport", slot: "APPAREL_PARTNER" }] }));
    const tournament = kitOf(shirt({ playerId: id, identity: npcPalette, scale: "featured",
      sponsors: [{ brandId: "apex-arrow", brandName: "Apex Arrow", slot: "EQUIPMENT_PARTNER" }] }));
    assert.ok(rankings, `${id} renders a premium kit`);
    assert.equal(directory, rankings, `${id}: directory matches rankings`);
    assert.equal(tournament, rankings, `${id}: tournament matches rankings`);
  }
});

test("an NPC's stature-driven partner changes never re-dress them, and no maker shirt is implied", async () => {
  const { CAREER_KIT_BY_ID } = await vite.ssrLoadModule("/src/features/career/kit-catalog.ts");
  const id = "career-world-player-2201";
  const amateur = kitOf(shirt({ playerId: id, sponsors: [] }));
  const professional = kitOf(shirt({ playerId: id, sponsors: [{ brandId: "northline-darts", brandName: "Northline Darts", slot: "EQUIPMENT_PARTNER" }] }));
  assert.equal(professional, amateur);
  assert.equal(CAREER_KIT_BY_ID.get(amateur!)?.makerBrandId, undefined, "assigned NPC kits are never maker-range shirts");
});

test("every Career screen that draws an NPC shirt passes the NPC id to the shared resolver", () => {
  const read = (f: string) => readFileSync(path.join(ROOT, "src/features/career", f), "utf8");
  assert.match(read("pages/rankings.tsx"), /CareerShirt playerId=\{r\.participantKey==="HUMAN"\?undefined:r\.participantKey\}/);
  assert.match(read("pages/world-hub.tsx"), /CareerPlayerCard playerId=\{p\.id\}/);
  assert.match(read("pages/tournament.tsx"), /CareerShirt playerId=\{p\.key === "HUMAN" \? undefined : p\.key\}/);
  assert.equal((read("tournament/components.tsx").match(/CareerShirt playerId=\{p\.key === "HUMAN" \? undefined : p\.key\}/g) ?? []).length, 2);
  assert.match(read("pages/player-profile.tsx"), /CareerShirt playerId=\{player\.id\}/);
});

test("a player save without a premium kit ID wears the premium shirt for its template; a saved premium kit is used as saved", () => {
  const legacy = shirt({ identity: { shirtTemplate: "CHEVRON", primaryColour: "#20334A", secondaryColour: "#FFFFFF", accentColour: "#C8A050" },
    sponsors: [{ brandId: "blackforge-darts", brandName: "Blackforge Darts", slot: "EQUIPMENT_PARTNER" }] });
  assert.equal(kitOf(legacy), "kit-50-49", "older saves show premium artwork, never the flat vector shirt");
  assert.equal(kitOf(shirt({ identity: {} })), "kit-50-01");
  const saved = shirt({ identity: { kitDesignId: "kit-250-151" } });
  assert.equal(kitOf(saved), "kit-250-151");
  // A saved NPC kit (if one is ever persisted) wins over the generated wardrobe.
  assert.equal(kitOf(shirt({ playerId: "career-world-player-1044", identity: { kitDesignId: "kit-pro-03" } })), "kit-pro-03");
});
