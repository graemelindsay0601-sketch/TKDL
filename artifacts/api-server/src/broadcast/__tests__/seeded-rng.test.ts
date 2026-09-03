/**
 * Tests for seeded-rng.ts — the deterministic hash/PRNG the Director
 * (section 10-11) and Commentary Engine (section 12.5) both need for
 * "same Edition, same result for every viewer."
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hashStringToSeed, mulberry32, seededRng, pickFrom, shuffle } from "../seeded-rng.ts";

describe("hashStringToSeed", () => {
  test("is deterministic for the same input", () => {
    assert.equal(hashStringToSeed("hello"), hashStringToSeed("hello"));
  });

  test("different inputs produce different hashes (no trivial collisions)", () => {
    const inputs = ["hello", "hellp", "Hello", "2026-09-02:evening", "2026-09-02:night", "singles:1", "singles:2"];
    const hashes = new Set(inputs.map(hashStringToSeed));
    assert.equal(hashes.size, inputs.length);
  });

  test("always returns a non-negative 32-bit integer", () => {
    for (const s of ["", "a", "a very long string ".repeat(50), "🎯 darts"]) {
      const h = hashStringToSeed(s);
      assert.ok(Number.isInteger(h));
      assert.ok(h >= 0 && h <= 0xffffffff);
    }
  });

  test("empty string hashes to a stable, defined value", () => {
    assert.equal(hashStringToSeed(""), hashStringToSeed(""));
  });
});

describe("mulberry32", () => {
  test("same seed produces the exact same sequence", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    assert.deepEqual(seqA, seqB);
  });

  test("different seeds produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    assert.notDeepEqual(seqA, seqB);
  });

  test("every output is within [0, 1)", () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 5000; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1, `value ${v} out of [0,1)`);
    }
  });

  test("does not repeat the same value every call (not a degenerate constant generator)", () => {
    const rng = mulberry32(42);
    const values = new Set(Array.from({ length: 50 }, () => rng()));
    assert.ok(values.size > 40, "expected mostly-distinct values from 50 draws");
  });

  test("rough uniformity: many draws split roughly evenly above/below 0.5", () => {
    const rng = mulberry32(7);
    let below = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (rng() < 0.5) below++;
    const ratio = below / n;
    assert.ok(ratio > 0.45 && ratio < 0.55, `expected ~50% below 0.5, got ${ratio}`);
  });
});

describe("seededRng (the actual API every caller uses)", () => {
  test("same composite key -> identical sequence, every time", () => {
    const a = seededRng("2026-09-02:evening", "singles:WIN_STREAK:subjects:singles:7", 1);
    const b = seededRng("2026-09-02:evening", "singles:WIN_STREAK:subjects:singles:7", 1);
    assert.deepEqual(Array.from({ length: 10 }, () => a()), Array.from({ length: 10 }, () => b()));
  });

  test("a different slotKey changes the sequence — different Editions aren't accidentally in lockstep", () => {
    const a = seededRng("2026-09-02:evening", "storyKeyX", 1);
    const b = seededRng("2026-09-03:evening", "storyKeyX", 1);
    assert.notEqual(a(), b());
  });

  test("a different storyKey changes the sequence — two stories in the same Edition don't pick in lockstep", () => {
    const a = seededRng("2026-09-02:evening", "storyKeyX", 1);
    const b = seededRng("2026-09-02:evening", "storyKeyY", 1);
    assert.notEqual(a(), b());
  });

  test("a different commentaryVersion changes the sequence — bumping the version re-shuffles selection deliberately", () => {
    const a = seededRng("2026-09-02:evening", "storyKeyX", 1);
    const b = seededRng("2026-09-02:evening", "storyKeyX", 2);
    assert.notEqual(a(), b());
  });

  test("numeric and string parts join unambiguously (no part-boundary collision) for realistic keys", () => {
    const a = seededRng("slot", "key", 1);
    const b = seededRng("slot", "key", 10);
    assert.notEqual(a(), b());
  });
});

describe("pickFrom", () => {
  test("throws on an empty array", () => {
    assert.throws(() => pickFrom([], () => 0.5));
  });

  test("returns the only element of a singleton array regardless of rng value", () => {
    assert.equal(pickFrom(["only"], () => 0), "only");
    assert.equal(pickFrom(["only"], () => 0.999999), "only");
  });

  test("rng()=0 picks the first element, rng() just under 1 picks the last", () => {
    const items = ["a", "b", "c", "d"];
    assert.equal(pickFrom(items, () => 0), "a");
    assert.equal(pickFrom(items, () => 0.999999), "d");
  });

  test("never returns out-of-bounds even at the rng()=1 edge (defensive clamp)", () => {
    const items = ["a", "b", "c"];
    assert.equal(pickFrom(items, () => 1), "c");
  });

  test("a real seeded rng distributes picks across all options over many draws", () => {
    const rng = seededRng("distribution-check");
    const items = ["a", "b", "c", "d", "e"];
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(pickFrom(items, rng));
    assert.equal(seen.size, items.length);
  });
});

describe("shuffle", () => {
  test("never mutates the input array", () => {
    const items = ["a", "b", "c", "d"];
    const original = [...items];
    shuffle(items, seededRng("mutation-check"));
    assert.deepEqual(items, original);
  });

  test("returns a permutation — same elements, same length, nothing added or dropped", () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items, seededRng("permutation-check"));
    assert.equal(result.length, items.length);
    assert.deepEqual([...result].sort((a, b) => a - b), items);
  });

  test("same seed produces the exact same shuffle every time", () => {
    const items = ["a", "b", "c", "d", "e"];
    const a = shuffle(items, seededRng("stable-key"));
    const b = shuffle(items, seededRng("stable-key"));
    assert.deepEqual(a, b);
  });

  test("a different seed generally produces a different order over a large enough array", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const a = shuffle(items, seededRng("seed-a"));
    const b = shuffle(items, seededRng("seed-b"));
    assert.notDeepEqual(a, b);
  });

  test("an empty array shuffles to an empty array", () => {
    assert.deepEqual(shuffle([], seededRng("empty-check")), []);
  });

  test("a single-element array is unaffected", () => {
    assert.deepEqual(shuffle(["only"], seededRng("single-check")), ["only"]);
  });

  test("over many distinct seeds, a 3-element array visits more than one ordering (not a degenerate no-op)", () => {
    const items = ["x", "y", "z"];
    const orderings = new Set<string>();
    for (let i = 0; i < 50; i++) orderings.add(shuffle(items, seededRng("many-seeds", i)).join(","));
    assert.ok(orderings.size > 1, "expected more than one distinct ordering across 50 seeds");
  });
});
