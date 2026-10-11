/**
 * Shirt collection standard: every one of the 250 kits is a full photographic garment
 * (transparent WebP, no clip-art placeholders) and the premium artwork is the default look —
 * a colour wash only when the player explicitly chose a colourway.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { statSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import { CAREER_KIT_DESIGNS } from "../../features/career/kit-catalog.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
let vite: ViteDevServer; let S: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  S = await vite.ssrLoadModule("/src/features/career/apparel/premium-shirt.tsx");
});
after(async () => { await vite?.close(); });

test("all 250 kits keep their IDs and are full raster garments (no clip-art placeholders)", () => {
  assert.equal(CAREER_KIT_DESIGNS.length, 250);
  assert.equal(new Set(CAREER_KIT_DESIGNS.map(k => k.id)).size, 250);
  for (const k of CAREER_KIT_DESIGNS) {
    assert.match(k.image, /\.webp$/, `${k.id} is a raster garment`);
    const bytes = statSync(path.join(ROOT, "public/assets/career-kit-library", k.image)).size;
    assert.ok(bytes > 20_000, `${k.id}: ${bytes} bytes is not a production garment render`);
    assert.ok(statSync(path.join(ROOT, "public/assets/career-kit-library/thumb", k.image)).size > 2_000, `${k.id} has a small-size rendition`);
  }
  assert.deepEqual(CAREER_KIT_DESIGNS.filter(k => k.id.startsWith("kit-pro-")).map(k => k.image),
    Array.from({ length: 10 }, (_, i) => `kit-pro-${String(i + 1).padStart(2, "0")}.webp`));
});

test("premium artwork is the default; only an explicit colourway tints the fabric", () => {
  const render = (identity: Record<string, unknown>) => renderToStaticMarkup(h(S.PremiumCareerShirt, { identity: { kitDesignId: "kit-50-07", ...identity }, name: "P" }));
  // every save carries a template colour and NPC palettes have one: neither may wash the artwork
  assert.doesNotMatch(render({ primaryColour: "#20334A" }), /career-premium-shirt__tint/);
  assert.doesNotMatch(render({ primaryColour: "#20334A", kitTintEnabled: false }), /career-premium-shirt__tint/);
  assert.match(render({ primaryColour: "#a92c43", kitTintEnabled: true }), /career-premium-shirt__tint/);
});

test("small shirts load the 256px rendition; featured and profile views keep the full artwork", () => {
  const src = (scale: string) => renderToStaticMarkup(h(S.PremiumCareerShirt, { identity: { kitDesignId: "kit-50-07" }, name: "P", scale })).match(/src="([^"]+)"/)?.[1];
  assert.match(src("compact")!, /career-kit-library\/thumb\/kit-50-07\.webp$/);
  assert.match(src("standard")!, /career-kit-library\/thumb\/kit-50-07\.webp$/);
  assert.match(src("featured")!, /career-kit-library\/kit-50-07\.webp$/);
});
