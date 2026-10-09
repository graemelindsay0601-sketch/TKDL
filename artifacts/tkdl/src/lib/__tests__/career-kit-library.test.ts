import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  CAREER_KIT_COLORWAYS,
  CAREER_KIT_COLLECTIONS,
  CAREER_KIT_DESIGNS,
  filterCareerKitDesigns,
} from "../../features/career/kit-catalog.ts";

test("Career kit library contains 50 individually named, distinct shirt assets", async () => {
  assert.equal(CAREER_KIT_DESIGNS.length, 50);
  assert.equal(new Set(CAREER_KIT_DESIGNS.map(design => design.id)).size, 50);

  const hashes = new Set<string>();
  for (const [index, design] of CAREER_KIT_DESIGNS.entries()) {
    assert.equal(design.id, `kit-50-${String(index + 1).padStart(2, "0")}`);
    const bytes = await readFile(new URL(`../../../public/assets/career-kit-library/${design.image}`, import.meta.url));
    assert.ok(bytes.byteLength > 10_000, `${design.image} should contain full shirt artwork`);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, 50, "every catalog item should use its own artwork file");
});

test("Career kit filters cover five complete collections and find cuts by name", () => {
  assert.deepEqual(CAREER_KIT_COLLECTIONS, ["Precision", "Rivalry", "Heritage", "Energy", "After Dark"]);
  for (const collection of CAREER_KIT_COLLECTIONS) {
    assert.equal(filterCareerKitDesigns(collection, "").length, 10, `${collection} collection`);
  }
  assert.deepEqual(filterCareerKitDesigns("All shirts", "quarter-zip").map(item => item.name), ["Nightshift", "Afterburn", "Copper Circuit"]);
  assert.equal(filterCareerKitDesigns("All shirts", "not-a-real-cut").length, 0);
});

test("Career kit tint controls offer eight distinct named colours", () => {
  assert.equal(CAREER_KIT_COLORWAYS.length, 8);
  assert.equal(new Set(CAREER_KIT_COLORWAYS.map(colourway => colourway.primary)).size, 8);
});
