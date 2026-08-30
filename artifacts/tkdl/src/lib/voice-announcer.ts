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
 *
 * Browser quirks this file works around (found while debugging a report of
 * "the caller toggle is on but I hear nothing"):
 *  - Voices load asynchronously. `getVoices()` can return an empty array on
 *    the very first call in some browsers, populated only once the
 *    `voiceschanged` event fires later. speak() no longer needs a voice to
 *    be loaded to work (the engine falls back to its own default), but the
 *    voice *picker* UI needs to react to that event to show any choices.
 *  - Chrome has a long-standing bug where a `SpeechSynthesisUtterance` that
 *    isn't kept alive by a live reference can get garbage-collected before
 *    it finishes speaking, which silently kills the audio. `speak()` keeps
 *    one in a module-level variable for exactly this reason.
 *  - Calling `cancel()` unconditionally right before every `speak()` can
 *    drop the new utterance entirely in some browsers if there was nothing
 *    queued to cancel. `speak()` now only cancels when the engine reports
 *    it's actually speaking or has something pending.
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

/** General 0-999 number-to-words, used for "X remaining" call-outs (starting scores can be 501/701/1001+, well past the 180 a single visit can score). Falls back to the plain digits outside that range rather than throwing. */
function remainingToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) return String(n);
  if (n === 0) return "zero";
  if (n < 100) return twoDigitWords(n);
  if (n > 999) return String(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredsPart = `${ONES[hundreds]} hundred`;
  return rest === 0 ? hundredsPart : `${hundredsPart} and ${twoDigitWords(rest)}`;
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

// ── Caller voice selection ───────────────────────────────────────────────
// The browser's default TTS voice tends to sound flat/robotic. Most devices
// actually ship several installed voices (different accents, "natural"
// higher-quality ones, etc) — speechSynthesis just defaults to whichever one
// the OS picks first. We let the player pick from whatever the device
// actually has, and remember it (per-device — voice lists don't transfer
// between machines, so this deliberately lives in localStorage, not a
// server setting).

const VOICE_KEY = "tkdl_voice_uri";

export function getSelectedVoiceURI(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

export function setSelectedVoiceURI(voiceURI: string | null): void {
  try {
    if (voiceURI) localStorage.setItem(VOICE_KEY, voiceURI);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    // ignore — worst case the picker resets to default next visit
  }
}

/** Every voice the browser currently knows about. Can legitimately be empty right after page load — call again once `voiceschanged` fires (see `onVoicesChanged` below). English voices are sorted first since that's who's calling most darts matches, but nothing is filtered out. */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return [];
  try {
    const voices = window.speechSynthesis.getVoices();
    return [...voices].sort((a, b) => {
      const aEn = a.lang.toLowerCase().startsWith("en") ? 0 : 1;
      const bEn = b.lang.toLowerCase().startsWith("en") ? 0 : 1;
      if (aEn !== bEn) return aEn - bEn;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

/** Subscribe to the browser loading its voice list asynchronously. Returns an unsubscribe function. Fires the callback once immediately too, in case voices are already loaded. */
export function onVoicesChanged(cb: () => void): () => void {
  cb();
  if (!speechAvailable() || !("onvoiceschanged" in window.speechSynthesis)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb);
}

function resolveVoice(): SpeechSynthesisVoice | null {
  const uri = getSelectedVoiceURI();
  if (!uri) return null;
  const match = getAvailableVoices().find(v => v.voiceURI === uri);
  return match ?? null;
}

// Chrome (and some other browsers) can silently drop an utterance if the
// SpeechSynthesisUtterance object gets garbage-collected before it's done
// speaking — keeping a live reference here works around that.
let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Speak `text` immediately. Cancels anything still in-flight first (so call-outs never pile up behind a slow visit), but only when there's actually something to cancel — cancelling unconditionally can drop the very next utterance in some browsers. Silently does nothing if voice is unavailable or muted. */
export function speak(text: string, opts: { muted?: boolean } = {}): void {
  if (opts.muted ?? isVoiceMuted()) return;
  if (!speechAvailable()) return;
  try {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    utterance.volume = 1;
    const voice = resolveVoice();
    if (voice) utterance.voice = voice;
    currentUtterance = utterance;
    utterance.onend = () => { if (currentUtterance === utterance) currentUtterance = null; };
    utterance.onerror = () => { if (currentUtterance === utterance) currentUtterance = null; };
    synth.speak(utterance);
  } catch {
    // Speech is a nice-to-have, never let it break scoring.
  }
}

/** Convenience wrapper for a visit's score — "no score" for a bust/miss, plain words otherwise. Pass `remaining` (the score left after this visit) to have it read out too, caller-style — e.g. "Sixty. Four hundred and forty-one remaining." Omit or pass 0 (a checkout) to skip it, since announceGameShot covers that case instead. */
export function announceScore(score: number, remaining?: number, opts: { muted?: boolean } = {}): void {
  const scoreText = numberToWords(score);
  if (remaining !== undefined && remaining > 0) {
    speak(`${scoreText}. ${remainingToWords(remaining)} remaining`, opts);
  } else {
    speak(scoreText, opts);
  }
}

export function announceBust(opts: { muted?: boolean } = {}): void {
  speak("No score, bust!", opts);
}

export function announceGameShot(playerName: string, opts: { muted?: boolean } = {}): void {
  speak(`Game shot! ${playerName}!`, opts);
}
