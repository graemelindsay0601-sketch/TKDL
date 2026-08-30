import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { numberToWords, speak, isVoiceMuted } from "../voice-announcer.ts";

describe("numberToWords", () => {
  test("zero is called out as a bust, not literally 'zero'", () => {
    assert.equal(numberToWords(0), "no score");
  });

  test("small numbers under twenty", () => {
    assert.equal(numberToWords(1), "one");
    assert.equal(numberToWords(7), "seven");
    assert.equal(numberToWords(19), "nineteen");
  });

  test("round tens have no trailing hyphen", () => {
    assert.equal(numberToWords(20), "twenty");
    assert.equal(numberToWords(60), "sixty");
    assert.equal(numberToWords(90), "ninety");
  });

  test("non-round two-digit numbers are hyphenated", () => {
    assert.equal(numberToWords(26), "twenty-six");
    assert.equal(numberToWords(45), "forty-five");
    assert.equal(numberToWords(99), "ninety-nine");
  });

  test("100 is 'one hundred' (a ton), not 'one zero'", () => {
    assert.equal(numberToWords(100), "one hundred");
  });

  test("101-179 drop 'hundred and' the way real callers say them", () => {
    assert.equal(numberToWords(101), "one one");
    assert.equal(numberToWords(140), "one forty");
    assert.equal(numberToWords(126), "one twenty-six");
    assert.equal(numberToWords(179), "one seventy-nine");
  });

  test("180 keeps the full traditional call", () => {
    assert.equal(numberToWords(180), "one hundred and eighty");
  });

  test("out-of-range or non-integer input falls back to the plain number rather than throwing", () => {
    assert.equal(numberToWords(181), "181");
    assert.equal(numberToWords(-1), "-1");
    assert.equal(numberToWords(3.5), "3.5");
  });
});

describe("voice functions are silent no-ops outside a browser", () => {
  test("speak() does not throw when window/speechSynthesis don't exist", () => {
    assert.doesNotThrow(() => speak("test"));
  });

  test("isVoiceMuted() defaults to false when sessionStorage isn't available", () => {
    assert.equal(isVoiceMuted(), false);
  });
});
