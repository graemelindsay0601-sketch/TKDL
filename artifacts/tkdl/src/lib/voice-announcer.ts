/**
 * Live-scorer voice call-outs — announces scores, busts, and game shots out
 * loud using the browser's built-in text-to-speech (Web Speech API). No
 * camera, no hardware, no new dependencies — every modern browser ships
 * this already. Purely additive: if speechSynthesis isn't available for any
 * reason, every function here is a silent no-op.
 *
 * numberToWords() is pure and covers 0-180 (the maximum possible 3-dart
 * visit), following the way darts callers actually say scores: bare
 * "century" numbers like 140 are said as "one forty" rather than "one
 * hundred and forty", but 100 itself ("one hundred", a ton) and 180 ("one
 * hundred and eighty", the maximum) keep their full traditional call-outs.
 */

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const rest = n % 10;
  return rest === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[rest]}`;
}

export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 180) return String(n);
  if (n === 0) return "no score";
  if (n === 180) return "one hundred and eighty";
  if (n === 100) return "one hundred";
  if (n > 100) return `one ${twoDigitWords(n - 100)}`;
  return twoDigitWords(n);
}

function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

const MUTE_KEY = "tkdl_voice_muted";

export function isVoiceMuted(): boolean {
  try {
    return sessionStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceMuted(muted: boolean): void {
  try {
    if (muted) sessionStorage.setItem(MUTE_KEY, "1");
    else sessionStorage.removeItem(MUTE_KEY);
  } catch {
    // ignore — worst case the toggle doesn't persist across a reload
  }
}

/** Speak `text` immediately, cancelling anything still queued so call-outs never pile up behind a slow visit. Silently does nothing if voice is unavailable or muted. */
export function speak(text: string, opts: { muted?: boolean } = {}): void {
  if (opts.muted ?? isVoiceMuted()) return;
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech is a nice-to-have, never let it break scoring.
  }
}

/** Convenience wrapper for a visit's score — "no score" for a bust/miss, plain words otherwise. */
export function announceScore(score: number, opts: { muted?: boolean } = {}): void {
  speak(numberToWords(score), opts);
}

export function announceBust(opts: { muted?: boolean } = {}): void {
  speak("No score, bust!", opts);
}

export function announceGameShot(playerName: string, opts: { muted?: boolean } = {}): void {
  speak(`Game shot! ${playerName}!`, opts);
}
