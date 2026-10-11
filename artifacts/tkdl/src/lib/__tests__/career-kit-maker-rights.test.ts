import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { CAREER_KIT_BY_ID, CAREER_KIT_DESIGNS, isCareerKitAvailable } from "../../features/career/kit-catalog.ts";
import { eligibleKitMakerIds, placementBrandId } from "../../features/career/apparel/brand-mark-identity.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");

test("Kit Room maker rights use the placement's stable brandId, with a name fallback only for legacy payloads", () => {
  // A negotiated or renamed display name must not change who owns the rights.
  assert.equal(placementBrandId({ brandId: "blackforge-darts", brandName: "Blackforge Darts International" }), "blackforge-darts");
  assert.equal(placementBrandId({ brandId: "vela-sport", brandName: "Blackforge Darts" }), "vela-sport", "the ID wins over a conflicting name");
  assert.equal(placementBrandId({ brandName: "Vela Sport" }), "vela-sport", "older payloads without brandId still resolve");
  assert.equal(placementBrandId({ brandName: "Unknown Local Café" }), null);
  assert.deepEqual(eligibleKitMakerIds([{ brandId: "apex-arrow", brandName: "Apex" }, { brandId: "apex-arrow", brandName: "Apex Arrow" }, { brandName: "Nobody" }]), ["apex-arrow"]);
});

test("Kit Room wiring passes the authoritative IDs, not names, to the customizer", () => {
  const world = readFileSync(path.join(ROOT, "src/features/career/pages/world.tsx"), "utf8");
  assert.match(world, /eligibleMakerBrandIds=\{eligibleKitMakerIds\(data\.placements\)\}/);
  assert.doesNotMatch(world, /sponsorMarkIdentity\(undefined,\s*partner\.brandName\)/);
});

test("client maker ranges equal the server's signing authority", () => {
  const server = readFileSync(path.join(ROOT, "../api-server/src/career/content/service.ts"), "utf8");
  const block = server.slice(server.indexOf("makerBrandByKitId"), server.indexOf("};", server.indexOf("makerBrandByKitId")));
  const serverMap = Object.fromEntries([...block.matchAll(/"(kit-[^"]+)":"([^"]+)"/g)].map(m => [m[1], m[2]]));
  const clientMap = Object.fromEntries(CAREER_KIT_DESIGNS.filter(k => k.makerBrandId).map(k => [k.id, k.makerBrandId]));
  assert.ok(Object.keys(clientMap).length > 0);
  assert.deepEqual(clientMap, serverMap);
});

test("contract expiry locks the maker range but keeps the player's saved shirt", () => {
  const saved = CAREER_KIT_BY_ID.get("kit-250-151")!, sibling = CAREER_KIT_BY_ID.get("kit-250-152")!;
  assert.equal(saved.makerBrandId, "blackforge-darts");
  assert.equal(isCareerKitAvailable(saved, ["blackforge-darts"]), true);
  assert.equal(isCareerKitAvailable(saved, [], saved.id), true, "retained after expiry");
  assert.equal(isCareerKitAvailable(sibling, [], saved.id), false, "the rest of the range locks again");
});
