import assert from "node:assert/strict";
import { test } from "node:test";
import { CAREER_KIT_DESIGNS } from "../../features/career/kit-catalog.ts";
import { garmentPrintZones, printZonesAreSafe } from "../../features/career/apparel/print-zones.ts";
import { sponsorMarkIdentity } from "../../features/career/apparel/brand-mark-identity.ts";
import { stableNpcKitDesignId } from "../../features/career/apparel/npc-wardrobe.ts";
import { BRANDS } from "../../../../api-server/src/career/content/brands.ts";

test("premium apparel print zones fit the garment and do not collide across every current shirt cut", () => {
  assert.equal(CAREER_KIT_DESIGNS.length, 60);
  for (const kit of CAREER_KIT_DESIGNS) {
    const zones = garmentPrintZones(kit);
    assert.equal(zones.length, 5, kit.id);
    assert.ok(printZonesAreSafe(zones), `${kit.id} has overlapping or out-of-bounds print areas`);
  }
});

test("every authoritative sponsor has a distinct stable identity for vector mark rendering", () => {
  const ids = BRANDS.map(brand => brand.id);
  assert.ok(ids.length > 50);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(BRANDS.every(brand => brand.name.trim().length > 1 && brand.presentation.logoAssetKey === `sponsor-mark:${brand.id}`));
  const signatures = BRANDS.map(brand => {
    const mark = sponsorMarkIdentity(brand.id, brand.name);
    return `${mark.hue}:${mark.emblem}:${mark.monogram}`;
  });
  assert.equal(new Set(signatures).size, BRANDS.length, "brand marks should not collapse to duplicate combinations");
});

test("historical kit IDs and active kit IDs remain addressable", () => {
  assert.deepEqual(CAREER_KIT_DESIGNS.slice(0, 50).map(kit => kit.id), Array.from({ length: 50 }, (_, index) =>
    `kit-50-${String(index + 1).padStart(2, "0")}`));
});

test("NPC kit assignment is stable across catalogue growth and preserves valid saved choices", () => {
  const npc = "career-world-player-1044";
  const assigned = stableNpcKitDesignId(npc);
  assert.equal(stableNpcKitDesignId(npc), assigned);
  assert.equal(stableNpcKitDesignId(npc, "kit-pro-03"), "kit-pro-03");
  assert.equal(stableNpcKitDesignId(npc, "not-a-kit"), assigned);
  assert.ok(CAREER_KIT_DESIGNS.slice(0, 50).some(kit => kit.id === assigned));
});
