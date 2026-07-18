import { test } from "node:test";
import assert from "node:assert/strict";
import { getBoardMarkMagnitude, clampX01RemainingAfterReduction } from "../boardMarkRewards";

test("bull pays more than treble/double, which pays more than a number bed (X01 hot)", () => {
  const numberMag = getBoardMarkMagnitude("number", "X01", "hot");
  const trebleMag = getBoardMarkMagnitude("treble", "X01", "hot");
  const bullMag = getBoardMarkMagnitude("bull", "X01", "hot");
  assert.ok(numberMag < trebleMag, "number bed should pay less than treble");
  assert.ok(trebleMag < bullMag, "treble should pay less than bull");
});

test("bull pays more than treble/double, which pays more than a number bed (Cricket trap)", () => {
  const numberMag = getBoardMarkMagnitude("number", "CRICKET", "trap");
  const doubleMag = getBoardMarkMagnitude("double", "CRICKET", "trap");
  const bullMag = getBoardMarkMagnitude("bull", "CRICKET", "trap");
  assert.ok(numberMag < doubleMag);
  assert.ok(doubleMag < bullMag);
});

test("treble and double pay the same (equally hard to hit precisely)", () => {
  assert.equal(getBoardMarkMagnitude("treble", "X01", "hot"), getBoardMarkMagnitude("double", "X01", "hot"));
  assert.equal(getBoardMarkMagnitude("treble", "CRICKET", "trap"), getBoardMarkMagnitude("double", "CRICKET", "trap"));
});

test("all magnitudes are positive — sign is applied by the caller, not this table", () => {
  for (const engine of ["X01", "CRICKET"] as const) {
    for (const kind of ["hot", "trap"] as const) {
      for (const target of ["number", "treble", "double", "bull"] as const) {
        assert.ok(getBoardMarkMagnitude(target, engine, kind) > 0);
      }
    }
  }
});

test("X01 magnitudes are larger than Cricket magnitudes for the same target/kind (different scoring scales)", () => {
  assert.ok(getBoardMarkMagnitude("bull", "X01", "hot") > getBoardMarkMagnitude("bull", "CRICKET", "hot"));
});

test("clampX01RemainingAfterReduction bumps 0 and 1 to 2 (both are unreachable finish states)", () => {
  assert.equal(clampX01RemainingAfterReduction(0), 2);
  assert.equal(clampX01RemainingAfterReduction(1), 2);
});

test("clampX01RemainingAfterReduction leaves every other value untouched", () => {
  for (const v of [2, 3, 4, 5, 10, 40, 100, 170, 501]) {
    assert.equal(clampX01RemainingAfterReduction(v), v);
  }
});
