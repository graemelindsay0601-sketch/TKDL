import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync } from "node:fs";
import { CAREER_KIT_DESIGNS, isCareerKitAvailable } from "../../features/career/kit-catalog.ts";
import { garmentPrintZones, printZonesAreSafe } from "../../features/career/apparel/print-zones.ts";
import { SPONSOR_LOGO_ASSETS, sponsorMarkIdentity } from "../../features/career/apparel/brand-mark-identity.ts";
import { stableNpcKitDesignId } from "../../features/career/apparel/npc-wardrobe.ts";
import { BRANDS } from "../../../../api-server/src/career/content/brands.ts";

test("premium apparel print zones fit the garment and do not collide across every current shirt cut", () => {
  assert.equal(CAREER_KIT_DESIGNS.length, 250);
  for (const kit of CAREER_KIT_DESIGNS) {
    const zones = garmentPrintZones(kit);
    assert.equal(zones.length, 5, kit.id);
    assert.ok(printZonesAreSafe(zones), `${kit.id} has overlapping or out-of-bounds print areas`);
  }
});

test("the new shirt wave has unique persistent IDs, real image files and explicit maker-range access", () => {
  const wave = CAREER_KIT_DESIGNS.filter(kit => kit.id.startsWith("kit-100-"));
  assert.equal(wave.length, 40);
  assert.equal(new Set(CAREER_KIT_DESIGNS.map(kit => kit.name)).size, CAREER_KIT_DESIGNS.length);
  assert.equal(new Set(wave.map(kit => kit.name)).size, 40);
  assert.ok(wave.every(kit => existsSync(`public/assets/career-kit-library/${kit.image}`)));
  assert.equal(wave.filter(kit => kit.makerBrandId).length, 20);
  assert.ok(wave.filter(kit => kit.makerBrandId).every(kit => SPONSOR_LOGO_ASSETS.has(kit.makerBrandId!)));
  const licensed = wave.find(kit => kit.makerBrandId)!;
  assert.ok(licensed);
  assert.equal(isCareerKitAvailable(licensed, []), false);
  assert.equal(isCareerKitAvailable(licensed, [licensed.makerBrandId!]), true);
  assert.equal(isCareerKitAvailable(licensed, [], licensed.id), true);
});

test("the expanded premium range has 150 complete original artwork assets and searchable, unique names", () => {
  const wave = CAREER_KIT_DESIGNS.filter(kit => kit.id.startsWith("kit-250-"));
  assert.equal(wave.length, 150);
  assert.equal(new Set(wave.map(kit => kit.name)).size, 150);
  assert.ok(wave.every(kit => existsSync(`public/assets/career-kit-library/${kit.image}`)));
  assert.deepEqual(wave[0].number, "101");
  assert.deepEqual(wave.at(-1)?.number, "250");
  assert.ok(wave.every(kit => kit.cut.trim().length >= 10 && kit.detail.trim().length >= 30));
});

test("every authoritative sponsor maps to a bespoke, unique vector identity", () => {
  const ids = BRANDS.map(brand => brand.id);
  assert.equal(ids.length, 52);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(SPONSOR_LOGO_ASSETS.size, ids.length);
  assert.ok(BRANDS.every(brand => brand.name.trim().length > 1 &&
    brand.presentation.logoAssetKey === `sponsor-mark:${brand.id}` &&
    SPONSOR_LOGO_ASSETS.get(brand.id)?.name === brand.name));
  const signatures = BRANDS.map(brand => {
    const mark = sponsorMarkIdentity(brand.id, brand.name);
    assert.ok(mark, `missing sponsor mark: ${brand.id}`);
    assert.equal(mark.sector, brand.sector);
    return `${mark.symbol}:${mark.primary}:${mark.accent}`;
  });
  assert.equal(new Set(signatures).size, BRANDS.length, "each sponsor must have a distinct art-directed mark");
  assert.ok(BRANDS.every(brand => sponsorMarkIdentity(undefined, brand.name)?.id === brand.id),
    "existing name-only Career sponsor records must resolve to the same stable mark");
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
