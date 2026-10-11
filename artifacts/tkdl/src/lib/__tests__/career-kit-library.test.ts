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

test("Career kit library preserves the original 60 shirts and adds 40 distinct premium artworks", async () => {
  assert.equal(CAREER_KIT_DESIGNS.length, 100);
  assert.deepEqual(CAREER_KIT_DESIGNS.slice(0, 50).map(design => design.id),
    Array.from({ length: 50 }, (_, index) => `kit-50-${String(index + 1).padStart(2, "0")}`));
  assert.equal(CAREER_KIT_DESIGNS.slice(50, 60).filter(design => design.id.startsWith("kit-pro-")).length, 10);
  assert.equal(CAREER_KIT_DESIGNS.slice(60).filter(design => design.id.startsWith("kit-100-")).length, 40);
  assert.equal(new Set(CAREER_KIT_DESIGNS.map(design => design.id)).size, 100);

  const hashes = new Set<string>();
  for (const [index, design] of CAREER_KIT_DESIGNS.entries()) {
    const bytes = await readFile(new URL(`../../../public/assets/career-kit-library/${design.image}`, import.meta.url));
    assert.ok(bytes.byteLength > (index < 50 ? 10_000 : 500), `${design.image} should contain full shirt artwork`);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, 100, "every catalog item should use its own artwork file");
});

test("Career kit filters cover five complete collections and find cuts by name", () => {
  assert.deepEqual(CAREER_KIT_COLLECTIONS, ["Precision", "Rivalry", "Heritage", "Energy", "After Dark"]);
  for (const collection of CAREER_KIT_COLLECTIONS) {
    assert.ok(filterCareerKitDesigns(collection, "").length >= 10, `${collection} collection`);
  }
  assert.deepEqual(filterCareerKitDesigns("All shirts", "quarter-zip").map(item => item.name), ["Nightshift", "Afterburn", "Copper Circuit", "Signal Point"]);
  assert.equal(filterCareerKitDesigns("All shirts", "not-a-real-cut").length, 0);
});

test("Career kit tint controls offer eight distinct named colours", () => {
  assert.equal(CAREER_KIT_COLORWAYS.length, 8);
  assert.equal(new Set(CAREER_KIT_COLORWAYS.map(colourway => colourway.primary)).size, 8);
});
