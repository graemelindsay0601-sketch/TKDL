import { test } from "node:test";
import assert from "node:assert/strict";
import { composeDob } from "../../features/career/dob.ts";

test("date of birth dropdowns: a full date only once day, month and year are all chosen", () => {
  assert.equal(composeDob("", "4", "1990"), "");
  assert.equal(composeDob("7", "", "1990"), "");
  assert.equal(composeDob("7", "4", ""), "");
  assert.equal(composeDob("7", "4", "1990"), "1990-04-07");
});

test("date of birth dropdowns: a day past the end of the month is clamped (leap years too)", () => {
  assert.equal(composeDob("31", "4", "1990"), "1990-04-30");
  assert.equal(composeDob("30", "2", "1999"), "1999-02-28");
  assert.equal(composeDob("29", "2", "2000"), "2000-02-29");
});
