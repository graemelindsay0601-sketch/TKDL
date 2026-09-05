// TKDL LIVE — pure parts of the broadcast settings resolver (handover doc
// section 16.1). Split out of config.ts for the same reason story-engine-
// math.ts is split from story-engine.ts and title-predictor-math.ts from
// title-predictor.ts: this file has zero `@workspace/db` imports (not even
// its `/schema` subpath — see story-engine-math.ts's own header for exactly
// why that specific import breaks `node --test`'s direct module resolution),
// so it stays directly unit-testable the same way every other pure file in
// this folder is. config.ts layers the actual settingsTable read/write on
// top of the types and validation logic defined here.
import {
  PROGRAMME_PACING_RULES,
  type OrdinaryProgrammeMode,
  type ProgrammeContentBeat,
  type ProgrammePacingRule,
} from "./director-math.ts";

export const BROADCAST_SETTING_KEYS = [
  "broadcast_midday_time",
  "broadcast_evening_time",
  "broadcast_night_time",
  "broadcast_timezone",
  "broadcast_change_threshold",
  "broadcast_simulation_count",
  "broadcast_live_poll_seconds",
  "broadcast_banter_level",
  "broadcast_commentary_version",
  "broadcast_programme_version",
  "broadcast_single_daily_episode",
  "broadcast_news_profile",
  "broadcast_balanced_profile",
  "broadcast_magazine_profile",
] as const;
export type BroadcastSettingKey = (typeof BROADCAST_SETTING_KEYS)[number];

/** Every default value exactly as listed in section 16.1's own table. */
export const BROADCAST_SETTING_DEFAULTS: Record<BroadcastSettingKey, string> = {
  broadcast_midday_time: "11:30",
  broadcast_evening_time: "19:00",
  broadcast_night_time: "00:00",
  broadcast_timezone: "Europe/London",
  broadcast_change_threshold: "30",
  broadcast_simulation_count: "2500",
  broadcast_live_poll_seconds: "30",
  broadcast_banter_level: "1",
  broadcast_commentary_version: "1",
  broadcast_programme_version: "1",
  // Direct response to player feedback ("even if we do one new episode a
  // day... not just a constant same episode loop"): defaults ON, so the day
  // reads as one appointment episode (the "night" wrap-up slot, using
  // broadcast_night_time as its fire time) rather than three similar-
  // looking midday/evening/night refreshes. "0" restores the legacy
  // three-slot-a-day cadence for anyone who wants it back.
  broadcast_single_daily_episode: "1",
  broadcast_news_profile: JSON.stringify(PROGRAMME_PACING_RULES.NEWS),
  broadcast_balanced_profile: JSON.stringify(PROGRAMME_PACING_RULES.BALANCED),
  broadcast_magazine_profile: JSON.stringify(PROGRAMME_PACING_RULES.MAGAZINE),
};

export type BroadcastConfig = {
  /** "HH:MM", validated but intentionally left as a string — edition-slots.ts is what interprets it against a specific calendar day/timezone. */
  middayTime: string;
  eveningTime: string;
  nightTime: string;
  /** An IANA zone name (e.g. "Europe/London") — passed straight to Intl.DateTimeFormat by edition-slots.ts, never parsed here. */
  timezone: string;
  /** 10.1: generate a new Edition when the Edition Change Score reaches this at a slot check. */
  changeThreshold: number;
  /** 8.2: Title Predictor Monte Carlo run count. */
  simulationCount: number;
  /** 14.4/15.4: how often the frontend polls GET /api/broadcast/live. */
  livePollSeconds: number;
  /** 12.7's "banter level" knob — 0 currently reads as a lighter/quieter tone and 2 a livelier one, with 1 ("balanced") as the doc's own named default; the exact tone difference between levels is the Commentary Engine's (12.7's) concern, not this file's. */
  banterLevel: number;
  /** 12.5: part of the seeded-PRNG key, so bumping this deliberately re-shuffles phrase selection without changing any code. */
  commentaryVersion: number;
  /** 14.4's channel.programmeVersion — bumping this signals a running-order/template change to clients, independent of commentaryVersion. */
  programmeVersion: number;
  /** When true (the default), the day has exactly one guaranteed episode (the "night" slot, fired at nightTime) instead of three separate midday/evening/night slots — see edition-slots.ts's own resolveLogicalSlot/resolveNextLogicalSlot for how this collapses slot resolution down to a single daily instant. */
  singleDailyEpisode: boolean;
  programmeProfiles: Record<OrdinaryProgrammeMode, ProgrammePacingRule>;
};

function warnAndFallback(key: BroadcastSettingKey, raw: string, reason: string): string {
  console.warn(`broadcast/config: setting "${key}" has an invalid stored value "${raw}" (${reason}) — using the default "${BROADCAST_SETTING_DEFAULTS[key]}" instead`);
  return BROADCAST_SETTING_DEFAULTS[key];
}

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PROFILE_KEYS = {
  broadcast_news_profile: "NEWS",
  broadcast_balanced_profile: "BALANCED",
  broadcast_magazine_profile: "MAGAZINE",
} as const satisfies Partial<Record<BroadcastSettingKey, OrdinaryProgrammeMode>>;
const CONTENT_BEATS = new Set<ProgrammeContentBeat>(["news", "analysis", "feature"]);
const MAX_STORY_RUNTIME_SECONDS = 6 * 9;
const MAX_HEADLINE_RUNTIME_SECONDS = 3 * 9;
const MAX_UTILITY_RUNTIME_SECONDS = 3 * 2 * 9;

export function parseProgrammeProfile(raw: string): ProgrammePacingRule | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const runtime = value?.estimatedRuntimeSeconds as Record<string, unknown> | undefined;
    const mix = value?.contentMix;
    if (!Number.isInteger(value?.maxHeadlineTeases) || (value.maxHeadlineTeases as number) < 0 || (value.maxHeadlineTeases as number) > 5) return null;
    if (!Number.isInteger(value?.maxStorySegments) || (value.maxStorySegments as number) < 4 || (value.maxStorySegments as number) > 7) return null;
    if ((value.maxHeadlineTeases as number) > (value.maxStorySegments as number)) return null;
    if (!runtime || !Number.isInteger(runtime.min) || !Number.isInteger(runtime.max)
      || (runtime.min as number) < 60 || (runtime.max as number) > 900 || (runtime.max as number) - (runtime.min as number) < 30) return null;
    const maximumAchievableRuntime = (value.maxStorySegments as number) * MAX_STORY_RUNTIME_SECONDS
      + (value.maxHeadlineTeases as number) * MAX_HEADLINE_RUNTIME_SECONDS
      + MAX_UTILITY_RUNTIME_SECONDS;
    if ((runtime.min as number) > maximumAchievableRuntime) return null;
    if (!Array.isArray(mix) || mix.length !== value.maxStorySegments || !mix.every(beat => CONTENT_BEATS.has(beat as ProgrammeContentBeat))) return null;
    return {
      maxHeadlineTeases: value.maxHeadlineTeases as number,
      maxStorySegments: value.maxStorySegments as number,
      estimatedRuntimeSeconds: { min: runtime.min as number, max: runtime.max as number },
      contentMix: mix as ProgrammeContentBeat[],
    };
  } catch {
    return null;
  }
}

function resolveProgrammeProfile(key: keyof typeof PROFILE_KEYS, raw: string): ProgrammePacingRule {
  return parseProgrammeProfile(raw)
    ?? parseProgrammeProfile(warnAndFallback(key, raw, "not a valid programme profile"))!;
}

export function parseHHMM(key: BroadcastSettingKey, raw: string): string {
  if (!HHMM_PATTERN.test(raw)) return warnAndFallback(key, raw, "not a valid 24-hour HH:MM time");
  return raw;
}

/** `min` defaults to 1 (most of these settings are counts/thresholds that make no sense at 0); banterLevel is the one caller that passes 0, since a "quietest" tone level is a legitimate setting. */
export function parseSettingInt(key: BroadcastSettingKey, raw: string, min = 1): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) {
    return Number(warnAndFallback(key, raw, `expected an integer >= ${min}`));
  }
  return n;
}

/**
 * A STRICT counterpart to parseHHMM/parseSettingInt, for PATCH
 * /api/admin/broadcast/settings (14.2): those two exist for the tolerant
 * read path (getBroadcastConfig), where an already-bad stored value should
 * warn-and-fall-back rather than ever fail a whole Edition build — but an
 * admin actively submitting a new value should get an immediate, honest
 * rejection instead of having it silently replaced by a default it never
 * asked for. Returns null when `raw` is valid for `key`, or a human-
 * readable reason string when it isn't.
 */
export function validateBroadcastSettingValue(key: BroadcastSettingKey, raw: string): string | null {
  if (key in PROFILE_KEYS) {
    return parseProgrammeProfile(raw)
      ? null
      : "must be a profile with 0-5 headline teases (no more than its story count), 4-7 story segments, an achievable 60-900 second runtime band at least 30 seconds wide, and one valid content-mix beat per story segment";
  }
  if (key === "broadcast_midday_time" || key === "broadcast_evening_time" || key === "broadcast_night_time") {
    return HHMM_PATTERN.test(raw) ? null : "must be a 24-hour HH:MM time (e.g. \"19:00\")";
  }
  if (key === "broadcast_timezone") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: raw });
      return null;
    } catch {
      return "must be a valid IANA timezone name (e.g. \"Europe/London\")";
    }
  }
  if (key === "broadcast_single_daily_episode") {
    return raw === "0" || raw === "1" ? null : "must be \"0\" or \"1\"";
  }
  const min = key === "broadcast_banter_level" ? 0 : 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) return `must be an integer >= ${min}`;
  return null;
}

/** Turns a raw {key -> stored value} lookup into the fully typed, validated BroadcastConfig — shared by config.ts's real DB read and by tests that want to exercise this without a database. */
export function resolveBroadcastConfig(raw: (key: BroadcastSettingKey) => string): BroadcastConfig {
  return {
    middayTime: parseHHMM("broadcast_midday_time", raw("broadcast_midday_time")),
    eveningTime: parseHHMM("broadcast_evening_time", raw("broadcast_evening_time")),
    nightTime: parseHHMM("broadcast_night_time", raw("broadcast_night_time")),
    timezone: raw("broadcast_timezone") || BROADCAST_SETTING_DEFAULTS.broadcast_timezone,
    changeThreshold: parseSettingInt("broadcast_change_threshold", raw("broadcast_change_threshold")),
    simulationCount: parseSettingInt("broadcast_simulation_count", raw("broadcast_simulation_count")),
    livePollSeconds: parseSettingInt("broadcast_live_poll_seconds", raw("broadcast_live_poll_seconds")),
    banterLevel: parseSettingInt("broadcast_banter_level", raw("broadcast_banter_level"), 0),
    commentaryVersion: parseSettingInt("broadcast_commentary_version", raw("broadcast_commentary_version")),
    programmeVersion: parseSettingInt("broadcast_programme_version", raw("broadcast_programme_version")),
    singleDailyEpisode: raw("broadcast_single_daily_episode") !== "0",
    programmeProfiles: {
      NEWS: resolveProgrammeProfile("broadcast_news_profile", raw("broadcast_news_profile")),
      BALANCED: resolveProgrammeProfile("broadcast_balanced_profile", raw("broadcast_balanced_profile")),
      MAGAZINE: resolveProgrammeProfile("broadcast_magazine_profile", raw("broadcast_magazine_profile")),
    },
  };
}
